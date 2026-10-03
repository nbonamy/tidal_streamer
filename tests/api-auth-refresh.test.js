jest.mock('../src/auth', () => jest.fn())

const Auth = require('../src/auth')
const TidalApi = require('../src/api')

function apiResponse(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    headers: new Map(),
    json: jest.fn().mockResolvedValue(payload)
  }
}

function createSettings() {
  let storedUser = {
    user: { id: 42 },
    access_token: 'old-token',
    refresh_token: 'refresh-token'
  }

  const settings = {
    app: { client_id: 'client-id' },
    countryCode: 'US',
    getUser: jest.fn(() => storedUser),
    reload: jest.fn(),
    replaceUser(updatedUser) {
      storedUser = updatedUser
    }
  }

  return settings
}

afterEach(() => {
  jest.restoreAllMocks()
  delete global.fetch
})

test('retries a request with the refreshed access token', async () => {
  const settings = createSettings()
  const refreshedUser = {
    user: { id: 42 },
    access_token: 'new-token',
    refresh_token: 'refresh-token'
  }
  const refreshToken = jest.fn(async () => {
    settings.replaceUser(refreshedUser)
    return true
  })
  Auth.mockImplementation(() => ({ refreshToken }))

  global.fetch = jest.fn(async (_url, options) => {
    if (options.headers.Authorization === 'Bearer old-token') {
      return apiResponse({ error: 'expired_token', httpStatus: 401 }, { ok: false, status: 401 })
    }
    return apiResponse({ items: [{ id: 1 }], totalNumberOfItems: 1 })
  })

  const result = await new TidalApi(settings).search('track', 'test')

  expect(result.items).toEqual([{ id: 1 }])
  expect(refreshToken).toHaveBeenCalledTimes(1)
  expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer new-token')
})

test('shares token refresh across concurrent API instances for one user', async () => {
  const settings = createSettings()
  const refreshedUser = {
    user: { id: 42 },
    access_token: 'new-token',
    refresh_token: 'refresh-token'
  }
  const refreshToken = jest.fn(async () => {
    await new Promise(resolve => setTimeout(resolve, 5))
    settings.replaceUser(refreshedUser)
    return true
  })
  Auth.mockImplementation(() => ({ refreshToken }))

  global.fetch = jest.fn(async (_url, options) => {
    if (options.headers.Authorization === 'Bearer old-token') {
      return apiResponse({ error: 'expired_token', httpStatus: 401 }, { ok: false, status: 401 })
    }
    return apiResponse({ items: [{ id: 1 }], totalNumberOfItems: 1 })
  })

  const [first, second] = await Promise.all([
    new TidalApi(settings).search('track', 'first'),
    new TidalApi(settings).search('track', 'second')
  ])

  expect(first.items).toEqual([{ id: 1 }])
  expect(second.items).toEqual([{ id: 1 }])
  expect(refreshToken).toHaveBeenCalledTimes(1)
})
