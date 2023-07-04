
const RESOURCES_BASE_URL = 'https://resources.tidal.com'
const { exec } = require('child_process')

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

  getAlbumCovers: function(albumId) {
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
  },

  runLocalCommand: function(command) {
		if (command == null) return
		if (Array.isArray(command)) {
			for (let cmd of command) {
				this.runLocalCommand(cmd);
			}
			return
		}
		console.log(`[CMD] ${command}`)
		exec(command, (error, stdout, stderr) => {
			if (error) console.log(error)
			if (stderr) console.log(stderr)
		})
	}
  
}
