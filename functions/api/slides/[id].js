import {requireAdmin,requireAdminResponse} from "../../_auth.js";
export async function onRequest(context){
 if(!await requireAdmin(context))return requireAdminResponse();
 const id=Number(context.params.id);
 if(!Number.isSafeInteger(id)||id<1)return Response.json({error:"Invalid id"},{status:400});
 const {request,env}=context;
 if(request.method==="DELETE"){await env.DB.prepare("DELETE FROM slides WHERE id=?").bind(id).run();return Response.json({ok:true})}
 if(request.method!=="PATCH")return Response.json({error:"Method not allowed"},{status:405});
 let x;try{x=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
 const current=await env.DB.prepare("SELECT * FROM slides WHERE id=?").bind(id).first();
 if(!current)return Response.json({error:"Not found"},{status:404});
 const name=x.name===undefined?current.name:String(x.name).trim().slice(0,100);
 if(!name)return Response.json({error:"Name required"},{status:400});
 const price=x.price_text===undefined?current.price_text:String(x.price_text).slice(0,40);
 const enabled=x.enabled===undefined?current.enabled:(x.enabled?1:0);
 const featured=x.featured===undefined?current.featured:(x.featured?1:0);
 const order=x.display_order===undefined?current.display_order:Number(x.display_order);
 const duration=x.duration_seconds===undefined?current.duration_seconds:Number(x.duration_seconds);
 if(!Number.isSafeInteger(order)||order<0||!Number.isSafeInteger(duration)||duration<3||duration>120)return Response.json({error:"Invalid order or duration"},{status:400});
 const mediaId=x.media_id===undefined?current.media_id:x.media_id===null?null:Number(x.media_id);
 if(mediaId!==null){const media=await env.DB.prepare("SELECT id FROM media WHERE id=? AND media_type='image'").bind(mediaId).first();if(!media)return Response.json({error:"Image not found"},{status:400})}
 await env.DB.prepare("UPDATE slides SET name=?,price_text=?,enabled=?,featured=?,display_order=?,duration_seconds=?,media_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(name,price,enabled,featured,order,duration,mediaId,id).run();
 return Response.json({ok:true});
}