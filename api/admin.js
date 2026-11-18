'use strict';
const {services, identity, response, error, method, str} = require('../server/firebase');
const {deny} = require('../server/student-access');
const titles = require('../course-data');
const {mediaDocument, mediaInput} = require('../server/lecture-media');
const {lectureKeys, accessCollection, deviceCollection, allowedLectures} = require('../server/lecture-access');

module.exports = async function(req, res) {
  try {
    method(req);
    const admin = await identity(req, {requireAdmin: true});
    const {auth, db, field} = services();
    const {action, uid, email, name, active, nodeIndex, lectureIndex, locked} = req.body || {};
    const catalog = db.doc('courseCatalog/batch1');
    const audit = (target, details = {}) => ({
      action, actor: admin.uid, target, ...details, at: field.serverTimestamp()
    });
    const auditRef = () => db.collection('auditLogs').doc();

    const media = mediaDocument(db);
    const access = accessCollection(db);
    const devicesRef = deviceCollection(db);
    if (action === 'listStudents') {
      const [students, catalogDoc, devices, mediaDoc, accessDocs] = await Promise.all([
        db.collection('Students').where('role', '==', 'student').get(),
        catalog.get(),
        devicesRef.get(),
        media.get(),
        access.get()
      ]);
      const accessByStudent = new Map(accessDocs.docs.map(doc => [doc.id, doc.data()]));
      const registered = new Set(devices.docs.filter(doc => doc.data().hash).map(doc => doc.id));
      return response(res, 200, {
        students: students.docs.map(doc => ({
          uid: doc.id, name: doc.data().name || '', email: doc.data().email || '',
          active: doc.data().active === true, registered: registered.has(doc.id),
          lectureAccess: allowedLectures(accessByStudent.get(doc.id))
        })),
        lectureLocks: catalogDoc.data()?.lectureLocks || {},
        lectureMedia: mediaDoc.data() || {}
      });
    }

    if (action === 'setLectureMedia') {
      if (!Number.isInteger(nodeIndex) || !Number.isInteger(lectureIndex) ||
          lectureIndex < 0 || !titles[nodeIndex]?.[lectureIndex + 1]) {
        deny(400, 'Invalid lecture selection.');
      }
      const {provider, videoId, privacyHash} = req.body;
      const source = provider === '' ? null : mediaInput(provider, videoId, privacyHash);
      const lectureKey = nodeIndex + ':' + lectureIndex;
      const batch = db.batch();
      batch.set(media, {[lectureKey]: source}, {mergeFields: [lectureKey]});
      batch.create(media.collection('audit').doc(), audit(lectureKey, {provider: source?.provider || null}));
      await batch.commit();
      return response(res, 200, {ok: true});
    }

    // Preview media, grants and registered browsers have dedicated collections.
    if (process.env.VERCEL_ENV === 'preview' && !['setStudentLectureAccess', 'resetDevice'].includes(action)) {
      deny(403, 'Shared Firebase changes are disabled in Vercel previews.');
    }

    if (action === 'createStudent') {
      const cleanEmail = str(email, 254)?.toLowerCase();
      const cleanName = str(name, 120);
      if (!cleanName || !cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        deny(400, 'Enter a valid student name and email.');
      }
      let user;
      try {
        user = await auth.createUser({email: cleanEmail, displayName: cleanName});
      } catch (err) {
        if (err.code === 'auth/email-already-exists') deny(409, 'An account already uses this email.');
        throw err;
      }
      let setupLink;
      try {
        setupLink = await auth.generatePasswordResetLink(cleanEmail);
        const batch = db.batch();
        batch.create(db.collection('Students').doc(user.uid), {
          name: cleanName, email: cleanEmail, role: 'student', active: true, createdAt: field.serverTimestamp()
        });
        batch.create(access.doc(user.uid), {lectures: [], updatedAt: field.serverTimestamp()});
        batch.create(auditRef(), audit(user.uid));
        await batch.commit();
      } catch (err) {
        await auth.deleteUser(user.uid);
        throw err;
      }
      return response(res, 201, {uid: user.uid, setupLink});
    }

    if (action === 'setLectureLock') {
      if (!Number.isInteger(nodeIndex) || !Number.isInteger(lectureIndex) ||
          lectureIndex < 0 || !titles[nodeIndex]?.[lectureIndex + 1] || typeof locked !== 'boolean') {
        deny(400, 'Invalid lecture selection.');
      }
      const batch = db.batch();
      batch.set(catalog, {lectureLocks: {[nodeIndex + ':' + lectureIndex]: locked}}, {merge: true});
      batch.create(auditRef(), audit('batch1', {nodeIndex, lectureIndex, locked}));
      await batch.commit();
      return response(res, 200, {ok: true});
    }

    if (!['setStudentActive', 'passwordResetLink', 'resetDevice', 'setStudentLectureAccess'].includes(action)) {
      deny(400, 'Unknown action.');
    }
    if (typeof uid !== 'string' || !/^[^/]{1,128}$/.test(uid) || uid === '.' || uid === '..') {
      deny(400, 'Invalid student.');
    }

    const studentRef = db.collection('Students').doc(uid);
    const adminRef = db.collection('admins').doc(uid);
    const deviceRef = devicesRef.doc(uid);
    function checkTarget(student, adminDoc) {
      if (adminDoc.exists || student.data()?.role !== 'student') deny(404, 'Student not found.');
    }

    if (action === 'setStudentLectureAccess') {
      const lectures = req.body.lectures;
      if (!Array.isArray(lectures) || lectures.length > lectureKeys.length ||
          lectures.some(key => !lectureKeys.includes(key))) {
        deny(400, 'Invalid lecture selection.');
      }
      const selected = lectureKeys.filter(key => lectures.includes(key));
      const accessRef = access.doc(uid);
      await db.runTransaction(async tx => {
        const [student, adminDoc] = await tx.getAll(studentRef, adminRef);
        checkTarget(student, adminDoc);
        tx.set(accessRef, {lectures: selected, updatedAt: field.serverTimestamp()});
        tx.create(accessRef.collection('audit').doc(), audit(uid, {lectures: selected}));
      });
      return response(res, 200, {ok: true});
    }

    if (action === 'passwordResetLink') {
      const [student, adminDoc] = await db.getAll(studentRef, adminRef);
      checkTarget(student, adminDoc);
      const account = await auth.getUser(uid);
      const setupLink = await auth.generatePasswordResetLink(account.email);
      await auditRef().create(audit(uid));
      return response(res, 200, {setupLink});
    }

    if (action === 'setStudentActive' && typeof active !== 'boolean') deny(400, 'Invalid account status.');
    await db.runTransaction(async tx => {
      const [student, adminDoc] = await tx.getAll(studentRef, adminRef);
      checkTarget(student, adminDoc);
      if (action === 'setStudentActive') {
        tx.update(studentRef, {active});
      } else {
        tx.set(deviceRef, {minAuthTime: Math.floor(Date.now() / 1000) + 1});
      }
      const previewReset = process.env.VERCEL_ENV === 'preview' && action === 'resetDevice';
      const log = previewReset ? deviceRef.collection('audit').doc() : auditRef();
      tx.create(log, audit(uid, action === 'setStudentActive' ? {active} : {}));
    });
    return response(res, 200, {ok: true});
  } catch (err) {
    error(res, err);
  }
};
