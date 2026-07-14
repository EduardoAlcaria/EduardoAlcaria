# Spotify widget setup

One-time setup to get the "now playing" SVG live on your README.

## 1. Create a Spotify app
- https://developer.spotify.com/dashboard → Create app
- Redirect URI: `http://127.0.0.1:8888/callback`
- Copy the **Client ID** and **Client Secret**

## 2. Get a refresh token (run locally, once)
```bash
SPOTIFY_CLIENT_ID=xxx SPOTIFY_CLIENT_SECRET=xxx npm run get-refresh-token
```
Open the printed URL, approve access, then check the terminal for `SPOTIFY_REFRESH_TOKEN`.

## 3. Deploy to Vercel
```bash
npm i -g vercel
vercel
```
In the Vercel project settings, add env vars:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

Redeploy after adding them.

## 4. Point the README at your deployment
Replace the placeholder domain in `README.md`:
```
https://YOUR-PROJECT.vercel.app/api/spotify
```
