import {ready, watch, user, login, logout, resetPassword, request, authErrorMessage} from './auth-client.js';

const byId = id => document.getElementById(id);
const titles = window.TMS_COURSE_TITLES;
const views = ['course', 'chapters', 'lectures', 'player'];
const form = byId('auth-form');
const status = byId('auth-status');
const feedback = byId('auth-feedback');
const out = byId('auth-logout');
const reset = byId('auth-reset');
let deviceSecret;
let session = 0;
let activeNode;
let activeLecture;
let playbackRequest = 0;
let locks = {};

function show(view) {
  views.forEach(id => byId(id).classList.toggle('hidden', id !== view));
  byId('nav-course').classList.toggle('active', view === 'course');
  byId('nav-chapters').classList.toggle('active', Boolean(view && view !== 'course'));
  if (view !== 'player') {
    playbackRequest++;
    activeLecture = undefined;
    const player = document.querySelector('.video');
    player.classList.remove('player-expanded');
    if (document.fullscreenElement === player) document.exitFullscreen().catch(() => {});
    player.replaceChildren();
  }
}

function row(title, subtitle, onClick, locked = false) {
  const button = document.createElement('button');
  button.className = 'item';
  button.disabled = locked;
  const description = document.createElement('span');
  const label = document.createElement('strong');
  label.textContent = title;
  const detail = document.createElement('small');
  detail.textContent = subtitle;
  description.append(label, detail);
  button.append(description);
  button.onclick = onClick;
  return button;
}

function setAccess(allowed) {
  byId('nav-course').disabled = !allowed;
  byId('nav-chapters').disabled = !allowed;
  if (!allowed) show(null);
}

function hasLock(nodeIndex, lectureIndex) {
  return locks[nodeIndex + ':' + lectureIndex] === true;
}

function openNode(nodeIndex) {
  activeNode = nodeIndex;
  const [title, ...lectures] = titles[nodeIndex];
  byId('node-heading').textContent = title;
  byId('lecture-list').replaceChildren(...lectures.map((lecture, lectureIndex) => {
    const locked = hasLock(nodeIndex, lectureIndex);
    return row(lecture, locked ? 'Locked' : 'Open lecture',
      () => openLecture(nodeIndex, lectureIndex), locked);
  }));
  show('lectures');
}

async function openLecture(nodeIndex, lectureIndex) {
  const generation = session;
  const requestId = ++playbackRequest;
  activeLecture = lectureIndex;
  byId('lecture-heading').textContent = titles[nodeIndex][lectureIndex + 1];
  const player = document.querySelector('.video');
  player.textContent = 'Checking lecture access…';
  show('player');
  try {
    const {embedUrl, student} = await request('/api/video', {nodeIndex, lectureIndex, deviceSecret});
    if (generation !== session || requestId !== playbackRequest) return;
    const url = new URL(embedUrl);
    const allowedOrigins = ['https://iframe.mediadelivery.net', 'https://www.youtube-nocookie.com',
      'https://player.vimeo.com', 'https://player.vdocipher.com'];
    if (!allowedOrigins.includes(url.origin)) throw new Error('Video playback is unavailable.');
    const frame = document.createElement('iframe');
    frame.src = url.href;
    frame.title = titles[nodeIndex][lectureIndex + 1];
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    const watermark = document.createElement('span');
    watermark.className = 'player-watermark';
    const name = document.createElement('strong');
    name.textContent = student?.name || 'TMS Student';
    const email = document.createElement('span');
    email.textContent = student?.email || user()?.email || '';
    watermark.append(name, email);
    const fullscreen = document.createElement('button');
    fullscreen.type = 'button';
    fullscreen.className = 'player-fullscreen';
    fullscreen.textContent = 'Full screen';
    fullscreen.setAttribute('aria-label', 'Toggle full screen');
    fullscreen.onclick = async () => {
      if (player.classList.contains('player-expanded')) {
        player.classList.remove('player-expanded');
      } else if (document.fullscreenElement === player) {
        await document.exitFullscreen();
      } else if (!document.fullscreenEnabled || !player.requestFullscreen) {
        player.classList.add('player-expanded');
      } else {
        try {
          await player.requestFullscreen();
        } catch {
          if (player.contains(fullscreen)) player.classList.add('player-expanded');
        }
      }
    };
    player.replaceChildren(frame, watermark, fullscreen);
  } catch (err) {
    if (generation === session && requestId === playbackRequest) player.textContent = err.message;
  }
}

byId('nodes').replaceChildren(...titles.map(([title, ...lectures], index) =>
  row(title, lectures.length + ' lectures', () => openNode(index))));
byId('open-chapters').onclick = byId('nav-chapters').onclick = () => show('chapters');
byId('nav-course').onclick = () => show('course');
document.querySelectorAll('[data-back]').forEach(button => {
  button.onclick = () => button.dataset.back === 'lectures' ? openNode(activeNode) : show(button.dataset.back);
});

function browserKey(uid) {
  const key = 'tms.device.' + uid;
  const existing = localStorage.getItem(key);
  if (/^[0-9a-f]{64}$/.test(existing || '')) return existing;
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)),
    byte => byte.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(key, secret);
  return localStorage.getItem(key);
}

watch(async account => {
  const generation = ++session;
  setAccess(false);
  deviceSecret = undefined;
  form.hidden = reset.hidden = Boolean(account);
  out.hidden = !account;
  feedback.textContent = '';
  status.textContent = account ? 'Verifying student access…' :
    ready ? 'Sign in to access your course.' : 'Firebase sign-in is unavailable.';
  if (!account) return;
  try {
    deviceSecret = browserKey(account.uid);
    const data = await request('/api/device', {deviceSecret});
    if (generation !== session) return;
    locks = data.lectureLocks;
    setAccess(true);
    show('course');
    status.textContent = 'Student access verified.';
  } catch (err) {
    if (generation !== session) return;
    deviceSecret = undefined;
    status.textContent = 'Student access unavailable.';
    feedback.textContent = err.message;
  }
});

let refreshing = false;
async function refresh() {
  if (refreshing || !deviceSecret || !user()) return;
  const generation = session;
  refreshing = true;
  try {
    const data = await request('/api/course', {deviceSecret});
    if (generation !== session) return;
    if (byId('nav-course').disabled) {
      setAccess(true);
      show('course');
      status.textContent = 'Student access verified.';
      feedback.textContent = '';
    }
    const changed = JSON.stringify(data.lectureLocks) !== JSON.stringify(locks);
    locks = data.lectureLocks;
    if (changed && (!byId('lectures').classList.contains('hidden') || hasLock(activeNode, activeLecture))) {
      openNode(activeNode);
    }
  } catch (err) {
    if (generation === session) {
      setAccess(false);
      status.textContent = 'Student access unavailable.';
      feedback.textContent = err.message;
    }
  } finally {
    refreshing = false;
  }
}
window.setInterval(refresh, 10000);
window.addEventListener('focus', refresh);

form.onsubmit = async event => {
  event.preventDefault();
  feedback.textContent = '';
  const password = byId('auth-password');
  try {
    await login(byId('auth-email').value.trim(), password.value);
  } catch (error) {
    feedback.textContent = authErrorMessage(error, 'Firebase sign-in could not be completed.');
  } finally {
    password.value = '';
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
