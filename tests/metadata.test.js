
const Config = require('../src/config')
const Metadata = require('../src/metadata');

let url = null
console.debug = console.log
console.log = function(str) {
  url = str
}

let metadata = null

beforeEach(() => {
  metadata = new Metadata(new Config())
})

test('get album info', async () => {
  const album = await metadata.getAlbumInfo('293301129')
  expect(url).toBe('[OUT] GET https://api.tidal.com/v1/albums/293301129/items?countryCode=US&offset=0&limit=100')
  expect(album.id).toBe(293301129)
  expect(album.type).toBe('ALBUM')
  expect(album.title).toBe('Random Access Memories (10th Anniversary Edition)')
  expect(album.numberOfTracks).toBe(22)
  expect(album.releaseDate).toBe('2013-05-20')
  expect(album.audioQuality).toBe('LOSSLESS')
  expect(album.audioModes).toStrictEqual(['STEREO'])
  expect(album.artist.id).toBe(8847)
  expect(album.artist.name).toBe('Daft Punk')
  expect(album.artist.type).toBe('MAIN')
  expect(album.artists).toHaveLength(1)
  expect(album.artists[0]).toStrictEqual(album.artist)
  expect(album.items).toHaveLength(22)
  expect(album.items[0].item.id).toBe(293301134)
  expect(album.items[0].item.title).toBe('Give Life Back to Music')
  expect(album.items[0].item.duration).toBe(274)
  expect(album.items[0].item.audioQuality).toBe('LOSSLESS')
})

test('get track lyrics', async () => {
  const lyrics = await metadata.getTrackLyrics('293301134')
  expect(url).toBe('[OUT] GET https://api.tidal.com/v1/tracks/293301134/lyrics?countryCode=US')
  expect(lyrics.trackId).toBe(293301134)
  expect(lyrics.lyrics).toEqual(expect.stringContaining('Give life back to music'))
})

test('search albums', async () => {
  const albums = await metadata.searchAlbums('Pink Floyd')
  expect(url).toBe('[OUT] GET https://api.tidal.com/v1/search/albums?countryCode=US&query=Pink%20Floyd&limit=100')
  expect(albums.limit).toBe(100)
  expect(albums.offset).toBe(0)
  expect(albums.totalNumberOfItems).toBeGreaterThan(0)
  expect(albums.items).toHaveLength(100)
  for (let i = 0; i < albums.items.length; i++) {
    expect(albums.items[i].id).toBeDefined()
    expect(albums.items[i].type).toBeDefined()
    expect(albums.items[i].title).toBeDefined()
    expect(albums.items[i].artist).toBeDefined()
    expect(albums.items[i].artists).toBeDefined()
    expect(albums.items[i].audioQuality).toBeDefined()
  }
})

test('get artist albums', async () => {
  const albums = await metadata.getArtistAlbums(8847)
  expect(url).toBe('[OUT] GET https://api.tidal.com/v1/artists/8847/albums?countryCode=US&offset=0&limit=100')
  expect(albums.limit).toBe(100)
  expect(albums.offset).toBe(0)
  expect(albums.totalNumberOfItems).toBeGreaterThan(0)
  expect(albums.items).toHaveLength(Math.min(albums.totalNumberOfItems, albums.limit))
  for (let i = 0; i < albums.items.length; i++) {
    expect(albums.items[i].id).toBeDefined()
    expect(albums.items[i].type).toBeDefined()
    expect(albums.items[i].title).toBeDefined()
    expect(albums.items[i].artist).toBeDefined()
    expect(albums.items[i].artists).toBeDefined()
    expect(albums.items[i].audioQuality).toBeDefined()
  }
})

test('get artist top tracks', async () => {
  const tracks = await metadata.getArtistTopTracks(8847)
  expect(url).toEqual(expect.stringContaining('GET https://api.tidal.com/v1/artists/8847/toptracks?countryCode=US&offset='))
  expect(tracks.limit).toBe(100)
  expect(tracks.offset).toBe(0)
  expect(tracks.totalNumberOfItems).toBeGreaterThan(0)
  expect(tracks.items).toHaveLength(tracks.totalNumberOfItems)
  for (let i = 0; i < tracks.items.length; i++) {
    expect(tracks.items[i].id).toBeDefined()
    expect(tracks.items[i].title).toBeDefined()
    expect(tracks.items[i].duration).toBeDefined()
    expect(tracks.items[i].album).toBeDefined()
    expect(tracks.items[i].artist).toBeDefined()
    expect(tracks.items[i].artists).toBeDefined()
    expect(tracks.items[i].audioQuality).toBeDefined()
  }
})

test('get artist radio', async () => {
  const tracks = await metadata.getArtistRadio(8847)
  expect(url).toEqual(expect.stringContaining('GET https://api.tidal.com/v1/artists/8847/radio?countryCode=US&offset='))
  expect(tracks.limit).toBe(100)
  expect(tracks.offset).toBe(0)
  expect(tracks.totalNumberOfItems).toBeGreaterThan(0)
  expect(tracks.items).toHaveLength(tracks.totalNumberOfItems)
  for (let i = 0; i < tracks.items.length; i++) {
    expect(tracks.items[i].id).toBeDefined()
    expect(tracks.items[i].title).toBeDefined()
    expect(tracks.items[i].duration).toBeDefined()
    expect(tracks.items[i].album).toBeDefined()
    expect(tracks.items[i].artist).toBeDefined()
    expect(tracks.items[i].artists).toBeDefined()
    expect(tracks.items[i].audioQuality).toBeDefined()
  }
})


test('get genres', async () => {
  const genres = await metadata.getGenres()
  expect(url).toBe('[OUT] GET https://api.tidal.com/v1/genres?countryCode=US')
  expect(genres.length).toBeGreaterThan(0)
  for (let i = 0; i < genres.length; i++) {
    expect(genres[i].name).toBeDefined()
    expect(genres[i].path).toBeDefined()
  }
})

test('get genre', async () => {
  const tracks = await metadata.getGenreTracks('pop')
  expect(url).toEqual(expect.stringContaining('[OUT] GET https://api.tidal.com/v1/genres/pop/tracks?countryCode=US&offset='))
  expect(tracks.items).toBeDefined()
  expect(tracks.items.length).toBeGreaterThan(0)
  for (let i = 0; i < tracks.items.length; i++) {
    expect(tracks.items[i].id).toBeDefined()
    expect(tracks.items[i].title).toBeDefined()
    expect(tracks.items[i].duration).toBeDefined()
    expect(tracks.items[i].album).toBeDefined()
    expect(tracks.items[i].artist).toBeDefined()
    expect(tracks.items[i].artists).toBeDefined()
    expect(tracks.items[i].audioQuality).toBeDefined()
  }
})
