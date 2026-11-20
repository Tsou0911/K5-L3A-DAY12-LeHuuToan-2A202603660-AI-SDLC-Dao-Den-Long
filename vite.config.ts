import { defineConfig } from 'vite'
import {createLeaderboardMiddleware} from './scripts/leaderboard-api.mjs'

export default defineConfig({
  base:'./',
  plugins:[{name:'leaderboard-api',configureServer(server){server.middlewares.use(createLeaderboardMiddleware())}}],
  build:{outDir:'dist/client'}
})
