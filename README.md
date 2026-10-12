# Otaku Arcade — local anime catalog starter

An original dark-themed anime discovery website with:
- Responsive catalog, search, genre chips, title details and episode list
- HTML5 video player for direct, browser-compatible video URLs
- Express API and SQLite database
- Admin login and dashboard to create/edit/delete anime and add/remove episodes
- Fictional starter catalog with a public sample video for testing the player

Use only anime artwork and videos you own, have licensed, or are otherwise permitted to display. This starter does not scrape HiAnime or provide copyrighted episode sources.

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js 20 or newer
- VS Code (optional but recommended)

Check whether Node.js is installed in Terminal:

```bash
node -v
npm -v
```

If `node` is missing, install the current LTS version from https://nodejs.org/en/download or use your preferred package manager. Homebrew is not required.

## Setup in VS Code

1. Extract `otaku-arcade.zip`.
2. Open the extracted `otaku-arcade` folder in VS Code.
3. In VS Code choose **Terminal → New Terminal**.
4. Run these commands one at a time:

```bash
npm install
cp .env.example .env
```

5. Open `.env` in VS Code. Change `ADMIN_PASSWORD` and `SESSION_SECRET` to private values. Example:

```dotenv
PORT=3000
SESSION_SECRET=put-a-long-random-string-here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose-a-strong-local-password
```

6. Start the server:

```bash
npm run dev
```

If `npm run dev` does not work with your Node version, use `npm start`.

7. Open these addresses in your browser:
   - Website: http://localhost:3000
   - Admin: http://localhost:3000/admin

Sign in using the username and password you set in `.env`.

## Add your own anime and episodes

1. Open `/admin` and sign in.
2. Use **Add anime title**. Add a title, genres separated by commas, synopsis, year, status and optional poster URL.
3. Use **Add an episode**. Select the anime and enter an episode number.
4. Paste a direct URL to a video file you have permission to stream, for example an MP4 on your own storage.
5. Optionally provide a WebVTT subtitle URL ending in `.vtt`.
6. Open the public homepage, click the title, then choose an episode.

### Video URL notes

The player expects a direct media URL that browsers can play, typically an MP4 using H.264 video and AAC audio. A webpage URL from YouTube, Google Drive's preview page, or a streaming service is not necessarily a direct video URL. Remote hosts may block cross-origin playback. For production, use a licensed video hosting provider or a media server configured for streaming and CORS.

Example WebVTT subtitle file:

```vtt
WEBVTT

00:00:01.000 --> 00:00:04.000
Welcome to the episode.
```

## Database

SQLite database is created automatically at `data/otaku-arcade.sqlite` on first start. The starter catalog is inserted only when the anime table is empty.

To reset all local content, stop the server and delete the database files in `data/`. This permanently deletes your local changes.

## Troubleshooting

- `node: command not found`: install Node.js LTS and restart VS Code.
- `npm install` fails while compiling `better-sqlite3`: update Node.js to a current LTS version, then retry `npm install`.
- `EADDRINUSE`: another process is using port 3000. Stop it or change `PORT` in `.env`.
- Admin login fails: confirm `.env` values and restart the server. The initial admin user is created on the first run; changing credentials after database creation does not automatically reset the existing admin password.
- Video will not play: test the direct URL in a new browser tab, confirm it is a media file, and check the host's CORS and range-request support.

## Before putting it online

This is a local development starter, not a hardened production deployment. Before public hosting, add CSRF protection and rate limiting, use a persistent session store, enforce HTTPS secure cookies, configure backups and logging, and review authentication/security. Do not expose the development admin credentials or serve unlicensed content.


## Video integration (free local development)

This version adds an **admin video upload** feature. It is free to use locally and does not require an API key or paid streaming account.

1. Sign in at `http://localhost:3000/admin`.
2. In **Upload a licensed video**, select an MP4/WebM/OGV/OGG/M4V file you own or are licensed to distribute. Local upload limit: 1 GB.
3. Click **Upload video**. The generated URL (such as `/media/1712345678-episode.mp4`) is filled into the episode form.
4. Select the anime, enter the episode number and click **Add episode**.
5. Visit the homepage, open the title, and play the episode.

Uploaded files are saved under `data/media/` on your Mac. This is for local development and testing; it does not provide global delivery or automatically upload media to a remote host.

### Free hosting reality

There is no dependable unlimited, permanently free hosted full-episode API. Free local uploads work only while your local server is running and are not public on the internet. To stream remotely later, use a provider's current free allowance (if available) or a paid video-hosting plan, and upload only content you are allowed to distribute. Review current provider pricing and limits before choosing a production host.

The HTML5 player works best with browser-compatible MP4 files (H.264 video + AAC audio). Some codecs may upload successfully but not play in every browser.
