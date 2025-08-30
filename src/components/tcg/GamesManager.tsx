import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { JustTCGApi } from '@/lib/justtcg-api';
import { Loader2, RefreshCw, Database, Calendar, Check } from 'lucide-react';
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
  justtcg_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function GamesManager() {
  const { toast } = useToast();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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

  const syncGames = async () => {
    setSyncing(true);
    try {
      const data = await JustTCGApi.discoverGames();

      toast({
        title: 'Success',
        description: `Games sync started. Job ID: ${data.job_id}`,
      });

      // Refresh games list after a short delay
      setTimeout(fetchGames, 2000);
    } catch (error) {
      const message = (error as any)?.message || 'Failed to start games sync';
      toast({
        title: 'Sync failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
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
                <Database className="h-5 w-5" />
                Games Management
              </CardTitle>
              <CardDescription>
                Manage TCG games and sync from JustTCG API
              </CardDescription>
            </div>
            <Button 
              onClick={syncGames} 
              disabled={syncing}
              className="flex items-center gap-2"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync All Games
            </Button>
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
                Start by syncing games from the JustTCG API
              </p>
              <Button onClick={syncGames} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Games Now
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>JustTCG ID</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {games.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell className="font-medium">
                      {game.name}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {game.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={game.is_active ? "default" : "secondary"}
                        className="flex items-center gap-1 w-fit"
                      >
                        {game.is_active && <Check className="h-3 w-3" />}
                        {game.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {game.justtcg_id || 'N/A'}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(game.updated_at).toLocaleDateString()}
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
      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {games.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Games
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {games.filter(g => g.is_active).length}
              </div>
              <div className="text-sm text-muted-foreground">
                Active Games
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">
                {games.filter(g => g.justtcg_id).length}
              </div>
              <div className="text-sm text-muted-foreground">
                Synced Games
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}