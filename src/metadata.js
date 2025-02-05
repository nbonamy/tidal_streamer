
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

    router.get('/info/artist/:id/singles', (req, res, next) => {
      this.getArtistSingles(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/compilations', (req, res, next) => {
      this.getArtistCompilations(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/toptracks', (req, res, next) => {
      this.getArtistTopTracks(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/radio', (req, res, next) => {
      this.getArtistRadio(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/artist/:id/similar', (req, res, next) => {
      this.getSimilarArtists(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/genres', (req, res, next) => {
      this.getGenres(req.query.countryCode)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/genre/:id/tracks', (req, res, next) => {
      this.getGenreTracks(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/mix/:id/tracks', (req, res, next) => {
      this.getMixTracks(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get(['/lyrics/:id', '/info/track/:id/lyrics'], (req, res, next) => {
      this.getTrackLyrics(req.params.id)
        .then((result) => json_status(res, null, result))
        .catch(err => next(err))
    })

    router.get('/info/track/:id/radio', (req, res, next) => {
      this.getTrackRadio(req.params.id)
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

    router.get('/search/track', (req, res, next) => {
      this.searchTracks(req.query.query)
      .then((result) => json_status(res, null, result))
      .catch(err => next(err))
    })

    router.get('/search/track/digest', (req, res, next) => {
      this.searchTracks(req.query.query)
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
      this.apiProxy(req.path.substring(4), req.query)
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

  async searchTracks(query) {
    let api = new TidalApi(this._settings)
    let results = await api.search('tracks', query)
    return results
  }

  async getArtistAlbums(artistId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchArtistAlbums(artistId)
    return this.deduplicateAlbums(results)
  }

  async getArtistSingles(artistId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchArtistAlbums(artistId, { filter: 'EPSANDSINGLES' })
    return this.deduplicateAlbums(results)
  }

  async getArtistCompilations(artistId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchArtistAlbums(artistId, { filter: 'COMPILATIONS' })
    return this.deduplicateAlbums(results)
  }

  async getArtistTopTracks(artistId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchArtistTopTracks(artistId)
    return results
  }

  async getArtistRadio(artistId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchArtistRadio(artistId)
    return results
  }

  async getSimilarArtists(artistId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchSimilarArtists(artistId)
    return results
  }

  async getGenres(countryCode) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchGenres(countryCode)
    return results
  }

  async getGenreTracks(genreId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchGenreTracks(genreId)
    return results
  }

  async getMixTracks(mixId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchMixTracks(mixId)
    return results.items
  }

  async getTrackRadio(trackId) {
    let api = new TidalApi(this._settings)
    let results = await api.fetchTrackRadio(trackId)
    return results
  }

  async apiProxy(path, query) {
    let api = new TidalApi(this._settings)
    let results = await api.proxy(path, query)
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
        previous.version === album.version &&
        previous.releaseDate === album.releaseDate &&
        previous.numberOfVolumes === album.numberOfVolumes &&
        previous.numberOfTracks === album.numberOfTracks &&
        previous.duration === album.duration
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
