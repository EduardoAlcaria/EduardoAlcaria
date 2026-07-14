const http = require('http');
const { URL } = require('url');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-read-currently-playing user-read-recently-played';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars first.');
  process.exit(1);
}

const authUrl = new URL('https://accounts.spotify.com/authorize');
authUrl.search = new URLSearchParams({
  response_type: 'code',
  client_id: CLIENT_ID,
  scope: SCOPES,
  redirect_uri: REDIRECT_URI,
}).toString();

console.log('\n1. Add this exact redirect URI in your Spotify app settings:');
console.log(`   ${REDIRECT_URI}`);
console.log('\n2. Open this URL, log in, and approve access:\n');
console.log(authUrl.toString());
console.log('\nWaiting for the redirect...\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400).end('Missing code');
    return;
  }

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await tokenRes.json();

  if (data.refresh_token) {
    console.log('\nSPOTIFY_REFRESH_TOKEN =', data.refresh_token);
    console.log('\nAdd it (and SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET) as Vercel env vars.');
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Done — check your terminal, then close this tab.');
  } else {
    console.error('Failed to get refresh token:', data);
    res.writeHead(500).end('Failed — check your terminal.');
  }

  server.close();
  process.exit(0);
});

server.listen(PORT);
