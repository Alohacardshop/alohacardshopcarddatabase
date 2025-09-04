import { useState } from "react";
import { Search, RefreshCw, Bell, Heart, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onInstantPriceCheck?: () => void;
  onForceRefresh?: () => void;
  onViewAlerts?: () => void;
  onHealthCheck?: () => void;
  className?: string;
}

export function FloatingActionButton({
  onInstantPriceCheck,
  onForceRefresh,
  onViewAlerts,
  onHealthCheck,
  className
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      icon: Search,
      label: "Instant Price Check",
      onClick: onInstantPriceCheck,
      shortcut: "/",
      color: "bg-info hover:bg-info/90"
    },
    {
      icon: RefreshCw,
      label: "Force Refresh All",
      onClick: onForceRefresh,
      shortcut: "R",
      color: "bg-warning hover:bg-warning/90"
    },
    {
      icon: Bell,
      label: "View Alerts",
      onClick: onViewAlerts,
      shortcut: "A",
      color: "bg-danger hover:bg-danger/90"
    },
    {
      icon: Heart,
      label: "System Health Check",
      onClick: onHealthCheck,
      shortcut: "H",
      color: "bg-success hover:bg-success/90"
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
          "flex flex-col gap-3 mb-4 transition-all duration-300",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}>
          {actions.map((action, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  className={cn(
                    "w-12 h-12 rounded-full shadow-lg transition-all duration-200 animate-slide-up",
                    action.color,
                    "hover:scale-110"
                  )}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: 'both'
                  }}
                  onClick={() => {
                    action.onClick?.();
                    setIsOpen(false);
                  }}
                >
                  <action.icon className="w-5 h-5 text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="flex items-center gap-2">
                <span>{action.label}</span>
                <kbd className="px-2 py-1 text-xs bg-muted rounded">{action.shortcut}</kbd>
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
                <Plus className="w-6 h-6" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Quick Actions
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}