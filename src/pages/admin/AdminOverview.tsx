import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { QuickActionBar } from '@/components/dashboard/QuickActionBar';
import { useSyncActions } from '@/hooks/useSyncActions';
import { 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Activity, 
  Database, 
  Zap, 
  Clock, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

interface SystemHealth {
  database: 'healthy' | 'error' | 'checking';
  apiKey: 'configured' | 'missing' | 'checking';
  recentJobs: number;
  failedJobs: number;
  activeJobs: number;
}

interface SystemStats {
  totalGames: number;
  totalSets: number;
  totalCards: number;
  totalVariants: number;
  syncedSets: number;
  lastSyncTime: string | null;
}

export function AdminOverview() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const {
    syncState,
    handleSyncAll,
    handleSyncMTG,
    handleSyncPokemonEN,
    handleSyncPokemonJP,
    handleSyncYugioh,
    handleSyncSealed,
    handleTestBatch
  } = useSyncActions();
  const [health, setHealth] = useState<SystemHealth>({
    database: 'checking',
    apiKey: 'checking',
    recentJobs: 0,
    failedJobs: 0,
    activeJobs: 0
  });
  const [stats, setStats] = useState<SystemStats>({
    totalGames: 0,
    totalSets: 0,
    totalCards: 0,
    totalVariants: 0,
    syncedSets: 0,
    lastSyncTime: null
  });

  useEffect(() => {
    checkSystemHealth();
    fetchSystemStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      checkSystemHealth();
      fetchSystemStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkSystemHealth = async () => {
    try {
      // Check database connection
      const { error: dbError } = await supabase.from('games').select('count').limit(1);
      const dbHealthy = !dbError;

      // Check recent jobs
      const { data: recentJobs } = await supabase
        .from('sync_jobs')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const activeJobs = recentJobs?.filter(job => job.status === 'running').length || 0;
      const failedJobs = recentJobs?.filter(job => job.status === 'failed').length || 0;

      setHealth({
        database: dbHealthy ? 'healthy' : 'error',
        apiKey: 'configured', // We'll check this via health endpoint later
        recentJobs: recentJobs?.length || 0,
        failedJobs,
        activeJobs
      });
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth(prev => ({ ...prev, database: 'error' }));
    }
  };

  const fetchSystemStats = async () => {
    try {
      // Try to use the database_stats view first
      const { data: statsData, error: statsError } = await supabase
        .from('database_stats')
        .select('*')
        .single();

      if (statsError) {
        // Fallback to individual queries
        const [games, sets, cards, variants, syncedSets, lastSync] = await Promise.all([
          supabase.from('games').select('*', { count: 'exact', head: true }),
          supabase.from('sets').select('*', { count: 'exact', head: true }),
          supabase.from('cards').select('*', { count: 'exact', head: true }),
          supabase.from('variants').select('*', { count: 'exact', head: true }),
          supabase.from('sets').select('*', { count: 'exact', head: true }).eq('sync_status', 'completed'),
          supabase.from('sync_jobs').select('completed_at').eq('status', 'completed').order('completed_at', { ascending: false }).limit(1)
        ]);

        setStats({
          totalGames: games.count || 0,
          totalSets: sets.count || 0,
          totalCards: cards.count || 0,
          totalVariants: variants.count || 0,
          syncedSets: syncedSets.count || 0,
          lastSyncTime: lastSync.data?.[0]?.completed_at || null
        });
      } else {
        setStats({
          totalGames: statsData.total_games || 0,
          totalSets: statsData.total_sets || 0,
          totalCards: statsData.total_cards || 0,
          totalVariants: statsData.total_variants || 0,
          syncedSets: statsData.synced_sets || 0,
          lastSyncTime: null // Get from separate query
        });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch system statistics',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getHealthIcon = (status: 'healthy' | 'error' | 'checking') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />;
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
      <div>
        <h1 className="text-3xl font-bold text-foreground">System Overview</h1>
        <p className="text-muted-foreground">Monitor your TCG database service health and performance</p>
      </div>

      {/* System Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {getHealthIcon(health.database)}
              Database Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={health.database === 'healthy' ? 'default' : 'destructive'}>
              {health.database === 'healthy' ? 'Connected' : 'Connection Issues'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Active Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{health.activeJobs}</div>
            <p className="text-xs text-muted-foreground">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Failed Jobs (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{health.failedJobs}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Database Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Statistics
          </CardTitle>
          <CardDescription>Current data volumes in your TCG database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{formatNumber(stats.totalGames)}</div>
              <div className="text-sm text-muted-foreground">Games</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary">{formatNumber(stats.totalSets)}</div>
              <div className="text-sm text-muted-foreground">Sets</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">{formatNumber(stats.totalCards)}</div>
              <div className="text-sm text-muted-foreground">Cards</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-muted-foreground">{formatNumber(stats.totalVariants)}</div>
              <div className="text-sm text-muted-foreground">Variants</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="font-medium">Sync Progress</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {stats.syncedSets} of {stats.totalSets} sets synced
              </div>
              <div className="mt-2">
                <div className="bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ 
                      width: stats.totalSets > 0 ? `${(stats.syncedSets / stats.totalSets) * 100}%` : '0%' 
                    }}
                  />
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Last Sync</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {stats.lastSyncTime ? 
                  new Date(stats.lastSyncTime).toLocaleString() : 
                  'No sync completed yet'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Action Bar - Now with working sync buttons */}
      <QuickActionBar
        onSyncAll={handleSyncAll}
        onSyncMTG={handleSyncMTG}
        onSyncPokemonEN={handleSyncPokemonEN}
        onSyncPokemonJP={handleSyncPokemonJP}
        onSyncYugioh={handleSyncYugioh}
        onSyncSealed={handleSyncSealed}
        onTestBatch={handleTestBatch}
        syncState={syncState}
      />

      {/* Navigation Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation & Tools</CardTitle>
          <CardDescription>Access other admin sections and tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => window.location.href = '/admin/pricing'} variant="outline">
              Pricing Monitor
            </Button>
            <Button onClick={() => window.location.href = '/admin/database'} variant="outline">
              Database Tools
            </Button>
            <Button onClick={() => window.location.reload()} variant="ghost">
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}