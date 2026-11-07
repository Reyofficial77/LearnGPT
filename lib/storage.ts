import type { Settings } from "./types";
export const SETTINGS_KEY="learngpt.settings";
export const CHATS_KEY="learngpt.chats";
export function readSettings(): Settings { if(typeof window==="undefined") return {} as Settings; try { const raw=localStorage.getItem(SETTINGS_KEY); return raw?JSON.parse(raw):{} as Settings; } catch { return {} as Settings; } }
export function writeSettings(value: Settings){ localStorage.setItem(SETTINGS_KEY,JSON.stringify(value)); }
export function readChats(){ if(typeof window==="undefined") return []; try { return JSON.parse(localStorage.getItem(CHATS_KEY)||"[]"); } catch { return []; } }
export function writeChats(value: unknown[]){ localStorage.setItem(CHATS_KEY,JSON.stringify(value)); }
