import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";
import { createSession, publicUser } from "../../../../lib/server-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
  try { const {email,password}=await req.json(); const user=await prisma.user.findUnique({where:{email:String(email||"").trim().toLowerCase()}}); if(!user?.passwordHash||!(await bcrypt.compare(String(password||""),user.passwordHash))) return NextResponse.json({error:"Invalid email or password."},{status:401}); await createSession(user.id); return NextResponse.json({user:publicUser(user)}); }
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Sign in failed."},{status:500});}
}
