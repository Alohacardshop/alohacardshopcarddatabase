import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { AppMain } from "@/components/shell/AppMain";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <AppHeader />
          <AppMain>{children}</AppMain>
        </div>
      </div>
    </SidebarProvider>
  );
}