jest.mock('../src/discoverer', () => jest.fn())

const MediaStationStreamer = require('../src/streamer_mediastation')

const pod = {
  ip: '192.168.1.9',
  port: 8001
}

function createStreamer() {
  const streamer = Object.create(MediaStationStreamer.prototype)
  streamer._serverIp = '192.168.1.2'
  streamer._serverPort = 5002
  return streamer
}

function track(id) {
  return {
    id,
    title: `Track ${id}`,
    album: {
      title: `Album ${id}`,
      cover: `cover-${id}`
    },
    artists: [{ name: `Artist ${id}` }],
    duration: id
  }
}

function response(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body)
  }
}

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.restoreAllMocks()
  delete global.fetch
})

test('play next sends MediaPod track-position payloads after current index', async () => {
  const streamer = createStreamer()
  global.fetch
    .mockResolvedValueOnce(response({ index: 3 }))
    .mockResolvedValueOnce(response({ status: 'ok' }))
    .mockResolvedValueOnce(response({ status: 'ok' }))

  await streamer._enqueueTracksToMediaPod(pod, [track(10), track(11)], 'next', 'LOSSLESS')

  expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://192.168.1.9:8001/player/status')

  const firstBody = JSON.parse(global.fetch.mock.calls[1][1].body)
  const secondBody = JSON.parse(global.fetch.mock.calls[2][1].body)

  expect(global.fetch.mock.calls[1][0]).toBe('http://192.168.1.9:8001/player/enqueue')
  expect(firstBody.position).toBe(4)
  expect(firstBody.track.id).toBe('10')
  expect(firstBody.track.url).toBe('http://192.168.1.2:5002/stream/track/10?quality=LOSSLESS')
  expect(firstBody.track.upnp_url).toBe(firstBody.track.url)
  expect(firstBody.track.album_cover).toBe('cover-10')
  expect(secondBody.position).toBe(5)
  expect(secondBody.track.id).toBe('11')
})

test('play next appends when player status has no current index', async () => {
  const streamer = createStreamer()
  global.fetch
    .mockResolvedValueOnce(response({ index: null }))
    .mockResolvedValueOnce(response({ status: 'ok' }))

  await streamer._enqueueTracksToMediaPod(pod, [track(10)], 'next', undefined)

  const body = JSON.parse(global.fetch.mock.calls[1][1].body)
  expect(body.position).toBe(-1)
})

test('add to queue sends append position without fetching status', async () => {
  const streamer = createStreamer()
  global.fetch.mockResolvedValueOnce(response({ status: 'ok' }))

  await streamer._enqueueTracksToMediaPod(pod, [track(12)], 'end', 'HIGH')

  expect(global.fetch).toHaveBeenCalledTimes(1)
  const body = JSON.parse(global.fetch.mock.calls[0][1].body)
  expect(body.position).toBe(-1)
  expect(body.track.quality).toBe('high')
  expect(body.track.url).toBe('http://192.168.1.2:5002/stream/track/12?quality=HIGH')
})

test('numeric enqueue position inserts at that exact position and preserves order', async () => {
  const streamer = createStreamer()
  global.fetch
    .mockResolvedValueOnce(response({ status: 'ok' }))
    .mockResolvedValueOnce(response({ status: 'ok' }))

  await streamer._enqueueTracksToMediaPod(pod, [track(20), track(21)], '2')

  expect(global.fetch).toHaveBeenCalledTimes(2)
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).position).toBe(2)
  expect(JSON.parse(global.fetch.mock.calls[1][1].body).position).toBe(3)
})

test('invalid enqueue positions and bodies fail before mutating MediaPod', async () => {
  const streamer = createStreamer()

  expect(() => streamer._parseQueueTracks([])).toThrow('enqueue body must include one or more tracks with ids')
  expect(() => streamer._parseQueueTracks(['{bad json'])).toThrow('enqueue track strings must be valid JSON')
  await expect(streamer._enqueueTracksToMediaPod(pod, [track(1)], 'front')).rejects.toThrow('enqueue position must be next, end, or a non-negative integer')
  expect(global.fetch).not.toHaveBeenCalled()
})

test('failed MediaPod enqueue response rejects instead of returning ok', async () => {
  const streamer = createStreamer()
  global.fetch
    .mockResolvedValueOnce(response({ index: 0 }))
    .mockResolvedValueOnce(response({ error: 'failed' }, false, 500))

  await expect(streamer._enqueueTracksToMediaPod(pod, [track(10)], 'next')).rejects.toThrow('Failed to enqueue tracks: 500')
})

test('tidal status transform preserves missing player index instead of selecting first song', () => {
  const streamer = createStreamer()

  const status = streamer._transformStatus({
    state: 'stopped',
    index: null,
    playlist: {
      id: 'playlist-1',
      tracks: [
        { id: '10', title: 'Track 10' },
        { id: '11', title: 'Track 11' }
      ]
    }
  })

  expect(status.position).toBe(-1)
  expect(status.queue.items.map((item) => item.properties.active)).toEqual(['false', 'false'])
})
