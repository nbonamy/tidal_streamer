const crypto = require('crypto')

// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const LOGIN_URL = 'https://login.tidal.com'
// Updated scopes for new Tidal OAuth API
const SCOPE = 'user.read collection.read search.read playlists.read entitlements.read playback recommendations.read'

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

  async exchange_code(code, state, port) {
    // Verify state matches (CSRF protection)
    if (state !== this._state) {
      throw new Error('State mismatch - possible CSRF attack')
    }

    // Exchange authorization code for tokens
    const response = await fetch(`${AUTH_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this._settings.app.client_id,
        code: code,
        redirect_uri: `http://localhost:${port}/callback`,
        code_verifier: this._codeVerifier
      })
    })

    const auth = await response.json()

    // Check for errors
    if (!response.ok || auth.error) {
      throw new Error(auth.error_description || auth.error || `Token exchange failed: ${response.status}`)
    }

    // Verify we got the tokens
    if (!auth.access_token || !auth.refresh_token) {
      throw new Error('Token response missing access_token or refresh_token')
    }

    // Fetch user info (new OAuth doesn't include it in token response)
    try {
      const userInfo = await this._fetchUserInfo(auth.access_token)
      auth.user = userInfo
    } catch (e) {
      // User info fetch failed, but auth succeeded - continue without user info
      console.log(`Warning: Could not fetch user info: ${e.message}`)
    }

    // Save auth data
    this._save_auth(auth)

    return auth
  }

  async _fetchUserInfo(accessToken) {
    // Fetch user info from Tidal API
    const response = await fetch('https://api.tidal.com/v1/sessions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`)
    }

    const data = await response.json()

    // Map response to expected user format
    return {
      userId: data.userId,
      username: data.username || data.email,
      countryCode: data.countryCode,
      email: data.email
    }
  }


  async refresh_token() {

    // get it
    let response = await fetch(`${AUTH_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this._settings.auth.refresh_token
      })
    })

    // parse
    let auth = await response.json()
    if (auth.access_token) {
      // Note: New API doesn't return a new refresh_token, keep existing one
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
