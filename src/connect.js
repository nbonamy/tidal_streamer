const tls = require('tls')
const WebSocket = require('ws')
const TidalApi = require('./api')
const { getAlbumCovers } = require('./utils')

const CONNECT_WAIT_DELAY = 1000
const CONNECT_RETRY_DELAY = 5000

module.exports = class {

  constructor(settings, device, wss) {
    this._settings = settings
    this._device = device
    this._wss = wss
    this._reset()
  }

  _resetStatus() {
    this._lastMediaId = null
    this._enrichedTrackId = null
    this._enrichedTrackData = null
    this._status = {
      state: 'STOPPED',
      queue: null,
      tracks: [],
      position: -1,
      progress: 0,
      volume: { level: null, mute: true },
    }
    this._sendStatus()
  }

  device() {
    return this._device
  }

  async status() {
    await this._enrichCurrentTrack()
    return this._status
  }

  _reset() {
    
    // Clear heartbeat first
    if (this._heartbeat) {
      clearInterval(this._heartbeat)
      this._heartbeat = null
    }

    // Clean up WebSocket
    if (this._ws) {
      this._ws.removeAllListeners()
      this._ws = null
    }

    this._reqid = 0
    this._sessionId = 0
    this._resetStatus()
  }

  async shutdown() {
    
    console.log(`[${this._device.description}] disconnecting`)

    // Clear heartbeat
    if (this._heartbeat) {
      clearInterval(this._heartbeat)
      this._heartbeat = null
    }

    // Close WebSocket cleanly
    if (this._ws) {
      const ws = this._ws
      this._ws = null
      ws.removeAllListeners()
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Client shutdown')
        // Wait for close
        await new Promise(resolve => {
          ws.once('close', resolve)
          setTimeout(resolve, 2000)
        })
      }
    }

    console.log(`[${this._device.description}] disconnected`)

    this._reset()
  }

  _connect() {

    // Wait for user id (get first user for backward compat)
    const user = this._settings.getUser()
    if (!user?.user?.id) {
      this._retryTimer = setTimeout(() => this._connect(), CONNECT_WAIT_DELAY)
      return Promise.resolve()
    }

    // Already connected
    if (this._ws != null && this._ws.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }

    // Clear retry timer
    clearTimeout(this._retryTimer)
    this._retryTimer = null

    return new Promise((resolve, reject) => {

      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        try {
          this._ws.removeAllListeners()
          this._ws.close()
        } catch (e) {
          console.log(`[${this._device.description}] error closing existing websocket: ${e.message}`)
        } finally {
          this._ws = null
        }
      }

      if (this._heartbeat) {
        clearInterval(this._heartbeat)
        this._heartbeat = null
      }

      // Fresh agent - no TLS session cache
      const agent = new (require('https').Agent)({
        maxCachedSessions: 0,
        keepAlive: false
      })

      this._ws = new WebSocket(`wss://${this._device.ip}:${this._device.port}`, {
        agent,
        rejectUnauthorized: false,
        // secureProtocol: 'TLSv1_2_method',
        // ciphers: 'AES256-GCM-SHA384',
        // checkServerIdentity: () => undefined
      })

      // Track if connection was established
      let connectionEstablished = false

      // Attach error handler FIRST
      this._ws.on('error', (e) => {
        console.log(`[${this._device.description}] websocket error: ${e.message}`)
        clearInterval(this._heartbeat)
        this._heartbeat = null
        if (!connectionEstablished) {
          reject(e)
        }
      })

      // Handle close event (both before and after connection)
      this._ws.on('close', (code, reason) => {
        if (this._heartbeat) {
          clearInterval(this._heartbeat)
          this._heartbeat = null
        }
        if (!connectionEstablished) {
          console.log(`[${this._device.description}] connection closed before established`)
          reject(new Error('WebSocket closed before connection was established'))
        } else {
          console.log(`[${this._device.description}] websocket closed with code: ${code} ${reason}`)
        }
      })

      this._ws.on('open', () => {
        connectionEstablished = true
        console.log(`[${this._device.description}] connected to ${this._device.ip}:${this._device.port}`)
        setTimeout(() => {
          const user = this._settings.getUser()
          this._ws.send(JSON.stringify({
            command: 'startSession',
            appId: 'tidal',
            appName: 'tidal',
            sessionCredential: user.user.id.toString()
          }))
        }, 500)
        this._heartbeat = setInterval(() => {
          if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.ping()
          }
        }, 1000)
        resolve()
      })

      this._ws.on('message', (message) => {
        this._processMessage(JSON.parse(message.toString())).catch((err) => {
          console.log(`[${this._device.description}] failed to process message: ${err.message}`)
        })
      })

    })
  }

  async _close() {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.close(1000, 'Client shutdown')
      await new Promise(resolve => {
        this._ws.once('close', resolve)
        setTimeout(resolve, 2000) // Timeout after 2s
      })
    }
  }
    
  async loadQueue(api, queue, tracks) {

    // clear reset timer
    clearTimeout(this._resetTimer)
    this._resetTimer = null

    // get position
    let position = parseInt(queue.properties?.position || 0)

    // big payload!
    let params = {
      autoplay: true,
      position: position,
    }
    params.queueServerInfo = {
      serverUrl: `${api.getQueueBaseUrl()}/queues`,
      authInfo: api.getAuthInfo(),
      httpHeaderFields: [],
      queryParameters: {}      
    }
    params.contentServerInfo = {
      serverUrl: `${api.getApiBaseUrl()}`,
      authInfo: api.getAuthInfo(),
      httpHeaderFields: [],
      queryParameters: {
        audiomode: tracks[0].item.audioModes[0],
        audioquality: tracks[0].item.audioQuality,
      }     
    }
    params.queueInfo = {
      queueId: queue.id,
      repeatMode: queue.repeat_mode || false,
      shuffled: queue.shuffled || false,
      maxBeforeSize: 10,
      maxAfterSize: 10
    }
    params.currentMediaInfo = {
      itemId: queue.items[position].id,
      mediaId: queue.items[position].media_id,
      mediaType: 0,
      metadata: {
        title: tracks[position].item.title,
        artists: tracks[position].item.artists?.map((a) => a.name),
        albumTitle: tracks[position].item.album?.title,
        duration: tracks[position].item.duration * 1000,
        images: getAlbumCovers(tracks[position].item.album?.cover)
      }
    }

    // save
    this._status.progress = 0
    this._status.position = position
    this._status.tracks = tracks
    this._status.queue = queue
    
    // do it
    await this.sendCommand('loadCloudQueue', params)
    await this.sendCommand('refreshQueue', { queueId: queue.id })

  }

  async enqueueTracks(api, tracks, position) {

    // the queue
    let queue = this._status?.queue
    if (queue?.id == null) throw new Error('queue not loaded')
    if (!Array.isArray(tracks) || tracks.length == 0) throw new Error('no tracks to enqueue')

    // position can be next: anchor to the current queue item if it is known.
    // Otherwise use the old append behavior so local and server ordering agree.
    const currentPosition = this._status.position
    const currentIndex = position == 'next' ? this._getCurrentQueueIndex(queue, currentPosition) : -1
    const afterId = currentIndex >= 0 ? queue.items[currentIndex].id : ''

    await api.addToQueue(queue, tracks, afterId)
    await this._refreshQueueFromServer(api, queue.id)

  }

  async dequeueTrack(api, position) {

    // the queue
    let queue = this._status?.queue
    if (queue?.id == null) throw new Error('queue not loaded')
    this._assertQueuePosition(queue, position)

    // remove at queue server
    let trackId = queue.items[position].id
    await api.deleteFromQueue(queue, trackId)

    await this._refreshQueueFromServer(api, queue.id)
  
  }

  async reorderQueue(api, from, to) {

    // the queue
    let queue = this._status?.queue
    if (queue?.id == null) throw new Error('queue not loaded')
    this._assertQueuePosition(queue, from)
    this._assertQueuePosition(queue, to)
    if (from == to) return

    // PATCH uses "after item id" semantics. Convert the requested target index
    // to the item that will precede the moved item after removal.
    let moveId = queue.items[from].id
    let afterId = this._getReorderAfterId(queue, from, to)
    await api.reorderQueue(queue, moveId, afterId)

    await this._refreshQueueFromServer(api, queue.id)
  
  }

  goto(position) {

    // check
    if (!Number.isInteger(position) || position < 0 || position > this._status.tracks.length - 1) {
      throw new Error('index out of bounds')
    }
    if (!this._status.queue?.items?.[position]) {
      throw new Error('queue item not found')
    }

    // build payload
    let item = this._status.tracks[position].item
    let payload = {
      mediaInfo: {
        itemId: this._status.queue.items[position].id,
        mediaId: `${item.id}`,
        mediaType: 0,
        metadata: {
          title: item.title,
          albumTitle: item.album.title,
          artists: item.artists.map((a) => a.name),
          duration: item.duration * 1000,
          images: getAlbumCovers(item.album.cover),
        },
      },
      policy: {
        canNext: true,
        canPrevious: true,
      }
    }

    // save
    this._status.progress = 0
    this._status.position = position

    // do it
    this.sendCommand('selectQueueItem', payload)
  }

  async stop() {
    // stop does not work when paused
    await this.sendCommand('play')
    this.sendCommand('stop')
    this._resetStatus();
  }

  sendCommand(command, params) {
    return this._sendMessage(JSON.stringify({
      'command': command,
      'requestId': this._reqid++,
      ...params
    }))
  }

  async _sendMessage(message) {
    try {
      await this._connect()
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._ws.send(message)
      } else {
        console.log(`[${this._device.description}] cannot send message - connection not ready`)
      }
    } catch (e) {
      console.log(`[${this._device.description}] failed to send message: ${e.message}`)
      // Connection will auto-retry via retry timer
    }
  }

  async _reloadQueue(queueId, api = null) {

    // log
    console.log(`Reloading queue ${queueId}`)

    // we need an api (use first user for backward compat)
    api = api || new TidalApi(this._settings, this._settings.getUser())

    // fetch queue
    let queue = await api.fetchQueue(queueId)

    // now fetch content
    let tracks = await api.fetchQueueContent(queue)

    // save all
    this._status.queue = queue
    this._status.tracks = tracks
    this._setStatusPosition()

    // enrich current track with full album/artist info
    await this._enrichCurrentTrack()

  }

  async _refreshQueueFromServer(api, queueId) {
    await this._reloadQueue(queueId, api)
    await this.sendCommand('refreshQueue', { queueId })
    this._sendStatus()
  }

  _assertQueuePosition(queue, position) {
    if (!Number.isInteger(position) || position < 0 || position >= queue.items.length) {
      throw new Error('queue position out of bounds')
    }
  }

  _getCurrentQueueIndex(queue, position) {
    if (!queue?.items?.length) return -1

    if (this._lastMediaId != null) {
      return queue.items.findIndex((item) => item.media_id == this._lastMediaId)
    }

    if (Number.isInteger(position) && position >= 0 && position < queue.items.length) {
      return position
    }

    return -1
  }

  _getReorderAfterId(queue, from, to) {
    const remainingItems = queue.items.filter((_, index) => index != from)
    if (to == 0) return ''
    return remainingItems[to - 1]?.id || ''
  }

  _getLastMediaPosition() {
    if (this._lastMediaId == null) return -1
    else if (this._status.tracks == null) return -1
    return this._status.tracks.findIndex((t) => t.item.id == this._lastMediaId)
  }

  _setStatusPosition() {
    let old_position = this._status.position
    let new_position = this._getLastMediaPosition()
    if (new_position != old_position) {
      this._status.position = new_position
      console.log(`Position updated: ${this._status.position}`)
    }
  }

  async _enrichCurrentTrack() {
    const position = this._status.position
    console.log(`[enrich] position=${position}, tracks=${this._status.tracks?.length}`)

    if (position < 0 || position >= this._status.tracks.length) {
      console.log('[enrich] invalid position')
      return
    }

    const track = this._status.tracks[position]?.item
    if (!track?.id) {
      console.log('[enrich] no track id')
      return
    }

    console.log(`[enrich] track.id=${track.id}, cached=${this._enrichedTrackId}`)

    // check cache
    if (this._enrichedTrackId === track.id) {
      this._applyEnrichedData(track)
      console.log('[enrich] using cache')
      return
    }

    // fetch full track info
    try {
      const api = new TidalApi(this._settings, this._settings.getUser())
      console.log(`[enrich] fetching track info for ${track.id}`)
      const fullTrack = await api.fetchTrackInfo(track.id)
      console.log(`[enrich] got response: album.id=${fullTrack.album?.id}, error=${fullTrack.error}`)

      if (fullTrack.error || fullTrack.httpStatus || !fullTrack.album) {
        console.log('[enrich] API error:', fullTrack)
        return
      }

      // cache it
      this._enrichedTrackId = track.id
      this._enrichedTrackData = {
        album: fullTrack.album,
        artist: fullTrack.artist,
        artists: fullTrack.artists,
      }

      // apply
      this._applyEnrichedData(track)
      console.log(`[enrich] SUCCESS album.id=${fullTrack.album?.id}, artist.id=${fullTrack.artist?.id}`)

    } catch (e) {
      console.log('[enrich] exception:', e.message)
    }
  }

  _applyEnrichedData(track) {
    if (!this._enrichedTrackData) return
    if (this._enrichedTrackData.album) track.album = this._enrichedTrackData.album
    if (this._enrichedTrackData.artist) track.artist = this._enrichedTrackData.artist
    if (this._enrichedTrackData.artists) track.artists = this._enrichedTrackData.artists
  }

  _sendStatus() {
    if (this._wss == null) return
    this._wss.clients.forEach((client) => {
      client.send(JSON.stringify(this._status))
    })
  }

  async _processMessage(message) {

    // debug
    // if (message.command != 'notifyPlayerStatusChanged') {
    //   console.dir(message, { depth: null })
    // }

    //
    if (message.command == 'notifySessionStarted') {
      if (this._sessionId == 0) {
        this._sessionId = message.sessionId
      }
      return
    }

    //
    if (message.command == 'notifySessionEnded') {
      this.shutdown()
      //this.connect()
      return
    }

    //
    if (message.command == 'notifyRequestResult') {
      return
    }

    //
    if (message.command == 'notifyDeviceStatusChanged') {
      this._status.volume = message.volume
      this._sendStatus()
      return
    }

    //
    if (message.command == 'notifyQueueChanged') {
      let queueId = message.queueInfo.queueId
      if (this._status.queue == null || this._status.queue.id != queueId) {
        await this._reloadQueue(queueId)
        this._sendStatus()
      }
      return
    }

    //
    if (message.command == 'notifyQueueItemsChanged') {
      await this._reloadQueue(message.queueInfo.queueId)
      this._sendStatus()
      return
    }

    //
    if (message.command == 'notifyMediaChanged') {
      this._status.progress = 0
      this._lastMediaId = message.mediaInfo.mediaId
      this._setStatusPosition()
      this._enrichCurrentTrack()
      this._sendStatus()
      return
    }

    //
    if (message.command == 'notifyPlayerStatusChanged') {
      
      // update
      if (this._status.tracks.length) {
        this._status.state = message.playerState
        this._status.progress = message.progress
      }

      // detect end of album
      if (message.playerState === 'PAUSED' && message.progress > message.duration - 500) {
        if (this._status.position == this._status.tracks.length - 1) {
          this.stop()
          return
        }
      }

      // normal
      this._sendStatus()
      return
    }

    //
    if (message.command == 'notifySessionError') {
      console.log(`[ERR] ${this._device.ip}: Unsuccessful connection. Retrying in ${CONNECT_RETRY_DELAY} ms.`)
      this._retryTimer = setTimeout(() => {
        this._connect().catch(e => {
          console.log(`[${this._device.description}] retry connection failed: ${e.message}`)
        })
      }, CONNECT_RETRY_DELAY)
      return
    }

    //
    if (message.command.endsWith('Error')) {
      console.error(`[ERR] ${this._device.ip}: ${JSON.stringify(message)}`)
      return
    }

    // not processed
    console.log(`Unknow message received from device: ${message.command}`)
    
  }

}
