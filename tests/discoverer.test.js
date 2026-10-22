const { EventEmitter } = require('node:events')
const Discoverer = require('../src/discoverer')

// Keep Bonjour's actual browser and packet parsing; replace only UDP transport.
jest.mock('multicast-dns', () => jest.fn())
const multicastDns = require('multicast-dns')

let mdns
let discoverer
let up
let down

const type = '_mediastationpod._tcp.local'
const fqdn = `Living Room.${type}`

function announce(ttl = 10, ipv4 = true) {
  mdns.emit('response', {
    answers: [{ name: type, type: 'PTR', ttl, data: fqdn }],
    additionals: [
      { name: fqdn, type: 'SRV', ttl, data: { target: 'player.local', port: 3500 } },
      { name: fqdn, type: 'TXT', ttl, data: [Buffer.from('fn=Living Room Player')] },
      { name: 'player.local', type: 'AAAA', ttl, data: 'fe80::1' },
      ...(ipv4 ? [{ name: 'player.local', type: 'A', ttl, data: '192.168.1.50' }] : []),
    ],
  }, { address: '192.168.1.50', port: 5353 })
}

beforeEach(() => {
  jest.useFakeTimers()
  mdns = new EventEmitter()
  mdns.query = jest.fn()
  mdns.respond = jest.fn()
  mdns.destroy = jest.fn()
  multicastDns.mockReturnValue(mdns)
  up = jest.fn()
  down = jest.fn()
  discoverer = new Discoverer(up, down, 'pod', 'mediastationpod')
})

afterEach(() => {
  discoverer.close?.()
  jest.useRealTimers()
})

test('maps real DNS announcements and goodbyes to the existing IPv4 device contract', () => {
  announce()
  expect(up).toHaveBeenCalledWith({
    name: 'Living Room', description: 'Living Room Player', type: 'pod',
    ip: '192.168.1.50', host: 'player.local', port: 3500,
  })
  mdns.emit('response', {
    answers: [{ name: type, type: 'PTR', ttl: 0, data: fqdn }], additionals: [],
  })
  expect(down).toHaveBeenCalledWith('Living Room')
})

test('ignores IPv6-only devices', () => {
  announce(10, false)
  expect(up).not.toHaveBeenCalled()
})

test('expires a silent device once and rediscovers it when it returns', () => {
  announce()
  jest.advanceTimersByTime(9000)
  expect(down).not.toHaveBeenCalled()
  jest.advanceTimersByTime(2000)
  expect(down.mock.calls).toEqual([['Living Room']])
  jest.advanceTimersByTime(20000)
  expect(down).toHaveBeenCalledTimes(1)
  announce()
  expect(up).toHaveBeenCalledTimes(2)
})

test.each(['full', 'PTR only'])('%s announcements refresh the TTL without disconnecting a live device', packet => {
  announce()
  jest.advanceTimersByTime(6000)
  if (packet === 'full') announce()
  else mdns.emit('response', {
    answers: [{ name: type, type: 'PTR', ttl: 10, data: fqdn }], additionals: [],
  })
  jest.advanceTimersByTime(6000)
  expect(down).not.toHaveBeenCalled()
  expect(up).toHaveBeenCalledTimes(1)
  jest.advanceTimersByTime(5000)
  expect(down.mock.calls).toEqual([['Living Room']])
})

test('honors a changed TTL even when the service data is unchanged', () => {
  announce(120)
  jest.advanceTimersByTime(6000)
  announce(5)
  jest.advanceTimersByTime(6000)
  expect(down.mock.calls).toEqual([['Living Room']])
})

test('actively refreshes a short-lived service before expiry', () => {
  mdns.query.mockClear()
  announce()
  jest.advanceTimersByTime(9000)
  expect(mdns.query).toHaveBeenCalledWith(type, 'PTR')
  expect(down).not.toHaveBeenCalled()
})

test('closing discovery releases transport and stops queries and device callbacks', () => {
  announce()
  discoverer.close()
  mdns.query.mockClear()
  jest.advanceTimersByTime(120000)
  announce()
  expect(mdns.query).not.toHaveBeenCalled()
  expect(down).not.toHaveBeenCalled()
  expect(up).toHaveBeenCalledTimes(1)
  expect(mdns.destroy).toHaveBeenCalledTimes(1)
  discoverer.close()
  expect(mdns.destroy).toHaveBeenCalledTimes(1)
})
