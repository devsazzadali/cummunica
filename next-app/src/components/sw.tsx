"use client";
import { useEffect } from "react";
export default function RegisterSW(){
  useEffect(()=>{ if("serviceWorker" in navigator){ navigator.serviceWorker.register("/sw.js").catch((err)=>{ try{ console.warn("service worker registration failed", err); }catch{} }); } },[]);
  return null;
}
