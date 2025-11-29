
const express = require('express')
const TidalApi = require('./api')
const { json_status } = require('./utils')

module.exports = class {

  constructor(settings) {
    this._settings = settings
  }

  routes() {

    const router = express.Router()

    router.post('/playlist/create', (req, res, next) => {
      this.createPlaylist(req.body.title, req.body.description, req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.post('/playlist/add', (req, res, next) => {
      this.addTracksToPlaylist(req.body.playlistId, req.body.trackIds, req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    return router

  }

  async createPlaylist(title, description, req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let result = api.createPlaylist(title, description)
    return result
  }

  async addTracksToPlaylist(playlistId, trackIds, req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let result = api.addTracksToPlaylist(playlistId, trackIds)
    return result
  }

}
