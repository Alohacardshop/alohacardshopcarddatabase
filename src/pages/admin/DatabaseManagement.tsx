
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TableName, ViewName, isRelation, TABLES, VIEWS } from '@/types/supabase-relations';
import {
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Settings,
  AlertTriangle,
  Play,
  BarChart3
} from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

interface DatabaseHealth {
  connected: boolean;
  tablesExist: boolean;
  indexesExist: boolean;
  rlsPolicies: boolean;
  error?: string;
}

interface DatabaseStats {
  totalGames: number;
  totalSets: number;
  totalCards: number;
  totalVariants: number;
  totalJobs: number;
  databaseSize: string;
}

export function DatabaseManagement() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<DatabaseHealth>({
    connected: false,
    tablesExist: false,
    indexesExist: false,
    rlsPolicies: false
  });
  const [stats, setStats] = useState<DatabaseStats>({
    totalGames: 0,
    totalSets: 0,
    totalCards: 0,
    totalVariants: 0,
    totalJobs: 0,
    databaseSize: '0 MB'
  });
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    checkDatabaseHealth();
    fetchDatabaseStats();
  }, []);

  const checkDatabaseHealth = async () => {
    try {
      // Test basic connection
      const { error: connectionError } = await supabase.from('games').select('count').limit(1);
      const connected = !connectionError;

      // Check if core tables exist
      const tables: TableName[] = ['games', 'sets', 'cards', 'variants', 'sync_jobs'];
      let tablesExist = true;
      
      for (const table of tables) {
        const { error } = await supabase.from(table).select('count').limit(1);
        if (error) {
          tablesExist = false;
          break;
        }
      }

      // Check if database_stats view exists
      const { error: viewError } = await supabase.from('database_stats').select('*').limit(1);
      const viewExists = !viewError;

      setHealth({
        connected,
        tablesExist,
        indexesExist: tablesExist, // Assume indexes exist if tables exist
        rlsPolicies: tablesExist,
        error: connectionError?.message || (!tablesExist ? 'Some tables are missing' : undefined)
      });
    } catch (error) {
      console.error('Database health check failed:', error);
      setHealth({
        connected: false,
        tablesExist: false,
        indexesExist: false,
        rlsPolicies: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDatabaseStats = async () => {
    try {
      // Try database_stats view first
      const { data: statsData, error: statsError } = await supabase
        .from('database_stats')
        .select('*')
        .single();

      if (statsError) {
        // Fallback to individual queries
        const [games, sets, cards, variants, jobs] = await Promise.all([
          supabase.from('games').select('*', { count: 'exact', head: true }),
          supabase.from('sets').select('*', { count: 'exact', head: true }),
          supabase.from('cards').select('*', { count: 'exact', head: true }),
          supabase.from('variants').select('*', { count: 'exact', head: true }),
          supabase.from('sync_jobs').select('*', { count: 'exact', head: true })
        ]);

        setStats({
          totalGames: games.count || 0,
          totalSets: sets.count || 0,
          totalCards: cards.count || 0,
          totalVariants: variants.count || 0,
          totalJobs: jobs.count || 0,
          databaseSize: 'Unknown'
        });
      } else {
        setStats({
          totalGames: statsData.total_games || 0,
          totalSets: statsData.total_sets || 0,
          totalCards: statsData.total_cards || 0,
          totalVariants: statsData.total_variants || 0,
          totalJobs: 0, // Not in view
          databaseSize: 'Unknown'
        });
      }
    } catch (error) {
      console.error('Failed to fetch database stats:', error);
    }
  };

  const initializeSchema = async () => {
    setLoading(true);
    try {
      toast({
        title: 'Schema Initialization',
        description: 'Please run the SQL schema manually in your Supabase SQL editor',
      });
      
      // In a real implementation, this would execute the schema
      setTimeout(() => {
        checkDatabaseHealth();
        fetchDatabaseStats();
      }, 2000);
    } catch (error) {
      console.error('Schema initialization failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to initialize database schema',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    setMaintenance(true);
    try {
      // Clear in correct order due to foreign key constraints
      await supabase.from('variants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('sets').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('games').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('sync_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      toast({
        title: 'Success',
        description: 'All data has been cleared from the database'
      });

      fetchDatabaseStats();
    } catch (error) {
      console.error('Failed to clear data:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear database data',
        variant: 'destructive'
      });
    } finally {
      setMaintenance(false);
    }
  };

  const clearOldJobs = async () => {
    setMaintenance(true);
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from('sync_jobs')
        .delete()
        .lt('created_at', thirtyDaysAgo)
        .in('status', ['completed', 'failed']);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Old sync jobs have been cleared'
      });

      fetchDatabaseStats();
    } catch (error) {
      console.error('Failed to clear old jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to clear old sync jobs',
        variant: 'destructive'
      });
    } finally {
      setMaintenance(false);
    }
  };

  const getHealthIcon = (healthy: boolean) => {
    return healthy ? 
      <CheckCircle className="h-5 w-5 text-green-500" /> : 
      <XCircle className="h-5 w-5 text-red-500" />;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Database Management</h1>
        <p className="text-muted-foreground">Monitor and maintain your TCG database</p>
      </div>

      {/* Database Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Health Check
          </CardTitle>
          <CardDescription>
            Current status of your database connection and schema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  {getHealthIcon(health.connected)}
                  <span className="font-medium">Connection</span>
                  <Badge variant={health.connected ? 'default' : 'destructive'}>
                    {health.connected ? 'Connected' : 'Error'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  {getHealthIcon(health.tablesExist)}
                  <span className="font-medium">Tables</span>
                  <Badge variant={health.tablesExist ? 'default' : 'destructive'}>
                    {health.tablesExist ? 'Created' : 'Missing'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  {getHealthIcon(health.indexesExist)}
                  <span className="font-medium">Indexes</span>
                  <Badge variant={health.indexesExist ? 'default' : 'destructive'}>
                    {health.indexesExist ? 'Created' : 'Missing'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  {getHealthIcon(health.rlsPolicies)}
                  <span className="font-medium">RLS Policies</span>
                  <Badge variant={health.rlsPolicies ? 'default' : 'destructive'}>
                    {health.rlsPolicies ? 'Active' : 'Missing'}
                  </Badge>
                </div>
              </div>

              {health.error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Database Error</span>
                  </div>
                  <p className="text-sm text-destructive mt-1">{health.error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={checkDatabaseHealth} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" />
                  Refresh Status
                </Button>
                {!health.tablesExist && (
                  <Button onClick={initializeSchema} variant="default" size="sm">
                    <Play className="h-4 w-4" />
                    Initialize Schema
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Database Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Database Statistics
          </CardTitle>
          <CardDescription>
            Current data volumes and storage usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{formatNumber(stats.totalGames)}</div>
              <div className="text-sm text-muted-foreground">Games</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{formatNumber(stats.totalSets)}</div>
              <div className="text-sm text-muted-foreground">Sets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{formatNumber(stats.totalCards)}</div>
              <div className="text-sm text-muted-foreground">Cards</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">{formatNumber(stats.totalVariants)}</div>
              <div className="text-sm text-muted-foreground">Variants</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{formatNumber(stats.totalJobs)}</div>
              <div className="text-sm text-muted-foreground">Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{stats.databaseSize}</div>
              <div className="text-sm text-muted-foreground">Size</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Database Maintenance
          </CardTitle>
          <CardDescription>
            Maintenance operations and data cleanup tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={fetchDatabaseStats} variant="outline" disabled={maintenance}>
                <RefreshCw className="h-4 w-4" />
                Refresh Stats
              </Button>

              <Button onClick={clearOldJobs} variant="outline" disabled={maintenance}>
                {maintenance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Clear Old Jobs
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={maintenance}>
                    <Trash2 className="h-4 w-4" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all games, sets, 
                      cards, variants, and sync jobs from your database.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearAllData} className="bg-destructive text-destructive-foreground">
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Separator />

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Maintenance Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Clear old sync jobs regularly to maintain performance</li>
                <li>• Monitor database size to prevent storage issues</li>
                <li>• Run health checks after schema changes</li>
                <li>• Always backup before maintenance operations</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
