# Release bundle

The downloadable web bundle contains the built client and the local Node.js server for persistent leaderboard storage.

1. Extract the archive.
2. With Node.js 22.12 or newer, run `node scripts/run.mjs` from the extracted folder.
3. Open `http://127.0.0.1:4178`.

No npm install is needed for the prebuilt bundle. The server stores leaderboard data in `~/.dao-den-long/leaderboard.json`; set `ISLAND_DATA_DIR` to use another local directory. The server binds to loopback only.
