import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { Provider } from "../../../lib/types";
import { resolveModel } from "../../../lib/models";
export const runtime="nodejs";
export async function POST(req:NextRequest){
  try{
    const body=await req.json();
    const provider=body.provider as Provider, learnModel=String(body.model||""), browserApiKey=String(body.apiKey||""), apiKey=browserApiKey || (provider==="gemini" ? process.env.GEMINI_API_KEY : provider==="openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY) || "", systemPrompt=String(body.systemPrompt||""), messages=Array.isArray(body.messages)?body.messages:[];
    if(!["gemini","openai","anthropic"].includes(provider)) return NextResponse.json({error:"Unsupported provider."},{status:400});
    if(!apiKey) return NextResponse.json({error:`${provider} API key is missing. Open Settings to add it.`},{status:400});
    const model=resolveModel(provider, learnModel);
    if(!model) return NextResponse.json({error:"Invalid LearnGPT model."},{status:400});
    if(provider==="openai"){
      const client=new OpenAI({apiKey});
      const response=await client.responses.create({model,instructions:systemPrompt,input:messages.map((m:{role:string,content:string})=>({role:m.role as "user"|"assistant",content:m.content}))});
      return NextResponse.json({text:response.output_text});
    }
    if(provider==="anthropic"){
      const client=new Anthropic({apiKey});
      const response=await client.messages.create({model,max_tokens:4096,system:systemPrompt,messages:messages.map((m:{role:string,content:string})=>({role:m.role as "user"|"assistant",content:m.content}))});
      const text=response.content.filter((b:any)=>b.type==="text").map((b:any)=>b.text).join("\n");
      return NextResponse.json({text});
    }
    const ai=new GoogleGenAI({apiKey});
    const response=await ai.models.generateContent({model,contents:messages.map((m:{role:string,content:string})=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]})),config:{systemInstruction:systemPrompt}});
    return NextResponse.json({text:response.text||""});
  }catch(error){ const message=error instanceof Error?error.message:"The AI request failed."; return NextResponse.json({error:message},{status:500}); }
}
