
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
      this.getUserFeed(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/feed', (req, res, next) => {
      this.getUserFeed(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/home/sections', (req, res, next) => {
      this.getHomeSections(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/home/sections/:sectionId/items', (req, res, next) => {
      this.getHomeSectionItems(req.params.sectionId, req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/module/:moduleId', (req, res, next) => {
      this.getFeedModule(req.params.moduleId, req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/shortcuts', (req, res, next) => {
      this.getUserShortcuts(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/artists', (req, res, next) => {
      this.getUserArtists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/albums', (req, res, next) => {
      this.getUserAlbums(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists', (req, res, next) => {
      this.getUserPlaylists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/tracks', (req, res, next) => {
      this.getUserTracks(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/tracks/:trackId/favorite', (req, res, next) => {
      this.isTrackFavorite(req, req.params.trackId)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.post('/user/tracks/:trackId/favorite/toggle', (req, res, next) => {
      this.toggleTrackFavorite(req, req.params.trackId)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.post('/user/tracks/:trackId/favorite', (req, res, next) => {
      this.addTrackFavorite(req, req.params.trackId)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.delete('/user/tracks/:trackId/favorite', (req, res, next) => {
      this.removeTrackFavorite(req, req.params.trackId)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })


    router.get('/user/new/albums', (req, res, next) => {
      this.getNewAlbums(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/new/tracks', (req, res, next) => {
      this.getNewTracks(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    // router.get('/user/recent/albums', (req, res, next) => {
    //   this.getRecentAlbums()
    //     .then((result) => json_status(res, null, result))
    //     .catch(err => next(err))
    // })

    router.get('/user/recent/artists', (req, res, next) => {
      this.getRecentArtists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/recommended/albums', (req, res, next) => {
      this.getRecommendedAlbums(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/forgotten/albums', (req, res, next) => {
      this.getForgottenAlbums(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists/popular', (req, res, next) => {
      this.getPopularPlaylists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists/essential', (req, res, next) => {
      this.getEssentialPlaylists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists/updated', (req, res, next) => {
      this.getUpdatedPlaylists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/playlists/recommended', (req, res, next) => {
      this.getRecommendedPlaylists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/mixes/history', (req, res, next) => {
      this.getHistoryMixes(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/mixes/daily', (req, res, next) => {
      this.getDailyMixes(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/mixes/radio', (req, res, next) => {
      this.getRadioMixes(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/tracks/spotlighted', (req, res, next) => {
      this.getSpotlightedTracks(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/user/tracks/uploads', (req, res, next) => {
      this.getUploadsTracks(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    return router

  }

  async getUserHome(req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const home = await api.proxy('/pages/home', { deviceType: 'PHONE' })
    return home
  }

  async getUserFeed(req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const feed = api.fetchHomeStaticFeed()
    return feed
  }

  async getHomeSections(req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const feed = await api.fetchHomeStaticFeed()
    const modules = this._getFeedModules(feed)
    return modules.map((module) => ({
      id: module.moduleId,
      title: module.title,
      type: module.type,
      itemCount: module.items?.length || 0,
      hasViewAll: !!module.viewAll
    }))
  }

  async getHomeSectionItems(sectionId, req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const feed = await api.fetchHomeStaticFeed()
    const module = this._findFeedModule(feed, sectionId)
    if (!module) {
      console.warn(`Module ${sectionId} not found in user feed`, JSON.stringify(this._getFeedModules(feed).map(i => i.moduleId)))
      return {
        id: sectionId,
        title: null,
        type: null,
        items: []
      }
    }

    const items = await this._getModuleItems(api, module)
    let typedItems = this._typedHomeItems(items)
    if (typedItems.length === 0 && items !== module.items) {
      typedItems = this._typedHomeItems(module.items || [])
    }

    return {
      id: module.moduleId,
      title: module.title,
      type: module.type,
      items: typedItems
    }
  }

  async getUserShortcuts(req) {
    return await this.getFeedModule('SHORTCUT_LIST', req)
  }

  async getUserArtists(req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const artists = await api.fetchUserArtists()
    return artists
  }

  async getUserAlbums(req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const albums = await api.fetchUserAlbums()
    return albums
  }

  async getUserPlaylists(req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const playlists = await api.fetchUserPlaylists()
    return playlists
  }

  async getUserTracks(req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const tracks = await api.fetchUserTracks()
    return tracks
  }

  async isTrackFavorite(req, trackId) {
    const api = new TidalApi(this._settings, req.userAuth)
    const favorite = await api.isTrackFavorite(trackId)
    return { favorite }
  }

  async toggleTrackFavorite(req, trackId) {
    const api = new TidalApi(this._settings, req.userAuth)
    return await api.toggleTrackFavorite(trackId)
  }

  async addTrackFavorite(req, trackId) {
    const api = new TidalApi(this._settings, req.userAuth)
    return await api.addTrackFavorite(trackId)
  }

  async removeTrackFavorite(req, trackId) {
    const api = new TidalApi(this._settings, req.userAuth)
    return await api.removeTrackFavorite(trackId)
  }

  async getNewAlbums(req) {
    return await this.getFeedModule('NEW_ALBUM_SUGGESTIONS', req)
  }

  async getNewTracks(req) {
    return await this.getFeedModule('NEW_TRACK_SUGGESTIONS', req)
  }

  // async getRecentAlbums() {
  //   return await this.getFeedModule('CONTINUE_LISTEN_TO')
  // }

  async getRecentArtists(req) {
    return await this.getFeedModule('YOUR_FAVORITE_ARTISTS', req)
  }

  async getRecommendedAlbums(req) {
    return await this.getFeedModule('ALBUM_RECOMMENDATIONS', req)
  }

  async getForgottenAlbums(req) {
    return await this.getFeedModule('FORGOTTEN_FAVORITES', req)
  }

  async getPopularPlaylists(req) {
    return await this.getFeedModule('POPULAR_PLAYLISTS', req)
  }

  async getEssentialPlaylists(req) {
    return await this.getFeedModule('SUGGESTED_ESSENTIAL_PLAYLISTS', req)
  }

  async getUpdatedPlaylists(req) {
    return await this.getFeedModule('RECENTLY_UPDATED_FAVORITED_PLAYLIST', req)
  }

  async getRecommendedPlaylists(req) {
    return await this.getFeedModule('RECOMMENDED_USERS_PLAYLISTS', req)
  }

  async getHistoryMixes(req) {
    return await this.getFeedModule('HISTORY_MIXES', req)
  }

  async getDailyMixes(req) {
    return await this.getFeedModule('DAILY_MIXES', req)
  }

  async getRadioMixes(req) {
    return await this.getFeedModule('SUGGESTED_RADIOS_MIXES', req)
  }

  async getSpotlightedTracks(req) {
    return await this.getFeedModule('LATEST_SPOTLIGHTED_TRACKS', req)
  }

  async getUploadsTracks(req) {
    return await this.getFeedModule('UPLOADS_FOR_YOU', req)
  }

  async getFeedModule(moduleId, req) {
    const api = new TidalApi(this._settings, req.userAuth)
    const feed = await api.fetchHomeStaticFeed()
    const module = this._findFeedModule(feed, moduleId)
    if (!module) {
      console.warn(`Module ${moduleId} not found in user feed`, JSON.stringify(this._getFeedModules(feed).map(i => i.moduleId)))
      return []
    }
    if (module.viewAll) {
      const items = await this._getModuleItems(api, module)
      return items.map((item) => item.data)
    } else {
      return module.items.map((item) => item.data)
    }
  }

  _getFeedModules(feed) {
    if (!feed || !feed.items) {
      console.warn('User feed is empty or invalid', JSON.stringify(feed))
      return []
    }
    return feed.items
  }

  _findFeedModule(feed, moduleId) {
    return this._getFeedModules(feed).find((item) => item.moduleId === moduleId)
  }

  async _getModuleItems(api, module) {
    const inlineItems = module.items || []
    if (!module.viewAll) {
      return inlineItems
    }

    try {
      const results = await api.proxyV2(`/${module.viewAll}`, { deviceType: 'PHONE' })
      const viewAllItems = results.items || []
      if (viewAllItems.length > 0) {
        return viewAllItems
      }
      console.warn(`View all returned no items for module ${module.moduleId}; using inline feed items`)
    } catch (err) {
      console.warn(`Error fetching view all for module ${module.moduleId}; using inline feed items`, err)
    }

    return inlineItems
  }

  _typedHomeItems(items) {
    return items
      .map((item) => this._typedHomeItem(item))
      .filter((item) => item != null)
  }

  _typedHomeItem(item) {
    const data = item?.data || item?.item || item
    const itemType = this._homeItemType(item, data)
    if (!itemType || !data) {
      return null
    }
    return { itemType, data }
  }

  _homeItemType(item, data) {
    const wrapperType = item?.type?.toLowerCase()
    if (['album', 'playlist', 'track', 'artist', 'mix'].includes(wrapperType)) {
      return wrapperType
    }

    if (data?.uuid) return 'playlist'
    if (data?.album && data?.trackNumber != null) return 'track'
    if (data?.mixImages || data?.artifactIdType === 'trackGroupId') return 'mix'
    if (data?.picture && !data?.cover) return 'artist'
    if (data?.cover && data?.numberOfTracks != null) return 'album'

    return null
  }

}
