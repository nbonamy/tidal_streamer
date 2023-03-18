# tidal-streamer

A server that enables streaming TIDAL music to a TIDAL connect device without using TIDAL app. This can be useful for a [Vinyl Emulator](https://www.hackster.io/mark-hank/sonos-spotify-vinyl-emulator-3be63d) for instance.

## Setup

tidal-streamer relies on the `mdns` package which itself has some system depenencies. Please check the `mdns` [installation guide](https://www.npmjs.com/package/mdns) else the following command will fail. Once done you can install dependencies:

`npm install`

You need to specify a valid TIDAL API consumer application `client_id` and `client_secret`. This is not provided here but can be found with a bit of digging in other TIDAL related repos in github. Once you have that, create a config.yml file and add:

```
app:
  client_id: <YOUR_CLIENT_ID>
  client_secret: <YOUR_CLIENT_SECRET>
```

You can now run the server. It will display a link you need to navigate to authorize it. After that you are all good: the server will display the port it is listening to!

## Usage

### Get album information

`curl http://localhost:{port}/info/album/{albumId}`

###  Stream album

`curl http://localhost:{port}/play/album/{albumId}`

## Advanced

If you want the server to listen on a specific port, you can configure this in config.yml:
```
port: 8000
```

If you have multiple TIDAL connect devices, you can specify which one to stream to by adding it's friendly name or IPv4 address in config.yml:

```
device: My TIDAL connect device
```

## TODO

- N/A


