const TidalConnect = require('../src/connect')
const TidalApi = require('../src/api')

const settings = {
  getUser: jest.fn(() => ({ user: { id: 1 } }))
}

function track(id) {
  return {
    type: 'track',
    item: {
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
}

function queueItem(id, mediaId) {
  return {
    id,
    media_id: String(mediaId),
    type: 'track'
  }
}

function queue(items) {
  return {
    id: 'queue-1',
    etag: 'etag-1',
    total: items.length,
    items
  }
}

function createConnect() {
  const connect = new TidalConnect(settings, { description: 'Device', ip: '127.0.0.1', port: 1 })
  connect.sendCommand = jest.fn().mockResolvedValue()
  return connect
}

function createApi(refreshedQueue, refreshedTracks) {
  return {
    addToQueue: jest.fn().mockResolvedValue({}),
    deleteFromQueue: jest.fn().mockResolvedValue({}),
    reorderQueue: jest.fn().mockResolvedValue({}),
    fetchQueue: jest.fn().mockResolvedValue(refreshedQueue),
    fetchQueueContent: jest.fn().mockResolvedValue(refreshedTracks)
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

test('play next anchors after the current queue item and reloads authoritative state', async () => {
  const connect = createConnect()
  const initialQueue = queue([
    queueItem('q0', 100),
    queueItem('q1', 200),
    queueItem('q2', 300)
  ])
  const refreshedQueue = queue([
    queueItem('q0', 100),
    queueItem('q1', 200),
    queueItem('qn', 250),
    queueItem('q2', 300)
  ])
  const refreshedTracks = [track(100), track(200), track(250), track(300)]
  const api = createApi(refreshedQueue, refreshedTracks)

  connect._status.queue = initialQueue
  connect._status.tracks = [track(100), track(200), track(300)]
  connect._status.position = 1
  connect._lastMediaId = 200

  await connect.enqueueTracks(api, [{ id: 250 }], 'next')

  expect(api.addToQueue).toHaveBeenCalledWith(initialQueue, [{ id: 250 }], 'q1')
  expect(api.fetchQueue).toHaveBeenCalledWith('queue-1')
  expect(connect._status.queue.items.map((item) => item.id)).toEqual(['q0', 'q1', 'qn', 'q2'])
  expect(connect._status.tracks.map((item) => item.item.id)).toEqual([100, 200, 250, 300])
  expect(connect.sendCommand).toHaveBeenCalledWith('refreshQueue', { queueId: 'queue-1' })
})

test('play next appends when there is no safe current queue anchor', async () => {
  const connect = createConnect()
  const initialQueue = queue([
    queueItem('q0', 100),
    queueItem('q1', 200)
  ])
  const refreshedQueue = queue([
    queueItem('q0', 100),
    queueItem('q1', 200),
    queueItem('qn', 300)
  ])
  const api = createApi(refreshedQueue, [track(100), track(200), track(300)])

  connect._status.queue = initialQueue
  connect._status.tracks = [track(100), track(200)]
  connect._status.position = -1
  connect._lastMediaId = 999

  await connect.enqueueTracks(api, [{ id: 300 }], 'next')

  expect(api.addToQueue).toHaveBeenCalledWith(initialQueue, [{ id: 300 }], '')
  expect(connect._status.queue.items.map((item) => item.id)).toEqual(['q0', 'q1', 'qn'])
})

test('backward reorder converts target index to patch after-id semantics', async () => {
  const connect = createConnect()
  const initialQueue = queue([
    queueItem('q0', 100),
    queueItem('q1', 200),
    queueItem('q2', 300),
    queueItem('q3', 400)
  ])
  const refreshedQueue = queue([
    queueItem('q0', 100),
    queueItem('q3', 400),
    queueItem('q1', 200),
    queueItem('q2', 300)
  ])
  const api = createApi(refreshedQueue, [track(100), track(400), track(200), track(300)])

  connect._status.queue = initialQueue
  connect._status.tracks = [track(100), track(200), track(300), track(400)]

  await connect.reorderQueue(api, 3, 1)

  expect(api.reorderQueue).toHaveBeenCalledWith(initialQueue, 'q3', 'q0')
  expect(connect._status.queue.items.map((item) => item.id)).toEqual(['q0', 'q3', 'q1', 'q2'])
})

test('reorder to top sends an empty after-id', async () => {
  const connect = createConnect()
  const initialQueue = queue([
    queueItem('q0', 100),
    queueItem('q1', 200),
    queueItem('q2', 300)
  ])
  const refreshedQueue = queue([
    queueItem('q2', 300),
    queueItem('q0', 100),
    queueItem('q1', 200)
  ])
  const api = createApi(refreshedQueue, [track(300), track(100), track(200)])

  connect._status.queue = initialQueue
  connect._status.tracks = [track(100), track(200), track(300)]

  await connect.reorderQueue(api, 2, 0)

  expect(api.reorderQueue).toHaveBeenCalledWith(initialQueue, 'q2', '')
  expect(connect._status.queue.items.map((item) => item.id)).toEqual(['q2', 'q0', 'q1'])
})

test('dequeue reloads and shifts current position from authoritative content', async () => {
  const connect = createConnect()
  const initialQueue = queue([
    queueItem('q0', 100),
    queueItem('q1', 200),
    queueItem('q2', 300)
  ])
  const refreshedQueue = queue([
    queueItem('q1', 200),
    queueItem('q2', 300)
  ])
  const api = createApi(refreshedQueue, [track(200), track(300)])

  connect._status.queue = initialQueue
  connect._status.tracks = [track(100), track(200), track(300)]
  connect._status.position = 2
  connect._lastMediaId = 300

  await connect.dequeueTrack(api, 0)

  expect(api.deleteFromQueue).toHaveBeenCalledWith(initialQueue, 'q0')
  expect(connect._status.position).toBe(1)
  expect(connect._status.tracks.map((item) => item.item.id)).toEqual([200, 300])
})

test('dequeue current track reloads and clears current position when media is gone', async () => {
  const connect = createConnect()
  const initialQueue = queue([
    queueItem('q0', 100),
    queueItem('q1', 200),
    queueItem('q2', 300)
  ])
  const refreshedQueue = queue([
    queueItem('q0', 100),
    queueItem('q2', 300)
  ])
  const api = createApi(refreshedQueue, [track(100), track(300)])

  connect._status.queue = initialQueue
  connect._status.tracks = [track(100), track(200), track(300)]
  connect._status.position = 1
  connect._lastMediaId = 200

  await connect.dequeueTrack(api, 1)

  expect(api.deleteFromQueue).toHaveBeenCalledWith(initialQueue, 'q1')
  expect(connect._status.position).toBe(-1)
  expect(connect._status.tracks.map((item) => item.item.id)).toEqual([100, 300])
})

test('failed queue API mutations are propagated and do not reload', async () => {
  const connect = createConnect()
  const initialQueue = queue([queueItem('q0', 100)])
  const api = createApi(initialQueue, [track(100)])
  api.addToQueue.mockRejectedValue(new Error('queue failed'))

  connect._status.queue = initialQueue
  connect._status.tracks = [track(100)]

  await expect(connect.enqueueTracks(api, [{ id: 200 }], 'next')).rejects.toThrow('queue failed')
  expect(api.fetchQueue).not.toHaveBeenCalled()
  expect(connect._status.queue.items.map((item) => item.id)).toEqual(['q0'])
})

test('invalid queue mutation inputs fail before touching the queue API', async () => {
  const connect = createConnect()
  const initialQueue = queue([queueItem('q0', 100)])
  const api = createApi(initialQueue, [track(100)])

  connect._status.queue = initialQueue
  connect._status.tracks = [track(100)]

  await expect(connect.enqueueTracks(api, [], 'next')).rejects.toThrow('no tracks to enqueue')
  await expect(connect.dequeueTrack(api, -1)).rejects.toThrow('queue position out of bounds')
  await expect(connect.reorderQueue(api, 0, 2)).rejects.toThrow('queue position out of bounds')
  expect(() => connect.goto(-1)).toThrow('index out of bounds')
  expect(api.addToQueue).not.toHaveBeenCalled()
  expect(api.deleteFromQueue).not.toHaveBeenCalled()
  expect(api.reorderQueue).not.toHaveBeenCalled()
})

test('queue item notifications publish status after async reload completes', async () => {
  const connect = createConnect()
  const messages = []
  let reloadCompleted = false

  connect._reloadQueue = jest.fn().mockImplementation(async () => {
    await Promise.resolve()
    connect._status.queue = queue([queueItem('q0', 100), queueItem('q1', 200)])
    reloadCompleted = true
  })
  connect._wss = {
    clients: new Set([
      {
        send: jest.fn((message) => {
          messages.push(JSON.parse(message))
          expect(reloadCompleted).toBe(true)
        })
      }
    ])
  }

  await connect._processMessage({
    command: 'notifyQueueItemsChanged',
    queueInfo: { queueId: 'queue-1' }
  })

  expect(connect._reloadQueue).toHaveBeenCalledWith('queue-1')
  expect(messages[messages.length - 1].queue.items.map((item) => item.id)).toEqual(['q0', 'q1'])
})

test('queue API throws useful errors for failed mutations and keeps endpoint response shape on success', async () => {
  const api = new TidalApi(settings)
  const response = {
    ok: false,
    status: 409,
    text: jest.fn().mockResolvedValue('etag mismatch'),
    headers: { get: jest.fn() }
  }

  api._callQueue = jest.fn().mockResolvedValue(response)

  await expect(api.addToQueue(queue([]), [{ id: 200 }], '')).rejects.toThrow('Failed to add tracks to queue: 409: etag mismatch')

  const success = {
    ok: true,
    status: 200,
    headers: { get: jest.fn(() => 'etag-2') }
  }
  api._callQueue.mockResolvedValue(success)

  await expect(api.addToQueue(queue([]), [{ id: 200 }], '')).resolves.toBe(success)
})

test('multi-track enqueue uses distinct original order values', async () => {
  const api = new TidalApi(settings)
  const success = {
    ok: true,
    status: 200,
    headers: { get: jest.fn(() => 'etag-2') }
  }
  api._callQueue = jest.fn().mockResolvedValue(success)

  await api.addToQueue(queue([queueItem('q0', 100)]), [{ id: 200 }, { id: 300 }], '')

  const body = JSON.parse(api._callQueue.mock.calls[0][2].body)
  expect(body.items.map((item) => item.properties.original_order)).toEqual([1, 2])
})
