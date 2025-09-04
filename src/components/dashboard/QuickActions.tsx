import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Database, TestTube, Activity, Play } from "lucide-react";
import { StatusBadge } from "./StatusBadge";

interface QuickActionsProps {
  onTestBatch: () => void;
  onSyncAll: () => void;
  onSyncPokemonEN: () => void;
  onSyncPokemonJP: () => void;
  onSyncMTG: () => void;
  onSyncYugioh: () => void;
  onSyncSealed: () => void;
}

export function QuickActions({
  onTestBatch,
  onSyncAll,
  onSyncPokemonEN,
  onSyncPokemonJP,
  onSyncMTG,
  onSyncYugioh,
  onSyncSealed
}: QuickActionsProps) {
  const gameActions = [
    {
      name: "Pokémon EN",
      action: onSyncPokemonEN,
      status: "healthy" as const,
      icon: <Zap className="w-4 h-4" />
    },
    {
      name: "Pokémon JP", 
      action: onSyncPokemonJP,
      status: "healthy" as const,
      icon: <Zap className="w-4 h-4" />
    },
    {
      name: "MTG",
      action: onSyncMTG,
      status: "healthy" as const,
      icon: <Zap className="w-4 h-4" />
    },
    {
      name: "Yu-Gi-Oh",
      action: onSyncYugioh,
      status: "warning" as const,
      icon: <Zap className="w-4 h-4" />
    }
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Trigger sync operations and test functions
            </CardDescription>
          </div>
          <StatusBadge status="healthy" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button 
            onClick={onTestBatch}
            variant="outline"
            className="flex items-center gap-2 h-12"
          >
            <TestTube className="w-4 h-4" />
            Test Batch (10 cards)
          </Button>
          
          <Button 
            onClick={onSyncAll}
            className="flex items-center gap-2 h-12 bg-gradient-primary text-primary-foreground hover:bg-gradient-primary/90"
          >
            <Activity className="w-4 h-4" />
            Sync All Games
          </Button>
          
          <Button 
            onClick={onSyncSealed}
            variant="outline"
            className="flex items-center gap-2 h-12"
          >
            <Database className="w-4 h-4" />
            Sync Sealed Products
          </Button>
        </div>

        {/* Game-Specific Actions */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Individual Game Sync</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {gameActions.map((game) => (
              <Button
                key={game.name}
                onClick={game.action}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 h-10 justify-start hover:bg-accent/50"
              >
                {game.icon}
                <span className="text-xs font-medium">{game.name}</span>
                <StatusBadge status={game.status} size="sm" className="ml-auto" />
              </Button>
            ))}
          </div>
        </div>

        {/* Status Info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>All systems operational</span>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="text-xs">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1" />
              API Ready
            </Badge>
            <Badge variant="secondary" className="text-xs">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-1" />
              Queue: 0
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}