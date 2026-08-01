const { parseScanDirection, parseScanPosition, stopPreviewScan } = require('../src/scan')

describe('playback scan fallback', () => {
  test.each([-1, 1])('accepts direction %s', (direction) => {
    expect(parseScanDirection(String(direction))).toBe(direction)
  })

  test('rejects unsupported directions', () => {
    expect(() => parseScanDirection('2')).toThrow('direction must be -1 or 1')
  })

  test('preserves millisecond positions', () => {
    expect(parseScanPosition('42999')).toBe(42999)
  })

  test('seeks once before resuming', async () => {
    const sendCommand = jest.fn().mockResolvedValue(undefined)
    await stopPreviewScan(sendCommand, '42999')
    expect(sendCommand.mock.calls).toEqual([
      ['seek', { position: 42999 }],
      ['play'],
    ])
  })
})
