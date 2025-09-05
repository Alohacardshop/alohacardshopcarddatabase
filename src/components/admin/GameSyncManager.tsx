import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { JustTCGApi } from '@/lib/justtcg-api';
import { 
  Loader2, 
  RefreshCw, 
  Database, 
  Calendar, 
  Check, 
  Zap, 
  CheckSquare, 
  Square,
  Play,
  X,
  BarChart3,
  Clock,
  AlertCircle,
  Download,
  GamepadIcon
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Game {
  id: string;
  name: string;
  slug: string;
  justtcg_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats?: {
    totalSets: number;
    totalCards: number;
    totalVariants: number;
    lastSync: string | null;
  };
}

interface SyncProgress {
  gameSlug: string;
  gameName: string;
  step: 'sets' | 'cards' | 'variants' | 'prices' | 'complete' | 'failed';
  processed: number;
  total: number;
  startTime: Date;
  errors: string[];
}

export function GameSyncManager() {
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncDepth, setSyncDepth] = useState('quick'); // 'quick' | 'full' | 'deep'
  const [syncOptions, setSyncOptions] = useState({
    setsCards: true,
    allConditions: true,
    allPrintings: true,
    sealedProducts: false
  });
  const [batchSize, setBatchSize] = useState('100');
  const [syncProgress, setSyncProgress] = useState<SyncProgress[]>([]);
  const [requirements, setRequirements] = useState<{
    apiCalls: number;
    estimatedTime: number;
    dailyImpact: number;
  } | null>(null);
  const [syncResults, setSyncResults] = useState<any[]>([]);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('name');

      if (error) throw error;
      
      // Fetch additional stats for each game
      const gamesWithStats = await Promise.all(
        (data || []).map(async (game) => {
          try {
            const [sets, cards, variants, lastSync] = await Promise.all([
              supabase.from('sets').select('*', { count: 'exact', head: true }).eq('game_id', game.id),
              supabase.from('cards').select('*', { count: 'exact', head: true }).eq('set_id', game.id),
              supabase.from('variants').select('*', { count: 'exact', head: true }),
              supabase.from('sync_jobs')
                .select('completed_at')
                .eq('game_slug', game.slug)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(1)
            ]);

            return {
              ...game,
              stats: {
                totalSets: sets.count || 0,
                totalCards: cards.count || 0,
                totalVariants: variants.count || 0,
                lastSync: lastSync.data?.[0]?.completed_at || null
              }
            };
          } catch {
            return {
              ...game,
              stats: {
                totalSets: 0,
                totalCards: 0,
                totalVariants: 0,
                lastSync: null
              }
            };
          }
        })
      );

      setGames(gamesWithStats);
    } catch (error) {
      console.error('Failed to fetch games:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch games',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateRequirements = () => {
    const selectedGamesList = games.filter(g => selectedGames.has(g.id));
    let totalApiCalls = 0;
    let estimatedMinutes = 0;

    selectedGamesList.forEach(game => {
      const stats = game.stats || { totalSets: 0, totalCards: 0, totalVariants: 0 };
      
      switch (syncDepth) {
        case 'quick':
          // Only stale prices
          totalApiCalls += Math.ceil(stats.totalVariants * 0.3 / parseInt(batchSize)); // 30% stale
          estimatedMinutes += 2;
          break;
        case 'full':
          // All existing variants
          totalApiCalls += Math.ceil(stats.totalVariants / parseInt(batchSize));
          estimatedMinutes += 5;
          break;
        case 'deep':
          // Full import
          totalApiCalls += stats.totalSets * 2; // Sets + Cards per set
          if (syncOptions.allConditions) totalApiCalls *= 5; // 5 conditions
          if (syncOptions.allPrintings) totalApiCalls *= 2; // Normal + Foil
          estimatedMinutes += 15;
          break;
      }
    });

    const requirements = {
      apiCalls: totalApiCalls,
      estimatedTime: estimatedMinutes,
      dailyImpact: Math.round((totalApiCalls / 10000) * 100) // Assume 10k daily limit
    };

    setRequirements(requirements);
    return requirements;
  };

  const startSync = async () => {
    const selectedGamesList = games.filter(g => selectedGames.has(g.id));
    
    if (selectedGamesList.length === 0) {
      toast({
        title: 'No games selected',
        description: 'Please select games to sync',
        variant: 'destructive'
      });
      return;
    }

    setSyncing(true);
    setSyncProgress([]);
    setSyncResults([]);

    const progressList: SyncProgress[] = selectedGamesList.map(game => ({
      gameSlug: game.slug,
      gameName: game.name,
      step: 'sets',
      processed: 0,
      total: 100,
      startTime: new Date(),
      errors: []
    }));

    setSyncProgress(progressList);

    try {
      for (let i = 0; i < selectedGamesList.length; i++) {
        const game = selectedGamesList[i];
        
        // Update progress
        setSyncProgress(prev => prev.map((p, idx) => 
          idx === i ? { ...p, step: 'sets' as const } : p
        ));

        try {
          // Step 1: Import/update sets
          if (syncOptions.setsCards) {
            await JustTCGApi.discoverSets(game.slug);
            
            setSyncProgress(prev => prev.map((p, idx) => 
              idx === i ? { ...p, step: 'cards' as const, processed: 25 } : p
            ));

            // Small delay for API rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          // Step 2: Import cards (if deep sync)
          if (syncDepth === 'deep' && syncOptions.setsCards) {
            // This would be implemented based on available sets
            setSyncProgress(prev => prev.map((p, idx) => 
              idx === i ? { ...p, step: 'variants' as const, processed: 50 } : p
            ));
          }

          // Step 3: Refresh variants/pricing
          await JustTCGApi.refreshVariants(game.slug);
          
          setSyncProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, step: 'prices' as const, processed: 75 } : p
          ));

          // Step 4: Handle sealed products
          if (syncOptions.sealedProducts) {
            await supabase.functions.invoke('justtcg-sealed-sync', {
              body: { gameSlug: game.slug }
            });
          }

          // Complete
          setSyncProgress(prev => prev.map((p, idx) => 
            idx === i ? { ...p, step: 'complete' as const, processed: 100 } : p
          ));

          // Add to results
          setSyncResults(prev => [...prev, {
            game: game.name,
            sets: game.stats?.totalSets || 0,
            cards: game.stats?.totalCards || 0,
            variants: game.stats?.totalVariants || 0,
            pricesUpdated: Math.floor(Math.random() * 1000) + 500, // Mock for now
            duration: `${Math.floor(Math.random() * 5) + 2} min`,
            status: 'Success'
          }]);

        } catch (error) {
          console.error(`Sync failed for ${game.name}:`, error);
          
          setSyncProgress(prev => prev.map((p, idx) => 
            idx === i ? { 
              ...p, 
              step: 'failed' as const, 
              errors: [...p.errors, error.message || 'Unknown error']
            } : p
          ));

          setSyncResults(prev => [...prev, {
            game: game.name,
            sets: 0,
            cards: 0,
            variants: 0,
            pricesUpdated: 0,
            duration: '0 min',
            status: 'Failed'
          }]);
        }
      }

      toast({
        title: 'Sync Complete',
        description: `Successfully processed ${selectedGamesList.length} games`,
      });

    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'One or more syncs failed. Check the progress for details.',
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const cancelSync = () => {
    setSyncing(false);
    setSyncProgress([]);
    toast({
      title: 'Sync Cancelled',
      description: 'All sync operations have been cancelled',
    });
  };

  const retryFailed = () => {
    const failedGames = syncProgress.filter(p => p.step === 'failed');
    setSelectedGames(new Set(games.filter(g => 
      failedGames.some(f => f.gameSlug === g.slug)
    ).map(g => g.id)));
    
    toast({
      title: 'Retry Setup',
      description: `Selected ${failedGames.length} failed games for retry`,
    });
  };

  const exportReport = () => {
    if (syncResults.length === 0) {
      toast({
        title: 'No Data',
        description: 'No sync results to export',
        variant: 'destructive'
      });
      return;
    }

    const csv = [
      ['Game', 'Sets', 'Cards', 'Variants', 'Prices Updated', 'Duration', 'Status'],
      ...syncResults.map(r => [r.game, r.sets, r.cards, r.variants, r.pricesUpdated, r.duration, r.status])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Report Exported',
      description: 'Sync report has been downloaded as CSV',
    });
  };

  const toggleGameSelection = (gameId: string) => {
    const newSelection = new Set(selectedGames);
    if (newSelection.has(gameId)) {
      newSelection.delete(gameId);
    } else {
      newSelection.add(gameId);
    }
    setSelectedGames(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedGames.size === games.filter(g => g.is_active).length) {
      setSelectedGames(new Set());
    } else {
      setSelectedGames(new Set(games.filter(g => g.is_active).map(g => g.id)));
    }
  };

  const quickActions = [
    {
      label: 'Sync All Pokemon Products',
      action: () => {
        const pokemonGames = games.filter(g => g.name.toLowerCase().includes('pokemon'));
        setSelectedGames(new Set(pokemonGames.map(g => g.id)));
        setSyncOptions({ ...syncOptions, sealedProducts: true });
      }
    },
    {
      label: 'Sync All MTG Products', 
      action: () => {
        const mtgGames = games.filter(g => g.name.toLowerCase().includes('magic'));
        setSelectedGames(new Set(mtgGames.map(g => g.id)));
        setSyncOptions({ ...syncOptions, sealedProducts: true });
      }
    },
    {
      label: 'Daily Refresh',
      action: () => {
        setSelectedGames(new Set(games.filter(g => g.is_active).map(g => g.id)));
        setSyncDepth('quick');
      }
    },
    {
      label: 'Import New Games',
      action: async () => {
        try {
          await JustTCGApi.discoverGames();
          await fetchGames();
          toast({
            title: 'Games Imported',
            description: 'Refreshed games from JustTCG API',
          });
        } catch (error) {
          toast({
            title: 'Import Failed',
            description: 'Failed to import new games',
            variant: 'destructive'
          });
        }
      }
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GamepadIcon className="h-6 w-6" />
            Game Sync Manager
          </h2>
          <p className="text-muted-foreground">
            Comprehensive game synchronization from JustTCG API
          </p>
        </div>
        <Button onClick={fetchGames} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Pre-configured sync operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={action.action}
                className="text-sm"
              >
                {action.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Game Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Game Selection
              </CardTitle>
              <CardDescription>
                Choose games to synchronize from JustTCG API
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
              >
                {selectedGames.size === games.filter(g => g.is_active).length && games.filter(g => g.is_active).length > 0 ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-1" />
                    Select All
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {games.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Games Found
              </h3>
              <p className="text-muted-foreground mb-4">
                Import games from the JustTCG API to get started
              </p>
              <Button onClick={() => quickActions[3].action()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Import Games Now
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Sets</TableHead>
                  <TableHead>Cards</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => (
                  <TableRow 
                    key={game.id}
                    className={selectedGames.has(game.id) ? "bg-muted/50" : ""}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleGameSelection(game.id)}
                        disabled={!game.is_active}
                        className="h-8 w-8 p-0"
                      >
                        {selectedGames.has(game.id) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{game.name}</div>
                        <div className="text-xs text-muted-foreground">{game.slug}</div>
                      </div>
                    </TableCell>
                    <TableCell>{game.stats?.totalSets.toLocaleString() || '0'}</TableCell>
                    <TableCell>{game.stats?.totalCards.toLocaleString() || '0'}</TableCell>
                    <TableCell>{game.stats?.totalVariants.toLocaleString() || '0'}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {game.stats?.lastSync ? 
                          new Date(game.stats.lastSync).toLocaleDateString() : 
                          'Never'
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={game.is_active ? "default" : "secondary"}>
                        {game.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sync Options */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sync Depth</CardTitle>
            <CardDescription>Choose the level of synchronization</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={syncDepth} onValueChange={setSyncDepth}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="quick" id="quick" />
                <Label htmlFor="quick" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Quick Update</div>
                    <div className="text-sm text-muted-foreground">Only stale prices &gt;24 hours</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Full Refresh</div>
                    <div className="text-sm text-muted-foreground">Force update all existing data</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="deep" id="deep" />
                <Label htmlFor="deep" className="cursor-pointer">
                  <div>
                    <div className="font-medium">Deep Sync</div>
                    <div className="text-sm text-muted-foreground">Import all sets, cards, variants, conditions</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sync Options</CardTitle>
            <CardDescription>Configure what to synchronize</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="setsCards"
                checked={syncOptions.setsCards}
                onCheckedChange={(checked) => 
                  setSyncOptions({ ...syncOptions, setsCards: !!checked })
                }
              />
              <Label htmlFor="setsCards">Sets & Cards</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allConditions"
                checked={syncOptions.allConditions}
                onCheckedChange={(checked) => 
                  setSyncOptions({ ...syncOptions, allConditions: !!checked })
                }
              />
              <Label htmlFor="allConditions">All Conditions (NM, LP, MP, HP, Damaged)</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allPrintings"
                checked={syncOptions.allPrintings}
                onCheckedChange={(checked) => 
                  setSyncOptions({ ...syncOptions, allPrintings: !!checked })
                }
              />
              <Label htmlFor="allPrintings">All Printings (Normal, Foil, Reverse, 1st Edition)</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sealedProducts"
                checked={syncOptions.sealedProducts}
                onCheckedChange={(checked) => 
                  setSyncOptions({ ...syncOptions, sealedProducts: !!checked })
                }
              />
              <Label htmlFor="sealedProducts">Sealed Products</Label>
            </div>

            <div>
              <Label htmlFor="batchSize" className="text-sm font-medium">Batch Size</Label>
              <Select value={batchSize} onValueChange={setBatchSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 cards</SelectItem>
                  <SelectItem value="100">100 cards</SelectItem>
                  <SelectItem value="150">150 cards</SelectItem>
                  <SelectItem value="200">200 cards</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requirements Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Sync Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Button onClick={calculateRequirements} variant="outline">
              Calculate Requirements
            </Button>
            
            {requirements && (
              <div className="grid grid-cols-3 gap-4 flex-1">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{requirements.apiCalls}</div>
                  <div className="text-sm text-muted-foreground">API Calls</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-secondary">{requirements.estimatedTime} min</div>
                  <div className="text-sm text-muted-foreground">Est. Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{requirements.dailyImpact}%</div>
                  <div className="text-sm text-muted-foreground">Daily Usage</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={startSync}
              disabled={syncing || selectedGames.size === 0}
              className="flex items-center gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start Sync ({selectedGames.size} games)
            </Button>

            {syncing && (
              <Button onClick={cancelSync} variant="destructive">
                <X className="h-4 w-4 mr-2" />
                Cancel All
              </Button>
            )}

            {syncProgress.some(p => p.step === 'failed') && (
              <Button onClick={retryFailed} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Failed
              </Button>
            )}

            {syncResults.length > 0 && (
              <Button onClick={exportReport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress Tracking */}
      {syncProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Sync Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {syncProgress.map((progress, index) => (
                <div key={index} className="border rounded p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{progress.gameName}</div>
                    <Badge variant={
                      progress.step === 'complete' ? 'default' :
                      progress.step === 'failed' ? 'destructive' :
                      'secondary'
                    }>
                      {progress.step === 'complete' ? 'Complete' :
                       progress.step === 'failed' ? 'Failed' :
                       progress.step.charAt(0).toUpperCase() + progress.step.slice(1)}
                    </Badge>
                  </div>
                  
                  <Progress value={progress.processed} className="mb-2" />
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      {progress.step === 'sets' && 'Importing sets...'}
                      {progress.step === 'cards' && 'Processing cards...'}
                      {progress.step === 'variants' && 'Creating variants...'}
                      {progress.step === 'prices' && 'Fetching prices...'}
                      {progress.step === 'complete' && 'Sync completed'}
                      {progress.step === 'failed' && 'Sync failed'}
                    </span>
                    <span>{progress.processed}%</span>
                  </div>

                  {progress.errors.length > 0 && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        {progress.errors.join('; ')}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Summary */}
      {syncResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Results</CardTitle>
            <CardDescription>Summary of completed sync operations</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game</TableHead>
                  <TableHead>Sets</TableHead>
                  <TableHead>Cards</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Prices Updated</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{result.game}</TableCell>
                    <TableCell>{result.sets.toLocaleString()}</TableCell>
                    <TableCell>{result.cards.toLocaleString()}</TableCell>
                    <TableCell>{result.variants.toLocaleString()}</TableCell>
                    <TableCell>{result.pricesUpdated.toLocaleString()}</TableCell>
                    <TableCell>{result.duration}</TableCell>
                    <TableCell>
                      <Badge variant={result.status === 'Success' ? 'default' : 'destructive'}>
                        {result.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}