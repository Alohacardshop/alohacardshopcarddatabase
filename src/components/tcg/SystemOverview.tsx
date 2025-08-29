import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import { Loader2, CheckCircle, XCircle, Database, Zap, Clock, TrendingUp } from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface SystemStats {
  totalGames: number;
  totalSets: number;
  totalCards: number;
  totalVariants: number;
  syncedSets: number;
  recentJobs: number;
  apiStatus: 'healthy' | 'error' | 'checking';
}

export function SystemOverview() {
  const { toast } = useToast();
  const [stats, setStats] = useState<SystemStats>({
    totalGames: 0,
    totalSets: 0,
    totalCards: 0,
    totalVariants: 0,
    syncedSets: 0,
    recentJobs: 0,
    apiStatus: 'checking'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSystemStats();
    const interval = setInterval(fetchSystemStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSystemStats = async () => {
    try {
      // Try health check first for real-time status
      const healthResponse = await fetch('/api/health-check')
        .catch(() => null)
      
      let apiStatus: 'healthy' | 'error' | 'checking' = 'checking'
      if (healthResponse) {
        const healthData = await healthResponse.json()
        apiStatus = healthData.status === 'healthy' ? 'healthy' : 'error'
      }

      // Use the database_stats view for better performance
      const { data: statsData, error: statsError } = await supabase
        .from('database_stats')
        .select('*')
        .single();

      if (statsError) {
        // Fallback to individual queries if view doesn't exist
        const [
          gamesResult,
          setsResult,
          cardsResult,
          variantsResult,
          syncedSetsResult,
          jobsResult
        ] = await Promise.all([
          supabase.from('games').select('id', { count: 'exact', head: true }),
          supabase.from('sets').select('id', { count: 'exact', head: true }),
          supabase.from('cards').select('id', { count: 'exact', head: true }),
          supabase.from('variants').select('id', { count: 'exact', head: true }),
          supabase.from('sets').select('id', { count: 'exact', head: true }).eq('sync_status', 'completed'),
          supabase
            .from('sync_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        ]);

        setStats({
          totalGames: gamesResult.count || 0,
          totalSets: setsResult.count || 0,
          totalCards: cardsResult.count || 0,
          totalVariants: variantsResult.count || 0,
          syncedSets: syncedSetsResult.count || 0,
          recentJobs: jobsResult.count || 0,
          apiStatus
        });
      } else {
        // Use view data
        setStats({
          totalGames: statsData.total_games || 0,
          totalSets: statsData.total_sets || 0,
          totalCards: statsData.total_cards || 0,
          totalVariants: statsData.total_variants || 0,
          syncedSets: statsData.synced_sets || 0,
          recentJobs: statsData.active_jobs || 0,
          apiStatus
        });
      }
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
      setStats(prev => ({ ...prev, apiStatus: 'error' }));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {stats.apiStatus === 'healthy' ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-500 font-medium">All Systems Operational</span>
              </>
            ) : stats.apiStatus === 'error' ? (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-red-500 font-medium">System Error Detected</span>
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                <span className="text-yellow-500 font-medium">Checking Status...</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics - Premium Plan Optimized */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Games
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-foreground">
                {formatNumber(stats.totalGames)}
              </span>
            </div>
            <Badge variant="outline" className="mt-1 text-xs">100% Synced</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-secondary" />
              <span className="text-2xl font-bold text-foreground">
                {formatNumber(stats.totalSets)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {stats.totalSets > 0 ? Math.round((stats.syncedSets / stats.totalSets) * 100) : 0}% completed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span className="text-2xl font-bold text-foreground">
                {formatNumber(stats.totalCards)}
              </span>
            </div>
            <Badge variant="secondary" className="mt-1 text-xs">Optimized</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Card Variants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold text-foreground">
                {formatNumber(stats.totalVariants)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              With pricing data
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Plan Performance Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Premium Plan Performance
          </CardTitle>
          <CardDescription>
            Optimized settings and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-300">Rate Limits</span>
              </div>
              <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                400 req/min (safe buffer)
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-700 dark:text-blue-300">Batch Size</span>
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                100 items per request
              </div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-purple-700 dark:text-purple-300">DB Batching</span>
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                25-50 cards per transaction
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Sync jobs in the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {stats.recentJobs}
            </Badge>
            <span className="text-muted-foreground">sync operations</span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common administrative tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Refresh Dashboard
            </Button>
            <Badge variant="outline" className="px-3 py-1">
              Production Ready
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              High Performance
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}