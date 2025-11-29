
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
      this.getAlbumInfo(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/playlist/:id', (req, res, next) => {
      this.getPlaylistInfo(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id', (req, res, next) => {
      this.getArtistInfo(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/albums', (req, res, next) => {
      this.getArtistAlbums(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/live', (req, res, next) => {
      this.getArtistLiveAlbums(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/singles', (req, res, next) => {
      this.getArtistSingles(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/compilations', (req, res, next) => {
      this.getArtistCompilations(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/toptracks', (req, res, next) => {
      this.getArtistTopTracks(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/radio', (req, res, next) => {
      this.getArtistRadio(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/similar', (req, res, next) => {
      this.getSimilarArtists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/genres', (req, res, next) => {
      this.getGenres(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/genre/:id/tracks', (req, res, next) => {
      this.getGenreTracks(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/mix/:id/tracks', (req, res, next) => {
      this.getMixTracks(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get(['/lyrics/:id', '/info/track/:id/lyrics'], (req, res, next) => {
      this.getTrackLyrics(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/track/:id/radio', (req, res, next) => {
      this.getTrackRadio(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/track/:id/url', async (req, res) => {
      try {
        let api = new TidalApi(this._settings, req.userAuth)
        let quality = req.query.quality || 'LOSSLESS'  // HIGH, LOSSLESS, HI_RES_LOSSLESS
        let streamInfo = await api.fetchTrackStreamUrl(req.params.id, quality)
        res.json(streamInfo)
      } catch (err) {
        json_status(res, err)
      }
    })

    router.get('/search/artist', (req, res, next) => {
      this.searchArtists(req)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/search/album', (req, res, next) => {
      this.searchAlbums(req)
      .then((result) => json_status(res, null, result))
      .catch(err => next(err))
    })

    router.get('/search/track', (req, res, next) => {
      this.searchTracks(req)
      .then((result) => json_status(res, null, result))
      .catch(err => next(err))
    })

    router.get('/search/track/digest', (req, res, next) => {
      this.searchTracks(req)
      .then((result) => {
        result = result.items.map((i) => { return {
          id: i.id,
          title: i.title,
          artist: i.artist.name,
          album: i.album.title,
        }}).slice(0, 5)
        json_status(res, null, result)
      })
      .catch(err => next(err))
    })

    router.get('/api/*', (req, res, next) => {
      this.apiProxy(req)
      .then((result) => json_status(res, null, result))
      .catch(err => next(err))
    })

    return router

  }

  async getAlbumInfo(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let info = await api.fetchAlbumInfo(req.params.id)
    let tracks = await api.fetchAlbumTracks(req.params.id)
    return {
      ...info,
      ...tracks
    }
  }

  async getPlaylistInfo(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let tracks = await api.fetchPlaylistTracks(req.params.id)
    return tracks
  }

  async getTrackLyrics(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let lyrics = await api.fetchTrackLyrics(req.params.id)
    return lyrics
  }

  async searchArtists(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.search('artists', req.query.query)
    return results
  }

  async searchAlbums(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.search('albums', req.query.query)
    return results
  }

  async searchTracks(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.search('tracks', req.query.query)
    return results
  }

  async getArtistInfo(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchArtistInfo(req.params.id)
    return results
  }

  async getArtistAlbums(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchArtistAlbums(req.params.id)
    //let results = await api.fetchArtistRelationShip(req.params.id, 'Featured Albums')
    return this.deduplicateAlbums(results)
  }

  async getArtistLiveAlbums(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchArtistRelationShip(req.params.id, 'Live albums')
    return this.deduplicateAlbums(results)
  }

  async getArtistSingles(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchArtistAlbums(req.params.id, { filter: 'EPSANDSINGLES' })
    //let results = await api.fetchArtistRelationShip(req.params.id, 'EP & Singles')
    return this.deduplicateAlbums(results)
  }

  async getArtistCompilations(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchArtistAlbums(req.params.id, { filter: 'COMPILATIONS' })
    //let results = await api.fetchArtistRelationShip(req.params.id, 'Appears On')
    return this.deduplicateAlbums(results)
  }

  async getArtistTopTracks(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchArtistTopTracks(req.params.id)
    return results
  }

  async getArtistRadio(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchArtistRadio(req.params.id)
    return results
  }

  async getSimilarArtists(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchSimilarArtists(req.params.id)
    return results
  }

  async getGenres(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchGenres(req.query.countryCode)
    return results
  }

  async getGenreTracks(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchGenreTracks(req.params.id)
    return results
  }

  async getMixTracks(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchMixTracks(req.params.id)
    return results.items
  }

  async getTrackRadio(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.fetchTrackRadio(req.params.id)
    return results
  }

  async apiProxy(req) {
    let api = new TidalApi(this._settings, req.userAuth)
    let results = await api.proxy(req.path.substring(4), req.query)
    return results
  }

  deduplicateAlbums(results) {
    
    let albums = []
    for (const album of results.items) {

      if (!album.allowStreaming) {
        continue
      }

      const previous = albums.find((previous) => {
        return previous.title === album.title &&
        //previous.version === album.version &&
        previous.releaseDate === album.releaseDate &&
        previous.numberOfVolumes === album.numberOfVolumes &&
        previous.numberOfTracks === album.numberOfTracks &&
        Math.abs(previous.duration - album.duration) < 10
      })

      if (!previous) {
        albums.push(album)
        continue
      }

      const replace = () => {
        albums = albums.filter((a) => {
          return a.id !== previous.id
        })
        albums.push(album)
      }

      // audio quality
      if (this.quality(album.audioQuality) > this.quality(previous.audioQuality)) {
        replace()
        continue
      }

      // mediaMetadata.tags length
      if (album.mediaMetadata?.tags?.length > previous.mediaMetadata?.tags?.length) {
        replace()
        continue
      }

      // popularity
      if (album.popularity > previous.popularity) {
        replace()
        continue
      }

    }

    results.items = albums
    results.totalNumberOfItems = albums.length
    return results
  }

  quality(audioQuality) {
    if (audioQuality === 'LOW') {
      return 1
    } else if (audioQuality === 'HIGH') {
      return 2
    } else if (audioQuality === 'LOSSLESS') {
      return 3
    } else if (audioQuality === 'HI_RES') {
      return 4
    } else if (audioQuality === 'HIRES_LOSSLESS') {
      return 5
    } else {
      return 0
    }
  }

}
