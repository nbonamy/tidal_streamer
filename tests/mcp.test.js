const { createMcpEndpoint, createRestClient } = require('../src/mcp')

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload)
  }
}

async function mcpCall(endpoint, id, method, params = {}) {
  const httpResponse = await endpoint.handler.fetch(new Request('http://localhost/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-11-25'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params })
  }))

  expect(httpResponse.status).toBe(200)
  const body = await httpResponse.text()
  const data = body.split('\n').find((line) => line.startsWith('data: '))
  return JSON.parse(data.substring(6))
}

test('REST client sends no MCP authorization and unwraps successful API results', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(response({
    status: 'ok',
    result: { id: 'playlist-1' }
  }))
  const request = createRestClient(8123, fetchImpl)

  const result = await request({
    method: 'POST',
    path: '/playlist/create',
    body: { title: 'Road trip', description: '' },
    userId: '42'
  })

  expect(result).toEqual({ id: 'playlist-1' })
  expect(fetchImpl).toHaveBeenCalledWith(
    new URL('http://127.0.0.1:8123/playlist/create'),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-User-Id': '42'
      },
      body: JSON.stringify({ title: 'Road trip', description: '' })
    }
  )
  expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined()
})

test('MCP endpoint advertises playlist tools and maps create playlist calls', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(response({
    status: 'ok',
    result: { uuid: 'playlist-1', title: 'Road trip' }
  }))
  const endpoint = createMcpEndpoint({ port: 8123, fetchImpl })

  try {
    const toolsResponse = await mcpCall(endpoint, 1, 'tools/list')
    const toolNames = toolsResponse.result.tools.map((tool) => tool.name)
    expect(toolNames).toContain('create_playlist')
    expect(toolNames).toContain('add_tracks_to_playlist')

    const callResponse = await mcpCall(endpoint, 2, 'tools/call', {
      name: 'create_playlist',
      arguments: {
        title: 'Road trip',
        description: 'Summer',
        userId: '42'
      }
    })

    expect(callResponse.result.isError).not.toBe(true)
    expect(JSON.parse(callResponse.result.content[0].text)).toEqual({
      uuid: 'playlist-1',
      title: 'Road trip'
    })
    expect(fetchImpl.mock.calls[0][0].toString()).toBe('http://127.0.0.1:8123/playlist/create')
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { 'X-User-Id': '42' },
      body: JSON.stringify({ title: 'Road trip', description: 'Summer' })
    })
  } finally {
    await endpoint.close()
  }
})

test('MCP tools return downstream failures as tool errors', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(response({
    status: 'error',
    error: 'Playlist is read-only'
  }))
  const endpoint = createMcpEndpoint({ port: 8123, fetchImpl })

  try {
    const callResponse = await mcpCall(endpoint, 1, 'tools/call', {
      name: 'add_tracks_to_playlist',
      arguments: {
        playlistId: 'playlist-1',
        trackIds: [10, 11]
      }
    })

    expect(callResponse.result.isError).toBe(true)
    expect(callResponse.result.content[0].text).toBe('Playlist is read-only')
  } finally {
    await endpoint.close()
  }
})
