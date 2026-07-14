const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';
const RECENTLY_PLAYED_URL = 'https://api.spotify.com/v1/me/player/recently-played?limit=5';

async function getAccessToken() {
  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function getNowPlaying(accessToken) {
  const res = await fetch(NOW_PLAYING_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status !== 200) return null;

  const now = await res.json();
  if (!now || !now.item) return null;

  return {
    title: now.item.name,
    artist: now.item.artists.map((a) => a.name).join(', '),
    cover: now.item.album.images[0]?.url,
    url: now.item.external_urls.spotify,
  };
}

async function getRecentTracks(accessToken) {
  const res = await fetch(RECENTLY_PLAYED_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];

  const recent = await res.json();
  return (recent.items || [])
    .map((entry) => entry.track)
    .filter(Boolean)
    .map((item) => ({
      title: item.name,
      artist: item.artists.map((a) => a.name).join(', '),
      cover: item.album.images[0]?.url,
      url: item.external_urls.spotify,
    }));
}

function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(str, max) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

async function coverToDataUri(coverUrl) {
  if (!coverUrl) return null;
  try {
    const res = await fetch(coverUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') || 'image/jpeg';
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function renderSvg({ title, artist, coverDataUri }) {
  const status = 'Now playing';
  const playing = true;
  const title_ = escapeXml(truncate(title, 34));
  const artist_ = escapeXml(truncate(artist, 40));
  const bars = playing
    ? [0, 1, 2, 3]
        .map(
          (i) =>
            `<rect x="${360 + i * 6}" y="20" width="3" height="20" rx="1.5" fill="#1DB954"><animate attributeName="height" values="6;24;6" dur="${0.6 + i * 0.15}s" repeatCount="indefinite"/><animate attributeName="y" values="27;15;27" dur="${0.6 + i * 0.15}s" repeatCount="indefinite"/></rect>`
        )
        .join('')
    : '';

  return `<svg width="400" height="120" viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <foreignObject width="0" height="0"></foreignObject>
  <rect width="400" height="120" rx="12" fill="#191414"/>
  <clipPath id="coverClip"><rect x="16" y="16" width="88" height="88" rx="8"/></clipPath>
  ${
    coverDataUri
      ? `<image href="${coverDataUri}" x="16" y="16" width="88" height="88" clip-path="url(#coverClip)" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect x="16" y="16" width="88" height="88" rx="8" fill="#282828"/>`
  }
  <svg x="120" y="18" width="16" height="16" viewBox="0 0 24 24"><path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.719-.66 13.439 1.62.361.181.54.78.302 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.72-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.72 1.621.539.3.719 1.02.42 1.56-.3.421-1.02.599-1.559.3z"/></svg>
  <text x="140" y="30" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="11" fill="#1DB954" font-weight="600">${status}</text>
  <text x="16" y="122" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="1" fill="transparent">.</text>
  <text x="120" y="55" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="16" fill="#FFFFFF" font-weight="700">${title_}</text>
  <text x="120" y="76" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="#B3B3B3">${artist_}</text>
  ${bars}
</svg>`;
}

function renderHistorySvg(tracks) {
  const rowHeight = 32;
  const headerHeight = 34;
  const height = headerHeight + tracks.length * rowHeight + 10;

  const rows = tracks
    .map((track, i) => {
      const y = headerHeight + i * rowHeight;
      const title_ = escapeXml(truncate(track.title, 32));
      const artist_ = escapeXml(truncate(track.artist, 34));
      return `<text x="16" y="${y + 14}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="#FFFFFF" font-weight="600">${title_}</text>
  <text x="16" y="${y + 29}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="11" fill="#B3B3B3">${artist_}</text>`;
    })
    .join('\n  ');

  return `<svg width="400" height="${height}" viewBox="0 0 400 ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="${height}" rx="12" fill="#191414"/>
  <svg x="16" y="10" width="14" height="14" viewBox="0 0 24 24"><path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.719-.66 13.439 1.62.361.181.54.78.302 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.72-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.72 1.621.539.3.719 1.02.42 1.56-.3.421-1.02.599-1.559.3z"/></svg>
  <text x="36" y="21" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="12" fill="#1DB954" font-weight="600">Recently played</text>
  ${rows}
</svg>`;
}

function fallbackSvg(message) {
  return `<svg width="400" height="120" viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
  <rect width="400" height="120" rx="12" fill="#191414"/>
  <text x="20" y="65" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" fill="#B3B3B3">${escapeXml(
    message
  )}</text>
</svg>`;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate');

  try {
    const accessToken = await getAccessToken();
    const nowPlaying = await getNowPlaying(accessToken);

    if (nowPlaying) {
      const coverDataUri = await coverToDataUri(nowPlaying.cover);
      res.status(200).send(renderSvg({ ...nowPlaying, coverDataUri }));
      return;
    }

    const recent = await getRecentTracks(accessToken);
    if (!recent.length) {
      res.status(200).send(fallbackSvg('Nothing played recently'));
      return;
    }

    res.status(200).send(renderHistorySvg(recent));
  } catch (err) {
    res.status(200).send(fallbackSvg('Spotify unavailable'));
  }
};
