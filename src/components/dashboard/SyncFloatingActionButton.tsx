import { useState } from "react";
import { Zap, Database, RefreshCw, Play, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SyncFloatingActionButtonProps {
  onSyncAll?: () => void;
  onSyncMTG?: () => void;
  onSyncPokemonEN?: () => void;
  onSyncPokemonJP?: () => void;
  onSyncYugioh?: () => void;
  onSyncSealed?: () => void;
  onTestBatch?: () => void;
  className?: string;
}

export function SyncFloatingActionButton({
  onSyncAll,
  onSyncMTG,
  onSyncPokemonEN,
  onSyncPokemonJP,
  onSyncYugioh,
  onSyncSealed,
  onTestBatch,
  className
}: SyncFloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      icon: Zap,
      label: "Sync All Products",
      onClick: onSyncAll,
      color: "bg-primary hover:bg-primary/90",
      priority: true
    },
    {
      icon: Database,
      label: "Sync MTG",
      onClick: onSyncMTG,
      color: "bg-blue-500 hover:bg-blue-600"
    },
    {
      icon: Database,
      label: "Sync Pokémon EN",
      onClick: onSyncPokemonEN,
      color: "bg-yellow-500 hover:bg-yellow-600"
    },
    {
      icon: Database,
      label: "Sync Pokémon JP",
      onClick: onSyncPokemonJP,
      color: "bg-red-500 hover:bg-red-600"
    },
    {
      icon: Database,
      label: "Sync Yu-Gi-Oh",
      onClick: onSyncYugioh,
      color: "bg-purple-500 hover:bg-purple-600"
    },
    {
      icon: Database,
      label: "Sync Sealed Products",
      onClick: onSyncSealed,
      color: "bg-green-500 hover:bg-green-600"
    },
    {
      icon: Play,
      label: "Test 10 Cards",
      onClick: onTestBatch,
      color: "bg-gray-500 hover:bg-gray-600"
    }
  ];

  const toggleFAB = () => {
    setIsOpen(!isOpen);
  };

  return (
    <TooltipProvider>
      <div className={cn("fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8", className)}>
        {/* Action buttons */}
        <div className={cn(
          "flex flex-col gap-2 mb-4 transition-all duration-300",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}>
          {actions.map((action, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className={cn(
                    "w-11 h-11 rounded-full shadow-lg transition-all duration-200 animate-slide-up",
                    action.color,
                    action.priority && "w-12 h-12",
                    "hover:scale-110"
                  )}
                  style={{ 
                    animationDelay: `${index * 30}ms`,
                    animationFillMode: 'both'
                  }}
                  onClick={() => {
                    action.onClick?.();
                    setIsOpen(false);
                  }}
                >
                  <action.icon className={cn(
                    "text-white",
                    action.priority ? "w-5 h-5" : "w-4 h-4"
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>{action.label}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Main FAB button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className={cn(
                "w-14 h-14 rounded-full shadow-glow transition-all duration-300",
                "bg-primary hover:bg-primary/90 hover:scale-110",
                isOpen && "rotate-45"
              )}
              onClick={toggleFAB}
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Zap className="w-6 h-6" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <div className="text-center">
              <div className="font-medium">Quick Sync</div>
              <div className="text-xs opacity-75">Click for sync options</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}