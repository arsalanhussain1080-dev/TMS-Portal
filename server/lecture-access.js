'use strict';
const titles = require('../course-data');

const lectureKeys = titles.flatMap(([, ...lectures], nodeIndex) =>
  lectures.map((_, lectureIndex) => nodeIndex + ':' + lectureIndex));

function accessCollection(db) {
  return db.collection(process.env.VERCEL_ENV === 'preview' ? 'lectureAccessPreview' : 'lectureAccess');
}

function deviceCollection(db) {
  return db.collection(process.env.VERCEL_ENV === 'preview' ? 'deviceLocksPreview' : 'deviceLocks');
}

function allowedLectures(record) {
  if (record === undefined) return lectureKeys;
  return Array.isArray(record.lectures) ? lectureKeys.filter(key => record.lectures.includes(key)) : [];
}

function effectiveLocks(globalLocks, record) {
  const allowed = new Set(allowedLectures(record));
  return Object.fromEntries(lectureKeys.map(key => [key, globalLocks[key] === true || !allowed.has(key)]));
}

module.exports = {lectureKeys, accessCollection, deviceCollection, allowedLectures, effectiveLocks};
