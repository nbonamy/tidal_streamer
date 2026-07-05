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
    proxyV2: jest.fn().mockResolvedValue({
      items: [
        { type: 'ALBUM', data: { ...album, id: 10 } },
        { type: 'UNKNOWN', data: { unsupported: true } }
      ]
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
