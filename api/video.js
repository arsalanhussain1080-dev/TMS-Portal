'use strict';
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
    return response(res, 503, {error: 'Secure video playback has not been configured.'});
  } catch (err) {
    error(res, err);
  }
};
