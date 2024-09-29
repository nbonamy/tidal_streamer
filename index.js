
const express = require('express')
const portfinder = require('portfinder')
const mdns = require('mdns')
const Config = require('./config')
const Auth = require('./auth')
const Metadata = require('./metadata')
const Streamer = require('./streamer')
const Playlist = require('./playlist')
const Nestor = require('./nestor')
const { NestorService } = require('nestor-service')
const { json_status } = require('./utils')

// init our stuff
const settings = new Config()

// auth
const auth = new Auth(settings)
auth.is_auth().then(async (rc) => {

  if (rc == false) {

    // print
    console.log('Authentication information not found. You need to authorize the streamer. Please wait...')

    // get a link
    let link = await auth.get_link()
    if (link == null || link.verificationUriComplete == null) {
      throw new Error('Unable to get an authorization link. Check the client_id and client_secret you provided')
    }

    // print
    console.log(`Please visit the following link: https://${link.verificationUriComplete}`)
    console.log(`(this link expires in ${link.expiresIn} seconds)`)
    
    // now wait for a user
    let user = await auth.check_link(link)
    console.log(`${user.username} authorized!`)

  }

}).catch((e) => {
  console.log(`Unable to authorize: ${e}`)
  process.exit(1)
})
  
// now we can build our modules
const metadata = new Metadata(settings)
const streamer = new Streamer(settings)
const playlist = new Playlist(settings)
const nestor = new Nestor(settings)

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

  // logger middleware
  app.use((req,res,next) =>{
    if (req.path != '/status') {
      console.log(` [IN] ${req.method} ${req.path} ${JSON.stringify(req.query)}`)
    }
    next()
  })

  // routes
  app.use('/', metadata.routes())
  app.use('/', playlist.routes())
  app.use('/', streamer.routes())
  app.use('/', nestor.routes())

  // error handler
  app.use((err, req, res, next) => {
    console.error(err.stack)
    json_status(res, err)
  })  

	// start it
	app.listen(port, () => {

		// log
		console.log(`Tidal streamer listening on port ${port}`)

		// advertise
		const ad = mdns.createAdvertisement(mdns.tcp('tidalstreamer'), port);
		ad.start();

    // run nestor service
    new NestorService('nestor-tidalstreamer', port, '/nestor/list')

	})

})
