"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("parkir_token");
    if (!token) {
      router.replace("/login");
    } else {
      setAuthorized(true);
    }
  }, [router]);

  if (!authorized) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-surface-base">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
