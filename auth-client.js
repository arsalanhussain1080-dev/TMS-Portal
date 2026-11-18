/* Firebase browser auth integration. This module does not allow demo credentials or offline bypass. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const config=window.TMS_FIREBASE_CONFIG;
const configured=Boolean(config?.apiKey&&config?.projectId&&config?.appId);
let auth=null;
if(configured)auth=getAuth(initializeApp(config));
const listeners=new Set();
let currentUser=null;
if(auth)onAuthStateChanged(auth,user=>{currentUser=user;listeners.forEach(fn=>fn(user));});
export const ready=configured;
export const user=()=>currentUser;
export const watch=fn=>{listeners.add(fn);if(!configured)fn(null);return ()=>listeners.delete(fn)};
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
