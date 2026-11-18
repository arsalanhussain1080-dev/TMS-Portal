'use strict';
const {identity,response,error,method}=require('./_firebase');
module.exports=async function(req,res){
 try{
  method(req);
  await identity(req);
  // Fail closed until a server-side signed video service is configured.
  return response(res,503,{error:'Secure video playback is not configured'});
 }catch(e){error(res,e)}
};
