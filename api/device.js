'use strict';
const crypto=require('crypto');
const {services,identity,response,error,method,str}=require('./_firebase');
module.exports=async function(req,res){
 try{
  method(req);
  const user=await identity(req);
  const {db,field}=services();
  const student=await db.doc('Students/'+user.uid).get();
  if(!student.exists||student.data().active!==true||student.data().role!=='student')return response(res,403,{error:'Student access disabled'});
  const secret=str(req.body?.deviceSecret,512);
  if(!secret||secret.length<32)return response(res,400,{error:'Device secret required'});
  const hash=crypto.createHash('sha256').update(secret).digest('hex');
  const ref=db.doc('deviceLocks/'+user.uid);
  const result=await db.runTransaction(async tx=>{
   const doc=await tx.get(ref);
   if(doc.exists&&doc.data().hash!==hash)return false;
   if(!doc.exists)tx.create(ref,{hash,createdAt:field.serverTimestamp()});
   return true;
  });
  return response(res,result?200:403,result?{ok:true}:{error:'Another device is registered. Contact admin for reset.'});
 }catch(e){error(res,e)}
};
