
const express = require('express')
const portfinder = require('portfinder')
const mdns = require('mdns')
const Config = require('./config')
const Auth = require('./auth')
const User = require('./user')
const Metadata = require('./metadata')
const Playlist = require('./playlist')
const { json_status } = require('./utils')

// init our stuff
const settings = new Config()
const auth = new Auth(settings)

// choose streamer based on config
const streamerType = settings.streamer || 'tidal'
const StreamerClass = streamerType === 'mediastation'
  ? require('./streamer_mediastation')
  : require('./streamer_tidal_connect')

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
  app.set('port', port)

  // logger middleware
  app.use((req,res,next) =>{
    if (req.path != '/status' && req.path != '/callback') {
      console.log(` [IN] ${req.method} ${req.path} ${JSON.stringify(req.query)}`)
    }
    next()
  })

  // auth routes (must be before user context middleware)
  app.use('/', auth.routes())

  // user context middleware - extracts user from X-User-Id header
  app.use((req, res, next) => {
    const userId = req.headers['x-user-id']
    req.userAuth = settings.getUser(userId)
    if (!req.userAuth && userId) {
      return json_status(res, new Error(`User ${userId} not found`))
    }
    next()
  })

  // now we can build our modules
  const user = new User(settings)
  const metadata = new Metadata(settings)
  const streamer = new StreamerClass(settings)
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
		console.log(`Using streamer: ${streamerType}`)

		// Set server info for MediaStation streamer (needs real IP for proxy URLs)
		if (typeof streamer.setServerInfo === 'function') {
			streamer.setServerInfo(port)
		}

		// advertise
		const ad = mdns.createAdvertisement(mdns.tcp('tidalstreamer'), port);
		ad.start();

    // Handle authentication after server is running
    try {
      const isAuthenticated = await auth.isAuth()

      if (!isAuthenticated) {
        const authMethod = auth.getAuthMethod()
        console.log(`\nAuthentication information not found. Using ${authMethod} flow...\n`)

        if (authMethod === 'device') {
          // Device Authorization Flow
          const device = await auth.startDeviceAuthorization()

          console.log('Please visit the following URL and enter the code:')
          console.log(`URL: ${device.verificationUri}`)
          console.log(`Code: ${device.userCode}`)
          console.log(`\nThis code expires in ${device.expiresIn} seconds`)
          console.log('Waiting for authorization...\n')

          // Poll for authorization
          const user = await auth.pollDeviceAuthorization(device.deviceCode, device.interval, device.expiresIn)
          console.log(`\nAuthorization successful! ${user.username} authorized.`)
          console.log('Tidal streamer is ready.')

        } else {
          // Authorization Code Flow
          console.log('Opening browser for authorization...\n')

          // Get authorization URL
          const { authUrl } = await auth.startAuthorization(port)

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
          const { code, state: returnedState } = await auth.getAuthPromise()

          // Exchange code for tokens
          await auth.exchangeCode(code, returnedState, port)
          console.log('\nAuthorization successful! Tidal streamer is ready.')
        }
      }
    } catch (e) {
      console.log(`\nUnable to authorize: ${e.message}`)
      process.exit(1)
    }

	})

})
