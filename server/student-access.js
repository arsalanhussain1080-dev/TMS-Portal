'use strict';
const {createHash} = require('node:crypto');
const {services, identity} = require('./firebase');
const {accessCollection, deviceCollection, effectiveLocks} = require('./lecture-access');

function deny(status, message) {
  throw Object.assign(new Error(message), {status});
}

async function studentAccess(req, {enroll = false, readCatalog = false} = {}) {
  const user = await identity(req);
  const secret = req.body?.deviceSecret;
  if (typeof secret !== 'string' || !/^[0-9a-f]{64}$/.test(secret)) {
    deny(400, 'A browser device key is required.');
  }
  const hash = createHash('sha256').update(secret).digest('hex');
  const {db, field} = services();
  return db.runTransaction(async tx => {
    const studentRef = db.collection('Students').doc(user.uid);
    const deviceRef = deviceCollection(db).doc(user.uid);
    const [student, device] = await tx.getAll(studentRef, deviceRef);
    if (student.data()?.active !== true || student.data().role !== 'student') {
      deny(403, 'Student access is suspended or unavailable.');
    }
    const binding = device.data();
    if (binding?.minAuthTime && user.auth_time < binding.minAuthTime) {
      deny(403, 'Device access was reset. Sign out and sign in again.');
    }
    if (binding?.hash && binding.hash !== hash) {
      deny(403, 'Another browser is registered. Contact your admin for a reset.');
    }
    if (!binding?.hash && !enroll) deny(403, 'Sign in on this browser to register it.');
    const [catalog, access] = readCatalog
      ? await tx.getAll(db.doc('courseCatalog/batch1'), accessCollection(db).doc(user.uid))
      : [];
    if (enroll && !binding?.hash) {
      tx.set(deviceRef, {hash, registeredAt: field.serverTimestamp()}, {merge: true});
    }
    return readCatalog ? effectiveLocks(catalog.data()?.lectureLocks || {}, access.data()) : {};
  });
}

module.exports = {studentAccess, deny};
