import { Zap, Database, Settings, Play, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface SyncState {
  isLoading: boolean;
  loadingAction: string | null;
}

interface QuickActionBarProps {
  onSyncAll?: () => void;
  onSyncMTG?: () => void;
  onSyncPokemonEN?: () => void;
  onSyncPokemonJP?: () => void;
  onSyncYugioh?: () => void;
  onSyncSealed?: () => void;
  onTestBatch?: () => void;
  syncState?: SyncState;
}

export function QuickActionBar({
  onSyncAll,
  onSyncMTG,
  onSyncPokemonEN,
  onSyncPokemonJP,
  onSyncYugioh,
  onSyncSealed,
  onTestBatch,
  syncState
}: QuickActionBarProps) {
  const isLoading = syncState?.isLoading || false;
  const loadingAction = syncState?.loadingAction;

  const getButtonContent = (action: string, icon: React.ReactNode, text: string) => {
    const isThisButtonLoading = isLoading && loadingAction === action;
    return (
      <>
        {isThisButtonLoading ? (
          <Loader2 className="w-3 h-3 mr-1 flex-shrink-0 animate-spin" />
        ) : (
          icon
        )}
        <span className="truncate">{text}</span>
      </>
    );
  };
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
            disabled={isLoading}
            className="h-12 px-8 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
          >
            {loadingAction === 'sync-all' ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Zap className="w-5 h-5 mr-2" />
            )}
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
              disabled={isLoading}
              className="flex-1 min-w-0"
            >
              {getButtonContent('sync-mtg', <Database className="w-3 h-3 mr-1 flex-shrink-0" />, 'MTG')}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncPokemonEN}
              disabled={isLoading}
              className="flex-1 min-w-0"
            >
              {getButtonContent('sync-pokemon', <Database className="w-3 h-3 mr-1 flex-shrink-0" />, 'Pokémon EN')}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncPokemonJP}
              disabled={isLoading}
              className="flex-1 min-w-0"
            >
              {getButtonContent('sync-pokemon-japan', <Database className="w-3 h-3 mr-1 flex-shrink-0" />, 'Pokémon JP')}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncYugioh}
              disabled={isLoading}
              className="flex-1 min-w-0"
            >
              {getButtonContent('sync-yugioh', <Database className="w-3 h-3 mr-1 flex-shrink-0" />, 'Yu-Gi-Oh')}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncSealed}
              disabled={isLoading}
              className="flex-1 min-w-0"
            >
              {getButtonContent('sync-sealed', <Database className="w-3 h-3 mr-1 flex-shrink-0" />, 'Sealed')}
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
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground"
          >
            {loadingAction === 'test-batch' ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : (
              <Play className="w-3 h-3 mr-1" />
            )}
            Test 10 Cards
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}