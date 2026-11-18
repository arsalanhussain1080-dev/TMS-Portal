'use strict';
const admin = require('firebase-admin');
function app() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIRESTORE_EMULATOR_HOST && !process.env.VERCEL) {
    return admin.initializeApp({projectId: 'demo-tms-portal'});
  }
  if (projectId !== 'tss-admin-portal-1f3fa' || !clientEmail || !privateKey) {
    throw Object.assign(new Error('Firebase server access is not configured for this deployment.'), {status: 503});
  }
  return admin.initializeApp({credential:admin.credential.cert({projectId,clientEmail,privateKey}),projectId});
}
function services() {app();return {auth:admin.auth(),db:admin.firestore(),field:admin.firestore.FieldValue};}
async function identity(req,{requireAdmin=false}={}) {
  const header=req.headers.authorization||'';
  if (!header.startsWith('Bearer ')) {const e=new Error('Authentication required');e.status=401;throw e;}
  const {auth,db}=services();
  let token;
  try {
    token = await auth.verifyIdToken(header.slice(7), true);
  } catch (error) {
    if (!['auth/id-token-expired', 'auth/id-token-revoked', 'auth/argument-error', 'auth/invalid-id-token', 'auth/user-disabled', 'auth/user-not-found'].includes(error.code)) throw error;
    throw Object.assign(new Error('Sign in again to continue.'), {status: 401});
  }
  if(requireAdmin) {
    const snap=await db.doc('admins/'+token.uid).get();
    if(!snap.exists||snap.data().active!==true){const e=new Error('Admin access required');e.status=403;throw e;}
  }
  return token;
}
function response(res,status,data){res.status(status).setHeader('Cache-Control','no-store').json(data)}
function error(res,e){const status=e.status||500;response(res,status,{error:status===500?'Request failed':e.message});if(status===500)console.error('TMS API error:',e.code||e.name)}
function method(req,expected='POST'){if(req.method!==expected){const e=new Error('Method not allowed');e.status=405;throw e;}}
function str(value,max=256){return typeof value==='string'&&value.trim().length>0&&value.trim().length<=max?value.trim():null}
module.exports={services,identity,response,error,method,str};
