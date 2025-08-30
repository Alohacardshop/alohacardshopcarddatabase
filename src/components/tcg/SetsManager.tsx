import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { JustTCGApi } from '@/lib/justtcg-api';
import { Loader2, RefreshCw, Database, Calendar, Package, Zap, Play, Filter, DollarSign, CheckSquare, Square } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Game {
  id: string;
  name: string;
  slug: string;
}

interface SetItem {
  id: string;
  name: string;
  code: string;
  release_date: string;
  card_count: number;
  sync_status: string;
  last_synced_at: string;
  games: { name: string };
}

export function SetsManager() {
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [sets, setSets] = useState<SetItem[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingCards, setSyncingCards] = useState<string | null>(null);
  const [refreshingPrices, setRefreshingPrices] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0, failed: 0 });
  const [syncingSetCodes, setSyncingSetCodes] = useState<Set<string>>(new Set());
  const [setupPhase, setSetupPhase] = useState<string>('');
  const [setupProgress, setSetupProgress] = useState({ phase: '', completed: 0, total: 0, iteration: 0 });

  useEffect(() => {
    fetchGames();
  }, []);

  useEffect(() => {
    if (selectedGame) {
      fetchSets(selectedGame);
    } else {
      setSets([]);
    }
  }, [selectedGame]);

  const fetchGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGames(data || []);
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

  const fetchSets = async (gameSlug: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sets')
        .select(`
          *,
          games!inner(name)
        `)
        .eq('games.slug', gameSlug)
        .order('release_date', { ascending: false });

      if (error) throw error;
      setSets(data || []);
    } catch (error) {
      console.error('Failed to fetch sets:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch sets',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const syncSets = async () => {
    if (!selectedGame) return;
    
    setSyncing(true);
    try {
      const data = await JustTCGApi.discoverSets(selectedGame);

      toast({
        title: 'Success',
        description: `Sets sync started for ${selectedGame}. Job ID: ${data.job_id}`,
      });

      // Refresh sets list after a short delay
      setTimeout(() => fetchSets(selectedGame), 2000);
    } catch (error) {
      const message = (error as any)?.message || 'Failed to start sets sync';
      toast({
        title: 'Sync failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  const syncCards = async (setCode: string) => {
    if (!selectedGame) return;
    
    setSyncingCards(setCode);
    try {
      const data = await JustTCGApi.importCards(selectedGame, setCode);

      toast({
        title: 'Success',
        description: data.message || `Cards sync started for ${setCode}. Job ID: ${data.job_id}`,
      });

      // Refresh sets list after a short delay
      setTimeout(() => fetchSets(selectedGame), 2000);
    } catch (error) {
      const message = (error as any)?.message || 'Failed to start cards sync';
      toast({
        title: 'Import failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setSyncingCards(null);
    }
  };

  const refreshPrices = async (setCode: string) => {
    if (!selectedGame) return;
    
    setRefreshingPrices(setCode);
    try {
      const data = await JustTCGApi.refreshVariants(selectedGame, setCode);

      toast({
        title: 'Success',
        description: `Price refresh started for ${setCode}. Job ID: ${data.job_id}`,
      });

      // Refresh sets after starting the refresh
      setTimeout(() => fetchSets(selectedGame), 2000);
    } catch (error) {
      const message = (error as any)?.message || 'Failed to start price refresh';
      toast({
        title: 'Refresh failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setRefreshingPrices(null);
    }
  };

  // Filter sets based on status filter
  const filteredSets = sets.filter(set => {
    switch (statusFilter) {
      case 'not_failed':
        return set.sync_status !== 'failed';
      case 'pending':
        return set.sync_status === 'pending' || !set.sync_status;
      case 'syncing':
        return set.sync_status === 'syncing';
      case 'completed':
        return set.sync_status === 'completed';
      case 'failed':
        return set.sync_status === 'failed';
      default:
        return true; // 'all'
    }
  });

  const syncAllCards = async () => {
    if (!selectedGame || bulkSyncing) return;
    
    // Use selected sets if any, otherwise use filtered sets
    const targetSets = selectedSets.size > 0 
      ? filteredSets.filter(set => selectedSets.has(set.id))
      : filteredSets.filter(set => set.sync_status !== 'syncing' && set.sync_status !== 'completed');
    
    if (targetSets.length === 0) {
      toast({
        title: 'No sets to sync',
        description: selectedSets.size > 0 ? 'No valid sets selected' : 'All sets are already synced or currently syncing',
      });
      return;
    }

    setBulkSyncing(true);
    setBulkProgress({ completed: 0, total: targetSets.length, failed: 0 });
    setSyncingSetCodes(new Set(targetSets.map(s => s.code)));

    toast({
      title: 'Bulk sync started',
      description: `Starting sync for ${targetSets.length} sets...`,
    });

    // Process sets with concurrency limit of 2
    const concurrency = 2;
    const results = { completed: 0, failed: 0 };
    
    for (let i = 0; i < targetSets.length; i += concurrency) {
      const batch = targetSets.slice(i, i + concurrency);
      
      await Promise.allSettled(
        batch.map(async (set) => {
          try {
            await JustTCGApi.importCards(selectedGame, set.code);
            results.completed++;
          } catch (error) {
            console.error(`Failed to sync ${set.code}:`, error);
            results.failed++;
          } finally {
            setBulkProgress(prev => ({ 
              ...prev, 
              completed: results.completed + results.failed 
            }));
          }
        })
      );

      // Small delay between batches to be respectful to the API
      if (i + concurrency < targetSets.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final refresh and cleanup
    await fetchSets(selectedGame);
    setBulkSyncing(false);
    setSyncingSetCodes(new Set());
    setSelectedSets(new Set()); // Clear selection after bulk operation

    toast({
      title: 'Bulk sync completed',
      description: `Completed: ${results.completed}, Failed: ${results.failed}`,
      variant: results.failed > 0 ? 'destructive' : 'default'
    });
  };

  const refreshAllPrices = async (forceAll = false) => {
    if (!selectedGame || bulkRefreshing) return;
    
    // Use selected sets if any, otherwise use filtered sets with completed status (or all if forceAll)
    const targetSets = selectedSets.size > 0 
      ? filteredSets.filter(set => selectedSets.has(set.id))
      : forceAll 
        ? filteredSets 
        : filteredSets.filter(set => set.sync_status === 'completed');
    
    if (targetSets.length === 0) {
      toast({
        title: 'No sets to refresh',
        description: selectedSets.size > 0 ? 'No valid sets selected' : 'No completed sets found',
      });
      return;
    }

    setBulkRefreshing(true);
    setBulkProgress({ completed: 0, total: targetSets.length, failed: 0 });
    
    toast({
      title: 'Bulk price refresh started',
      description: `Starting price refresh for ${targetSets.length} sets...`,
    });

    // Process sets with higher concurrency since refresh is lighter
    const concurrency = 3;
    const results = { completed: 0, failed: 0 };
    
    for (let i = 0; i < targetSets.length; i += concurrency) {
      const batch = targetSets.slice(i, i + concurrency);
      
      await Promise.allSettled(
        batch.map(async (set) => {
          try {
            await JustTCGApi.refreshVariants(selectedGame, set.code);
            results.completed++;
          } catch (error) {
            console.error(`Failed to refresh prices for ${set.code}:`, error);
            results.failed++;
          } finally {
            setBulkProgress(prev => ({ 
              ...prev, 
              completed: results.completed + results.failed 
            }));
          }
        })
      );

      // Small delay between batches
      if (i + concurrency < targetSets.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Final cleanup
    setBulkRefreshing(false);
    setSelectedSets(new Set()); // Clear selection after bulk operation

    toast({
      title: 'Bulk price refresh completed',
      description: `Completed: ${results.completed}, Failed: ${results.failed}`,
      variant: results.failed > 0 ? 'destructive' : 'default'
    });
  };

  const completeGameSetup = async () => {
    if (!selectedGame || bulkSyncing || bulkRefreshing) return;
    
    const maxIterations = 5; // Safety limit to prevent infinite loops
    let iteration = 0;
    let totalImported = 0;
    let totalFailed = 0;
    
    setSetupPhase('initializing');
    setBulkSyncing(true);
    
    toast({
      title: 'Complete Game Setup Started',
      description: `Beginning comprehensive setup for ${selectedGame}...`,
    });

    // Loop until all sets have cards or max iterations reached
    while (iteration < maxIterations) {
      iteration++;
      
      // Refresh sets data to get current state
      await fetchSets(selectedGame);
      
      // Find sets with zero cards that aren't currently syncing
      const zeroCardSets = sets.filter(set => 
        set.card_count === 0 && 
        set.sync_status !== 'syncing'
      );
      
      if (zeroCardSets.length === 0) {
        // No zero-card sets remain, we're done with imports
        break;
      }
      
      setSetupPhase(`import-iteration-${iteration}`);
      setSetupProgress({
        phase: `Import Phase ${iteration}`,
        completed: 0,
        total: zeroCardSets.length,
        iteration
      });
      
      toast({
        title: `Import Phase ${iteration}`,
        description: `Found ${zeroCardSets.length} sets with zero cards. Starting import...`,
      });

      setBulkProgress({ completed: 0, total: zeroCardSets.length, failed: 0 });
      setSyncingSetCodes(new Set(zeroCardSets.map(s => s.code)));

      const concurrency = 2;
      const phaseResults = { completed: 0, failed: 0 };
      
      // Process sets in batches
      for (let i = 0; i < zeroCardSets.length; i += concurrency) {
        const batch = zeroCardSets.slice(i, i + concurrency);
        
        await Promise.allSettled(
          batch.map(async (set) => {
            try {
              await JustTCGApi.importCards(selectedGame, set.code);
              phaseResults.completed++;
              totalImported++;
            } catch (error) {
              console.error(`Failed to sync ${set.code}:`, error);
              phaseResults.failed++;
              totalFailed++;
            } finally {
              setBulkProgress(prev => ({ 
                ...prev, 
                completed: phaseResults.completed + phaseResults.failed 
              }));
              setSetupProgress(prev => ({
                ...prev,
                completed: phaseResults.completed + phaseResults.failed
              }));
            }
          })
        );

        // Small delay between batches
        if (i + concurrency < zeroCardSets.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      toast({
        title: `Phase ${iteration} Complete`,
        description: `Imported: ${phaseResults.completed}, Failed: ${phaseResults.failed}. Checking for remaining sets...`,
      });
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Clear import state
    setSyncingSetCodes(new Set());
    setBulkSyncing(false);
    
    // Get final state after all imports
    await fetchSets(selectedGame);
    const finalZeroCardSets = sets.filter(set => set.card_count === 0);
    
    if (finalZeroCardSets.length > 0) {
      toast({
        title: 'Import Phase Complete (with remaining sets)',
        description: `${finalZeroCardSets.length} sets still have zero cards after ${iteration} phases. Starting variant refresh...`,
        variant: 'default'
      });
    } else {
      toast({
        title: 'All Sets Successfully Imported!',
        description: `All sets now have cards! Starting comprehensive variant refresh...`,
      });
    }

    // Now refresh variants for ALL sets
    setSetupPhase('variant-refresh');
    setSetupProgress({
      phase: 'Variant Refresh',
      completed: 0,
      total: sets.length,
      iteration: iteration + 1
    });
    
    await refreshAllPrices(true);

    // Final completion
    setSetupPhase('');
    setSetupProgress({ phase: '', completed: 0, total: 0, iteration: 0 });
    
    const completionMessage = `Setup Complete! 
      📊 Stats: ${totalImported} sets imported, ${totalFailed} failed
      🎯 Final result: ${sets.length - finalZeroCardSets.length}/${sets.length} sets have cards
      ${finalZeroCardSets.length === 0 ? '✅ All sets successfully populated!' : `⚠️ ${finalZeroCardSets.length} sets still need manual attention`}`;
    
    toast({
      title: 'Complete Game Setup Finished!',
      description: completionMessage,
      variant: finalZeroCardSets.length === 0 ? 'default' : 'destructive'
    });
  };

  const toggleSetSelection = (setId: string) => {
    const newSelection = new Set(selectedSets);
    if (newSelection.has(setId)) {
      newSelection.delete(setId);
    } else {
      newSelection.add(setId);
    }
    setSelectedSets(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedSets.size === filteredSets.length) {
      setSelectedSets(new Set());
    } else {
      setSelectedSets(new Set(filteredSets.map(set => set.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'syncing':
        return <Badge variant="secondary">Syncing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (loading && !selectedGame) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Sets & Cards Management
              </CardTitle>
              <CardDescription>
                Manage card sets and sync cards from JustTCG API
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedGame} onValueChange={setSelectedGame}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select a game" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((game) => (
                    <SelectItem key={game.id} value={game.slug}>
                      {game.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedGame && sets.length > 0 && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="not_failed">Not Failed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="syncing">Syncing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2">
                <Button 
                  onClick={syncSets} 
                  disabled={syncing || !selectedGame}
                  className="flex items-center gap-2"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sync Sets
                </Button>
                
                {selectedGame && filteredSets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="secondary"
                          disabled={bulkSyncing || syncing}
                          className="flex items-center gap-2"
                        >
                          {bulkSyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          {selectedSets.size > 0 ? `Import Selected (${selectedSets.size})` : 'Import All Cards'}
                          {bulkSyncing && (
                            <span className="text-xs">
                              ({bulkProgress.completed}/{bulkProgress.total})
                            </span>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Import Cards</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will start card import jobs for the {selectedSets.size > 0 ? 'selected' : 'filtered'} sets. 
                            This may take several minutes to complete.
                            {(() => {
                              const targetSets = selectedSets.size > 0 
                                ? filteredSets.filter(set => selectedSets.has(set.id))
                                : filteredSets.filter(s => s.sync_status !== 'syncing' && s.sync_status !== 'completed');
                              return targetSets.length > 0 && (
                                <div className="mt-2 p-2 bg-muted rounded-sm">
                                  <strong>{targetSets.length}</strong> sets will be imported.
                                </div>
                              );
                            })()}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={syncAllCards}>
                          Start Import
                        </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline"
                          disabled={bulkRefreshing || syncing}
                          className="flex items-center gap-2"
                        >
                          {bulkRefreshing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <DollarSign className="h-4 w-4" />
                          )}
                          {selectedSets.size > 0 ? `Refresh Prices (${selectedSets.size})` : 'Refresh All Prices'}
                          {bulkRefreshing && (
                            <span className="text-xs">
                              ({bulkProgress.completed}/{bulkProgress.total})
                            </span>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Refresh Prices</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will update variant pricing for the {selectedSets.size > 0 ? 'selected' : 'completed'} sets. 
                            This is faster than a full import and only updates pricing data.
                            {(() => {
                              const targetSets = selectedSets.size > 0 
                                ? filteredSets.filter(set => selectedSets.has(set.id))
                                : filteredSets.filter(s => s.sync_status === 'completed');
                              return targetSets.length > 0 && (
                                <div className="mt-2 p-2 bg-muted rounded-sm">
                                  <strong>{targetSets.length}</strong> sets will be refreshed.
                                </div>
                              );
                            })()}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => refreshAllPrices()}>
                            Start Refresh
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="default"
                          disabled={bulkSyncing || bulkRefreshing || syncing}
                          className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-glow"
                        >
                          {(bulkSyncing || bulkRefreshing) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                          Complete Game Setup
                          {setupPhase && (
                            <span className="text-xs">
                              {setupProgress.phase}
                            </span>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Complete Game Setup</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will automatically complete the full setup for {selectedGame}:
                            <div className="mt-2 space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-primary rounded-full"></span>
                                Auto-import cards for sets with zero cards (up to 5 iterations)
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-primary rounded-full"></span>
                                Refresh variants and prices for ALL sets
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-primary rounded-full"></span>
                                Provide completion summary with statistics
                              </div>
                            </div>
                            {(() => {
                              const zeroCardSets = filteredSets.filter(set => set.card_count === 0);
                              return (
                                <div className="mt-3 p-2 bg-muted rounded-sm">
                                  <strong>{zeroCardSets.length}</strong> sets currently have zero cards,{' '}
                                  <strong>{filteredSets.length}</strong> sets will get variant refresh.
                                </div>
                              );
                            })()}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={completeGameSetup}>
                            Complete Setup
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedGame ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Select a Game
              </h3>
              <p className="text-muted-foreground">
                Choose a game from the dropdown above to view and manage its sets
              </p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : sets.length === 0 ? (
            <div className="text-center py-8">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Sets Found
              </h3>
              <p className="text-muted-foreground mb-4">
                Start by syncing sets for {games.find(g => g.slug === selectedGame)?.name}
              </p>
              <Button onClick={syncSets} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Sets Now
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleSelectAll}
                      className="h-8 w-8 p-0"
                    >
                      {selectedSets.size === filteredSets.length && filteredSets.length > 0 ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead>Set Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Release Date</TableHead>
                  <TableHead>Cards</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSets.map((set) => (
                  <TableRow 
                    key={set.id}
                    className={selectedSets.has(set.id) ? "bg-muted/50" : ""}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSetSelection(set.id)}
                        className="h-8 w-8 p-0"
                      >
                        {selectedSets.has(set.id) ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {set.name}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {set.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3" />
                        {set.release_date ? 
                          new Date(set.release_date).toLocaleDateString() : 
                          'Unknown'
                        }
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {set.card_count.toLocaleString()} cards
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(set.sync_status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncCards(set.code)}
                          disabled={
                            syncingCards === set.code || 
                            bulkSyncing || 
                            syncingSetCodes.has(set.code)
                          }
                          className="flex items-center gap-1"
                        >
                          {(syncingCards === set.code || syncingSetCodes.has(set.code)) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3" />
                          )}
                          {set.sync_status === 'completed' ? 'Re-sync' : 'Import'}
                        </Button>
                        {set.sync_status === 'completed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => refreshPrices(set.code)}
                            disabled={refreshingPrices === set.code || bulkRefreshing}
                            className="flex items-center gap-1"
                          >
                            {refreshingPrices === set.code ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <DollarSign className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      {selectedGame && sets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Set Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {sets.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Sets
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {sets.filter(s => s.sync_status === 'completed').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Synced Sets
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">
                  {sets.reduce((sum, s) => sum + s.card_count, 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Cards
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {sets.filter(s => s.sync_status === 'syncing').length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Syncing Now
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}