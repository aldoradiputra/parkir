"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { setUser } = useAppStore();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
      } else {
        setUser({
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.name ?? user.email ?? "",
          role: user.user_metadata?.role ?? "admin",
          locations: user.user_metadata?.locations ?? [],
        });
        setAuthorized(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, setUser]);

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
