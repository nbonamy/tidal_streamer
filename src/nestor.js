
const express = require('express')

module.exports = class {

  constructor(settings, port) {
    this._settings = settings
  }

  routes() {

    const router = express.Router()

    router.get('/nestor/list', (req, res, next) => {

      res.json({ endpoints: [
        {
          name: 'create_playlist',
          description: 'Create a playlist',
          url: `${req.protocol}://${req.get('host')}/playlist/create`,
          method: 'POST',
          parameters: [
            { name: 'title', type: 'string', description: 'The title of the playlist', required: true },
            { name: 'description', type: 'string', description: 'The description of the playlist', required: true }
          ]
        },
        {
          name: 'add_to_playlist',
          description: 'Add one or multiple songs to a playlist',
          url: `${req.protocol}://${req.get('host')}/playlist/add`,
          method: 'POST',
          parameters: [
            { name: 'playlistId', type: 'string', description: 'The id of the playlist', required: true },
            { name: 'trackIds', type: 'string', description: 'A comma separated list of the id of the songs', required: true }
          ]
        },
        {
          name: 'search_track',
          description: 'Get the id of a song given its title and artist',
          url: `${req.protocol}://${req.get('host')}/search/track/digest`,
          parameters: [
            { name: 'query', type: 'string', description: 'The title and artist of the song', required: true },
          ]
        }
      ]})
    
    })

    return router

  }

}
