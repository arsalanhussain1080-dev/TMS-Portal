import {ready, watch, login, logout, resetPassword, request, authErrorMessage} from './auth-client.js';

const byId = id => document.getElementById(id);
const pages = ['overview', 'students', 'lectures', 'devices'];
const title = {overview: 'Overview', students: 'Students', lectures: 'Lectures', devices: 'Devices'};
const form = byId('auth-form');
const feedback = byId('auth-feedback');
const status = byId('auth-status');
const reset = byId('auth-reset');
const out = byId('auth-logout');
let generation = 0;
let authorized = false;
let busy = false;
let data;

function element(tag, className, name) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (name) node.textContent = name;
  return node;
}

function navigate(page) {
  for (const current of pages) byId(current).classList.toggle('hidden', page !== current);
  document.querySelectorAll('[data-page]').forEach(button => {
    button.disabled = !authorized;
    button.classList.toggle('active', button.dataset.page === page);
  });
}

for (const id of ['desktop-nav', 'mobile-nav']) {
  for (const page of pages) {
    const button = element('button', '', title[page]);
    button.dataset.page = page;
    button.onclick = () => navigate(page);
    byId(id).append(button);
  }
}
navigate(null);

function actionButton(label, onClick) {
  const button = element('button', 'btn secondary', label);
  button.type = 'button';
  button.onclick = () => onClick(button);
  return button;
}

function showSetupLink(link) {
  const field = element('input');
  field.readOnly = true;
  field.value = link;
  field.setAttribute('aria-label', 'One-time password setup link');
  const copy = actionButton('Copy link', async () => {
    try {
      await navigator.clipboard.writeText(link);
      feedback.textContent = 'Link copied. Share it privately with the student.';
    } catch {
      field.select();
    }
  });
  byId('setup-link').replaceChildren(element('p', '', 'One-time password setup link. Share privately.'), field, copy);
}

async function change(action, payload, control, message = feedback) {
  if (!authorized || busy) return;
  const session = generation;
  busy = control.disabled = true;
  byId('setup-link').replaceChildren();
  message.textContent = 'Saving…';
  try {
    const result = await request('/api/admin', {action, ...payload});
    if (session !== generation) return;
    if (result.setupLink) showSetupLink(result.setupLink);
    message.textContent = 'Saved.';
    if (action !== 'passwordResetLink') {
      const updated = await request('/api/admin', {action: 'listStudents'});
      if (session !== generation) return;
      data = updated;
      render();
    }
    return true;
  } catch (err) {
    if (session === generation) message.textContent = err.message;
  } finally {
    if (session === generation) busy = false;
    control.disabled = false;
  }
}

function studentRow(student, summary, ...buttons) {
  const row = element('div', 'item');
  const info = element('div');
  info.append(element('strong', '', student.name || 'Unnamed student'),
    element('small', '', [student.email, summary].filter(Boolean).join(' · ')));
  const actions = element('div', 'actions');
  actions.append(...buttons);
  row.append(info, actions);
  return row;
}

function editStudentLectures(student) {
  const dialog = element('dialog', 'access-dialog');
  const heading = element('h2', '', 'Lecture access · ' + (student.name || student.email || 'Student'));
  heading.id = 'access-dialog-title';
  dialog.setAttribute('aria-labelledby', heading.id);
  const message = element('p');
  message.setAttribute('role', 'status');
  dialog.append(heading, element('p', '', 'Lectures locked for the whole course stay locked for this student.'));
  const checkboxes = [];
  const granted = new Set(student.lectureAccess);
  const list = element('div', 'access-list');
  window.TMS_COURSE_TITLES.forEach(([node, ...lectures], nodeIndex) => {
    const group = element('fieldset');
    group.append(element('legend', '', node));
    lectures.forEach((title, lectureIndex) => {
      const key = nodeIndex + ':' + lectureIndex;
      const input = element('input');
      input.type = 'checkbox';
      input.value = key;
      input.checked = granted.has(key);
      checkboxes.push(input);
      const label = element('label', 'access-choice');
      const suffix = data.lectureLocks[key] ? ' (course locked)' : '';
      label.append(input, document.createTextNode(title + suffix));
      group.append(label);
    });
    list.append(group);
  });
  const actions = element('div', 'actions');
  const save = actionButton('Save access', async button => {
    const lectures = checkboxes.filter(input => input.checked).map(input => input.value);
    if (await change('setStudentLectureAccess', {uid: student.uid, lectures}, button, message)) {
      feedback.textContent = 'Lecture access saved.';
      dialog.close();
    }
  });
  actions.append(actionButton('Select all', () => checkboxes.forEach(input => {input.checked = true;})),
    actionButton('Clear all', () => checkboxes.forEach(input => {input.checked = false;})),
    save, actionButton('Close', () => dialog.close()));
  dialog.append(list, message, actions);
  dialog.addEventListener('close', () => dialog.remove(), {once: true});
  document.body.append(dialog);
  dialog.showModal();
}

function lectureMediaEditor(nodeIndex, lectureIndex, lecture) {
  const source = data.lectureMedia?.[nodeIndex + ':' + lectureIndex];
  const editor = element('form', 'actions media-editor');
  const provider = element('select');
  provider.setAttribute('aria-label', 'Video provider for ' + lecture);
  for (const [value, label] of Object.entries({
    '': 'No video', bunny: 'Bunny.net', youtube: 'YouTube', vimeo: 'Vimeo', vdocipher: 'VdoCipher'
  })) {
    const option = element('option', '', label);
    option.value = value;
    provider.append(option);
  }
  provider.value = source?.provider || '';
  const videoId = element('input');
  videoId.placeholder = 'Video ID';
  videoId.setAttribute('aria-label', 'Video ID for ' + lecture);
  videoId.value = source?.videoId || '';
  videoId.maxLength = 64;
  const hash = element('input');
  hash.placeholder = 'Vimeo unlisted hash';
  hash.setAttribute('aria-label', hash.placeholder);
  hash.value = source?.privacyHash || '';
  hash.maxLength = 64;
  const save = element('button', 'btn', 'Save video');
  save.type = 'submit';
  function updateFields() {
    videoId.disabled = !provider.value;
    videoId.required = Boolean(provider.value);
    hash.hidden = hash.disabled = provider.value !== 'vimeo';
  }
  updateFields();
  provider.onchange = updateFields;
  editor.onsubmit = event => {
    event.preventDefault();
    change('setLectureMedia', {
      nodeIndex, lectureIndex, provider: provider.value, videoId: videoId.value,
      privacyHash: hash.disabled ? '' : hash.value
    }, save);
  };
  editor.append(provider, videoId, hash, save);
  return editor;
}

function render() {
  const roster = data.students.filter(student => !student.archived);
  byId('total').textContent = roster.length;
  byId('active').textContent = roster.filter(student => student.active).length;
  byId('student-list').replaceChildren();
  byId('device-list').replaceChildren();
  if (!data.students.length) {
    byId('student-list').textContent = byId('device-list').textContent = 'No students yet.';
  }
  for (const student of data.students) {
    const {uid, active, registered} = student;
    if (student.archived) {
      byId('student-list').append(studentRow(student, 'Removed from active roster',
        actionButton('Restore student', button => change('setStudentArchived', {uid, archived: false}, button))));
      continue;
    }
    const accessCount = student.lectureAccess.length;
    const summary = (active ? 'Active' : 'Suspended') + ' · ' + accessCount + ' lectures granted';
    byId('student-list').append(studentRow(student, summary,
      actionButton('Lecture access', () => editStudentLectures(student)),
      actionButton(active ? 'Suspend' : 'Activate', button =>
        change('setStudentActive', {uid, active: !active}, button)),
      actionButton('Password setup link', button => change('passwordResetLink', {uid}, button)),
      actionButton('Remove student', button => {
        if (confirm('Remove this student from the active roster and block their access?')) {
          change('setStudentArchived', {uid, archived: true}, button);
        }
      })));
    byId('device-list').append(studentRow(student, registered ? 'Browser registered' : 'No browser registered',
      actionButton('Reset device', button => {
        if (confirm('Reset the registered browser for this student?')) change('resetDevice', {uid}, button);
      })));
  }

  const catalog = window.TMS_COURSE_TITLES.map(([name, ...lectures], nodeIndex) => {
    const group = element('section', 'panel');
    group.append(element('h3', '', name));
    lectures.forEach((lecture, lectureIndex) => {
      const locked = data.lectureLocks[nodeIndex + ':' + lectureIndex] === true;
      const row = element('div', 'item');
      row.append(element('strong', '', lecture), actionButton(locked ? 'Unlock' : 'Lock', button =>
        change('setLectureLock', {nodeIndex, lectureIndex, locked: !locked}, button)));
      row.append(lectureMediaEditor(nodeIndex, lectureIndex, lecture));
      group.append(row);
    });
    return group;
  });
  byId('node-list').replaceChildren(...catalog);
}

watch(async account => {
  const session = ++generation;
  document.querySelector('.access-dialog')?.close();
  authorized = busy = false;
  data = undefined;
  navigate(null);
  for (const id of ['student-list', 'device-list', 'node-list', 'setup-link']) byId(id).replaceChildren();
  form.hidden = reset.hidden = Boolean(account);
  out.hidden = !account;
  feedback.textContent = '';
  status.textContent = account ? 'Verifying admin access…' :
    ready ? 'Sign in to manage TMS.' : 'Firebase sign-in is unavailable.';
  if (!account) return;
  try {
    const result = await request('/api/admin', {action: 'listStudents'});
    if (session !== generation) return;
    data = result;
    authorized = true;
    status.textContent = 'Admin access verified.';
    render();
    navigate('overview');
  } catch (err) {
    if (session !== generation) return;
    status.textContent = 'Admin access unavailable.';
    feedback.textContent = err.message;
  }
});

byId('student-create').onsubmit = async event => {
  event.preventDefault();
  const createForm = event.currentTarget;
  const saved = await change('createStudent', {
    name: byId('student-name').value.trim(), email: byId('student-email').value.trim()
  }, createForm.querySelector('button'));
  if (saved) createForm.reset();
};
form.onsubmit = async event => {
  event.preventDefault();
  const password = byId('auth-password');
  feedback.textContent = '';
  try {
    await login(byId('auth-email').value.trim(), password.value);
    password.value = '';
  } catch (error) {
    password.value = '';
    feedback.textContent = authErrorMessage(error, 'Firebase sign-in could not be completed.');
  }
};
reset.onclick = async () => {
  if (!byId('auth-email').reportValidity()) return;
  try {
    await resetPassword(byId('auth-email').value.trim());
    feedback.textContent = 'If the account is eligible, a reset email will be sent.';
  } catch (error) {
    feedback.textContent = authErrorMessage(error, 'Password reset could not be requested.');
  }
};
out.onclick = () => logout().catch(() => { feedback.textContent = 'Sign-out failed. Try again.'; });
