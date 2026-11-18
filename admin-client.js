import {ready, watch, login, logout, resetPassword, request} from './auth-client.js';

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

async function change(action, payload, control) {
  if (!authorized || busy) return;
  const session = generation;
  busy = control.disabled = true;
  byId('setup-link').replaceChildren();
  feedback.textContent = 'Saving…';
  try {
    const result = await request('/api/admin', {action, ...payload});
    if (session !== generation) return;
    if (result.setupLink) showSetupLink(result.setupLink);
    feedback.textContent = 'Saved.';
    if (action !== 'passwordResetLink') {
      const updated = await request('/api/admin', {action: 'listStudents'});
      if (session !== generation) return;
      data = updated;
      render();
    }
    return true;
  } catch (err) {
    if (session === generation) feedback.textContent = err.message;
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

function render() {
  byId('total').textContent = data.students.length;
  byId('active').textContent = data.students.filter(student => student.active).length;
  byId('student-list').replaceChildren();
  byId('device-list').replaceChildren();
  if (!data.students.length) {
    byId('student-list').textContent = byId('device-list').textContent = 'No students yet.';
  }
  for (const student of data.students) {
    const {uid, active, registered} = student;
    byId('student-list').append(studentRow(student, active ? 'Active' : 'Suspended',
      actionButton(active ? 'Suspend' : 'Activate', button =>
        change('setStudentActive', {uid, active: !active}, button)),
      actionButton('Password setup link', button => change('passwordResetLink', {uid}, button))));
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
      group.append(row);
    });
    return group;
  });
  byId('node-list').replaceChildren(...catalog);
}

watch(async account => {
  const session = ++generation;
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
const authErrors = new Map([
  ['auth/invalid-credential', 'Firebase rejected the email or password. If you forgot the TMS admin password, use Reset password.'],
  ['auth/wrong-password', 'Firebase rejected the email or password. If you forgot the TMS admin password, use Reset password.'],
  ['auth/user-not-found', 'Firebase rejected the email or password. If you forgot the TMS admin password, use Reset password.'],
  ['auth/invalid-email', 'Enter a valid admin email address.'],
  ['auth/unauthorized-domain', 'Firebase Authentication has not authorized this preview domain.'],
  ['auth/app-not-authorized', 'The Firebase web key does not allow this app or preview domain.'],
  ['auth/invalid-api-key', 'The Firebase web API key is invalid.'],
  ['auth/api-key-not-valid', 'The Firebase web API key is invalid.'],
  ['auth/operation-not-allowed', 'Email and password sign-in is disabled in Firebase.'],
  ['auth/network-request-failed', 'Could not reach Firebase. Check your connection and try again.'],
  ['auth/too-many-requests', 'Firebase temporarily limited attempts. Wait before retrying.'],
  ['auth/user-disabled', 'This account is disabled. Contact the TMS project owner.'],
  ['auth/internal-error', 'Firebase could not complete the request. Try again shortly.']
]);

function authErrorMessage(error, fallback) {
  const code = error?.code;
  if (typeof code !== 'string' || !/^auth\/[a-z0-9-]{1,60}$/.test(code)) return fallback;
  return (authErrors.get(code) || fallback) + ' (' + code + ')';
}

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
