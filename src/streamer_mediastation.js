
const express = require('express')
const WebSocket = require('ws')
const TidalApi = require('./api')
const Discoverer = require('./discoverer')
const { json_status } = require('./utils')

function badRequest(message) {
  const error = new Error(message)
  error.code = 400
  return error
}

function parseQueuePosition(position) {
  if (!/^\d+$/.test(String(position))) {
    throw badRequest('position must be a non-negative integer')
  }
  return parseInt(position)
}

module.exports = class {

  constructor(settings) {
    this._settings = settings
    this._pods = {}
    this._serverPort = null
    this._serverIp = null
    this._wss = null
    this._pollInterval = null
    this._lastStatus = null
    this._enrichedTrackId = null
    this._enrichedTrackData = null
    this._discoverPods()
  }

  setServerInfo(port) {
    this._serverPort = port
    // Get local IP address
    const os = require('os')
    const interfaces = os.networkInterfaces()
    for (let iface in interfaces) {
      for (let details of interfaces[iface]) {
        if (details.family === 'IPv4' && !details.internal) {
          this._serverIp = details.address
          break
        }
      }
      if (this._serverIp) break
    }
    console.log(`MediaStation streamer server info: ${this._serverIp}:${this._serverPort}`)

    // Start WebSocket server and polling
    this._startServer()
  }

  routes() {

    const router = express.Router()

    router.use((req, res, next) => {
      // Skip pod selection for routes that don't need it
      if (req.url != '/list' && !req.url.startsWith('/track/url/')) {
        req.pod = this._getPod(req.query.uuid)
        if (req.pod == null) {
          json_status(res, 'MediaPod device not found')
          return
        }
      }
      next()
    })

    router.get('/list', (req, res) => {
      let devices = Object.values(this._pods).map(pod => ({
        uuid: pod.uuid,
        name: pod.name,
        ip: pod.ip,
        port: pod.port
      }))
      res.json(devices)
    })

    router.get('/ping', (req, res) => {
      res.json('pong')
    })

    router.get('/status', async (req, res) => {
      try {
        let response = await fetch(`http://${req.pod.ip}:${req.pod.port}/player/status`)
        let mediaStatus = await response.json()
        if (req.query.format === 'tidal') {
          let tidalStatus = this._transformStatus(mediaStatus)
          await this._enrichCurrentTrack(tidalStatus)
          res.json(tidalStatus)
        } else {
          res.json(mediaStatus)
        }
      } catch (err) {
        json_status(res, err)
      }
    })

    router.post('/play/tracks', async (req, res) => {
      try {
        // Parse and normalize track format
        let tracks = req.body.items.map((track) => {
          if (typeof track == 'string') track = JSON.parse(track)
          return {
            id: track.id,
            title: track.title,
            album: track.album,
            artist: track.artist,
            artists: track.artists,
            duration: track.duration
          }
        })

        let position = parseInt(req.query.position || 0)

        await this._queueTracksToMediaPod(
          req.pod,
          tracks,
          `tidal-${Date.now()}`,
          'Tidal Tracks',
          req.query.quality,
          position
        )

        json_status(res, null, { device: req.pod })
      } catch (err) {
        json_status(res, err)
      }
    })

    router.get('/play/album/:id', async (req, res) => {
      try {
        let api = new TidalApi(this._settings)
        let albumData = await api.fetchAlbumTracks(req.params.id)

        // Extract tracks from API response
        let tracks = albumData.items.map(item => item.item)

        let position = parseInt(req.query.position || 0)

        let queuedTracks = await this._queueTracksToMediaPod(
          req.pod,
          tracks,
          `tidal-album-${req.params.id}`,
          tracks[0]?.album?.title || 'Album',
          req.query.quality,
          position
        )

        json_status(res, null, {
          id: req.params.id,
          title: queuedTracks[0]?.album,
          artist: queuedTracks[0]?.artist,
          device: req.pod
        })
      } catch (err) {
        json_status(res, err)
      }
    })

    router.get('/play/playlist/:id', async (req, res) => {
      try {
        let api = new TidalApi(this._settings)
        let playlistData = await api.fetchPlaylistTracks(req.params.id)

        // Extract tracks from API response
        let tracks = playlistData.items.map(item => item.item)

        let position = parseInt(req.query.position || 0)

        await this._queueTracksToMediaPod(
          req.pod,
          tracks,
          `tidal-playlist-${req.params.id}`,
          'Tidal Playlist',
          req.query.quality,
          position
        )

        json_status(res, null, {
          id: req.params.id,
          device: req.pod
        })
      } catch (err) {
        json_status(res, err)
      }
    })

    router.get('/play/mix/:id', async (req, res) => {
      try {
        let api = new TidalApi(this._settings)
        let mixData = await api.fetchMixTracks(req.params.id)

        // Extract tracks directly (mix returns track objects)
        let tracks = mixData.items

        let position = parseInt(req.query.position || 0)

        await this._queueTracksToMediaPod(
          req.pod,
          tracks,
          `tidal-mix-${req.params.id}`,
          'Tidal Mix',
          req.query.quality,
          position
        )

        json_status(res, null, {
          id: req.params.id,
          device: req.pod
        })
      } catch (err) {
        json_status(res, err)
      }
    })

    router.post('/enqueue/:position', async (req, res) => {
      try {
        const tracks = this._parseQueueTracks(req.body)
        await this._enqueueTracksToMediaPod(req.pod, tracks, req.params.position, req.query.quality)
        json_status(res)
      } catch (err) {
        json_status(res, err)
      }
    })

    router.post('/dequeue/:position', async (req, res) => {
      try {
        this._assertQueuePositionParam(req.params.position)
        await this._forwardCommand(req.pod, `dequeue/${req.params.position}`, req, res)
      } catch (err) {
        json_status(res, err)
      }
    })

    router.post('/reorderqueue/:from/:to', async (req, res) => {
      try {
        this._assertQueuePositionParam(req.params.from)
        this._assertQueuePositionParam(req.params.to)
        await this._forwardCommand(req.pod, `reorderqueue/${req.params.from}/${req.params.to}`, req, res)
      } catch (err) {
        json_status(res, err)
      }
    })

    // Forward control commands to MediaPod
    router.post('/play', async (req, res) => {
      this._forwardCommand(req.pod, 'play', req, res)
    })

    router.post('/pause', async (req, res) => {
      this._forwardCommand(req.pod, 'pause', req, res)
    })

    router.post('/stop', async (req, res) => {
      this._forwardCommand(req.pod, 'stop', req, res)
    })

    router.post('/next', async (req, res) => {
      this._forwardCommand(req.pod, 'next', req, res)
    })

    router.post('/prev', async (req, res) => {
      this._forwardCommand(req.pod, 'prev', req, res)
    })

    router.post('/trackseek/:position', async (req, res) => {
      try {
        this._assertQueuePositionParam(req.params.position)
        await this._forwardCommand(req.pod, `trackseek/${req.params.position}`, req, res)
      } catch (err) {
        json_status(res, err)
      }
    })

    router.post('/timeseek/:progress', async (req, res) => {
      this._forwardCommand(req.pod, `timeseek/${req.params.progress}`, req, res)
    })

    router.post('/volume/down', async (req, res) => {
      this._forwardCommand(req.pod, 'volume/down', req, res)
    })

    router.post('/volume/up', async (req, res) => {
      this._forwardCommand(req.pod, 'volume/up', req, res)
    })

    // Proxy route for on-demand stream URL fetching
    router.get('/stream/track/:trackId', async (req, res) => {
      try {
        let api = new TidalApi(this._settings)
        let quality = req.query.quality || 'LOSSLESS'

        // console.log(`Fetching stream URL for track ${req.params.trackId} (quality: ${quality})`)

        let streamInfo = await api.fetchTrackStreamUrl(req.params.trackId, quality)

        if (!streamInfo.urls || streamInfo.urls.length === 0) {
          return res.status(404).json({ error: 'No stream URL available' })
        }

        // Redirect to actual Tidal stream URL
        // console.log(`Redirecting to Tidal stream URL for track ${req.params.trackId}`)
        res.redirect(302, streamInfo.urls[0])
      } catch (err) {
        console.error(`Failed to fetch stream URL for track ${req.params.trackId}:`, err)
        res.status(500).json({ error: err.message })
      }
    })

    return router

  }

  async _forwardCommand(pod, command, req, res) {
    try {
      let response = await fetch(`http://${pod.ip}:${pod.port}/player/${command}`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error(`Failed to forward command ${command}: ${response.status}`)
      }
      let result = await response.json()
      res.json(result)
    } catch (err) {
      json_status(res, err)
    }
  }

  _parseQueueTracks(body) {
    let tracks = body?.items || body
    if (!Array.isArray(tracks)) tracks = [tracks]

    tracks = tracks.map((track) => {
      if (typeof track == 'string') {
        try {
          track = JSON.parse(track)
        } catch {
          throw badRequest('enqueue track strings must be valid JSON')
        }
      }
      return track
    })

    if (tracks.length == 0 || tracks.some((track) => track?.id == null)) {
      throw badRequest('enqueue body must include one or more tracks with ids')
    }

    return tracks
  }

  _buildMediaPodTrack(track, quality) {
    const { getAlbumCovers } = require('./utils')

    let albumCover = track.album?.cover ? getAlbumCovers(track.album.cover) : {}
    let thumbnail = albumCover.medium?.url || albumCover.low?.url || null
    let resolvedQuality = quality || 'LOSSLESS'
    let proxyUrl = `http://${this._serverIp}:${this._serverPort}/stream/track/${track.id}?quality=${resolvedQuality}`

    return {
      id: String(track.id),
      title: track.title,
      album: track.album?.title || track.album || '',
      album_cover: track.album?.cover || null,
      artist: track.artist?.name || track.artists?.[0]?.name || '',
      duration: track.duration || 0,
      duration_raw: track.duration || 0,
      quality: resolvedQuality.toLowerCase(),
      url: proxyUrl,
      upnp_url: proxyUrl,
      thumbnail: thumbnail
    }
  }

  async _enqueueTracksToMediaPod(pod, tracks, position, quality) {
    const mediaPodTracks = tracks.map((track) => this._buildMediaPodTrack(track, quality))
    const insertPosition = await this._getMediaPodEnqueuePosition(pod, position)

    for (let i = 0; i < mediaPodTracks.length; i++) {
      const response = await fetch(`http://${pod.ip}:${pod.port}/player/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track: mediaPodTracks[i],
          position: insertPosition == -1 ? -1 : insertPosition + i
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to enqueue tracks: ${response.status}`)
      }
    }
  }

  async _getMediaPodEnqueuePosition(pod, position) {
    if (position == null || position == 'end') return -1
    if (/^\d+$/.test(String(position))) return parseInt(position)
    if (position != 'next') throw badRequest('enqueue position must be next, end, or a non-negative integer')

    let response = await fetch(`http://${pod.ip}:${pod.port}/player/status`)
    if (!response.ok) {
      throw new Error(`Failed to fetch player status: ${response.status}`)
    }

    let status = await response.json()
    if (!Number.isInteger(status.index) || status.index < 0) return -1
    return status.index + 1
  }

  _assertQueuePositionParam(position) {
    parseQueuePosition(position)
  }

  _discoverPods() {
    console.log('Discovering MediaPod devices...')

    this._discoverer = new Discoverer(
      (device) => {
        // Device discovered
        const pod = {
          uuid: `${device.name}-${device.ip}`,
          name: device.description,
          ip: device.ip,
          port: device.port
        }
        this._pods[pod.uuid] = pod
        console.log(`[MediaPod] Discovered: ${pod.name} at ${pod.ip}:${pod.port}`)
      },
      (name) => {
        // Device lost
        const podToRemove = Object.values(this._pods).find(p => p.name === name)
        if (podToRemove) {
          console.log(`[MediaPod] Lost: ${podToRemove.name}`)
          delete this._pods[podToRemove.uuid]
        }
      },
      'mediapod',  // device_type
      'mediapod'   // service_type
    )
  }

  async _queueTracksToMediaPod(pod, tracks, playlistId, playlistTitle, quality, position = 0) {

    const { getAlbumCovers } = require('./utils')

    // Build track list with proxy URLs (no API calls yet!)
    let tracksWithUrls = tracks.map((track) => {
      // Get album cover URL
      let albumCover = track.album?.cover ? getAlbumCovers(track.album.cover) : {}
      let thumbnail = albumCover.medium?.url || albumCover.low?.url || null

      // Use local proxy URL - stream URL will be fetched on-demand
      let proxyUrl = `/stream/track/${track.id}?quality=${quality || 'LOSSLESS'}`

      return {
        id: track.id.toString(),
        title: track.title,
        album: track.album?.title || track.album || '',
        album_cover: track.album?.cover || null,
        artist: track.artist?.name || track.artists?.[0]?.name || '',
        duration_raw: track.duration || 0,
        audio_codec: 'FLAC',
        quality: (quality || 'LOSSLESS').toLowerCase(),
        upnp_url: proxyUrl,
        url: proxyUrl,
        thumbnail: thumbnail
      }
    })

    // Start playback
    await fetch(`http://${pod.ip}:${pod.port}/player/clearqueue`, {
      method: 'POST'
    })

    // Queue to MediaPod
    let response = await fetch(`http://${pod.ip}:${pod.port}/player/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_url: `http://${this._serverIp}:${this._serverPort}`,
        playlist: {
          id: playlistId,
          title: playlistTitle,
          tracks: tracksWithUrls
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to queue tracks: ${response.status}`)
    }

    // Start playback at specified position (trackseek starts playing, play just resumes)
    let playResponse = await fetch(`http://${pod.ip}:${pod.port}/player/trackseek/${position}`, {
      method: 'POST'
    })

    if (!playResponse.ok) {
      throw new Error(`Failed to start playback: ${playResponse.status}`)
    }

    return tracksWithUrls
  }

  _getPod(uuid) {
    // Get all pods
    let uuids = Object.keys(this._pods)
    let pods = Object.values(this._pods)

    // If uuid specified, find exact match
    if (uuid != null) {
      let match = pods.find((p) => p.uuid == uuid)
      return match
    }

    // If only one pod, use it
    if (pods.length == 1) {
      return pods[0]
    }

    // Check for default pod in settings
    let defaultPod = this._settings.mediapod
    if (defaultPod && uuids.includes(defaultPod)) {
      return this._pods[defaultPod]
    }

    // Return first pod as fallback
    return pods.length > 0 ? pods[0] : null
  }

  _startServer() {
    // Do not start twice
    if (this._wss) return

    const portfinder = require('portfinder')

    // Find a port for WebSocket server
    portfinder.getPort({ port: this._settings.wsport }, async (err, port) => {
      this._wss = new WebSocket.Server({ port: port })
      this._wss.on('listening', () => {
        console.log(`MediaStation WebSocket server started on port ${port}`)
      })
      this._wss.on('error', (e) => {
        console.error(`Error while starting MediaStation websocket server: ${e}`)
        this._wss = null
      })
      this._wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          console.log(`Received message from client: ${message}`)
        })
        // Send current status to new client
        if (this._lastStatus) {
          ws.send(JSON.stringify(this._lastStatus))
        }
      })

      // Start polling for status updates
      this._startStatusPolling()
    })
  }

  _startStatusPolling() {
    // Poll every second
    this._pollInterval = setInterval(async () => {
      try {
        // Get the active pod
        let pod = this._getPod()
        if (!pod) return

        // Fetch status from MediaPod
        let response = await fetch(`http://${pod.ip}:${pod.port}/player/status`)
        let mediaStatus = await response.json()

        // Transform to Tidal-like format
        let tidalStatus = this._transformStatus(mediaStatus)

        // Enrich current track with full album/artist info
        await this._enrichCurrentTrack(tidalStatus)

        // Broadcast if status changed
        let statusStr = JSON.stringify(tidalStatus)
        if (statusStr !== JSON.stringify(this._lastStatus)) {
          this._lastStatus = tidalStatus
          this._sendStatus()
        }
      } catch (err) {
        // Ignore errors during polling
      }
    }, 1000)
  }

  _transformStatus(mediaStatus) {
    const index = Number.isInteger(mediaStatus.index) ? mediaStatus.index : -1

    return {
      state: mediaStatus.state ? mediaStatus.state.toUpperCase() : 'IDLE',
      queue: {
        id: mediaStatus.playlist?.id || null,
        items: (mediaStatus.playlist?.tracks || []).map((track, idx) => ({
          id: `queue-item-${track.id}`,
          media_id: track.id,
          type: 'track',
          properties: {
            active: (idx === index).toString(),
            sourceId: '0',
            sourceType: 'tidal',
            original_order: idx.toString()
          }
        })),
        offset: 0,
        limit: 100,
        total: mediaStatus.playlist?.tracks?.length || 0,
        etag: `"${Date.now()}"`
      },
      tracks: (mediaStatus.playlist?.tracks || []).map((track) => ({
        mediaId: parseInt(track.id),
        type: 'track',
        item: {
          id: parseInt(track.id),
          editable: false,
          replayGain: 0,
          audioQuality: (track.quality || 'lossless').toUpperCase(),
          audioModes: ['STEREO'],
          title: track.title,
          duration: track.duration_raw || track.duration || 0,
          version: null,
          url: `http://www.tidal.com/track/${track.id}`,
          artists: track.artist ? [{
            id: 0,
            name: track.artist,
            type: 'MAIN'
          }] : [],
          album: {
            id: 0,
            title: track.album || '',
            cover: track.album_cover || null,
            videoCover: null,
            url: null,
            releaseDate: null
          },
          explicit: false,
          volumeNumber: 1,
          trackNumber: 1,
          popularity: 0,
          allowStreaming: true,
          streamReady: true,
          streamStartDate: '1970-01-01T00:00:00.000+0000'
        }
      })),
      position: index,
      progress: mediaStatus.position ? mediaStatus.position * 1000 : 0,
      volume: {
        level: mediaStatus.volume || 0,
        mute: false
      }
    }
  }

  _sendStatus() {
    if (this._wss == null) return
    this._wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(this._lastStatus))
      }
    })
  }

  async shutdown() {
    // Stop polling
    if (this._pollInterval) {
      clearInterval(this._pollInterval)
      this._pollInterval = null
    }

    // Close WebSocket server
    if (this._wss) {
      this._wss.close()
      this._wss = null
    }
  }

  async _enrichCurrentTrack(status) {
    const position = status.position
    if (position < 0 || position >= status.tracks.length) return

    const track = status.tracks[position]?.item
    if (!track?.id) return

    // check cache
    if (this._enrichedTrackId === track.id) {
      if (this._enrichedTrackData.album) track.album = this._enrichedTrackData.album
      if (this._enrichedTrackData.artist) track.artist = this._enrichedTrackData.artist
      if (this._enrichedTrackData.artists) track.artists = this._enrichedTrackData.artists
      return
    }

    // fetch full track info
    try {
      const api = new TidalApi(this._settings)
      const fullTrack = await api.fetchTrackInfo(track.id)

      if (fullTrack.error || fullTrack.httpStatus || !fullTrack.album) return

      // cache it
      this._enrichedTrackId = track.id
      this._enrichedTrackData = {
        album: fullTrack.album,
        artist: fullTrack.artist,
        artists: fullTrack.artists,
      }

      // apply
      track.album = fullTrack.album
      track.artist = fullTrack.artist
      track.artists = fullTrack.artists

    } catch (e) {
      // silently fail
    }
  }

}
