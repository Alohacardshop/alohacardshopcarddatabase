import { ReactNode } from "react";

interface AppMainProps {
  children: ReactNode;
}

export function AppMain({ children }: AppMainProps) {
  return (
    <main className="flex-1 overflow-y-auto min-h-0 bg-muted/30">
      {children}
    </main>
  );
}