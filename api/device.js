'use strict';
const {response, error, method} = require('../server/firebase');
const {studentAccess} = require('../server/student-access');

module.exports = async function(req, res) {
  try {
    method(req);
    const lectureLocks = await studentAccess(req, {enroll: true, readCatalog: true});
    return response(res, 200, {lectureLocks});
  } catch (err) {
    error(res, err);
  }
};
