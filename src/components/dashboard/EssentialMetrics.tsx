import { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, Database, Bell, Activity, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSystemStatus } from "@/hooks/useSystemStatus";

interface EssentialMetricsProps {
  className?: string;
}

interface RealTimeStats {
  variantsSyncedToday: number;
  variantsSyncedLastHour: number;
  activeAlerts: number;
  apiUsage: number;
  nextSyncIn: number;
}

export function EssentialMetrics({ className = "" }: EssentialMetricsProps) {
  const { status: systemStatus, isLoading: statusLoading, refresh: refreshStatus } = useSystemStatus();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<RealTimeStats>({
    variantsSyncedToday: 0,
    variantsSyncedLastHour: 0,
    activeAlerts: 0,
    apiUsage: 0,
    nextSyncIn: 0
  });

  const fetchRealTimeStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      // Get variants updated today (both card and sealed variants)
      const [cardVariantsToday, sealedVariantsToday, cardVariantsHour, sealedVariantsHour] = await Promise.all([
        supabase
          .from('variants')
          .select('id', { count: 'exact', head: true })
          .gte('last_updated', `${today}T00:00:00.000Z`),
        supabase
          .from('sealed_variants')
          .select('id', { count: 'exact', head: true })
          .gte('last_updated', `${today}T00:00:00.000Z`),
        supabase
          .from('variants')
          .select('id', { count: 'exact', head: true })
          .gte('last_updated', oneHourAgo),
        supabase
          .from('sealed_variants')
          .select('id', { count: 'exact', head: true })
          .gte('last_updated', oneHourAgo)
      ]);

      const variantsSyncedToday = (cardVariantsToday.count || 0) + (sealedVariantsToday.count || 0);
      const variantsSyncedLastHour = (cardVariantsHour.count || 0) + (sealedVariantsHour.count || 0);

      setStats(prev => ({
        ...prev,
        variantsSyncedToday,
        variantsSyncedLastHour,
        // Keep simulated values for these until we have real data sources
        activeAlerts: 0, // TODO: Connect to real alerts
        apiUsage: 0, // TODO: Connect to real API usage
        nextSyncIn: Math.max(0, prev.nextSyncIn - 1)
      }));
    } catch (error) {
      console.error('Failed to fetch real-time stats:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchRealTimeStats(), refreshStatus()]);
    setIsRefreshing(false);
  };

  // Fetch initial data and set up refresh interval
  useEffect(() => {
    fetchRealTimeStats();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchRealTimeStats, 60000);
    
    // Simple countdown for next sync (placeholder)
    const countdown = setInterval(() => {
      setStats(prev => ({ ...prev, nextSyncIn: Math.max(0, prev.nextSyncIn - 1) }));
    }, 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(countdown);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (isHealthy: boolean) => {
    if (isHealthy) {
      return <CheckCircle className="w-5 h-5 text-success" />;
    } else {
      return <AlertTriangle className="w-5 h-5 text-destructive" />;
    }
  };

  const getStatusBadge = (isHealthy: boolean, errorMessage?: string) => {
    if (isHealthy) {
      return <Badge className="bg-success text-success-foreground">All Systems Operational</Badge>;
    } else {
      return <Badge variant="destructive">{errorMessage ? 'System Error' : 'Issues Detected'}</Badge>;
    }
  };

  const getStatusMessage = (isHealthy: boolean, errorMessage?: string) => {
    if (isHealthy) {
      return 'All systems operational';
    } else {
      return errorMessage || 'System experiencing issues';
    }
  };

  const getUsageColor = (usage: number) => {
    if (usage < 70) return 'text-success';
    if (usage < 90) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {/* System Status */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            {getStatusIcon(systemStatus.isHealthy)}
            System Status
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ml-auto h-6 w-6 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-semibold mb-1">
                {getStatusMessage(systemStatus.isHealthy, systemStatus.errorMessage)}
              </p>
              <p className="text-sm text-muted-foreground">
                Last checked: {systemStatus.lastHealthCheck?.toLocaleTimeString() || 'Never'}
              </p>
            </div>
            {getStatusBadge(systemStatus.isHealthy, systemStatus.errorMessage)}
          </div>
        </CardContent>
      </Card>

      {/* Variants Synced Today */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Variants Synced Today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-success">
                {stats.variantsSyncedToday.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                +{stats.variantsSyncedLastHour} in last hour
              </p>
            </div>
            <Database className="w-6 h-6 text-success" />
          </div>
        </CardContent>
      </Card>

      {/* Active Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-info">
                {systemStatus.activeJobs}
              </p>
              <p className="text-xs text-muted-foreground">
                Currently running
              </p>
            </div>
            <Activity className="w-6 h-6 text-info" />
          </div>
        </CardContent>
      </Card>

      {/* API Latency */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            API Latency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-primary">
                {systemStatus.apiLatency ? `${systemStatus.apiLatency}ms` : '--'}
              </p>
              <p className="text-xs text-muted-foreground">
                Database ping
              </p>
            </div>
            <Clock className="w-6 h-6 text-primary" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}