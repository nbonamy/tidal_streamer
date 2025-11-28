
const express = require('express')
const portfinder = require('portfinder')
const mdns = require('mdns')
const Config = require('./config')
const Auth = require('./auth')
const User = require('./user')
const Metadata = require('./metadata')
const Streamer = require('./streamer')
const Playlist = require('./playlist')
const { json_status } = require('./utils')

// init our stuff
const settings = new Config()
const auth = new Auth(settings)

// we need a port
let startPort = settings.port
portfinder.getPort({ port: startPort },  async (err, port) => {

  // error
  if (err || (startPort != null && port != startPort)) {
    console.log(`Error: no available port found`)
    process.exit(1)
  }

  // our server
  const app = express()
  app.use(express.json({limit: '50mb'}));

  // OAuth callback promise - used to coordinate auth flow
  let authResolver = null
  const authPromise = new Promise((resolve, reject) => {
    authResolver = { resolve, reject }
  })

  // OAuth callback route - handles redirect from Tidal
  app.get('/callback', (req, res) => {
    const { code, state, error, error_description } = req.query
    if (error) {
      authResolver.reject(new Error(error_description || error))
      res.send('<h1>Authorization Failed</h1><p>Check the console for details. You can close this window.</p>')
    } else {
      authResolver.resolve({ code, state })
      res.send('<h1>Authorization Successful!</h1><p>You can close this window and return to the terminal.</p>')
    }
  })

  // logger middleware
  app.use((req,res,next) =>{
    if (req.path != '/status' && req.path != '/callback') {
      console.log(` [IN] ${req.method} ${req.path} ${JSON.stringify(req.query)}`)
    }
    next()
  })

  // now we can build our modules
  const user = new User(settings)
  const metadata = new Metadata(settings)
  const streamer = new Streamer(settings)
  const playlist = new Playlist(settings)

  // routes
  app.use('/', user.routes())
  app.use('/', metadata.routes())
  app.use('/', playlist.routes())
  app.use('/', streamer.routes())

  // error handler
  app.use((err, req, res, next) => {
    console.error(err.stack)
    json_status(res, err)
  })

  // gracefully handle exit
  const close = async () => {
    await streamer.shutdown()
    process.exit(0)
  }
  process.on('SIGINT', () => close())
  process.on('SIGTERM', () => close())

  // start server first, then handle auth
	app.listen(port, async () => {

		// log
		console.log(`Tidal streamer listening on port ${port}`)

		// advertise
		const ad = mdns.createAdvertisement(mdns.tcp('tidalstreamer'), port);
		ad.start();

    // Handle authentication after server is running
    try {
      const isAuthenticated = await auth.is_auth()

      if (!isAuthenticated) {
        console.log('\nAuthentication information not found. You need to authorize the streamer.')
        console.log('Opening browser for authorization...\n')

        // Get authorization URL
        const { authUrl } = await auth.start_authorization(port)

        // Open browser (using dynamic import for ES module)
        try {
          const open = (await import('open')).default
          await open(authUrl)
        } catch (e) {
          console.log('Could not auto-open browser:', e.message)
        }

        console.log('If browser does not open automatically, visit:')
        console.log(authUrl)
        console.log('\nWaiting for authorization...')

        // Wait for callback
        const { code, state: returnedState } = await authPromise

        // Exchange code for tokens
        await auth.exchange_code(code, returnedState, port)
        console.log('\nAuthorization successful! Tidal streamer is ready.')
      }
    } catch (e) {
      console.log(`\nUnable to authorize: ${e.message}`)
      process.exit(1)
    }

	})

})
