
const Auth = require('./auth')

// https://tidalapi.netlify.app

// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const API_V1_BASE_URL = 'https://api.tidal.com/v1'
const API_V2_BASE_URL = 'https://listen.tidal.com/v2'
const QUEUE_BASE_URL = 'https://connectqueue.tidal.com/v1'
const CACHE_EXPIRES = 1 * 60 * 60 * 1000

// api limits
const COUNTRY_CODE = 'US'
const LIMIT = 100
const LIMIT_QUEUE_CONTENT = 50

// when requesting pages
const PAGE_DEVICE_TYPE = 'BROWSER'
const PAGE_PLATFORM = 'WEB'
const PAGE_LOCALE = 'en_US'
const PAGE_LIMIT = 50

// we need fetch
if (typeof fetch == 'undefined') {
  fetch = require('node-fetch')
}

const FORM = {
  stringify: (dict) => {
    return Object.keys(dict).map(key => {
      return encodeURIComponent(key) + '=' + encodeURIComponent(dict[key]);
    }).join('&');
  }
}

// global cache
const cache = {}

module.exports = class {

  constructor(settings, userAuth = null) {
    this._settings = settings
    this._userAuth = userAuth || settings.getUser()
    this._countryCode = settings.countryCode || COUNTRY_CODE
    this._refreshPromise = null // shared promise for token refresh
  }

  getApiBaseUrl() {
    return API_V1_BASE_URL
  }

  getQueueBaseUrl() {
    return QUEUE_BASE_URL
  }

  getUserId() {
    return this._userAuth.user.id
  }

  async fetchUserArtists() {
    return await this._fetchAll(`/users/${this.getUserId()}/favorites/artists`)
  }

  async fetchUserAlbums() {
    return await this._fetchAll(`/users/${this.getUserId()}/favorites/albums`)
  }

  async fetchUserPlaylists() {
    return await this._fetchAll(`/users/${this.getUserId()}/playlists`)
  }

  async fetchUserTracks() {
    return await this._fetchAll(`/users/${this.getUserId()}/favorites/tracks`)
  }

  async isTrackFavorite(trackId) {
    // Fetch favorites and check if track is in the list
    const favorites = await this.fetchUserTracks()
    return favorites?.items?.some(item => item.item?.id == trackId) || false
  }

  async toggleTrackFavorite(trackId) {
    const isFavorite = await this.isTrackFavorite(trackId)
    if (isFavorite) {
      await this.removeTrackFavorite(trackId)
      return { favorite: false }
    } else {
      await this.addTrackFavorite(trackId)
      return { favorite: true }
    }
  }

  _clearFavoritesCache() {
    const userId = this._userAuth?.user?.id || 'default'
    for (const key of Object.keys(cache)) {
      if (key.startsWith(`${userId}:`) && key.includes('/favorites/tracks')) {
        delete cache[key]
      }
    }
  }

  async addTrackFavorite(trackId) {
    const url = this._getUrl(API_V1_BASE_URL, `/users/${this.getUserId()}/favorites/tracks`, {})
    const response = await fetch(url, this._getFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `trackIds=${trackId}`
    }))
    this._clearFavoritesCache()
    return { success: response.ok, status: response.status }
  }

  async removeTrackFavorite(trackId) {
    const url = this._getUrl(API_V1_BASE_URL, `/users/${this.getUserId()}/favorites/tracks/${trackId}`, {})
    const response = await fetch(url, this._getFetchOptions({
      method: 'DELETE'
    }))
    this._clearFavoritesCache()
    return { success: response.ok, status: response.status }
  }

  async fetchTrackInfo(trackId) {
    return this._callApiV1(`/tracks/${trackId}`)
  }

  async fetchTrackStreamUrl(trackId, audioQuality = 'LOSSLESS') {
    // Audio quality options: LOW, HIGH, LOSSLESS, HI_RES_LOSSLESS
    // Returns: { urls: [url1, url2, ...], codec: "FLAC", audioQuality: "LOSSLESS", ... }
    return this._callApiV1(`/tracks/${trackId}/urlpostpaywall`, {
      audioquality: audioQuality,
      urlusagemode: 'STREAM',
      assetpresentation: 'FULL'
    })
  }

  async fetchAlbumInfo(albumId) {
    return this._callApiV1(`/albums/${albumId}`)
  }

  async fetchPlaylistInfo(playlistId) {
    return this._callApiV1(`/playlists/${playlistId}`)
  }

  async fetchAlbumTracks(albumId) {
    return await this._fetchAll(`/albums/${albumId}/items`)
  }

  async fetchPlaylistTracks(playlistId) {
    return await this._fetchAll(`/playlists/${playlistId}/items`)
  }

  async fetchMixTracks(mixId) {
    const results = await this.proxy(`/pages/mix`, { mixId, deviceType: 'PHONE' })
    return results.rows[1].modules[0].pagedList
  }

  async fetchArtistInfo(artistId, options) {
    return await this._fetchAll(`/artists/${artistId}/bio`, options)
  }

  async fetchArtistAlbums(artistId, options) {
    return await this._fetchAll(`/artists/${artistId}/albums`, options)
  }

  async fetchArtistRelationShip(artistId, title, options) {

    // add some options
    options = {
      artistId: artistId,
      deviceType: PAGE_DEVICE_TYPE,
      platform: PAGE_PLATFORM,
      locale: PAGE_LOCALE,
      limit: PAGE_LIMIT,
      ...options
    }

    // we must do a 1st call to get the dataApiPath
    const page = await this._callApiV1(`/pages/artist`, options)
    const row = page.rows.find(row => row.modules[0].type === 'ALBUM_LIST' && row.modules[0].title === title)
    if (!row || !row.modules) {
      return Promise.resolve({
        limit: PAGE_LIMIT,
        offset: 0,
        totalNumberOfItems: 0,
        items: [],
      })
    }

    // if we have all, return
    const pagedList = page.rows.find(row => row.modules[0].type === 'ALBUM_LIST' && row.modules[0].title === title)?.modules?.[0]?.pagedList
    if (pagedList.totalNumberOfItems < PAGE_LIMIT) {
      return pagedList
    }

    // else we need to fetch all based on dataApiPath
    return await this._fetchAll(`/${pagedList.dataApiPath.split('?')[0]}`, options)

  }

  async fetchArtistTopTracks(artistId) {
    return await this._fetchAll(`/artists/${artistId}/toptracks`)
  }

  async fetchArtistRadio(artistId) {
    return await this._fetchAll(`/artists/${artistId}/radio`)
  }

  async fetchSimilarArtists(artistId) {
    return await this._fetchAll(`/artists/${artistId}/similar`)
  }

  async fetchGenres(countryCode) {
    return await this._callApiV1(`/genres`, { countryCode: countryCode || COUNTRY_CODE })
  }

  async fetchGenreTracks(genreId) {
    return await this._fetchAll(`/genres/${genreId}/tracks`)
  }

  async fetchTrackLyrics(trackId) {
    return await this._callApiV1(`/tracks/${trackId}/lyrics`)
  }

  async fetchTrackRadio(trackId) {
    return await this._callApiV1(`/tracks/${trackId}/radio`)
  }

  async fetchHomeStaticFeed(options) {
    return await this._callApiV2(`/home/feed/static`, {
      ...options,
      limit: LIMIT,
    })
  }
  
  async search(type, query) {
    return this._callApiV1(`/search/${type}`, { query: query, limit: LIMIT })
  }

  async createPlaylist(title, description) {
    return this._callApiV1(`/users/${this.getUserId()}/playlists`, { limit: LIMIT }, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: FORM.stringify({ title, description})
    })
  }

  async addTracksToPlaylist(playlistId, trackIds) {

    // we need to get the etag
    let headers = {}
    await this._callApiV1(`/playlists/${playlistId}`, null, null, headers)

    // now we can do it!
    return this._callApiV1(`/playlists/${playlistId}/items`, { limit: LIMIT }, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'If-None-Match': headers['etag']
      },
      body: FORM.stringify({
        onArtifactNotFound: 'SKIP',
        onDupes: 'SKIP',
        trackIds: trackIds
      })
    })
  }

  async proxy(path, query) {
    return this.proxyV1(path, query)
  }

  async proxyV1(path, query) {
    return this._callApiV1(path, query)
  }

  async proxyV2(path, query) {
    return this._callApiV2(path, query)
  }

  async fetchQueue(queueId) {

    // queue info and items
    let info = await this._callQueue(`/queues/${queueId}`)
    let items = await this._callQueue(`/queues/${queueId}/items`, { offset: 0, limit: LIMIT })

    // return
    return {
      id: queueId,
      ...await items.json(),
      etag: info.headers.get('etag')
    }
  }

  async fetchQueueContent(queue) {

    // init
    let tracks = []
    let remaining = queue.total

    try {
      
      // may need several calls
      while (remaining > 0) {
        let response = await this._callQueue(`/content/${queue.id}`, { offset: tracks.length, limit: LIMIT_QUEUE_CONTENT })
        let content = await response.json()
        remaining -= content.items.length
        tracks = [...tracks, ...content.items]
      }

      // done
      return tracks

    } catch {

    }

    // let's try one by one
    tracks = []
    for (let item of queue.items) {
      let item_id = item.media_id
      let track = await this.fetchTrackInfo(item_id)
      tracks.push({
        item: track,
        type: 'track'
      })
    }

    // done
    return tracks
  }

  async addToQueue(queue, tracks, afterId) {
    let response = await this._callQueue(`/queues/${queue.id}/items`, null, {
      method: 'PUT',
      headers: {
        'If-Match': queue.etag,
      },
      body: JSON.stringify({
        mode: 'append',
        item_id: afterId,
        items: tracks.map((track) => ({
          type: 'track',
          media_id: track.id,
          properties: {
            active: false,
            original_order: queue.total
          }
        })),
      })
    })
    queue.etag = response.headers.get('etag')
    return response;
  }

  async deleteFromQueue(queue, trackId) {
    let response = await this._callQueue(`/queues/${queue.id}/items/${trackId}`, null, {
      method: 'DELETE',
    })
    queue.etag = response.headers.get('etag')
    return response;
  }

  async reorderQueue(queue, moveId, afterId) {
    let response = await this._callQueue(`/queues/${queue.id}/items`, null, {
      method: 'PATCH',
      headers: {
        'If-Match': queue.etag,
      },
      body: JSON.stringify({
        ids: [ moveId ],
        after: afterId
      })
    })
    queue.etag = response.headers.get('etag')
    return response;
  }

  queueTracks(sourceType, sourceId, tracks, position) {

    let payload = {
      properties: {
        position: position
      },
      repeat_mode: 'off',
      shuffled: false,
      items: tracks.map((t, index) => {
        return {
          type: t.type,
          media_id: t.item.id,
          properties: {
            active: false,
            original_order: index,
            sourceId: sourceId,
            sourceType: sourceType
          },
        }
      })
    }

    return this._callQueue(`/queues`, null, {
      method: 'POST',
      body: JSON.stringify(payload)
    })

  }

  async _fetchAll(path, options) {

    // init
    let result = null
    let remaining = null

    // iterate
    while (true) {
      try {
        let response = await this._callApiV1(path, { offset: result?.items?.length || 0, limit: LIMIT, ...options })
        if (response?.items?.length == 0) {
          break
        } else if (result == null) {
          result = response
          remaining = response.totalNumberOfItems - response.items.length
        } else {
          result.items = [...result.items, ...response.items]
          remaining = remaining - response.items.length
        }
        if (remaining <= 0) {
          break
        }
      } catch {
        break
      }
    }
    
    // done
    return result
  
  }

  async _callApiV1(path, params, options, returnHeaders) {
    return this._callApi(API_V1_BASE_URL, path, params, options, returnHeaders)
  }

  async _callApiV2(path, params, options, returnHeaders) {
    return this._callApi(API_V2_BASE_URL, path, {
      countryCode: options?.countryCode || COUNTRY_CODE,
      locale: 'en_US',
      deviceType: 'BROWSER',
      platform: 'WEB',
      timeOffset: '-06:00',
        ...params
      }, {
      headers: {
        'x-tidal-client-version': '2025.1.9',
        ...options?.headers
      },
      ...options
    }, returnHeaders)
  }

  async _callApi(baseUrl, path, params, options, returnHeaders) {

    // we may try two times in case token is invalid
    for (let i=0; i<2; i++) {

      // call it
      let url = this._getUrl(baseUrl, path, params)

      // create user-specific cache key
      const userId = this._userAuth?.user?.id || 'default'
      const cacheKey = `${userId}:${url}`

      // check in cache
      const cached = cache[cacheKey]
      if (cached) {
        if (Date.now() < cached.expires) {
          console.log(`[CACHE] ${options?.method || 'GET'} ${url}`)
          return cached.response
        }
      }

      // we need to call it
      console.log(`[OUT] ${options?.method || 'GET'} ${url}`)
      let response = await fetch(url, this._getFetchOptions(options))

      // return headers
      if (returnHeaders) {
        for (const header of response.headers) {
          returnHeaders[header[0]] = header[1]
        }
      }

      // parse response
      let json = null
      try {
        json = await response.json();
      } catch (e) {
        throw new Error(`API Error: Invalid JSON response from ${url}`, await response.text());
      }

      // if 401 and first iteration, try to renew token
      if ((response.status === 401 || json.httpStatus === 401 || json.status === 401) && i === 0) {

        // use shared promise to avoid parallel refresh attempts
        if (!this._refreshPromise) {
          this._refreshPromise = (async () => {
            try {
              console.log('Auth token expired, trying to renew...')
              let auth = new Auth(this._settings)
              let renewed = await auth.refreshToken(this._userAuth)
              this._settings.reload()
              return renewed
            } finally {
              this._refreshPromise = null
            }
          })()
        }

        let renewed = await this._refreshPromise
        if (!renewed) {
          return json
        }

        // retry with renewed token
        continue
      }

      // if error, return it
      if (json.error) {
        return json
      }

      // success: cache and return
      cache[cacheKey] = {
        expires: Date.now() + CACHE_EXPIRES,
        response: json
      }
      return json

    }
    
  }

  async _callQueue(path, params, options) {
    let url = this._getUrl(QUEUE_BASE_URL, path, params)
    console.log(`${options?.method || 'GET'} ${url}`)
    return fetch(url, this._getFetchOptions(options))
  }

  getAuthInfo() {
    return {
      'oauthServerInfo': {
        'serverUrl': `${AUTH_BASE_URL}/token`,
        'authInfo': {
          'headerAuth': `Bearer ${this._accessToken()}`,
          'oauthParameters': {
            'accessToken': this._accessToken(),
            'refreshToken': this._refreshToken(),
          }
        },
        'httpHeaderFields': [],
        'formParameters': {
          'scope': 'r_usr',
          'grant_type': 'switch_client'
        }
      }
    }
  }

  _getUrl(baseUrl, path, params) {
    let url = `${baseUrl}${path}`
    if (params == null || Object.keys(params).includes('countryCode') == false) {
      let sep = url.includes('?') ? '&' : '?'
      url += `${sep}countryCode=${this._countryCode}`
    }
    for (let key in params) {
      let sep = url.includes('?') ? '&' : '?'
      url += `${sep}${key}=${encodeURIComponent(params[key])}`
    }
    return url
  }

  _getFetchOptions(options) {

    // init
    options = options || {}
    options.headers = options.headers || {}

    // add authorization header
    options.headers['Authorization'] = `Bearer ${this._accessToken()}`

    // if not get
    if (options.method && options.method !== 'GET') {
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json'
      }
    }

    // done
    return options
  }

  _accessToken = () => this._userAuth.access_token
  _refreshToken = () => this._userAuth.refresh_token

}