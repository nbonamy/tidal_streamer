
const Auth = require('./auth')

// some constants
const AUTH_BASE_URL = 'https://auth.tidal.com/v1/oauth2'
const API_BASE_URL = 'https://api.tidal.com/v1'
const QUEUE_BASE_URL = 'https://connectqueue.tidal.com/v1'
const COUNTRY_CODE = 'US'
const LIMIT = 100
const LIMIT_QUEUE_CONTENT = 50

// we need fetch
if (typeof fetch == 'undefined') {
  fetch = require('node-fetch')
}

module.exports = class {

  constructor(settings) {
    this._settings = settings
    this._countryCode = settings.countryCode || COUNTRY_CODE
  }

  getApiBaseUrl() {
    return API_BASE_URL
  }

  getQueueBaseUrl() {
    return QUEUE_BASE_URL
  }

  async fetchTrackInfo(trackId) {
    return this._callApi(`/tracks/${trackId}`)
  }

  async fetchAlbumInfo(albumId) {
    return this._callApi(`/albums/${albumId}`)
  }

  async fetchAlbumTracks(albumId) {
    return await this._fetchAll(`/albums/${albumId}/items`)
  }

  async fetchPlaylistTracks(playlistId) {
    return await this._fetchAll(`/playlists/${playlistId}/items`)
  }

  async fetchArtistAlbums(artistId) {
    return await this._fetchAll(`/artists/${artistId}/albums`)
  }

  async fetchArtistTopTracks(artistId) {
    return await this._fetchAll(`/artists/${artistId}/toptracks`)
  }

  async fetchTrackLyrics(trackId) {
    return await this._callApi(`/tracks/${trackId}/lyrics`)
  }
  
  async search(type, query) {
    return this._callApi(`/search/${type}`, { query: query, limit: LIMIT })
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

  async deleteFromQueue(queue, trackId) {
    let response = await this._callQueue(`/queues/${queue.id}/items/${trackId}`, null, {
      method: 'DELETE',
      ...this._getFetchOptions()
    })
    queue.etag = response.headers.get('etag')
    return response;
  }

  async reorderQueue(queue, moveId, afterId) {
    let response = await this._callQueue(`/queues/${queue.id}/items`, null, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this._accessToken()}`,
        'Content-Type': 'application/json',
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
      headers: {
        'Authorization': `Bearer ${this._accessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

  }

  async _fetchAll(path) {

    // init
    let result = null
    let remaining = null

    // iterate
    while (true) {
      try {
        let response = await this._callApi(path, { offset: result?.items?.length || 0, limit: LIMIT })
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

  async _callApi(path, params) {

    // we may try two times in case token is invalid
    for (let i=0; i<2; i++) {

      // call it
      let url = this._getUrl(API_BASE_URL, path, params)
      console.log(`GET ${url}`)
      let response = await fetch(url, this._getFetchOptions())

      // parse and check auth
      let json = await response.json();
      if (i != 0 || json.status != 401) {
        return json;
      }

      // try to renew token
      let auth = new Auth(this._settings)
      let renewed = await auth.refresh_token()
      if (renewed == false) {
        return json;
      }

      // refresh settings
      this._settings.reload()

    }
    
  }

  async _callQueue(path, params, options) {
    let url = this._getUrl(QUEUE_BASE_URL, path, params)
    console.log(`${options?.method || 'GET'} ${url}`)
    return fetch(url, options || this._getFetchOptions())
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
    let url = `${baseUrl}${path}?countryCode=${this._countryCode}`
    for (let key in params) {
      url += `&${key}=${encodeURIComponent(params[key])}`
    }
    return url
  }

  _getFetchOptions() {
    return {
      headers: {
        'Authorization': `Bearer ${this._accessToken()}`
      }
    }
  }

  _accessToken = () => this._settings.auth.access_token
  _refreshToken = () => this._settings.auth.refresh_token

}