
const RESOURCES_BASE_URL = 'https://resources.tidal.com'

module.exports = {

  json_status: function(res, err, result) {
    try {
      if (err) {
        res.status(err.code||500).json({ status: 'error', error: err.message||err, details: err })
      } else {
        res.json({ status: 'ok', result: result||'success' })
      }
    } catch (err) {
      console.error(err)
      try {
        res.json({ status: 'error', error: err })
      } catch {}
    }
  },

  getAlbumCovers: function (albumId) {
    if (albumId == null) return {}
    const baseUrl = `${RESOURCES_BASE_URL}/images/${albumId.replace(/-/g, '/')}`;
    return {
      high: {
        url: `${baseUrl}/1280x1280.jpg`,
        width: 1280, height: 1280,
      },
      medium: {
        url: `${baseUrl}/640x640.jpg`,
        width: 640, height: 640,
      },
      low: {
        url: `${baseUrl}/320x320.jpg`,
        width: 320, height: 320,
      }
    }
  }
  
}
