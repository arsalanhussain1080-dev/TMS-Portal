'use strict';
const {services,identity,response,error,method,str}=require('./_firebase');
module.exports=async function(req,res){
 try{
  method(req);
  const admin=await identity(req,{requireAdmin:true});
  const {auth,db,field}=services();
  const {action,uid,email,name,active,nodeIndex,lectureIndex,locked}=req.body||{};
  if(action==='listStudents'){
   const snap=await db.collection('Students').limit(200).get();
   return response(res,200,{students:snap.docs.map(d=>({uid:d.id,name:d.data().name||'',active:d.data().active===true,role:d.data().role||''}))});
  }
  if(action==='createStudent'){
   const cleanEmail=str(email,320),cleanName=str(name,120);
   if(!cleanEmail||!cleanName||!/^\S+@\S+\.\S+$/.test(cleanEmail))return response(res,400,{error:'Valid email and name required'});
   const user=await auth.createUser({email:cleanEmail,displayName:cleanName,disabled:false});
   try{await db.doc('Students/'+user.uid).set({name:cleanName,role:'student',active:true,mustChangePassword:true,createdAt:field.serverTimestamp()})}
   catch(e){await auth.deleteUser(user.uid);throw e}
   await db.collection('auditLogs').add({action,actor:admin.uid,target:user.uid,at:field.serverTimestamp()});
   const setupLink=await auth.generatePasswordResetLink(cleanEmail);return response(res,200,{uid:user.uid,setupLink,notice:'Send this one-time password setup link to the intended student securely. Do not post it publicly.'});
  }
  if(action==='passwordResetLink'){const cleanUid=str(uid,128);if(!cleanUid)return response(res,400,{error:'Invalid UID'});const student=await db.doc('Students/'+cleanUid).get();if(!student.exists)return response(res,404,{error:'Student not found'});const account=await auth.getUser(cleanUid);const setupLink=await auth.generatePasswordResetLink(account.email);await db.collection('auditLogs').add({action,actor:admin.uid,target:cleanUid,at:field.serverTimestamp()});return response(res,200,{setupLink});}
  if(action==='setStudentActive'){
   if(!str(uid,128)||typeof active!=='boolean')return response(res,400,{error:'Invalid request'});
   const ref=db.doc('Students/'+uid);if(!(await ref.get()).exists)return response(res,404,{error:'Student not found'});
   await ref.update({active});await auth.updateUser(uid,{disabled:!active});
   await db.collection('auditLogs').add({action,actor:admin.uid,target:uid,active,at:field.serverTimestamp()});
   return response(res,200,{ok:true});
  }
  if(action==='removeStudent'){
   if(!str(uid,128))return response(res,400,{error:'Invalid UID'});
   await auth.deleteUser(uid).catch(e=>{if(e.code!=='auth/user-not-found')throw e});
   await db.doc('Students/'+uid).delete();await db.doc('deviceLocks/'+uid).delete();
   await db.collection('auditLogs').add({action,actor:admin.uid,target:uid,at:field.serverTimestamp()});
   return response(res,200,{ok:true});
  }
  if(action==='resetDevice'){
   if(!str(uid,128))return response(res,400,{error:'Invalid UID'});
   await db.doc('deviceLocks/'+uid).delete();
   await db.collection('auditLogs').add({action,actor:admin.uid,target:uid,at:field.serverTimestamp()});
   return response(res,200,{ok:true});
  }
  if(action==='setLectureLock'){
   if(!Number.isInteger(nodeIndex)||nodeIndex<0||nodeIndex>=11||!Number.isInteger(lectureIndex)||lectureIndex<0||lectureIndex>=2||typeof locked!=='boolean')return response(res,400,{error:'Invalid lecture selection'});
   const ref=db.doc('courseCatalog/batch1');await db.runTransaction(async tx=>{const snap=await tx.get(ref);const existing=snap.exists?snap.data().lectureLocks||{}:{};tx.set(ref,{lectureLocks:{...existing,[nodeIndex+':'+lectureIndex]:locked},updatedAt:field.serverTimestamp()},{merge:true});});
   await db.collection('auditLogs').add({action,actor:admin.uid,nodeIndex,lectureIndex,locked,at:field.serverTimestamp()});
   return response(res,200,{ok:true});
  }
  return response(res,400,{error:'Unknown action'});
 }catch(e){error(res,e)}
};
