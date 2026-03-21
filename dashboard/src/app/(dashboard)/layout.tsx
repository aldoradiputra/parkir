"use client";

import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-surface-base">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-20 lg:pb-0">
        <div className="p-4 lg:p-6 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
