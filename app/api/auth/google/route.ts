import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma"; import { createSession, publicUser } from "../../../../lib/server-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
  try { const {credential}=await req.json(); if(!credential) return NextResponse.json({error:"Google credential is missing."},{status:400});
    const verify=await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(credential))}`); const payload=await verify.json();
    const clientId=process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID; if(!verify.ok||!payload.sub||!payload.email||!clientId||payload.aud!==clientId) return NextResponse.json({error:"Google sign-in could not be verified."},{status:401});
    const user=await prisma.user.upsert({where:{provider_providerId:{provider:"google",providerId:String(payload.sub)}},update:{name:payload.name||payload.email, email:payload.email, avatar:payload.picture||null},create:{provider:"google",providerId:String(payload.sub),email:payload.email,name:payload.name||payload.email,avatar:payload.picture||null}}); await createSession(user.id); return NextResponse.json({user:publicUser(user)});
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Google sign-in failed."},{status:500});}
}
