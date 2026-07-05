jest.mock('../src/api')

const TidalApi = require('../src/api')
const User = require('../src/user')

const settings = {}
const req = { userAuth: { user: { id: 1 } } }

const album = {
  id: 1,
  title: 'Album',
  cover: 'album-cover',
  numberOfTracks: 10
}

const track = {
  id: 2,
  title: 'Track',
  album,
  trackNumber: 1
}

const playlist = {
  uuid: 'playlist-1',
  title: 'Playlist',
  squareImage: 'playlist-cover'
}

const artist = {
  id: 3,
  name: 'Artist',
  picture: 'artist-picture'
}

const mix = {
  id: 'mix-1',
  title: 'Mix',
  artifactIdType: 'trackGroupId',
  mixImages: []
}

const feed = {
  items: [
    {
      moduleId: 'ALBUMS',
      title: 'Albums for you',
      type: 'HORIZONTAL_LIST',
      viewAll: 'home/pages/ALBUMS/view-all',
      items: [
        { data: album },
        { data: { unsupported: true } }
      ]
    },
    {
      moduleId: 'MIXED',
      title: 'Recently played',
      type: 'HORIZONTAL_LIST',
      items: [
        { data: playlist },
        { data: track },
        { data: artist },
        { data: mix },
        { data: { mystery: true } }
      ]
    },
    {
      moduleId: 'FALLBACK',
      title: 'Fallback section',
      type: 'HORIZONTAL_LIST',
      viewAll: 'home/pages/FALLBACK/view-all',
      items: [
        { type: 'TRACK', data: track }
      ]
    }
  ]
}

let api
let user

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  api = {
    fetchHomeStaticFeed: jest.fn().mockResolvedValue(feed),
    proxyV2: jest.fn().mockImplementation((path) => {
      if (path === '/home/pages/FALLBACK/view-all') {
        return Promise.resolve({ items: [] })
      }

      return Promise.resolve({
        items: [
          { type: 'ALBUM', data: { ...album, id: 10 } },
          { type: 'UNKNOWN', data: { unsupported: true } }
        ]
      })
    })
  }
  TidalApi.mockImplementation(() => api)
  user = new User(settings)
})

afterEach(() => {
  console.warn.mockRestore()
})

test('gets ordered home sections from the static feed', async () => {
  const sections = await user.getHomeSections(req)

  expect(sections).toEqual([
    {
      id: 'ALBUMS',
      title: 'Albums for you',
      type: 'HORIZONTAL_LIST',
      itemCount: 2,
      hasViewAll: true
    },
    {
      id: 'MIXED',
      title: 'Recently played',
      type: 'HORIZONTAL_LIST',
      itemCount: 5,
      hasViewAll: false
    },
    {
      id: 'FALLBACK',
      title: 'Fallback section',
      type: 'HORIZONTAL_LIST',
      itemCount: 1,
      hasViewAll: true
    }
  ])
})

test('gets typed section items using view all when available', async () => {
  const section = await user.getHomeSectionItems('ALBUMS', req)

  expect(api.proxyV2).toHaveBeenCalledWith('/home/pages/ALBUMS/view-all', { deviceType: 'PHONE' })
  expect(section).toEqual({
    id: 'ALBUMS',
    title: 'Albums for you',
    type: 'HORIZONTAL_LIST',
    items: [
      {
        itemType: 'album',
        data: { ...album, id: 10 }
      }
    ]
  })
})

test('gets typed section items from inline module items', async () => {
  const section = await user.getHomeSectionItems('MIXED', req)

  expect(api.proxyV2).not.toHaveBeenCalled()
  expect(section.items.map((item) => item.itemType)).toEqual([
    'playlist',
    'track',
    'artist',
    'mix'
  ])
})

test('falls back to typed inline items when view all returns no items', async () => {
  const section = await user.getHomeSectionItems('FALLBACK', req)

  expect(api.proxyV2).toHaveBeenCalledWith('/home/pages/FALLBACK/view-all', { deviceType: 'PHONE' })
  expect(section.items).toEqual([
    {
      itemType: 'track',
      data: track
    }
  ])
})

test('returns empty typed items for missing sections', async () => {
  const section = await user.getHomeSectionItems('MISSING', req)

  expect(section).toEqual({
    id: 'MISSING',
    title: null,
    type: null,
    items: []
  })
})

test('keeps legacy module endpoint returning raw item data', async () => {
  const items = await user.getFeedModule('MIXED', req)

  expect(items).toEqual([
    playlist,
    track,
    artist,
    mix,
    { mystery: true }
  ])
})

test('keeps legacy module endpoint using inline fallback when view all is empty', async () => {
  const items = await user.getFeedModule('FALLBACK', req)

  expect(items).toEqual([track])
})
