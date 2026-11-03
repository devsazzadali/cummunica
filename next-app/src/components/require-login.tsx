"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api-client";
export function RequireLogin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!getToken()) router.replace("/login");
    else setOk(true);
  }, [router]);
  if (!ok) return <div className="wrap"><p>Redirecting to login…</p></div>;
  return <>{children}</>;
}
