import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma"; import { getSessionUser } from "../../../lib/server-auth";
import { generateChatId } from "../../../lib/chat-id.server";
export const runtime="nodejs";
export async function GET(){const user=await getSessionUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});const chats=await prisma.chat.findMany({where:{userId:user.id},orderBy:{updatedAt:"desc"},include:{messages:{orderBy:{createdAt:"asc"}}}});return NextResponse.json({chats});}
export async function POST(req:NextRequest){
  const user=await getSessionUser();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await req.json().catch(()=>({}));
    const title=String(body.title||"New conversation").trim().slice(0,80)||"New conversation";
    // Random 25-char id; retry on the (astronomically unlikely) unique-key collision.
    for(let attempt=0;attempt<5;attempt++){
      try{
        const chat=await prisma.chat.create({data:{id:generateChatId(),userId:user.id,title},include:{messages:true}});
        return NextResponse.json({chat});
      }catch(e:any){ if(e?.code!=="P2002") throw e; }
    }
    return NextResponse.json({error:"Could not allocate a chat id."},{status:500});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Could not create chat."},{status:500});}
}
