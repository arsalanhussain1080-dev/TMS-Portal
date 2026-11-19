'use strict';
const {services, response, error, method} = require('../server/firebase');
const {studentAccess, deny} = require('../server/student-access');
const titles = require('../course-data');
const {mediaDocument, mediaInput, embedUrl} = require('../server/lecture-media');

module.exports = async function(req, res) {
  try {
    method(req);
    const {nodeIndex, lectureIndex} = req.body || {};
    if (!Number.isInteger(nodeIndex) || !Number.isInteger(lectureIndex) ||
        lectureIndex < 0 || !titles[nodeIndex]?.[lectureIndex + 1]) {
      deny(400, 'Invalid lecture.');
    }
    const {locks, student} = await studentAccess(req, {readCatalog: true, includeProfile: true});
    const lectureKey = nodeIndex + ':' + lectureIndex;
    if (locks[lectureKey] === true) deny(403, 'This lecture is locked.');

    const {db} = services();
    const media = (await mediaDocument(db).get()).data() || {};
    let source = media[lectureKey];
    if (source === undefined) {
      const legacy = JSON.parse(process.env.BUNNY_STREAM_VIDEO_IDS || '{}')?.[lectureKey];
      if (legacy) source = {provider: 'bunny', videoId: legacy};
    }
    if (!source) deny(404, 'A video has not been assigned to this lecture.');
    const validSource = mediaInput(source.provider, source.videoId, source.privacyHash);
    return response(res, 200, {embedUrl: await embedUrl(validSource), student});
  } catch (err) {
    error(res, err);
  }
};
