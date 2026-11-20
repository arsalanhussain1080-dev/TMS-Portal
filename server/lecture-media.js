'use strict';
const {createHash} = require('node:crypto');
const {deny} = require('./student-access');

const idPatterns = {
  bunny: /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^\d{1,20}$/,
  vdocipher: /^[0-9a-f]{32}$/i
};

function mediaDocument(db) {
  const name = process.env.VERCEL_ENV === 'preview' ? 'batch1-preview' : 'batch1';
  return db.collection('lectureMedia').doc(name);
}

function mediaInput(provider, value, hash) {
  const videoId = typeof value === 'string' ? value.trim() : '';
  const privacyHash = typeof hash === 'string' ? hash.trim() : '';
  if (typeof provider !== 'string' || !Object.hasOwn(idPatterns, provider) || !idPatterns[provider].test(videoId)) {
    deny(400, 'Enter a valid video ID for the selected provider.');
  }
  if (privacyHash && (provider !== 'vimeo' || !/^[A-Za-z0-9]{1,64}$/.test(privacyHash))) {
    deny(400, 'Enter a valid Vimeo privacy hash.');
  }
  return privacyHash ? {provider, videoId, privacyHash} : {provider, videoId};
}

async function embedUrl({provider, videoId, privacyHash}) {
  if (provider === 'youtube') return 'https://www.youtube-nocookie.com/embed/' + videoId;
  if (provider === 'vimeo') {
    const url = new URL('https://player.vimeo.com/video/' + videoId);
    if (privacyHash) url.searchParams.set('h', privacyHash);
    return url.href;
  }

  if (provider === 'bunny') {
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const key = process.env.BUNNY_STREAM_EMBED_TOKEN_KEY?.trim();
    if (!/^\d+$/.test(libraryId || '') || !key) deny(503, 'Bunny.net playback is not configured.');
    const expires = Math.floor(Date.now() / 1000) + 300;
    const token = createHash('sha256').update(key + videoId + expires).digest('hex');
    const url = new URL('https://iframe.mediadelivery.net/embed/' + libraryId + '/' + videoId);
    url.search = new URLSearchParams({token, expires: String(expires)});
    return url.href;
  }

  const key = process.env.VDOCIPHER_API_SECRET?.trim();
  if (!key) deny(503, 'VdoCipher playback is not configured.');
  let playback;
  try {
    const response = await fetch('https://dev.vdocipher.com/api/videos/' + videoId + '/otp', {
      method: 'POST',
      headers: {Authorization: 'Apisecret ' + key, 'Content-Type': 'application/json'},
      body: JSON.stringify({ttl: 300}),
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) playback = await response.json();
  } catch {
    deny(502, 'VdoCipher could not start playback. Try again shortly.');
  }
  if (typeof playback?.otp !== 'string' || !playback.otp ||
      typeof playback?.playbackInfo !== 'string' || !playback.playbackInfo) {
    deny(502, 'VdoCipher could not start playback. Check the video ID and provider configuration.');
  }
  const url = new URL('https://player.vdocipher.com/v2/');
  url.search = new URLSearchParams({otp: playback.otp, playbackInfo: playback.playbackInfo});
  return url.href;
}

module.exports = {mediaDocument, mediaInput, embedUrl};
