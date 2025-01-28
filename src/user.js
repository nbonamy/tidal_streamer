
const express = require('express')
const TidalApi = require('./api')
const { json_status } = require('./utils')

const customMixes = [ 'Custom mixes' ]

module.exports = class {

  constructor(settings) {
    this._settings = settings
  }

  routes() {

    const router = express.Router()

    router.get('/user/feed', (req, res, next) => {
      this.getUserFeed()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/shortcuts', (req, res, next) => {
      this.getUserShortcuts()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/artists', (req, res, next) => {
      this.getUserArtists()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/albums', (req, res, next) => {
      this.getUserAlbums()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists', (req, res, next) => {
      this.getUserPlaylists()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/tracks', (req, res, next) => {
      this.getUserTracks()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/mixes', (req, res, next) => {
      this.getUserMixes()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/new/albums', (req, res, next) => {
      this.getNewAlbums()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/new/tracks', (req, res, next) => {
      this.getNewTracks()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/recent/albums', (req, res, next) => {
      this.getRecentAlbums()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/recommended/albums', (req, res, next) => {
      this.getRecommendedAlbums()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    return router

  }

  async getUserFeed() {
    const api = new TidalApi(this._settings)
    const feed = api.fetchHomeStaticFeed()
    return feed
  }

  async getUserShortcuts() {
    return await this.getFeedModule('SHORTCUT_LIST')
  }

  async getUserArtists() {
    const api = new TidalApi(this._settings)
    const artists = await api.fetchUserArtists()
    return artists
  }

  async getUserAlbums() {
    const api = new TidalApi(this._settings)
    const albums = await api.fetchUserAlbums()
    return albums
  }

  async getUserPlaylists() {
    const api = new TidalApi(this._settings)
    const playlists = await api.fetchUserPlaylists()
    return playlists
  }

  async getUserTracks() {
    const api = new TidalApi(this._settings)
    const tracks = await api.fetchUserTracks()
    return tracks
  }

  async getUserMixes() {
    const api = new TidalApi(this._settings)
    const results = await api.proxy('/pages/home', { deviceType: 'PHONE' })
    for (const row of results.rows) {
      for (const module of row.modules) {
        if (module.type === 'MIX_LIST' && customMixes.includes(module.title)) {
          const url = module.showMore.apiPath
          const mixes = await api.proxy(`/${url}`, { deviceType: 'PHONE' })
          return mixes.rows[0].modules[0].pagedList.items.map(mix => ({
            id: mix.id,
            type: mix.mixType,
            title: mix.title,
            subTitle: mix.subTitle,
            thumbnail: mix.images.MEDIUM.url,
            image: mix.image
          }))
        }
      }
    }
    return {}
  }

  async getNewAlbums() {
    return await this.getFeedModule('NEW_ALBUM_SUGGESTIONS')
  }

  async getNewTracks() {
    return await this.getFeedModule('NEW_TRACK_SUGGESTIONS')
  }
  
  async getRecentAlbums() {
    return await this.getFeedModule('CONTINUE_LISTEN_TO')
  }

  async getRecommendedAlbums() {
    return await this.getFeedModule('ALBUM_RECOMMENDATIONS')
  }

  async getFeedModule(moduleId) {
    const api = new TidalApi(this._settings)
    const feed = await api.fetchHomeStaticFeed()
    const module = feed.items.find((item) => item.moduleId === moduleId)
    if (module.viewAll) {
      const url = module.viewAll
      const results = await api.proxyV2(`/${url}`, { deviceType: 'PHONE' })
      return results.items.map((item) => item.data)
    } else {
      return module.items.map((item) => item.data)
    }
  }

}
