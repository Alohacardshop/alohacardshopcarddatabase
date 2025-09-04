import { useState, useEffect, useCallback } from "react";
import { Search, ArrowRight, Clock, Zap, Activity, Database, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  category: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onTabChange?: (tab: string) => void;
  onAction?: (action: string) => void;
}

export function CommandPalette({ open, onClose, onTabChange, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Sample commands - in real app, these would come from your app state
  const commands: Command[] = [
    // Quick Actions (Priority)
    {
      id: "action-sync-all",
      title: "Sync All Games",
      description: "Start comprehensive sync across all games and products",
      icon: <Zap className="w-4 h-4" />,
      category: "Quick Actions",
      action: () => onAction?.("sync-all"),
      keywords: ["sync", "all", "games", "everything", "pricing", "comprehensive"]
    },

    // Navigation
    {
      id: "nav-overview",
      title: "Go to Overview",
      description: "System overview and dashboard",
      icon: <Activity className="w-4 h-4" />,
      category: "Navigation",
      action: () => onTabChange?.("overview"),
      keywords: ["overview", "dashboard", "home"]
    },
    {
      id: "nav-analytics",
      title: "Go to Analytics",
      description: "Price movements and market intelligence",
      icon: <Activity className="w-4 h-4" />,
      category: "Navigation", 
      action: () => onTabChange?.("analytics"),
      keywords: ["analytics", "prices", "charts", "data"]
    },
    {
      id: "nav-jobs",
      title: "Go to Jobs",
      description: "Pricing job monitoring",
      icon: <Clock className="w-4 h-4" />,
      category: "Navigation",
      action: () => onTabChange?.("jobs"),
      keywords: ["jobs", "sync", "tasks", "queue"]
    },
    {
      id: "nav-system",
      title: "Go to System Health",
      description: "System status and diagnostics",
      icon: <Database className="w-4 h-4" />,
      category: "Navigation",
      action: () => onTabChange?.("system"),
      keywords: ["system", "health", "status", "diagnostics"]
    },

    // Actions
    {
      id: "action-sync-pokemon-en",
      title: "Sync Pokémon EN",
      description: "Start pricing job for English Pokémon cards",
      icon: <Zap className="w-4 h-4" />,
      category: "Actions",
      action: () => onAction?.("sync-pokemon-en"),
      keywords: ["sync", "pokemon", "english", "pricing", "cards"]
    },
    {
      id: "action-sync-pokemon-jp",
      title: "Sync Pokémon JP",
      description: "Start pricing job for Japanese Pokémon cards",
      icon: <Zap className="w-4 h-4" />,
      category: "Actions",
      action: () => onAction?.("sync-pokemon-jp"),
      keywords: ["sync", "pokemon", "japanese", "pricing", "cards"]
    },
    {
      id: "action-sync-mtg", 
      title: "Sync MTG",
      description: "Start pricing job for Magic: The Gathering cards",
      icon: <Zap className="w-4 h-4" />,
      category: "Actions",
      action: () => onAction?.("sync-mtg"),
      keywords: ["sync", "magic", "mtg", "pricing", "cards"]
    },
    {
      id: "action-sync-yugioh",
      title: "Sync Yu-Gi-Oh",
      description: "Start pricing job for Yu-Gi-Oh cards",
      icon: <Zap className="w-4 h-4" />,
      category: "Actions",
      action: () => onAction?.("sync-yugioh"),
      keywords: ["sync", "yugioh", "yugi", "pricing", "cards"]
    },
    {
      id: "action-sync-sealed",
      title: "Sync Sealed Products",
      description: "Start pricing job for all sealed products",
      icon: <Database className="w-4 h-4" />,
      category: "Actions",
      action: () => onAction?.("sync-sealed"),
      keywords: ["sync", "sealed", "products", "booster", "boxes"]
    },
    {
      id: "action-health-check",
      title: "Run Health Check",
      description: "Check system health and status",
      icon: <Database className="w-4 h-4" />,
      category: "Actions", 
      action: () => onAction?.("health-check"),
      keywords: ["health", "check", "status", "diagnostics"]
    },
    {
      id: "action-test-pricing",
      title: "Test Pricing Job",
      description: "Run a small test batch",
      icon: <Settings className="w-4 h-4" />,
      category: "Actions",
      action: () => onAction?.("test-pricing"),
      keywords: ["test", "pricing", "batch", "sample"]
    }
  ];

  // Filter commands based on query
  const filteredCommands = commands.filter(command => {
    if (!query) return true;
    
    const searchString = query.toLowerCase();
    return (
      command.title.toLowerCase().includes(searchString) ||
      command.description?.toLowerCase().includes(searchString) ||
      command.keywords?.some(keyword => keyword.includes(searchString))
    );
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = [];
    }
    acc[command.category].push(command);
    return acc;
  }, {} as Record<string, Command[]>);

  const handleExecute = (command: Command) => {
    // Add to recent searches if it was a search
    if (query && !recentSearches.includes(query)) {
      setRecentSearches(prev => [query, ...prev.slice(0, 4)]);
    }

    command.action();
    onClose();
    setQuery("");
    setSelectedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalCommands = filteredCommands.length;
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % totalCommands);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalCommands) % totalCommands);
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      handleExecute(filteredCommands[selectedIndex]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Global keyboard shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'S' && !open) {
        e.preventDefault();
        const syncAllCommand = commands.find(cmd => cmd.id === 'action-sync-all');
        if (syncAllCommand) {
          syncAllCommand.action();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, onAction]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <div className="border-b">
          <div className="flex items-center px-4 py-3">
            <Search className="w-4 h-4 text-muted-foreground mr-3" />
            <input
              type="text"
              placeholder="Search commands, navigate, or perform actions..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-0 outline-0 text-sm placeholder:text-muted-foreground"
              autoFocus
            />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↑↓</kbd>
              <span>navigate</span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">↵</kbd>
              <span>select</span>
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {!query && recentSearches.length > 0 && (
            <div className="px-4 py-3 border-b">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">Recent searches</h3>
              <div className="flex flex-wrap gap-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    onClick={() => setQuery(search)}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-muted hover:bg-accent rounded"
                  >
                    <Clock className="w-3 h-3" />
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {Object.keys(groupedCommands).length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No commands found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for "sync", "health", or navigation terms
              </p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands], categoryIndex) => (
              <div key={category}>
                {categoryIndex > 0 && <div className="border-t" />}
                <div className="px-4 py-2">
                  <h3 className="text-xs font-medium text-muted-foreground mb-1">
                    {category}
                  </h3>
                </div>
                {commands.map((command, commandIndex) => {
                  const globalIndex = Object.entries(groupedCommands)
                    .slice(0, categoryIndex)
                    .reduce((acc, [, cmds]) => acc + cmds.length, 0) + commandIndex;
                  
                  return (
                    <button
                      key={command.id}
                      onClick={() => handleExecute(command)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors",
                        globalIndex === selectedIndex && "bg-accent"
                      )}
                    >
                      <div className="flex-shrink-0">
                        {command.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{command.title}</p>
                        {command.description && (
                          <p className="text-xs text-muted-foreground">{command.description}</p>
                        )}
                      </div>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="border-t px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Click Quick Actions button or</span>
              <span>Ctrl+K / Cmd+K</span>
            </div>
            <div className="flex items-center gap-4">
              <span>{filteredCommands.length} commands</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}