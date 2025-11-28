const crypto = require('crypto')

// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const LOGIN_URL = 'https://login.tidal.com'
const SCOPE = 'r_usr w_usr w_sub'

// we need fetch
if (typeof fetch == 'undefined') {
  fetch = require('node-fetch')
}

// https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization

module.exports = class {

  constructor(settings) {
    this._settings = settings
  }

  is_auth() {

    return new Promise(async (resolve, reject) => {

      // we need info
      if (this._settings?.auth?.access_token == null || this._settings?.auth?.refresh_token == null) {
        resolve(false)
        return
      }

      // check expiration date
      if (Date.now() < this._settings.auth.expires) {
        resolve(true)
        return
      }

      // we need to refesh
      let refreshed = await this.refresh_token()
      resolve(refreshed)

    })

  }

  async start_authorization(port) {
    // Generate PKCE values
    this._codeVerifier = this._generateCodeVerifier()
    const codeChallenge = this._generateCodeChallenge(this._codeVerifier)

    // Generate state for CSRF protection
    this._state = crypto.randomBytes(16).toString('base64url')

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this._settings.app.client_id,
      redirect_uri: `http://localhost:${port}/callback`,
      scope: SCOPE,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state: this._state
    })

    const authUrl = `${LOGIN_URL}/authorize?${params.toString()}`

    return {
      authUrl,
      state: this._state,
      codeVerifier: this._codeVerifier
    }
  }

  check_link(link) {

    const expires = Date.now() + link.expiresIn * 1000

    return new Promise(async (resolve, reject) => {

      while (true) {

        // check expiration
        if (Date.now() > expires) {
          reject('Link expired')
          return
        }

        // get it
        let response = await fetch(`${AUTH_BASE_URL}/token`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${this._b64_creds()}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
          },
          body: `client_id=${this._settings.app.client_id}&client_secret=${this._settings.app.client_secret}&device_code=${link.deviceCode}&grant_type=${GRANT_TYPE}&scope=${SCOPE}`
        })
        let auth = await response.json()
        if (auth.user && auth.access_token && auth.refresh_token) {
          this._save_auth(auth)
          resolve(auth.user)
        }

        // pause
        await new Promise(r => setTimeout(r, link.interval * 1000));

      }
    
    })

  }

  async refresh_token() {

    // get it
    let response = await fetch(`${AUTH_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this._b64_creds()}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: `grant_type=client_credentials&refresh_token=${this._settings.auth.refresh_token}`
    })

    // parse
    let auth = await response.json()
    if (auth.access_token) {
      auth.refresh_token = this._settings.auth.refresh_token
      this._save_auth(auth)
      return true
    }

    // too bad
    return false

  }

  _save_auth(auth) {

    // update settings
    this._settings.auth = {
      user: auth.user ? {
        id: auth.user.userId,
        login: auth.user.username,
        country: auth.user.countryCode,
        email: auth.user.email,
      } : this._settings.auth?.user,
      access_token: auth.access_token,
      refresh_token: auth.refresh_token || this._settings.auth.refresh_token,
      expires: Date.now() + auth.expires_in * 1000
    }

    // save
    this._settings.save()

  }

  _b64_creds() {
    return Buffer.from(`${this._settings.app.client_id}:${this._settings.app.client_secret}`).toString('base64')
  }

  _generateCodeVerifier() {
    // Generate 43-128 character random string (base64url encoded)
    const buffer = crypto.randomBytes(32)
    return buffer.toString('base64url')
  }

  _generateCodeChallenge(verifier) {
    // S256: BASE64URL(SHA256(ASCII(code_verifier)))
    const hash = crypto.createHash('sha256').update(verifier).digest()
    return hash.toString('base64url')
  }

}
