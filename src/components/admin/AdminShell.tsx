import { ReactNode } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppSidebar } from "@/components/shell/AppSidebar";

interface AdminShellProps {
  children: ReactNode;
  onOpenCommandPalette?: () => void;
}

export function AdminShell({ children, onOpenCommandPalette }: AdminShellProps) {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <SidebarInset>
          <AppHeader onOpenCommandPalette={onOpenCommandPalette} />
          <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}