
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
      this.createPlaylist(req.body.title, req.body.description)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.post('/playlist/add', (req, res, next) => {
      this.addToPlaylist(req.body.playlistId, req.body.trackId)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    return router

  }

  async createPlaylist(title, description) {
    let api = new TidalApi(this._settings)
    let result = api.createPlaylist(title, description)
    return result
  }

  async addToPlaylist(playlistId, trackId) {
    let api = new TidalApi(this._settings)
    let result = api.addTrackToPlaylist(playlistId, trackId)
    return result
  }

}
