
// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'
const SCOPE = 'r_usr w_usr w_sub'

// we need fetch
if (typeof fetch == 'undefined') {
  fetch = require('node-fetch')
}

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

  async get_link() {
    let response = await fetch(`${AUTH_BASE_URL}/device_authorization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: `client_id=${this._settings.app.client_id}&scope=${SCOPE}`
    })
    return response.json()
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
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: `client_id=${this._settings.app.client_id}&client_secret=${this._settings.app.client_secret}&grant_type=refresh_token&refresh_token=${this._settings.auth.refresh_token}`
    })

    // parse
    let auth = await response.json()
    if (auth.user && auth.access_token) {
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
      user: {
        id: auth.user.userId,
        login: auth.user.username,
        country: auth.user.countryCode,
        email: auth.user.email,
      },
      access_token: auth.access_token,
      refresh_token: auth.refresh_token,
      expires: Date.now() + auth.expires_in * 1000
    }

    // save
    this._settings.save()

  }

}
