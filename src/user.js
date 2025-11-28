
const express = require('express')
const TidalApi = require('./api')
const { json_status } = require('./utils')

module.exports = class {

  constructor(settings) {
    this._settings = settings
  }

  routes() {

    const router = express.Router()

    router.get('/user/home', (req, res, next) => {
      this.getUserFeed()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/feed', (req, res, next) => {
      this.getUserFeed()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/module/:moduleId', (req, res, next) => {
      this.getFeedModule(req.params.moduleId)
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

    // router.get('/user/recent/albums', (req, res, next) => {
    //   this.getRecentAlbums()
    //     .then((result) => json_status(res, null, result))
    //     .catch(err => next(err))
    // })

    router.get('/user/recent/artists', (req, res, next) => {
      this.getRecentArtists()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/recommended/albums', (req, res, next) => {
      this.getRecommendedAlbums()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/forgotten/albums', (req, res, next) => {
      this.getForgottenAlbums()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists/popular', (req, res, next) => {
      this.getPopularPlaylists()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists/essential', (req, res, next) => {
      this.getEssentialPlaylists()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists/updated', (req, res, next) => {
      this.getUpdatedPlaylists()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists/recommended', (req, res, next) => {
      this.getRecommendedPlaylists()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/mixes/history', (req, res, next) => {
      this.getHistoryMixes()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/mixes/daily', (req, res, next) => {
      this.getDailyMixes()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/mixes/radio', (req, res, next) => {
      this.getRadioMixes()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/tracks/spotlighted', (req, res, next) => {
      this.getSpotlightedTracks()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/tracks/uploads', (req, res, next) => {
      this.getUploadsTracks()
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    return router

  }

  async getUserHome() {
    const api = new TidalApi(this._settings)
    const home = await api.proxy('/pages/home', { deviceType: 'PHONE' })
    return home
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


  async getNewAlbums() {
    return await this.getFeedModule('NEW_ALBUM_SUGGESTIONS')
  }

  async getNewTracks() {
    return await this.getFeedModule('NEW_TRACK_SUGGESTIONS')
  }
  
  // async getRecentAlbums() {
  //   return await this.getFeedModule('CONTINUE_LISTEN_TO')
  // }

  async getRecentArtists() {
    return await this.getFeedModule('YOUR_FAVORITE_ARTISTS')
  }

  async getRecommendedAlbums() {
    return await this.getFeedModule('ALBUM_RECOMMENDATIONS')
  }

  async getForgottenAlbums() {
    return await this.getFeedModule('FORGOTTEN_FAVORITES')
  }

  async getPopularPlaylists() {
    return await this.getFeedModule('POPULAR_PLAYLISTS')
  }

  async getEssentialPlaylists() {
    return await this.getFeedModule('SUGGESTED_ESSENTIAL_PLAYLISTS')
  }

  async getUpdatedPlaylists() {
    return await this.getFeedModule('RECENTLY_UPDATED_FAVORITED_PLAYLIST')
  }

  async getRecommendedPlaylists() {
    return await this.getFeedModule('RECOMMENDED_USERS_PLAYLISTS')
  }

  async getHistoryMixes() {
    return await this.getFeedModule('HISTORY_MIXES')
  }

  async getDailyMixes() {
    return await this.getFeedModule('DAILY_MIXES')
  }

  async getRadioMixes() {
    return await this.getFeedModule('SUGGESTED_RADIOS_MIXES')
  }

  async getSpotlightedTracks() {
    return await this.getFeedModule('LATEST_SPOTLIGHTED_TRACKS')
  }

  async getUploadsTracks() {
    return await this.getFeedModule('UPLOADS_FOR_YOU')
  }

  async getFeedModule(moduleId) {
    const api = new TidalApi(this._settings)
    const feed = await api.fetchHomeStaticFeed()
    const module = feed.items.find((item) => item.moduleId === moduleId)
    if (!module) {
      console.warn(`Module ${moduleId} not found in user feed`)
      return []
    }
    if (module.viewAll) {
      const url = module.viewAll
      const results = await api.proxyV2(`/${url}`, { deviceType: 'PHONE' })
      return results.items.map((item) => item.data)
    } else {
      return module.items.map((item) => item.data)
    }
  }

}
