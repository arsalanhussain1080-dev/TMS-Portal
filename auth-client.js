/* Firebase browser auth integration. This module does not allow demo credentials or offline bypass. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,connectAuthEmulator,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const config=window.TMS_FIREBASE_CONFIG;
const configured=Boolean(config?.apiKey&&config?.projectId==='tss-admin-portal-1f3fa'&&config?.appId);
let auth=null;
if(configured)auth=getAuth(initializeApp(config));
if (auth && ['localhost', '127.0.0.1'].includes(location.hostname)) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
}
const listeners=new Set();
let currentUser=null;
let initialized = !auth;
if(auth)onAuthStateChanged(auth,user=>{initialized=true;currentUser=user;listeners.forEach(fn=>fn(user));});
export const ready=configured;
export const user=()=>currentUser;
export const watch=fn=>{listeners.add(fn);if(initialized)fn(currentUser);return ()=>listeners.delete(fn)};
export async function login(email,password){if(!auth)throw Error('Firebase web configuration pending');return signInWithEmailAndPassword(auth,email,password)}
export async function logout(){if(auth)await signOut(auth)}
export async function resetPassword(email){if(!auth)throw Error('Firebase web configuration pending');return sendPasswordResetEmail(auth,email)}
export async function request(path,body,verb='POST'){
 if(!auth?.currentUser)throw Error('Sign in required');
 const token=await auth.currentUser.getIdToken();
 const res=await fetch(path,{method:verb,headers:{Authorization:'Bearer '+token,...(verb==='POST'?{'Content-Type':'application/json'}:{})},...(verb==='POST'?{body:JSON.stringify(body||{})}:{})});
 const data=await res.json().catch(()=>({error:'Unexpected server response'}));
 if(!res.ok)throw Error(data.error||'Request failed');
 return data;
}

const authErrors = new Map([
  ['auth/invalid-credential', 'Firebase rejected the email or password. If you forgot your TMS password, use Reset password.'],
  ['auth/wrong-password', 'Firebase rejected the email or password. If you forgot your TMS password, use Reset password.'],
  ['auth/user-not-found', 'Firebase rejected the email or password. If you forgot your TMS password, use Reset password.'],
  ['auth/invalid-email', 'Enter a valid email address.'],
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

export function authErrorMessage(error, fallback) {
  const code = error?.code;
  if (typeof code !== 'string' || !/^auth\/[a-z0-9-]{1,60}$/.test(code)) return fallback;
  return (authErrors.get(code) || fallback) + ' (' + code + ')';
}
