import {requireAdmin,requireAdminResponse} from "../../_auth.js";
export async function onRequest(context){
 if(!await requireAdmin(context))return requireAdminResponse();
 const id=Number(context.params.id);
 if(!Number.isSafeInteger(id)||id<1)return new Response("Bad id",{status:400});
 const m=await context.env.DB.prepare("SELECT * FROM media WHERE id=?").bind(id).first();
 if(!m)return new Response("Not found",{status:404});
 const object=await context.env.MEDIA.get(m.storage_key);
 if(!object)return new Response("Not found",{status:404});
 return new Response(object.body,{headers:{"Content-Type":m.mime_type,"Cache-Control":"private, max-age=300","X-Content-Type-Options":"nosniff"}});
}