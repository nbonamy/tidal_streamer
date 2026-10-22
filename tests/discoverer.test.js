const { EventEmitter } = require('node:events')
const { Bonjour } = require('bonjour-service')
const Discoverer = require('../src/discoverer')

jest.mock('bonjour-service', () => ({ Bonjour: jest.fn() }))

test('maps Bonjour device announcements and departures to the existing device contract', () => {
  const browser = new EventEmitter()
  Bonjour.mockImplementation(() => ({ find: () => browser }))
  const up = jest.fn()
  const down = jest.fn()
  new Discoverer(up, down, 'pod', 'mediastationpod')
  browser.emit('up', {
    name: 'Living Room', host: 'player.local', port: 3500,
    addresses: ['fe80::1', '192.168.1.50'], txt: { fn: 'Living Room Player' },
  })
  expect(up).toHaveBeenCalledWith({
    name: 'Living Room', description: 'Living Room Player', type: 'pod',
    ip: '192.168.1.50', host: 'player.local', port: 3500,
  })
  browser.emit('up', { name: 'IPv6 only', addresses: ['fe80::2'] })
  expect(up).toHaveBeenCalledTimes(1)
  browser.emit('down', { name: 'Living Room' })
  expect(down).toHaveBeenCalledWith('Living Room')
})
