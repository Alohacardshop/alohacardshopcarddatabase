import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DarkModeToggle } from "./DarkModeToggle";
import { cn } from "@/lib/utils";

interface StickyHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  lastUpdated?: Date;
  nextSync?: Date;
  className?: string;
}

export function StickyHeader({
  activeTab,
  onTabChange,
  lastUpdated,
  nextSync,
  className
}: StickyHeaderProps) {
  const [timeUntilSync, setTimeUntilSync] = useState("");
  const [timeSinceUpdate, setTimeSinceUpdate] = useState("");

  useEffect(() => {
    const updateTimers = () => {
      if (lastUpdated) {
        const now = new Date();
        const diffMs = now.getTime() - lastUpdated.getTime();
        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
          setTimeSinceUpdate(`${hours}h ${minutes % 60}m ago`);
        } else {
          setTimeSinceUpdate(`${minutes}m ago`);
        }
      }

      if (nextSync) {
        const now = new Date();
        const diffMs = nextSync.getTime() - now.getTime();
        
        if (diffMs > 0) {
          const minutes = Math.ceil(diffMs / (1000 * 60));
          const hours = Math.floor(minutes / 60);
          
          if (hours > 0) {
            setTimeUntilSync(`${hours}h ${minutes % 60}m`);
          } else {
            setTimeUntilSync(`${minutes}m`);
          }
        } else {
          setTimeUntilSync("Starting soon...");
        }
      }
    };

    updateTimers();
    const interval = setInterval(updateTimers, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [lastUpdated, nextSync]);

  const tabs = [
    { id: "overview", label: "Overview", shortcut: "1" },
    { id: "analytics", label: "Analytics", shortcut: "2" },
    { id: "jobs", label: "Jobs", shortcut: "3" },
    { id: "sealed", label: "Sealed Products", shortcut: "4" },
    { id: "system", label: "System Health", shortcut: "5" }
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle number key shortcuts (1-5)
      if (e.key >= "1" && e.key <= "5" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const index = parseInt(e.key) - 1;
        if (tabs[index]) {
          onTabChange(tabs[index].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTabChange]);

  return (
    <div className={cn(
      "sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md transition-all duration-200",
      "shadow-sm animate-fade-in",
      className
    )}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between p-4 gap-4">
        {/* Navigation tabs */}
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full lg:w-auto">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 lg:w-auto h-auto p-1">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id} 
                className="relative flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <span>{tab.label}</span>
                <kbd className="hidden sm:inline-flex items-center justify-center w-5 h-5 text-xs bg-muted text-muted-foreground rounded border">
                  {tab.shortcut}
                </kbd>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Status and controls */}
        <div className="flex items-center justify-between lg:justify-end gap-4">
          {/* Time indicators */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {lastUpdated && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">Last updated:</span>
                <span className="font-medium">{timeSinceUpdate}</span>
              </div>
            )}
            
            {nextSync && (
              <Badge variant="outline" className="flex items-center gap-1">
                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                <span className="hidden sm:inline">Next sync in</span>
                <span className="font-medium">{timeUntilSync}</span>
              </Badge>
            )}
          </div>

          {/* Dark mode toggle */}
          <DarkModeToggle />
        </div>
      </div>
    </div>
  );
}