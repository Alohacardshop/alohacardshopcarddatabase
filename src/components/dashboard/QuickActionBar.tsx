import { Zap, Database, Settings, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface QuickActionBarProps {
  onSyncAll?: () => void;
  onSyncMTG?: () => void;
  onSyncPokemonEN?: () => void;
  onSyncPokemonJP?: () => void;
  onSyncYugioh?: () => void;
  onSyncSealed?: () => void;
  onTestBatch?: () => void;
}

export function QuickActionBar({
  onSyncAll,
  onSyncMTG,
  onSyncPokemonEN,
  onSyncPokemonJP,
  onSyncYugioh,
  onSyncSealed,
  onTestBatch
}: QuickActionBarProps) {
  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-primary/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="w-5 h-5 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Action */}
        <div className="text-center">
          <Button
            size="lg"
            onClick={onSyncAll}
            className="h-12 px-8 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Zap className="w-5 h-5 mr-2" />
            🔄 Sync All Products
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Sync all games and sealed products (~15-20 minutes)
          </p>
        </div>

        <Separator />

        {/* Individual Game Syncs */}
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Individual Game Syncs</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncMTG}
              className="flex-1 min-w-0"
            >
              <Database className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">MTG</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncPokemonEN}
              className="flex-1 min-w-0"
            >
              <Database className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Pokémon EN</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncPokemonJP}
              className="flex-1 min-w-0"
            >
              <Database className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Pokémon JP</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncYugioh}
              className="flex-1 min-w-0"
            >
              <Database className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Yu-Gi-Oh</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncSealed}
              className="flex-1 min-w-0"
            >
              <Database className="w-3 h-3 mr-1 flex-shrink-0" />
              <span className="truncate">Sealed</span>
            </Button>
          </div>
        </div>

        <Separator />

        {/* Test Actions */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Testing & Diagnostics</p>
            <p className="text-xs text-muted-foreground">Quick tests and system checks</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onTestBatch}
            className="text-muted-foreground hover:text-foreground"
          >
            <Play className="w-3 h-3 mr-1" />
            Test 10 Cards
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}