
const express = require('express')
const TidalApi = require('./api')
const { json_status } = require('./utils')

module.exports = class {

  constructor(settings) {
    this._settings = settings
  }

  routes() {

    const router = express.Router()

    router.get('/info/album/:id', (req, res, next) => {
      this.getAlbumInfo(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/playlist/:id', (req, res, next) => {
      this.getPlaylistInfo(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/albums', (req, res, next) => {
      this.getArtistAlbums(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/lyrics/:id', (req, res, next) => {
      this.getTrackLyrics(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/search/artist', (req, res, next) => {
      this.searchArtists(req.query.query)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/search/album', (req, res, next) => {
      this.searchAlbums(req.query.query)
      .then((result) => json_status(res, null, result))
      .catch(err => next(err))
    })

    return router

  }

  async getAlbumInfo(albumId) {
    let api = new TidalApi(this._settings)
    let info = await api.fetchAlbumInfo(albumId)
    let tracks = await api.fetchAlbumTracks(albumId)
    return {
      ...info,
      ...tracks
    }
  }
  
  async getPlaylistInfo(playlistId) {
    let api = new TidalApi(this._settings)
    let tracks = await api.fetchPlaylistTracks(playlistId)
    return tracks
  }
  
  async getTrackLyrics(trackId) {
    let api = new TidalApi(this._settings)
    let lyrics = await api.fetchTrackLyrics(trackId)
    return lyrics
  }

  async searchArtists(query) {
    let api = new TidalApi(this._settings)
    let results = await api.search('artists', query)
    return results
  }

  async searchAlbums(query) {
    let api = new TidalApi(this._settings)
    let results = await api.search('albums', query)
    return results
  }

  async getArtistAlbums(artistId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchArtistAlbums(artistId)
    return results
  }

}
