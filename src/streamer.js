
const md5 = require('md5')
const express = require('express')
const Discoverer = require('./discoverer')
const TidalApi = require('./api')
const TidalConnect = require('./connect')
const { json_status, runLocalCommand } = require('./utils')

module.exports = class {

  constructor(settings) {
    this._settings = settings
    this._discoverDevices()
  }

  routes() {

    const router = express.Router()

    router.use((req, res, next) => {
      if (req.url != '/list') {
        req.device = this._getDevice(req.query.uuid)
        if (req.device == null) {
          json_status(res, 'Device not found')
          return
        }
      }
      next()
    })

    router.get('/list', (req, res) => {
      let devices = []
      for (let device of Object.values(this._devices)) {
        if (device.info != null) devices.push(device.info())
      }
      res.json(devices)
    })

    router.get('/ping', (req, res) => {
      res.json('pong')
    })

    router.get('/status', (req, res) => {
      let status = req.device.connect?.status()
      if (this._settings.volume?.up != null) {
        status.volume.level = -1
      }
      res.json(status)
    })

    router.post('/play/tracks', (req, res) => {
      this.streamTracks(req.device.connect, req.body, req.query.position, (err, result) => {
        json_status(res, err, result)
      })
    })

    router.get('/play/album/:id', (req, res) => {
      this.streamAlbum(req.device.connect, req.params.id, req.query.position, (err, result) => {
        json_status(res, err, result)
      })
    })

    router.get('/play/playlist/:id', (req, res) => {
      this.streamPlaylist(req.device.connect, req.params.id, req.query.position, (err, result) => {
        json_status(res, err, result)
      })
    })

    router.post('/dequeue/:position', async (req, res) => {
      try {
        let api = new TidalApi(this._settings)
        await req.device.connect.dequeueTrack(api, parseInt(req.params.position));
        json_status(res)
      } catch (err) {
        json_status(res, err)
      }
    })

    router.post('/reorderqueue/:from/:to', async (req, res) => {
      try {
        let api = new TidalApi(this._settings)
        await req.device.connect.reorderQueue(api, parseInt(req.params.from), parseInt(req.params.to));
        json_status(res)
      } catch (err) {
        json_status(res, err)
      }
    })

    router.post('/play', async (req, res) => {
      await req.device.connect.sendCommand('play');
      json_status(res)
    })

    router.post('/pause', async (req, res) => {
      await req.device.connect.sendCommand('pause');
      json_status(res)
    })

    router.post('/stop', async (req, res) => {
      await req.device.connect.stop();
      json_status(res)
    })

    router.post('/next', async (req, res) => {
      await req.device.connect.sendCommand('next');
      json_status(res)
    })

    router.post('/prev', async (req, res) => {
      await req.device.connect.sendCommand('previous');
      json_status(res)
    })

    router.post('/trackseek/:position', async (req, res) => {
      try {
        await req.device.connect.goto(parseInt(req.params.position))
        json_status(res)
      } catch (err) {
        json_status(res, err)
      }
    })

    router.post('/timeseek/:progress', async (req, res) => {
      await req.device.connect.sendCommand('seek', { position: req.params.progress * 1000 });
      json_status(res)
    })

    router.post('/volume/down', async (req, res) => {
      runLocalCommand(this._settings.volume?.down)
      json_status(res)
    })

    router.post('/volume/up', async (req, res) => {
      runLocalCommand(this._settings.volume?.up)
      json_status(res)
    })

    return router

  }

  async streamTracks(connect, tracks, position, cb) {

    try {

      // log
      // console.log(`Streaming ${tracks.items.length} tracks`)
      
      // do it
      let api = new TidalApi(this._settings)

      // some info
      // console.log(`  Device: ${connect.device().description}`)

      // stream
      this._streamTracks(api, connect, 'unknown', 0, tracks.items.map((t) => {
        if (typeof t == 'string') t = JSON.parse(t)
        return {
          type: 'track',
          item: {
            id: t.id,
            title: t.title,
            album: t.album,
            artist: t.artist,
            artists: t.artists,
            duration: t.duration,
            allowStreaming: true,
            editbale: false,
            streamReady: true,
            audioModes: t.audioModes,
            audioQuality: t.audioQuality,
          }
        }
      }), position || 0)

      // done
      cb?.(null, {
        device: connect.device().info(),
      })

    } catch (e) {
      console.error(e)
      cb?.(e)
    }
  
  }

  async streamAlbum(connect, albumId, position, cb) {

    try {

      // log
      // console.log(`Streaming album: ${albumId}`)
      
      // do it
      let api = new TidalApi(this._settings)

      // get tracks
      let tracks = await api.fetchAlbumTracks(albumId)

      // some info
      position = position || 0
      let title = tracks.items[position].item.album.title
      let artist = tracks.items[position].item.artists[0].name
      // let count = tracks.totalNumberOfItems
      // console.log(`  Device: ${connect.device().description}`)
      // console.log(`  Title: ${title}`)
      // console.log(`  Artist: ${artist}`)
      // console.log(`  Tracks: ${count}`)

      // stream
      await this._streamTracks(api, connect, 'album', albumId, tracks.items, position)

      // done
      cb?.(null, {
        id: albumId,
        title: title,
        artist: artist,
        device: connect.device().info(),
      })

    } catch (e) {
      console.error(e)
      cb?.(e)
    }

  }

  async streamPlaylist(connect, playlistId, position, cb) {

    try {

      // log
      // console.log(`Streaming playlist: ${playlistId}`)
      
      // do it
      let api = new TidalApi(this._settings)

      // get tracks
      let tracks = await api.fetchPlaylistTracks(playlistId)

      // some info
      // let count = tracks.totalNumberOfItems
      // console.log(`  Device: ${connect.device().description}`)
      // console.log(`  Tracks: ${count}`)

      // stream
      await this._streamTracks(api, connect, 'playlist', playlistId, tracks.items, position || 0)

      // done
      cb?.(null, {
        id: playlistId,
        device: connect.device().info(),
      })

    } catch (e) {
      console.error(e)
      cb?.(e)
    }

  }

  async _streamTracks(api, connect, sourceType, sourceId, tracks, position) {

    // check before play script
    runLocalCommand(this._settings.beforeplay, true)

    // limit
    tracks = tracks.slice(0, 100)

    // queue
    let response = await api.queueTracks(sourceType, sourceId, tracks, position)
    let queue = await response.json()
    queue.etag = response.headers.get('etag')

    // check
    if (queue.error != null) {
      throw new Error(JSON.stringify(queue))
    }
    
    // now we can queue!
    await connect.loadQueue(api, queue, tracks)

    // done
    return queue

  }

  _discoverDevices() {
    this._devices = {}
    new Discoverer(async (device) => {

      // first clean up
      let current = this._devices[device.name]
      if (current == null) {
        this._devices[device.name] = {} // reserve
      } else if (current.connect == null) {
        return // reserved
      } else {
        await this._disconnectFromDevice(current)
        delete this._devices[device.name]
      }

      // now connect
      try {
      
        await this._connectToDevice(device)
        device.uuid = md5(`${device.name}-${device.ip}`)
        device.info = function() { return { uuid: this.uuid, name: this.description }}
        this._devices[device.name] = device
      
      } catch (e) {
        throw new Error(`Unable to connect to ${device.name}@${device.ip}: ${e}`)
      }

    }, async (name) => {
      let current = this._devices[name]
      await this._disconnectFromDevice(current)
      delete this._devices[name]
    })
  
  }

  async _connectToDevice(device) {
    let connect = new TidalConnect(this._settings, device)
		connect._connect()
    device.connect = connect
  }

  async _disconnectFromDevice(device) {
    if (device != null) {
      device.connect?.shutdown()
      device.connect = null
    }
  }

  _getDevice(uuid) {

    // we need this
    let names = Object.keys(this._devices)
    let devices = Object.values(this._devices)

    // if we have a uuid then find it
    if (uuid != null) {
      let matches = devices.find((d) => d.uuid == uuid)
      return matches
    }

    // if we have only one device then good
    if (devices.length == 1) {
      return devices[0]
    }

    // do we have a default
    let name = this._settings.device
    if (names.includes(name)) {
      return this._devices[name]
    }

    // too bad
    return null

  }
  
}
