# tidal-streamer

A server that enables streaming TIDAL music to a TIDAL connect device without using TIDAL app. This can be useful for a [Vinyl Emulator](https://www.hackster.io/mark-hank/sonos-spotify-vinyl-emulator-3be63d) for instance.

## Setup

tidal-streamer relies on the `mdns` package which itself has some system depenencies. Please check the `mdns` [installation guide](https://www.npmjs.com/package/mdns) else the following command will fail. Once done you can install dependencies:

`npm install`

## Configuration

### 1. Create a TIDAL Application

You need to specify a valid TIDAL API application `client_id` and `client_secret`. You can get those by creating an App on the [TIDAL Developer Portal](https://developer.tidal.com/):

1. Log in to https://developer.tidal.com/
2. Create a new application
3. Note your `client_id` and `client_secret`

### 2. Configure Redirect URI

In your TIDAL Developer Portal app settings, add the following redirect URI:

```
http://localhost:PORT/callback
```

Where `PORT` is the port your server will run on (default is dynamically assigned, or you can specify it in `config.yml` - see Advanced section below).

**Important**: If you don't specify a fixed port in `config.yml`, you may want to register multiple redirect URIs for common ports (e.g., 3000, 8000, 8080) or register a wildcard pattern if supported.

### 3. Configure config.yml

Rename `config.sample.yml` to `config.yml` and replace the `app` section with your credentials:

```yaml
app:
  client_id: <YOUR_CLIENT_ID>
  client_secret: <YOUR_CLIENT_SECRET>
```

### 4. First Run - Authorization

When you first run the server, it will automatically:
1. Start the server on an available port
2. Open your default browser to the TIDAL authorization page
3. Wait for you to authorize the application
4. Save the authorization tokens to `config.yml`

If the browser doesn't open automatically, the server will display the authorization URL in the terminal - just copy and paste it into your browser.

After authorization is complete, the server will be ready to use. Tokens are refreshed automatically when needed, so you only need to authorize once (unless you revoke access or delete the auth section from `config.yml`).


## API Endpoints

### User

| Path                          | Method | Parameters          | Explanation                                      |
|-------------------------------|--------|---------------------|--------------------------------------------------|
| `/user/feed`                  | GET    | none                | Get user feed                                    |
| `/user/shortcuts`             | GET    | none                | Get user shortcuts                               |
| `/user/artists`               | GET    | none                | Get user artists                                 |
| `/user/albums`                | GET    | none                | Get user albums                                  |
| `/user/playlists`             | GET    | none                | Get user playlists                               |
| `/user/tracks`                | GET    | none                | Get user tracks                                  |
| `/user/mixes`                 | GET    | none                | Get user mixes                                   |
| `/user/new/albums`            | GET    | none                | Get new albums                                   |
| `/user/new/tracks`            | GET    | None                | Get new tracks                                   |
| `/user/recent/albums`         | GET    | none                | Get recent albums                                |
| `/user/recent/artists`        | GET    | none                | Get recent artists                               |
| `/user/recommended/albums`    | GET    | none                | Get recommended albums                           |

### Metadata

| Path                           | Method | Parameters          | Explanation                                      |
|--------------------------------|--------|---------------------|--------------------------------------------------|
| `/info/album/:id`              | GET    | album id            | Get album information                            |
| `/info/playlist/:id`           | GET    | album id            | Get playlist information                         |
| `/info/artist/:id/albums`      | GET    | album id            | Get artist's albums                              |
| `/info/artist/:id/singles`     | GET    | album id            | Get artist's singles                             |
| `/info/artist/:id/compilations`| GET    | album id            | Get artist's compilations                        |
| `/info/artist/:id/toptracks`   | GET    | album id            | Get artist's top tracks                          |
| `/info/artist/:id/radio`       | GET    | album id            | Get artist's radio                               |
| `/info/artist/:id/similar`     | GET    | album id            | Get similar artists                              |
| `/info/genres`                 | GET    | none                | Get genres                                       |
| `/info/genre/:id/tracks`       | GET    | genre id            | Get tracks of a genre                            |
| `/info/mix/:id/tracks`         | GET    | mix id              | Get tracks of a mix                              |
| `/lyrics/:id`                  | GET    | track id            | Get track lyrics                                 |
| `/search/artist`               | GET    | query               | Search for artists                               |
| `/search/album`                | GET    | query               | Search for albums                                |
| `/search/track`                | GET    | query               | Search for tracks                                |
| `/search/track/digest`         | GET    | query               | Search for tracks (digest)                       |

### Streamer

| Path                          | Method | Parameters          | Explanation                                      |
|-------------------------------|--------|---------------------|--------------------------------------------------|
| `/list`                       | GET    | none                | List available devices                           |
| `/ping`                       | GET    | none                | Ping the server                                  |
| `/status`                     | GET    | none                | Get status of a device                           |
| `/play/tracks`                | POST   | body, position      | Play tracks                                      |
| `/play/album/:id`             | GET    | id, position        | Play an album                                    |
| `/play/playlist/:id`          | GET    | id, position        | Play a playlist                                  |
| `/play/mix/:id`               | GET    | id, position        | Play a mix                                       |
| `/enqueue/:position`          | POST   | body, position      | Enqueue tracks                                   |
| `/dequeue/:position`          | POST   | position            | Dequeue a track                                  |
| `/reorderqueue/:from/:to`     | POST   | from, to            | Reorder the queue                                |
| `/play`                       | POST   | none                | Play the current track                           |
| `/pause`                      | POST   | none                | Pause the current track                           |
| `/stop`                       | POST   | none                | Stop the current track                           |
| `/next`                       | POST   | none                | Play the next track                              |
| `/prev`                       | POST   | none                | Play the previous track                          |
| `/trackseek/:position`        | POST   | position            | Seek to a specific track position                 |
| `/timeseek/:progress`         | POST   | progress            | Seek to a specific time                           |
| `/volume/down`                | POST   | none                | Decrease the volume                              |
| `/volume/up`                  | POST   | none                | Increase the volume                              |

### Playlist

| Path                          | Method | Parameters          | Explanation                                      |
|-------------------------------|--------|---------------------|--------------------------------------------------|
| `/playlist/create`            | POST   | title, description  | Create a playlist                                |
| `/playlist/add`               | POST   | playlistId, trackIds| Add tracks to a playlist                         |

## Advanced

If you want the server to listen on specific ports, you can configure this in config.yml:
```
port: 8000
wsport: 8001
```

If you have multiple TIDAL connect devices, you can specify which one to stream to by adding it's friendly name or IPv4 address in config.yml:

```
device: My TIDAL connect device
```

## TODO

- N/A


