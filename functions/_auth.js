// Access-protected API: fail closed until environment variables are configured.
// Required Pages secrets/variables: ACCESS_TEAM_DOMAIN, ACCESS_AUD, ADMIN_EMAILS.
const unauthorized = () => Response.json({error:"Unauthorized"}, {status:401,headers:{"Cache-Control":"no-store"}});
export async function requireAdmin(context) {
  const env=context.env;
  const team=(env.ACCESS_TEAM_DOMAIN||"").replace(/\/$/,"");
  const aud=env.ACCESS_AUD;
  const allowed=(env.ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!team.startsWith("https://")||!aud||!allowed.length) return null;
  const token=context.request.headers.get("Cf-Access-Jwt-Assertion");
  if(!token) return null;
  const parts=token.split(".");
  if(parts.length!==3) return null;
  try {
    const decode=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if(header.alg!=="RS256"||!header.kid||payload.iss!==team||!Array.isArray(payload.aud)||!payload.aud.includes(aud)||!allowed.includes((payload.email||"").toLowerCase()))return null;
    const now=Math.floor(Date.now()/1000);
    if(!payload.exp||payload.exp<=now||!payload.iat||payload.iat>now+60)return null;
    const jwks=await fetch(team+"/cdn-cgi/access/certs",{cf:{cacheTtl:300,cacheEverything:true}});
    if(!jwks.ok)return null;
    const keys=await jwks.json();
    const jwk=(keys.keys||[]).find(k=>k.kid===header.kid&&k.kty==="RSA");
    if(!jwk)return null;
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const ok=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,decode(parts[2]),new TextEncoder().encode(parts[0]+"."+parts[1]));
    return ok?payload:null;
  }catch{return null}
}
export const requireAdminResponse=unauthorized;
