import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { Provider } from "../../../lib/types";
import { resolveModel } from "../../../lib/models";
import { prisma } from "../../../lib/prisma";
import { getSessionUser } from "../../../lib/server-auth";
export const runtime="nodejs";

async function persist(chatId:string,userId:string,messages:any[],assistantText:string){
  const chat=await prisma.chat.findFirst({where:{id:chatId,userId}}); if(!chat) return;
  const existing=await prisma.message.count({where:{chatId}});
  const incoming=messages.slice(existing).filter((m:any)=>m.role==="user"||m.role==="assistant");
  if(incoming.length) await prisma.message.createMany({data:incoming.map((m:any)=>({chatId,role:m.role,content:String(m.content)}))});
  await prisma.message.create({data:{chatId,role:"assistant",content:assistantText}});
  if(existing===0) await prisma.chat.update({where:{id:chatId},data:{title:String(messages[0]?.content||"New conversation").slice(0,80)}});
}

export async function POST(req:NextRequest){
  try{
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    const body=await req.json();
    const provider=body.provider as Provider, learnModel=String(body.model||""), apiKey=(provider==="gemini" ? process.env.GEMINI_API_KEY : provider==="openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) || "", systemPrompt=String(body.systemPrompt||""), messages=Array.isArray(body.messages)?body.messages:[], chatId=body.chatId?String(body.chatId):"";
    if(!["gemini","openai","anthropic"].includes(provider)) return NextResponse.json({error:"Unsupported provider."},{status:400});
    if(!apiKey) return NextResponse.json({error:`${provider} API key is missing. Open Settings to add it.`},{status:400});
    const model=resolveModel(provider, learnModel);
    if(!model) return NextResponse.json({error:"Invalid LearnGPT model."},{status:400});
    if(provider==="openai"){
      const client=new OpenAI({apiKey});
      const response=await client.responses.create({model,instructions:systemPrompt,input:messages.map((m:{role:string,content:string})=>({role:m.role as "user"|"assistant",content:m.content}))});
      const text=response.output_text;
      if (chatId) await persist(chatId, user.id, messages, text);
      return NextResponse.json({text});
    }
    if(provider==="anthropic"){
      const client=new Anthropic({apiKey});
      const response=await client.messages.create({model,max_tokens:4096,system:systemPrompt,messages:messages.map((m:{role:string,content:string})=>({role:m.role as "user"|"assistant",content:m.content}))});
      const text=response.content.filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("\n");
      if (chatId) await persist(chatId, user.id, messages, text);
      return NextResponse.json({text});
    }
    const ai=new GoogleGenAI({apiKey});
    const response=await ai.models.generateContent({model,contents:messages.map((m:{role:string,content:string})=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]})),config:{systemInstruction:systemPrompt}});
    const text=response.text||"";
    if (chatId) await persist(chatId, user.id, messages, text);
    return NextResponse.json({text});
  }catch(error){ const message=error instanceof Error?error.message:"The AI request failed."; return NextResponse.json({error:message},{status:500}); }
}
