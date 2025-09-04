import { useEffect, useState } from "react";
import { Command } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsProps {
  onTabChange?: (tab: string) => void;
  onRefresh?: () => void;
  onTest?: () => void;
  onSearch?: () => void;
  onCommandPalette?: () => void;
}

export function KeyboardShortcuts({
  onTabChange,
  onRefresh,
  onTest,
  onSearch,
  onCommandPalette
}: KeyboardShortcutsProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Tab shortcuts (1-5)
      if (e.key >= "1" && e.key <= "5" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const tabs = ["overview", "analytics", "jobs", "sealed", "system"];
        const index = parseInt(e.key) - 1;
        if (tabs[index]) {
          onTabChange?.(tabs[index]);
        }
        return;
      }

      // Letter shortcuts
      switch (e.key.toLowerCase()) {
        case "r":
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            onRefresh?.();
          }
          break;
        case "t":
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            onTest?.();
          }
          break;
        case "/":
          e.preventDefault();
          onSearch?.();
          break;
        case "k":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onCommandPalette?.();
          }
          break;
        case "?":
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            setShowShortcuts(true);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTabChange, onRefresh, onTest, onSearch, onCommandPalette]);

  const shortcuts = [
    { key: "1-5", description: "Switch between tabs" },
    { key: "R", description: "Refresh current view" },
    { key: "T", description: "Run test" },
    { key: "/", description: "Focus search" },
    { key: "Cmd/Ctrl + K", description: "Open command palette" },
    { key: "?", description: "Show keyboard shortcuts" },
  ];

  return (
    <>
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Command className="w-5 h-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these shortcuts to navigate faster
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {shortcut.description}
                </span>
                <kbd className="px-2 py-1 text-xs font-semibold bg-muted text-muted-foreground border border-border rounded">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}