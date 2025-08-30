import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { JustTCGApi } from '@/lib/justtcg-api';
import { Loader2, RefreshCw, Database, Calendar, Package, Zap } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingCards, setSyncingCards] = useState<string | null>(null);

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
                  <TableHead>Set Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Release Date</TableHead>
                  <TableHead>Cards</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sets.map((set) => (
                  <TableRow key={set.id}>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncCards(set.code)}
                        disabled={syncingCards === set.code}
                        className="flex items-center gap-1"
                      >
                        {syncingCards === set.code ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        Sync Cards
                      </Button>
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