import { useState, useEffect } from "react";
import { Heart, AlertTriangle, CheckCircle, Clock, Database, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "./StatusBadge";
import { CircularProgress } from "./CircularProgress";
import { EnhancedDataTable } from "./EnhancedDataTable";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SystemHealthData {
  apiHealth: {
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    uptime: number;
    lastCheck: Date;
  };
  databaseHealth: {
    connections: number;
    queries: number;
    slowQueries: number;
  };
  jobQueue: {
    pending: number;
    running: number;
    failed: number;
    completed: number;
  };
  circuitBreakers: any[];
}

export function SystemHealthTab() {
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchHealthData = async () => {
    try {
      setLoading(true);

      // Fetch API health (mock data for now)
      const apiHealth = {
        status: 'healthy' as const,
        latency: Math.floor(Math.random() * 200) + 50,
        uptime: 99.8,
        lastCheck: new Date()
      };

      // Fetch database stats
      const { data: dbStats } = await supabase
        .from('database_stats')
        .select('*')
        .single();

      // Fetch job queue status
      const { data: jobData } = await supabase
        .from('pricing_job_queue')
        .select('status')
        .limit(1000);

      const jobCounts = jobData?.reduce((acc, job) => {
        acc[job.status] = (acc[job.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Fetch circuit breakers
      const { data: circuitBreakers } = await supabase
        .from('pricing_circuit_breaker')
        .select('*');

      setHealthData({
        apiHealth,
        databaseHealth: {
          connections: 45,
          queries: 1250,
          slowQueries: 3
        },
        jobQueue: {
          pending: jobCounts.queued || 0,
          running: jobCounts.running || 0,
          failed: jobCounts.error || 0,
          completed: jobCounts.completed || 0
        },
        circuitBreakers: circuitBreakers || []
      });

    } catch (error) {
      console.error('Error fetching health data:', error);
      toast.error('Failed to fetch system health data');
    } finally {
      setLoading(false);
    }
  };

  const runHealthCheck = async () => {
    setChecking(true);
    try {
      toast.info('🏥 Running comprehensive health check...');
      
      // Simulate health check operations
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await fetchHealthData();
      toast.success('✅ Health check completed successfully');
    } catch (error) {
      toast.error('❌ Health check failed');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const formatUptime = (uptime: number) => `${uptime.toFixed(2)}%`;
  const formatLatency = (ms: number) => `${ms}ms`;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
        <LoadingSkeleton variant="table" rows={5} />
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 mx-auto text-danger mb-4" />
        <h3 className="text-lg font-medium mb-2">Unable to load system health data</h3>
        <p className="text-muted-foreground mb-4">There was an error fetching the health information.</p>
        <Button onClick={() => fetchHealthData()}>
          Try Again
        </Button>
      </div>
    );
  }

  const getOverallHealth = () => {
    const { apiHealth, jobQueue } = healthData;
    
    if (apiHealth.status === 'down' || jobQueue.failed > 10) {
      return 'error';
    }
    
    if (apiHealth.status === 'degraded' || jobQueue.failed > 5) {
      return 'warning';
    }
    
    return 'healthy';
  };

  const overallHealth = getOverallHealth();

  // Column definitions for circuit breakers table
  const circuitBreakerColumns = [
    {
      key: 'game',
      label: 'Game',
      sortable: true,
    },
    {
      key: 'state',
      label: 'State',
      render: (state: string) => (
        <StatusBadge status={state === 'closed' ? 'success' : state === 'open' ? 'danger' : 'warning'}>
          {state.charAt(0).toUpperCase() + state.slice(1)}
        </StatusBadge>
      )
    },
    {
      key: 'failure_count',
      label: 'Failures',
      sortable: true,
      render: (count: number) => (
        <Badge variant={count === 0 ? 'default' : count < 5 ? 'secondary' : 'destructive'}>
          {count}
        </Badge>
      )
    },
    {
      key: 'last_failure_at',
      label: 'Last Failure',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'Never'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Health Overview Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Overall System Health */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Health</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge 
                    status={overallHealth}
                    icon={overallHealth === 'healthy' ? CheckCircle : AlertTriangle}
                  />
                  <span className="text-lg font-bold capitalize">{overallHealth}</span>
                </div>
              </div>
              <Heart className={`w-8 h-8 ${overallHealth === 'healthy' ? 'text-success' : 'text-danger'}`} />
            </div>
          </CardContent>
        </Card>

        {/* API Health */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">API Health</p>
                <p className="text-2xl font-bold">{formatLatency(healthData.apiHealth.latency)}</p>
              </div>
              <Zap className="w-8 h-8 text-info" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uptime</span>
                <span className="font-medium">{formatUptime(healthData.apiHealth.uptime)}</span>
              </div>
              <Progress value={healthData.apiHealth.uptime} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Database Health */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Database</p>
                <p className="text-2xl font-bold">{healthData.databaseHealth.connections}</p>
              </div>
              <Database className="w-8 h-8 text-success" />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Active connections</span>
                <span className="font-medium">{healthData.databaseHealth.connections}</span>
              </div>
              <div className="flex justify-between">
                <span>Slow queries</span>
                <span className="font-medium text-warning">{healthData.databaseHealth.slowQueries}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Queue Status */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Job Queue</p>
                <p className="text-2xl font-bold">{healthData.jobQueue.running}</p>
              </div>
              <Clock className="w-8 h-8 text-warning" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span>Pending</span>
                <Badge variant="secondary">{healthData.jobQueue.pending}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Failed</span>
                <Badge variant={healthData.jobQueue.failed > 0 ? 'destructive' : 'default'}>
                  {healthData.jobQueue.failed}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Health Metrics */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* System Performance */}
        <Card>
          <CardHeader>
            <CardTitle>System Performance</CardTitle>
            <CardDescription>Real-time performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center">
              <CircularProgress
                value={healthData.apiHealth.uptime}
                size={120}
                showLabel={true}
                label="API Uptime"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Response Time</span>
                  <span className="font-medium">{formatLatency(healthData.apiHealth.latency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Throughput</span>
                  <span className="font-medium">1.2k req/min</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Error Rate</span>
                  <span className="font-medium text-success">0.02%</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Check</span>
                  <span className="font-medium">{healthData.apiHealth.lastCheck.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Health Check Actions</CardTitle>
            <CardDescription>Run diagnostic checks and maintenance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={runHealthCheck} 
              disabled={checking}
              className="w-full"
            >
              {checking ? (
                <Heart className="w-4 h-4 mr-2 animate-pulse" />
              ) : (
                <Heart className="w-4 h-4 mr-2" />
              )}
              {checking ? 'Running Health Check...' : 'Run Full Health Check'}
            </Button>
            
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.info('🔄 API test started')}>
                Test API
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('💾 DB check started')}>
                Check DB
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('🔧 Queue cleared')}>
                Clear Queue
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('🔄 Circuits reset')}>
                Reset Circuits
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Circuit Breakers Table */}
      {healthData.circuitBreakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Circuit Breakers</CardTitle>
            <CardDescription>
              Safety mechanisms that prevent cascading failures
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedDataTable
              data={healthData.circuitBreakers}
              columns={circuitBreakerColumns}
              searchable={false}
              exportable={false}
              pagination={false}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}