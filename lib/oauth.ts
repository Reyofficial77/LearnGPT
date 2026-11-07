export type ClientUser={provider:"google"|"github";id:string;name:string;email?:string;avatar?:string};
const USER_KEY="learngpt.user";
export function saveUser(user:ClientUser){localStorage.setItem(USER_KEY,JSON.stringify(user));}
export function readUser():ClientUser|null{try{return JSON.parse(localStorage.getItem(USER_KEY)||"null")}catch{return null}}
export function clearUser(){localStorage.removeItem(USER_KEY)}
export function randomState(){const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")}
export async function pkce(){const verifier=randomState()+randomState();const data=new TextEncoder().encode(verifier);const hash=await crypto.subtle.digest("SHA-256",data);const challenge=btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");return {verifier,challenge};}
