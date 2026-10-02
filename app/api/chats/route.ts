import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma"; import { getSessionUser } from "../../../lib/server-auth";
export const runtime="nodejs";
export async function GET(){const user=await getSessionUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});const chats=await prisma.chat.findMany({where:{userId:user.id},orderBy:{updatedAt:"desc"},include:{messages:{orderBy:{createdAt:"asc"}}}});return NextResponse.json({chats});}
export async function POST(req:NextRequest){const user=await getSessionUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});try{const body=await req.json();const title=String(body.title||"New conversation").trim().slice(0,80)||"New conversation";const chat=await prisma.chat.create({data:{userId:user.id,title}});return NextResponse.json({chat});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not create chat."},{status:500});}}
