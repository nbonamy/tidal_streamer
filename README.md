# tidal-streamer

A server that enables streaming TIDAL music to a TIDAL connect device without using TIDAL app. This can be useful for a [Vinyl Emulator](https://www.hackster.io/mark-hank/sonos-spotify-vinyl-emulator-3be63d) for instance.

## Setup

tidal-streamer relies on the `mdns` package which itself has some system depenencies. Please check the `mdns` [installation guide](https://www.npmjs.com/package/mdns) else the following command will fail. Once done you can install dependencies:

`npm install`

## Configuration

This application supports two authentication methods with Tidal:

### Authentication Methods

#### Method 1: Device Authorization Flow (Recommended)

Best for headless servers and provides access to full API with `r_usr` scope.

**Requirements:**
- Client credentials that support device flow
- No browser interaction needed
- User enters code on Tidal website manually

**Setup:**
1. Rename `config.sample.yml` to `config.yml`
2. Configure your credentials:
```yaml
app:
  client_id: <YOUR_CLIENT_ID>
  client_secret: <YOUR_CLIENT_SECRET>
auth_method: device
```

3. Start the server - it will display a URL and code
4. Visit the URL and enter the code to authorize
5. Server automatically saves tokens and continues

**Note:** Official Tidal Developer Portal apps may not support device flow. You may need to use credentials from a compatible client.

#### Method 2: Authorization Code Flow with PKCE

Works with official Tidal Developer Portal apps (WEB platform).

**Setup:**
1. Create app at [TIDAL Developer Portal](https://developer.tidal.com/)
2. Add redirect URI: `http://localhost:PORT/callback` (where PORT is your configured port)
3. Configure `config.yml`:
```yaml
app:
  client_id: <YOUR_CLIENT_ID>
  client_secret: <YOUR_CLIENT_SECRET>
auth_method: authorization_code
```

4. Start server - browser will automatically open for authorization
5. Authorize the app and tokens are saved

**Limitations:** WEB platform apps use new scopes (`user.read`, `collection.read`, etc.) which may not provide access to all APIs. Some endpoints require the legacy `r_usr` scope which is only available with device flow credentials.

### Custom Scopes (Optional)

You can override default scopes in `config.yml`:

```yaml
scopes: user.read collection.read playback recommendations.read
```

### First Run

Regardless of authentication method:
1. Server starts and checks for existing auth
2. If no auth found, initiates chosen auth flow
3. User authorizes (via code entry or browser)
4. Tokens saved to `config.yml`
5. Tokens refresh automatically when expired


## API Endpoints

### User

| Path                          | Method | Parameters          | Explanation                                      |
|-------------------------------|--------|---------------------|--------------------------------------------------|
| `/user/feed`                  | GET    | none                | Get user feed                                    |
| `/user/module/:moduleId`      | GET    | moduleId            | Get specific feed module by ID                   |
| `/user/shortcuts`             | GET    | none                | Get user shortcuts                               |
| `/user/artists`               | GET    | none                | Get user artists                                 |
| `/user/albums`                | GET    | none                | Get user albums                                  |
| `/user/playlists`             | GET    | none                | Get user playlists                               |
| `/user/playlists/popular`     | GET    | none                | Get popular playlists                            |
| `/user/playlists/essential`   | GET    | none                | Get essential playlists                          |
| `/user/playlists/updated`     | GET    | none                | Get recently updated favorited playlists         |
| `/user/playlists/recommended` | GET    | none                | Get recommended users' playlists                 |
| `/user/tracks`                | GET    | none                | Get user tracks                                  |
| `/user/tracks/spotlighted`    | GET    | none                | Get spotlighted tracks                           |
| `/user/tracks/uploads`        | GET    | none                | Get uploads for you                              |
| `/user/mixes/daily`           | GET    | none                | Get daily mixes                                  |
| `/user/mixes/history`         | GET    | none                | Get listening history mixes                      |
| `/user/mixes/radio`           | GET    | none                | Get suggested radio mixes                        |
| `/user/new/albums`            | GET    | none                | Get new albums                                   |
| `/user/new/tracks`            | GET    | none                | Get new tracks                                   |
| `/user/recent/artists`        | GET    | none                | Get recent artists                               |
| `/user/recommended/albums`    | GET    | none                | Get recommended albums                           |
| `/user/forgotten/albums`      | GET    | none                | Get forgotten favorite albums                    |

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

## Feed Modules (as of 28-11-2025)

### API

**Note:** Module availability may vary based on user preferences and region. Seasonal modules (e.g., THANKSGIVING_PLAYLISTS) may not always be present.

- ALBUM_RECOMMENDATIONS - Album Recommendations
- DAILY_MIXES - Custom mixes (Daily Mixes)
- FORGOTTEN_FAVORITES - Forgotten Favorites
- HISTORY_MIXES - Your listening history mixes
- LATEST_SPOTLIGHTED_TRACKS - Spotlighted Tracks
- NEW_ALBUM_SUGGESTIONS - Suggested New Albums
- NEW_TRACK_SUGGESTIONS - Recommended New Tracks
- POPULAR_PLAYLISTS - Popular Playlists
- RECENTLY_UPDATED_FAVORITED_PLAYLIST - Recently Updated Favorited Playlists (singular)
- RECOMMENDED_USERS_PLAYLISTS - Recommended Users' Playlists
- SHORTCUT_LIST - Shortcuts (quick access links)
- SUGGESTED_ESSENTIAL_PLAYLISTS - Suggested Essential Playlists
- SUGGESTED_RADIOS_MIXES - Suggested Radios/Mixes
- THANKSGIVING_PLAYLISTS - Thanksgiving Playlists (seasonal)
- UPLOADS_FOR_YOU - Uploads for you
- YOUR_FAVORITE_ARTISTS - Your Favorite Artists

### Tidal app order

- SHORTCUT_LIST
- NEW_ALBUM_SUGGESTIONS
- NEW_TRACK_SUGGESTIONS
- ALBUM_RECOMMENDATIONS
- POPULAR_PLAYLISTS
- LATEST_SPOTLIGHTED_TRACKS
- UPLOADS_FOR_YOU
- HISTORY_MIXES
- YOUR_FAVORITE_ARTISTS
- DAILY_MIXES
- SUGGESTED_ESSENTIAL_PLAYLISTS
- SUGGESTED_RADIOS_MIXES
- RECENTLY_UPDATED_FAVORITED_PLAYLISTS
- RECOMMENDED_USERS_PLAYLISTS
- FORGOTTEN_FAVORITES
- SHORTCUT_LIST