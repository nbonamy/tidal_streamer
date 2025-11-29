const crypto = require('crypto')
const express = require('express')
const { json_status } = require('./utils')

// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const LOGIN_URL = 'https://login.tidal.com'

// Scopes for different auth flows
const SCOPES = {
  // Device flow uses legacy scopes (required for r_usr access)
  device: 'r_usr w_usr w_sub',
  // Authorization code flow uses new scopes
  authorization_code: 'user.read collection.read search.read playlists.read entitlements.read playback recommendations.read'
}

// Grant type for device flow
const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'

// we need fetch
if (typeof fetch == 'undefined') {
  fetch = require('node-fetch')
}

// https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization

module.exports = class {

  constructor(settings) {
    this._settings = settings
    // Determine auth method from settings (default to device for legacy compatibility)
    this._authMethod = settings.auth_method || 'device'
    // OAuth callback promise - used to coordinate auth flow
    this._authResolver = null
    this._authPromise = new Promise((resolve, reject) => {
      this._authResolver = { resolve, reject }
    })
    // Track auth flows in progress
    this._authFlows = new Map()
    // Cleanup expired flows every minute
    this._cleanupInterval = setInterval(() => this._cleanupExpiredFlows(), 60000)
  }

  routes() {

    const router = express.Router()

    // OAuth callback route - handles redirect from Tidal
    router.get('/callback', async (req, res) => {
      const { code, state, error, error_description } = req.query

      if (error) {
        this._authResolver.reject(new Error(error_description || error))

        // Update flow status
        const flow = Array.from(this._authFlows.values()).find(f => f.state === state)
        if (flow) {
          flow.status = 'failed'
          flow.error = error_description || error
        }

        res.send('<h1>Authorization Failed</h1><p>Check the console for details. You can close this window.</p>')
      } else {
        this._authResolver.resolve({ code, state })

        // Try to exchange code and update flow
        try {
          const auth = await this.exchangeCode(code, state, req.app.get('port'))
          const flow = Array.from(this._authFlows.values()).find(f => f.state === state)
          if (flow && auth.user) {
            flow.status = 'completed'
            flow.user = {
              id: auth.user.userId,
              login: auth.user.username,
              fullName: auth.user.fullName,
              email: auth.user.email,
              country: auth.user.countryCode
            }
          }
        } catch (e) {
          const flow = Array.from(this._authFlows.values()).find(f => f.state === state)
          if (flow) {
            flow.status = 'failed'
            flow.error = e.message
          }
        }

        res.send('<h1>Authorization Successful!</h1><p>You can close this window and return to the terminal.</p>')
      }
    })

    // List all authenticated users
    router.get('/auth/users', (req, res) => {
      const users = (this._settings.users || []).map(u => ({
        id: u.user.id,
        login: u.user.login,
        fullName: u.user.fullName,
        email: u.user.email,
        country: u.user.country
      }))
      json_status(res, null, users)
    })

    // Check auth flow status
    router.get('/auth/status/:flowId', (req, res) => {
      const flowId = req.params.flowId
      const flow = this._authFlows.get(flowId)

      if (!flow) {
        return res.status(404).json({
          status: 'error',
          error: 'Flow not found'
        })
      }

      // Check if expired
      if (flow.status === 'pending' && Date.now() > flow.expiresAt) {
        flow.status = 'failed'
        flow.error = 'Authorization expired'
      }

      // Build response
      const response = {
        status: flow.status
      }

      if (flow.status === 'completed' && flow.user) {
        response.user = flow.user
      } else if (flow.status === 'failed' && flow.error) {
        response.error = flow.error
      }

      json_status(res, null, response)

      // Clean up completed or failed flows after retrieval
      if (flow.status !== 'pending') {
        this._authFlows.delete(flowId)
      }
    })

    // Start auth flow for new user
    router.post('/auth/user', async (req, res) => {
      try {
        const authMethod = this.getAuthMethod()
        const flowId = crypto.randomBytes(16).toString('hex')

        if (authMethod === 'device') {
          // Device flow - start and immediately begin polling in background
          const device = await this.startDeviceAuthorization()

          // Store flow
          this._authFlows.set(flowId, {
            id: flowId,
            method: 'device',
            status: 'pending',
            userCode: device.userCode,
            createdAt: Date.now(),
            expiresAt: Date.now() + device.expiresIn * 1000
          })

          // Start polling in background (don't await)
          this.pollDeviceAuthorization(device.deviceCode, device.interval, device.expiresIn)
            .then(user => {
              console.log(`\nAuthorization successful! ${user.username} authorized.`)
              const flow = this._authFlows.get(flowId)
              if (flow) {
                flow.status = 'completed'
                flow.user = {
                  id: user.userId,
                  login: user.username,
                  fullName: user.fullName,
                  email: user.email,
                  country: user.countryCode
                }
              }
            })
            .catch(err => {
              console.error(`Device authorization failed: ${err.message}`)
              const flow = this._authFlows.get(flowId)
              if (flow) {
                flow.status = 'failed'
                flow.error = err.message
              }
            })

          json_status(res, null, {
            flowId: flowId,
            method: 'device',
            verificationUri: device.verificationUri,
            userCode: device.userCode,
            expiresIn: device.expiresIn
          })
        } else {
          // Authorization code flow
          const { authUrl, state } = await this.startAuthorization(req.app.get('port'))

          // Store flow
          this._authFlows.set(flowId, {
            id: flowId,
            method: 'authorization_code',
            status: 'pending',
            state: state,
            createdAt: Date.now(),
            expiresAt: Date.now() + 300000 // 5 minutes
          })

          json_status(res, null, {
            flowId: flowId,
            method: 'authorization_code',
            authUrl: authUrl
          })
        }
      } catch (err) {
        json_status(res, err)
      }
    })

    return router

  }

  getAuthPromise() {
    return this._authPromise
  }

  getAuthMethod() {
    return this._authMethod
  }

  isAuth(userAuth = null) {

    return new Promise(async (resolve, reject) => {

      // get user auth (default to first user for backward compat)
      const user = userAuth || this._settings.getUser()

      // we need info
      if (!user?.access_token || !user?.refresh_token) {
        resolve(false)
        return
      }

      // check expiration date
      if (Date.now() < user.expires) {
        resolve(true)
        return
      }

      // we need to refesh
      let refreshed = await this.refreshToken(user)
      resolve(refreshed)

    })

  }

  async startAuthorization(port) {

    // Generate PKCE values
    this._codeVerifier = this._generateCodeVerifier()
    const codeChallenge = this._generateCodeChallenge(this._codeVerifier)

    // Generate state for CSRF protection
    this._state = crypto.randomBytes(16).toString('base64url')

    // Use custom scopes if specified in config, otherwise use default for auth method
    const scopes = this._settings.scopes || SCOPES.authorization_code

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this._settings.app.client_id,
      redirect_uri: `http://localhost:${port}/callback`,
      scope: scopes,
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

  async exchangeCode(code, state, port) {
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
    this._saveAuth(auth)

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
      fullName: data.fullName || data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : data.username || data.email,
      countryCode: data.countryCode,
      email: data.email
    }
  }

  // Device Authorization Flow Methods

  async startDeviceAuthorization() {
    // Initiate device authorization
    const response = await fetch(`${AUTH_BASE_URL}/device_authorization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this._settings.app.client_id,
        scope: SCOPES.device
      })
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      throw new Error(data.error_description || data.error || `Device authorization failed: ${response.status}`)
    }

    // Response contains: verificationUriComplete, deviceCode, userCode, expiresIn, interval
    return {
      verificationUri: data.verificationUriComplete,
      deviceCode: data.deviceCode,
      userCode: data.userCode,
      expiresIn: data.expiresIn,
      interval: data.interval || 5  // Poll interval in seconds
    }
  }

  async pollDeviceAuthorization(deviceCode, interval, expiresIn) {
    const expires = Date.now() + expiresIn * 1000
    const pollInterval = interval * 1000

    while (true) {
      // Check expiration
      if (Date.now() > expires) {
        throw new Error('Device authorization expired')
      }

      // Poll for token
      const response = await fetch(`${AUTH_BASE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this._settings.app.client_id,
          client_secret: this._settings.app.client_secret,
          device_code: deviceCode,
          grant_type: DEVICE_GRANT_TYPE,
          scope: SCOPES.device
        })
      })

      const auth = await response.json()

      // Check if authorized
      if (auth.access_token && auth.refresh_token) {
        // Save auth data (device flow includes user info in response)
        this._saveAuth(auth)
        return auth.user
      }

      // Check for errors
      if (auth.error) {
        if (auth.error === 'authorization_pending') {
          // User hasn't authorized yet, continue polling
          await new Promise(r => setTimeout(r, pollInterval))
          continue
        } else {
          throw new Error(auth.error_description || auth.error)
        }
      }

      // Wait before next poll
      await new Promise(r => setTimeout(r, pollInterval))
    }
  }


  async refreshToken(userAuth = null) {

    // get user auth (default to first user for backward compat)
    const user = userAuth || this._settings.getUser()
    if (!user) {
      console.error('No user found for token refresh')
      return false
    }

    // get it
    let response = await fetch(`${AUTH_BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this._settings.app.client_id,
        refresh_token: user.refresh_token
      })
    })

    // parse
    let auth = await response.json()

    // Check for errors
    if (!response.ok || auth.error) {
      console.error(`Token refresh failed: ${auth.error_description || auth.error || response.status}`)
      return false
    }

    if (auth.access_token) {
      // Note: New API doesn't return a new refresh_token, keep existing one
      auth.refresh_token = user.refresh_token
      this._saveAuth(auth, user)
      return true
    }

    // too bad
    return false

  }

  _saveAuth(auth, userAuth = null) {

    // get existing user auth or create new
    const existingUser = userAuth || (this._settings.users && this._settings.users[0])

    // update user auth
    const updatedUserAuth = {
      user: {
        id: auth.user.userId ?? existingUser?.user.id,
        login: auth.user.username ?? existingUser?.user.login,
        fullName: auth.user.fullName ?? existingUser?.user.fullName,
        country: auth.user.countryCode ?? existingUser?.user.country,
        email: auth.user.email ?? existingUser?.user.email  ,
      },
      access_token: auth.access_token,
      refresh_token: auth.refresh_token || existingUser?.refresh_token,
      expires: Date.now() + auth.expires_in * 1000
    }

    // add or update user in settings
    this._settings.addOrUpdateUser(updatedUserAuth)

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

  _cleanupExpiredFlows() {
    const now = Date.now()
    for (const [flowId, flow] of this._authFlows.entries()) {
      if (now > flow.expiresAt) {
        this._authFlows.delete(flowId)
      }
    }
  }

}
