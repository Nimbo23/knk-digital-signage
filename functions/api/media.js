import {requireAdmin,requireAdminResponse} from "../_auth.js";
export async function onRequest(context){
 if(!await requireAdmin(context))return requireAdminResponse();
 const {request,env}=context;
 if(!env.MEDIA||!env.DB)return Response.json({error:"Storage not bound"},{status:503});
 if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405});
 const form=await request.formData().catch(()=>null),file=form?.get("file");
 if(!(file instanceof File))return Response.json({error:"File required"},{status:400});
 const types={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","video/mp4":"mp4"};
 if(!types[file.type])return Response.json({error:"Unsupported file type"},{status:415});
 if(file.size<1||file.size>25*1024*1024)return Response.json({error:"File must be 1 byte to 25 MB"},{status:413});
 const prefix=file.type.startsWith("image/")?"images":"videos";
 const key=prefix+"/"+crypto.randomUUID()+"."+types[file.type];
 const data=await file.arrayBuffer();
 const bytes=new Uint8Array(data);
 const valid=file.type==="image/jpeg"?bytes[0]===255&&bytes[1]===216:file.type==="image/png"?bytes.slice(0,4).join(",")==="137,80,78,71":file.type==="image/webp"?new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP":new TextDecoder().decode(bytes.slice(4,8))==="ftyp";
 if(!valid)return Response.json({error:"File contents do not match type"},{status:415});
 await env.MEDIA.put(key,data,{httpMetadata:{contentType:file.type}});
 try{
  const r=await env.DB.prepare("INSERT INTO media(filename,storage_key,media_type,mime_type,size_bytes) VALUES(?,?,?,?,?)").bind(file.name.slice(0,200),key,prefix==="images"?"image":"video",file.type,file.size).run();
  return Response.json({id:r.meta.last_row_id,filename:file.name},{status:201});
 }catch(e){await env.MEDIA.delete(key);return Response.json({error:"Unable to save metadata"},{status:500})}
}