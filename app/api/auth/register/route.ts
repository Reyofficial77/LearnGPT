import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../../lib/prisma";
import { createSession, publicUser } from "../../../../lib/server-auth";
export const runtime="nodejs";
export async function POST(req:NextRequest){
  try { const {email,password,name}=await req.json(); const cleanEmail=String(email||"").trim().toLowerCase(); const cleanName=String(name||"").trim();
    if(!cleanName||!cleanEmail||String(password||"").length<8) return NextResponse.json({error:"Name, valid email, and an 8+ character password are required."},{status:400});
    const exists=await prisma.user.findUnique({where:{email:cleanEmail}}); if(exists) return NextResponse.json({error:"An account with this email already exists."},{status:409});
    const user=await prisma.user.create({data:{email:cleanEmail,name:cleanName,passwordHash:await bcrypt.hash(String(password),12),provider:"email"}}); await createSession(user.id);
    return NextResponse.json({user:publicUser(user)});
  } catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Registration failed."},{status:500});}
}
