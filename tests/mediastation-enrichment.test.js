jest.mock('../src/discoverer', () => jest.fn().mockImplementation(() => ({ close: jest.fn() })))
jest.mock('../src/api')

const http = require('node:http')
const express = require('express')
const TidalApi = require('../src/api')
const MediaStationStreamer = require('../src/streamer_mediastation')

let streamer, server, fetchTrackInfo, mediaStatus

function status() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${server.address().port}/status?format=tidal`, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (error) { reject(error) }
      })
    }).on('error', reject)
  })
}

beforeEach(async () => {
  fetchTrackInfo = jest.fn().mockResolvedValue({ album: { id: 7, title: 'Tidal album' } })
  TidalApi.mockImplementation(() => ({ fetchTrackInfo }))
  streamer = Object.create(MediaStationStreamer.prototype)
  streamer._settings = {}
  streamer._pods = { pod: { ip: '192.168.1.9', port: 8000 } }
  mediaStatus = {
    state: 'playing', index: 0,
    playlist: { tracks: [{ id: '156556', title: 'drivers license', album: 'Local album', url: '/download/song.flac?id=156556' }] }
  }
  global.fetch = jest.fn(async () => ({ json: async () => mediaStatus }))
  const app = express()
  app.use(streamer.routes())
  server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
  })
})

afterEach(async () => {
  await streamer.shutdown()
  await new Promise((resolve) => server.close(resolve))
  jest.restoreAllMocks()
  delete global.fetch
})

test('local playback status never looks up a MediaStation id in Tidal', async () => {
  expect((await status()).tracks[0].item.album.title).toBe('Local album')
  await status()
  expect(fetchTrackInfo).not.toHaveBeenCalled()
})

test.each([
  '/stream/track/42?quality=LOSSLESS',
  'http://192.168.1.2:5002/stream/track/42?quality=HIGH',
  'http://192.168.1.2:8000/tidal/stream/track/42'
])('enriches genuine Tidal playback from its stream URL: %s', async (url) => {
  mediaStatus.playlist.tracks[0].url = url
  expect((await status()).tracks[0].item.album.title).toBe('Tidal album')
  expect((await status()).tracks[0].item.album.title).toBe('Tidal album')
  expect(fetchTrackInfo).toHaveBeenCalledTimes(1)
  expect(fetchTrackInfo).toHaveBeenCalledWith('42')
  // A local file can have the same numeric id as a previously enriched track.
  mediaStatus.playlist.tracks[0].id = '42'
  mediaStatus.playlist.tracks[0].url = '/download/local.flac?id=42'
  expect((await status()).tracks[0].item.album.title).toBe('Local album')
  expect(fetchTrackInfo).toHaveBeenCalledTimes(1)
})

test.each(['api error', 'missing album', 'network failure'])('backs off after %s and retries later', async (failure) => {
  let now = 1000
  jest.spyOn(Date, 'now').mockImplementation(() => now)
  mediaStatus.playlist.tracks[0].url = '/stream/track/42'
  if (failure === 'network failure') fetchTrackInfo.mockRejectedValueOnce(new Error('offline'))
  else fetchTrackInfo.mockResolvedValueOnce(failure === 'api error' ? { httpStatus: 404 } : {})

  expect((await status()).tracks[0].item.album.title).toBe('Local album')
  now += 1000
  await status()
  expect(fetchTrackInfo).toHaveBeenCalledTimes(1)
  now += 60000
  expect((await status()).tracks[0].item.album.title).toBe('Tidal album')
  expect(fetchTrackInfo).toHaveBeenCalledTimes(2)
})

test('overlapping status requests share the pending enrichment', async () => {
  mediaStatus.playlist.tracks[0].url = '/stream/track/42'
  let finish
  let requested
  const started = new Promise((resolve) => { requested = resolve })
  const pending = new Promise((resolve) => { finish = resolve })
  fetchTrackInfo.mockImplementation(() => {
    requested()
    return pending
  })
  const first = status()
  await started
  const second = status()
  // Wait until both native status reads have reached the route.
  while (global.fetch.mock.calls.length < 2) await new Promise((resolve) => setImmediate(resolve))
  finish({ album: { title: 'Tidal album' } })
  const results = await Promise.all([first, second])
  expect(results.map((result) => result.tracks[0].item.album.title)).toEqual(['Tidal album', 'Tidal album'])
  expect(fetchTrackInfo).toHaveBeenCalledTimes(1)
})

test('background polling also skips local tracks and still publishes their status', async () => {
  let published
  const sent = new Promise((resolve) => { published = resolve })
  streamer._sendStatus = published
  streamer._startStatusPolling()
  await sent
  expect(streamer._lastStatus.tracks[0].item.title).toBe('drivers license')
  expect(fetchTrackInfo).not.toHaveBeenCalled()
})
