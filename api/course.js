'use strict';
const {services,identity,response,error,method}=require('./_firebase');
module.exports=async function(req,res){
 try{
  method(req,'GET');
  const user=await identity(req);
  const {db}=services();
  const [student,administrator]=await Promise.all([db.doc('Students/'+user.uid).get(),db.doc('admins/'+user.uid).get()]);
  if(!(administrator.exists&&administrator.data().active===true)&&!(student.exists&&student.data().active===true))return response(res,403,{error:'Access denied'});
  const catalog=await db.doc('courseCatalog/batch1').get();
  return response(res,200,{lectureLocks:catalog.exists?catalog.data().lectureLocks||{}:{}});
 }catch(e){error(res,e)}
};
