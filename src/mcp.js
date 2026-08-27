const { createMcpHandler, McpServer } = require('@modelcontextprotocol/server')
const { toNodeHandler } = require('@modelcontextprotocol/node')
const { z } = require('zod/v4')
const { version } = require('../package.json')

const USER_ID = z.string().min(1).optional().describe('Stored TIDAL user id. Uses the default user when omitted.')
const DEVICE_UUID = z.string().min(1).optional().describe('Playback device UUID. Uses the configured or only device when omitted.')
const TRACK_ID = z.union([z.string(), z.number()])
const TRACK = z.looseObject({
  id: TRACK_ID,
  title: z.string().optional(),
  album: z.unknown().optional(),
  artist: z.unknown().optional(),
  artists: z.array(z.unknown()).optional(),
  duration: z.number().optional(),
  audioModes: z.array(z.string()).optional(),
  audioQuality: z.string().optional()
})

function mcpResult(value) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(value, null, 2)
    }]
  }
}

function mcpError(err) {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: err?.message || String(err)
    }]
  }
}

function encodePath(value) {
  return encodeURIComponent(String(value))
}

function createRestClient(port, fetchImpl = fetch) {
  return async function request({ method = 'GET', path, query, body, userId }) {
    const url = new URL(path, `http://127.0.0.1:${port}`)
    for (const [key, value] of Object.entries(query || {})) {
      if (value != null) url.searchParams.set(key, String(value))
    }

    const headers = { Accept: 'application/json' }
    if (userId) headers['X-User-Id'] = userId
    if (body != null) headers['Content-Type'] = 'application/json'

    const response = await fetchImpl(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body)
    })

    let payload
    try {
      payload = await response.json()
    } catch {
      throw new Error(`Tidal streamer returned ${response.status} with an invalid JSON response`)
    }

    if (!response.ok || payload?.status === 'error') {
      throw new Error(payload?.error || `Tidal streamer request failed with status ${response.status}`)
    }

    if (payload?.status === 'ok' && Object.hasOwn(payload, 'result')) {
      return payload.result
    }
    return payload
  }
}

function createServer(request) {
  const server = new McpServer({
    name: 'tidal-streamer',
    version
  })

  const register = (name, config, handler) => {
    server.registerTool(name, config, async (args) => {
      try {
        return mcpResult(await handler(args))
      } catch (err) {
        return mcpError(err)
      }
    })
  }

  register('search', {
    description: 'Search TIDAL for artists, albums, or tracks.',
    inputSchema: z.object({
      type: z.enum(['artist', 'album', 'track']),
      query: z.string().min(1),
      userId: USER_ID
    }),
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, ({ type, query, userId }) => request({
    path: `/search/${type}`,
    query: { query },
    userId
  }))

  register('get_collection', {
    description: 'Get an album with its tracks, playlist tracks, or mix tracks from TIDAL.',
    inputSchema: z.object({
      type: z.enum(['album', 'playlist', 'mix']),
      id: z.union([z.string(), z.number()]),
      userId: USER_ID
    }),
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, ({ type, id, userId }) => {
    const paths = {
      album: `/info/album/${encodePath(id)}`,
      playlist: `/info/playlist/${encodePath(id)}`,
      mix: `/info/mix/${encodePath(id)}/tracks`
    }
    return request({ path: paths[type], userId })
  })

  register('get_user_library', {
    description: 'Browse a section of the current user\'s TIDAL library or recommendations.',
    inputSchema: z.object({
      section: z.enum([
        'artists', 'albums', 'playlists', 'tracks', 'new_albums', 'new_tracks',
        'recent_artists', 'recommended_albums', 'forgotten_albums', 'popular_playlists',
        'essential_playlists', 'updated_playlists', 'recommended_playlists', 'daily_mixes',
        'history_mixes', 'radio_mixes', 'spotlighted_tracks', 'uploads'
      ]),
      userId: USER_ID
    }),
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, ({ section, userId }) => {
    const paths = {
      artists: '/user/artists',
      albums: '/user/albums',
      playlists: '/user/playlists',
      tracks: '/user/tracks',
      new_albums: '/user/new/albums',
      new_tracks: '/user/new/tracks',
      recent_artists: '/user/recent/artists',
      recommended_albums: '/user/recommended/albums',
      forgotten_albums: '/user/forgotten/albums',
      popular_playlists: '/user/playlists/popular',
      essential_playlists: '/user/playlists/essential',
      updated_playlists: '/user/playlists/updated',
      recommended_playlists: '/user/playlists/recommended',
      daily_mixes: '/user/mixes/daily',
      history_mixes: '/user/mixes/history',
      radio_mixes: '/user/mixes/radio',
      spotlighted_tracks: '/user/tracks/spotlighted',
      uploads: '/user/tracks/uploads'
    }
    return request({ path: paths[section], userId })
  })

  register('list_devices', {
    description: 'List playback devices discovered by tidal-streamer.',
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, () => request({ path: '/list' }))

  register('get_playback_status', {
    description: 'Get normalized playback status, queue, current track, progress, and volume.',
    inputSchema: z.object({ deviceUuid: DEVICE_UUID }),
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, ({ deviceUuid }) => request({
    path: '/status',
    query: { uuid: deviceUuid, format: 'tidal' }
  }))

  register('play_collection', {
    description: 'Replace the playback queue and play a TIDAL album, playlist, or mix.',
    inputSchema: z.object({
      type: z.enum(['album', 'playlist', 'mix']),
      id: z.union([z.string(), z.number()]),
      position: z.number().int().nonnegative().default(0),
      deviceUuid: DEVICE_UUID
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
  }, ({ type, id, position, deviceUuid }) => request({
    path: `/play/${type}/${encodePath(id)}`,
    query: { position, uuid: deviceUuid }
  }))

  register('play_tracks', {
    description: 'Replace the playback queue and play track objects returned by TIDAL search or metadata tools.',
    inputSchema: z.object({
      tracks: z.array(TRACK).min(1),
      position: z.number().int().nonnegative().default(0),
      deviceUuid: DEVICE_UUID
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true }
  }, ({ tracks, position, deviceUuid }) => request({
    method: 'POST',
    path: '/play/tracks',
    query: { position, uuid: deviceUuid },
    body: { items: tracks }
  }))

  register('enqueue_tracks', {
    description: 'Add track objects returned by TIDAL search or metadata tools to the current queue.',
    inputSchema: z.object({
      tracks: z.array(TRACK).min(1),
      position: z.union([z.literal('next'), z.literal('end'), z.number().int().nonnegative()]).default('end'),
      deviceUuid: DEVICE_UUID
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
  }, ({ tracks, position, deviceUuid }) => request({
    method: 'POST',
    path: `/enqueue/${encodePath(position)}`,
    query: { uuid: deviceUuid },
    body: { items: tracks }
  }))

  register('control_playback', {
    description: 'Control current playback or adjust volume.',
    inputSchema: z.object({
      action: z.enum(['play', 'pause', 'stop', 'next', 'previous', 'volume_up', 'volume_down']),
      deviceUuid: DEVICE_UUID
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
  }, ({ action, deviceUuid }) => {
    const paths = {
      play: '/play',
      pause: '/pause',
      stop: '/stop',
      next: '/next',
      previous: '/prev',
      volume_up: '/volume/up',
      volume_down: '/volume/down'
    }
    return request({ method: 'POST', path: paths[action], query: { uuid: deviceUuid } })
  })

  register('seek', {
    description: 'Seek to a queue index or a playback time in seconds.',
    inputSchema: z.object({
      type: z.enum(['track', 'time']),
      position: z.number().int().nonnegative(),
      deviceUuid: DEVICE_UUID
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
  }, ({ type, position, deviceUuid }) => request({
    method: 'POST',
    path: type === 'track' ? `/trackseek/${position}` : `/timeseek/${position}`,
    query: { uuid: deviceUuid }
  }))

  register('set_track_favorite', {
    description: 'Add, remove, or toggle a track in the current user\'s TIDAL favorites.',
    inputSchema: z.object({
      trackId: TRACK_ID,
      action: z.enum(['add', 'remove', 'toggle']),
      userId: USER_ID
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
  }, ({ trackId, action, userId }) => {
    const suffix = action === 'toggle' ? '/toggle' : ''
    return request({
      method: action === 'remove' ? 'DELETE' : 'POST',
      path: `/user/tracks/${encodePath(trackId)}/favorite${suffix}`,
      userId
    })
  })

  register('create_playlist', {
    description: 'Create a TIDAL playlist for the current user.',
    inputSchema: z.object({
      title: z.string().min(1),
      description: z.string().default(''),
      userId: USER_ID
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
  }, ({ title, description, userId }) => request({
    method: 'POST',
    path: '/playlist/create',
    body: { title, description },
    userId
  }))

  register('add_tracks_to_playlist', {
    description: 'Add TIDAL track ids to an existing playlist for the current user.',
    inputSchema: z.object({
      playlistId: z.union([z.string(), z.number()]),
      trackIds: z.array(TRACK_ID).min(1),
      userId: USER_ID
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
  }, ({ playlistId, trackIds, userId }) => request({
    method: 'POST',
    path: '/playlist/add',
    body: { playlistId, trackIds },
    userId
  }))

  return server
}

function createMcpEndpoint({ port, fetchImpl }) {
  const request = createRestClient(port, fetchImpl)
  const handler = createMcpHandler(() => createServer(request))
  const nodeHandler = toNodeHandler(handler, {
    onerror: (err) => console.error(`MCP request failed: ${err.message}`)
  })

  return {
    route: (req, res) => void nodeHandler(req, res, req.body),
    close: () => handler.close(),
    handler
  }
}

module.exports = { createMcpEndpoint, createRestClient, createServer }
