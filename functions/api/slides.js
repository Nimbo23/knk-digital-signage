import {requireAdmin,requireAdminResponse} from "../_auth.js";
export async function onRequest(context){
 if(!await requireAdmin(context))return requireAdminResponse();
 const {request,env}=context;
 if(!env.DB)return Response.json({error:"Database not bound"},{status:503});
 if(request.method==="GET"){
  const {results}=await env.DB.prepare("SELECT s.*,m.filename,m.storage_key FROM slides s LEFT JOIN media m ON s.media_id=m.id ORDER BY s.display_order,s.id").all();
  return Response.json({slides:results},{headers:{"Cache-Control":"no-store"}});
 }
 if(request.method==="POST"){
  let x;try{x=await request.json()}catch{return Response.json({error:"Invalid JSON"},{status:400})}
  const name=String(x.name||"").trim().slice(0,100);
  const price=String(x.price_text||"").trim().slice(0,40);
  if(!name)return Response.json({error:"Product name required"},{status:400});
  const duration=Math.max(3,Math.min(120,Number(x.duration_seconds)||6));
  const mediaId=x.media_id==null?null:Number(x.media_id);
  if(mediaId!==null){const media=await env.DB.prepare("SELECT id FROM media WHERE id=? AND media_type='image'").bind(mediaId).first();if(!media)return Response.json({error:"Image not found"},{status:400})}
  const order=await env.DB.prepare("SELECT COALESCE(MAX(display_order),0)+1 AS n FROM slides").first();
  const r=await env.DB.prepare("INSERT INTO slides(name,price_text,media_id,display_order,duration_seconds) VALUES(?,?,?,?,?)").bind(name,price,mediaId,order.n,duration).run();
  return Response.json({id:r.meta.last_row_id},{status:201});
 }
 return Response.json({error:"Method not allowed"},{status:405,headers:{"Allow":"GET, POST"}});
}