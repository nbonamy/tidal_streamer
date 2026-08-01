function badRequest(message) {
  const error = new Error(message)
  error.code = 400
  return error
}

function parseScanDirection(direction) {
  if (String(direction) !== '-1' && String(direction) !== '1') {
    throw badRequest('direction must be -1 or 1')
  }
  return Number(direction)
}

function parseScanPosition(positionMs) {
  if (!/^\d+$/.test(String(positionMs))) {
    throw badRequest('position must be a non-negative integer')
  }
  return Number(positionMs)
}

async function stopPreviewScan(sendCommand, positionMs) {
  // TIDAL Connect has no playback-rate control, so the client owns the
  // preview position. A future speed backend would stop scanning using its
  // own clock and would not need this target.
  await sendCommand('seek', { position: parseScanPosition(positionMs) })
  await sendCommand('play')
}

module.exports = { parseScanDirection, parseScanPosition, stopPreviewScan }
