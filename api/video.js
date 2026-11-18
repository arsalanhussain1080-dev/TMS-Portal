'use strict';
const {createHash} = require('node:crypto');
const {response, error, method} = require('../server/firebase');
const {studentAccess, deny} = require('../server/student-access');
const titles = require('../course-data');

module.exports = async function(req, res) {
  try {
    method(req);
    const {nodeIndex, lectureIndex} = req.body || {};
    if (!Number.isInteger(nodeIndex) || !Number.isInteger(lectureIndex) ||
        lectureIndex < 0 || !titles[nodeIndex]?.[lectureIndex + 1]) {
      deny(400, 'Invalid lecture.');
    }
    const locks = await studentAccess(req, {readCatalog: true});
    if (locks[nodeIndex + ':' + lectureIndex] === true) deny(403, 'This lecture is locked.');
    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const tokenKey = process.env.BUNNY_STREAM_EMBED_TOKEN_KEY?.trim();
    if (!/^[0-9]+$/.test(libraryId || '') || !tokenKey) {
      deny(503, 'Video playback is temporarily unavailable.');
    }

    const videos = JSON.parse(process.env.BUNNY_STREAM_VIDEO_IDS || '{}');
    const videoId = videos?.[nodeIndex + ':' + lectureIndex];
    if (videoId === undefined) deny(404, 'A video has not been assigned to this lecture.');
    if (typeof videoId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(videoId)) {
      deny(503, 'Video playback is temporarily unavailable.');
    }

    const expires = Math.floor(Date.now() / 1000) + 300;
    const token = createHash('sha256').update(tokenKey + videoId + expires).digest('hex');
    const url = new URL('https://iframe.mediadelivery.net/embed/' + libraryId + '/' + videoId);
    url.search = new URLSearchParams({token, expires: String(expires), autoplay: 'true'});
    return response(res, 200, {embedUrl: url.href});
  } catch (err) {
    error(res, err);
  }
};
