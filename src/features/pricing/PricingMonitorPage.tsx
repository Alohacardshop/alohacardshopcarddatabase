import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Clock, CheckCircle, XCircle, TrendingUp, Activity, AlertTriangle, Square, Trash2, Settings, BarChart3, Zap, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/shell/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SealedProductsTab } from "@/components/admin/SealedProductsTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PricingJob {
  id: string;
  game: string;
  expected_batches: number;
  actual_batches: number;
  cards_processed: number;
  variants_updated: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  error: string | null;
}

interface ApiUsageStats {
  total_requests: number;
  success_rate: number;
  avg_response_time: number;
  requests_last_hour: number;
  errors_last_hour: number;
  monthly_requests?: number;
  daily_requests?: number;
}

interface PricingStats {
  total_cards: number;
  cards_with_pricing: number;
  avg_card_price_cents: number;
  sets_with_pricing: number;
  total_sealed_products: number;
  sealed_with_pricing: number;
  avg_sealed_price_cents: number;
  total_jobs_last_30_days: number;
  successful_jobs: number;
  avg_job_duration_minutes: number;
  success_rate_percentage: number;
  last_updated: string;
}

interface SystemHealthCheck {
  circuit_breaker_status: any[];
  retry_queue_size: number;
  last_successful_runs: any[];
  stuck_jobs: any[];
}

interface TestProgress {
  jobId: string;
  stage: string;
  progress: number;
  cardsProcessed: number;
  errors: number;
  isRunning: boolean;
}

export function PricingMonitorPage() {
  const [jobs, setJobs] = useState<PricingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoking, setInvoking] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [apiStats, setApiStats] = useState<ApiUsageStats | null>(null);
  const [pricingStats, setPricingStats] = useState<PricingStats | null>(null);
  const [testingPricing, setTestingPricing] = useState(false);
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthCheck | null>(null);
  const [checkingSystemHealth, setCheckingSystemHealth] = useState(false);
  const [testProgress, setTestProgress] = useState<TestProgress | null>(null);
  const [extendedApiStats, setExtendedApiStats] = useState<any>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const { data: jobsData, error } = await (supabase as any).rpc('get_pricing_jobs_recent');

      if (error) {
        console.error('Error fetching pricing jobs:', error);
        setJobs([]);
      } else {
        setJobs(jobsData as PricingJob[] || []);
      }
    } catch (error) {
      console.error('Error fetching pricing jobs:', error);
      toast.error('Failed to fetch pricing jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchApiStats = useCallback(async () => {
    try {
      // Fetch API usage data
      const { data, error } = await supabase
        .from('pricing_api_usage')
        .select('*')
        .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Fetch monthly usage
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('pricing_api_usage')
        .select('*', { count: 'exact', head: true })
        .gte('recorded_at', monthStart.toISOString());

      // Fetch daily usage
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      
      const { data: dailyData, error: dailyError } = await supabase
        .from('pricing_api_usage')
        .select('*', { count: 'exact', head: true })
        .gte('recorded_at', dayStart.toISOString());

      if (!error && data) {
        const totalRequests = data.length;
        const successfulRequests = data.filter((r: any) => r.success).length;
        const avgResponseTime = data.reduce((acc: number, r: any) => acc + (r.response_time_ms || 0), 0) / Math.max(totalRequests, 1);
        const lastHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const requestsLastHour = data.filter((r: any) => r.recorded_at >= lastHour).length;
        const errorsLastHour = data.filter((r: any) => r.recorded_at >= lastHour && !r.success).length;

        setApiStats({
          total_requests: totalRequests,
          success_rate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
          avg_response_time: avgResponseTime,
          requests_last_hour: requestsLastHour,
          errors_last_hour: errorsLastHour,
          monthly_requests: monthlyData?.length || 0,
          daily_requests: dailyData?.length || 0
        });
      }
    } catch (error) {
      console.error('Error fetching API stats:', error);
      setApiStats({
        total_requests: 0,
        success_rate: 0,
        avg_response_time: 0,
        requests_last_hour: 0,
        errors_last_hour: 0,
        monthly_requests: 0,
        daily_requests: 0
      });
    }
  }, []);

  const fetchPricingStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_stats_mv')
        .select('*')
        .single();

      if (!error && data) {
        setPricingStats(data as PricingStats);
      }
    } catch (error) {
      console.error('Error fetching pricing stats:', error);
      setPricingStats(null);
    }
  }, []);

  const fetchCronJobs = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_cron_jobs_status');
      if (error) throw error;
      setCronJobs(data || []);
    } catch (error) {
      console.error('Error fetching cron jobs:', error);
      setCronJobs([]);
    }
  }, []);

  const runTestPricing = async (game: string = 'mtg') => {
    if (testingPricing) return;
    
    setTestingPricing(true);
    setTestProgress({
      jobId: '',
      stage: 'Starting...',
      progress: 0,
      cardsProcessed: 0,
      errors: 0,
      isRunning: true
    });

    try {
      const { data, error } = await supabase.rpc('trigger_test_pricing_batch', {
        p_game: game,
        p_limit: 10
      });
      
      if (error) throw error;
      
      const result = data as any;
      if (result.success) {
        setTestProgress(prev => prev ? {
          ...prev,
          jobId: result.job_id,
          stage: 'Test job queued successfully'
        } : null);

        toast.success(`🧪 Test pricing job started for ${getGameDisplayName(game)} (10 items)`);
        
        // Start monitoring test progress
        monitorTestProgress(result.job_id);
        
        // Refresh data after a brief delay
        setTimeout(() => {
          fetchJobs();
          fetchApiStats();
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to start test job');
      }
    } catch (error) {
      console.error('Error running test pricing:', error);
      toast.error(error instanceof Error ? error.message : "Failed to start test pricing");
      setTestProgress(null);
      setTestingPricing(false);
    }
  };

  const monitorTestProgress = async (jobId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max monitoring
    
    const checkProgress = async () => {
      try {
        const { data: jobs } = await (supabase as any).rpc('get_pricing_jobs_recent');
        const job = jobs?.find((j: any) => j.id === jobId);
        
        if (job) {
          const progress = Math.round((job.actual_batches / Math.max(job.expected_batches, 1)) * 100);
          
          setTestProgress(prev => prev ? {
            ...prev,
            stage: job.status === 'running' ? 'Processing cards...' : 
                   job.status === 'completed' ? 'Test completed!' : 
                   job.status === 'error' ? 'Test failed' : job.status,
            progress: progress,
            cardsProcessed: job.cards_processed || 0,
            errors: job.error ? 1 : 0,
            isRunning: job.status === 'running'
          } : null);
          
          if (job.status !== 'running') {
            // Test completed
            if (job.status === 'completed') {
              toast.success(`✅ Test completed! Processed ${job.cards_processed} cards, updated ${job.variants_updated} variants`);
            } else if (job.status === 'error') {
              toast.error(`❌ Test failed: ${job.error}`);
            }
            
            setTimeout(() => {
              setTestProgress(null);
              setTestingPricing(false);
            }, 3000);
            return;
          }
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkProgress, 5000); // Check every 5 seconds
        } else {
          setTestProgress(null);
          setTestingPricing(false);
        }
      } catch (error) {
        console.error('Error monitoring test progress:', error);
        setTestProgress(null);
        setTestingPricing(false);
      }
    };
    
    // Start checking progress after initial delay
    setTimeout(checkProgress, 2000);
  };

  const triggerPricingRefresh = async (game: string) => {
    setInvoking(game);
    try {
      const { data, error } = await supabase.functions.invoke('justtcg-refresh-variants', {
        body: { game }
      });

      if (error) {
        throw new Error(error.message || 'Failed to trigger pricing refresh');
      }

      // Check for specific error types in the response
      if (data && !data.success) {
        let errorMessage = `Failed to start pricing refresh for ${getGameDisplayName(game)}`;
        
        if (data.error === 'missing_api_key') {
          errorMessage = 'JustTCG API key is not configured. Please check the edge function secrets.';
        } else if (data.message) {
          errorMessage = data.message;
        }
        
        throw new Error(errorMessage);
      }

      toast.success(`Pricing refresh started for ${getGameDisplayName(game)}`);
      
      // Refresh the jobs list after a short delay
      setTimeout(() => {
        fetchJobs();
      }, 1000);
    } catch (error) {
      console.error('Error triggering pricing refresh:', error);
      toast.error(error instanceof Error ? error.message : `Failed to start pricing refresh for ${getGameDisplayName(game)}`);
    } finally {
      setInvoking(null);
    }
  };

  const forceStopJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to force stop this job? This will cancel the current run.')) {
      return;
    }

    setCancelling(jobId);
    try {
      const { error } = await (supabase as any).rpc('request_pricing_job_cancel', {
        p_job_id: jobId,
        p_reason: 'User requested force stop'
      });

      if (error) {
        throw new Error(error.message || 'Failed to request job cancellation');
      }

      toast.success('Job cancellation requested');
      
      // Refresh the jobs list
      setTimeout(() => {
        fetchJobs();
      }, 1000);
    } catch (error) {
      console.error('Error requesting job cancellation:', error);
      toast.error('Failed to request job cancellation');
    } finally {
      setCancelling(null);
    }
  };

  const cleanupStuckJobs = async () => {
    if (!confirm('Are you sure you want to clean up stuck jobs? This will mark jobs running for over 60 minutes as errors.')) {
      return;
    }

    setCleaning(true);
    try {
      const { data: cleanedCount, error } = await (supabase as any).rpc('cancel_stuck_pricing_jobs', {
        p_max_minutes: 60
      });

      if (error) {
        throw new Error(error.message || 'Failed to clean up stuck jobs');
      }

      toast.success(`Cleaned up ${cleanedCount || 0} stuck jobs`);
      
      // Refresh the jobs list
      fetchJobs();
    } catch (error) {
      console.error('Error cleaning up stuck jobs:', error);
      toast.error('Failed to clean up stuck jobs');
    } finally {
      setCleaning(false);
    }
  };

  const adminCancelJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to admin cancel this job? This will immediately mark it as cancelled in the database.')) {
      return;
    }

    setCancelling(jobId);
    try {
      const { error } = await (supabase as any).rpc('force_finish_pricing_job', {
        p_job_id: jobId,
        p_status: 'cancelled',
        p_error: 'Admin cancelled - force stopped'
      });

      if (error) {
        throw new Error(error.message || 'Failed to admin cancel job');
      }

      toast.success('Job cancelled by admin');
      
      // Refresh the jobs list
      setTimeout(() => {
        fetchJobs();
      }, 1000);
    } catch (error) {
      console.error('Error admin cancelling job:', error);
      toast.error('Failed to admin cancel job');
    } finally {
      setCancelling(null);
    }
  };

  const checkApiHealth = async () => {
    setHealthChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('justtcg-health-check', {
        body: {}
      });

      if (error) {
        throw new Error(error.message || 'Failed to check API health');
      }

      setHealthStatus(data);
      
      if (data.success) {
        toast.success('JustTCG API connection is healthy');
      } else {
        toast.error(data.message || 'API health check failed');
      }
    } catch (error) {
      console.error('Error checking API health:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to check API health');
      setHealthStatus({ success: false, error: 'check_failed', message: error.message });
    } finally {
      setHealthChecking(false);
    }
  };

  const checkSystemHealth = async () => {
    setCheckingSystemHealth(true);
    try {
      // Fetch circuit breaker status
      const { data: circuitBreakerData } = await supabase
        .from('pricing_circuit_breaker')
        .select('*');

      // Fetch retry queue size
      const { data: retryQueueData } = await supabase
        .from('pricing_variant_retries')
        .select('*', { count: 'exact', head: true });

      // Fetch last successful runs
      const { data: jobsData } = await (supabase as any).rpc('get_pricing_jobs_recent');
      const lastSuccessfulRuns = ['pokemon', 'pokemon-japan', 'mtg'].map(game => {
        const lastJob = jobsData?.find((job: any) => job.game === game && job.status === 'completed');
        return {
          game,
          lastRun: lastJob?.finished_at || null,
          status: lastJob ? 'success' : 'no_recent_success'
        };
      });

      // Fetch stuck jobs
      const { data: stuckJobs } = await supabase
        .from('pricing_job_queue')
        .select('*')
        .eq('status', 'running')
        .lt('started_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      setSystemHealth({
        circuit_breaker_status: circuitBreakerData || [],
        retry_queue_size: retryQueueData?.length || 0,
        last_successful_runs: lastSuccessfulRuns,
        stuck_jobs: stuckJobs || []
      });

      toast.success('System health check completed');
    } catch (error) {
      console.error('Error checking system health:', error);
      toast.error('Failed to check system health');
    } finally {
      setCheckingSystemHealth(false);
    }
  };

  const getGameDisplayName = (game: string) => {
    switch (game) {
      case 'pokemon': return 'Pokémon EN';
      case 'pokemon-japan': return 'Pokémon JP';
      case 'mtg': return 'MTG';
      default: return game;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'preflight_ceiling': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string, jobId: string) => {
    // Check if cancel is requested for this job
    const isCancelRequested = jobs.some(j => j.id === jobId && status === 'running');
    
    switch (status) {
      case 'running':
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Running</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Cancelled</Badge>;
      case 'error':
        return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Error</Badge>;
      case 'preflight_ceiling':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Preflight Stop</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (startedAt: string, finishedAt: string | null) => {
    const start = new Date(startedAt);
    const end = finishedAt ? new Date(finishedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const calculateProgress = (job: PricingJob) => {
    if (job.status === 'completed') return 100;
    if (job.status === 'error' || job.status === 'preflight_ceiling' || job.status === 'cancelled') return 0;
    if (job.expected_batches === 0) return 0;
    return Math.round((job.actual_batches / job.expected_batches) * 100);
  };

  // Stats calculations
  const runningJobs = jobs.filter(job => job.status === 'running').length;
  const completedJobs = jobs.filter(job => job.status === 'completed').length;
  const failedJobs = jobs.filter(job => job.status === 'error' || job.status === 'cancelled').length;
  const avgDuration = jobs
    .filter(job => job.status === 'completed' && job.finished_at)
    .reduce((acc, job) => {
      const duration = new Date(job.finished_at!).getTime() - new Date(job.started_at).getTime();
      return acc + duration;
    }, 0) / Math.max(completedJobs, 1);

  useEffect(() => {
    fetchJobs();
    fetchApiStats();
    fetchPricingStats();
    fetchCronJobs();
    
    // Set up real-time subscriptions
    const jobsChannel = supabase
      .channel('pricing-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'ops',
          table: 'pricing_job_runs'
        },
        (payload) => {
          // Refresh jobs when any job changes
          fetchJobs();
        }
      )
      .subscribe();

    const apiUsageChannel = supabase
      .channel('api-usage-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pricing_api_usage'
        },
        () => {
          // Refresh API stats when new usage is recorded
          fetchApiStats();
        }
      )
      .subscribe();
    
    // Adaptive polling: faster when jobs are active
    const hasRunningOrCancelling = runningJobs > 0 || cancelling !== null;
    const pollInterval = hasRunningOrCancelling ? 5000 : 30000;
    
    const interval = setInterval(() => {
      fetchJobs();
      fetchApiStats();
      fetchPricingStats();
      fetchCronJobs();
    }, pollInterval);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(apiUsageChannel);
    };
  }, [runningJobs, cancelling, fetchJobs, fetchApiStats, fetchPricingStats]);

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return; // Don't trigger shortcuts when user is typing
      }
      
      switch (e.key.toLowerCase()) {
        case 'r':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            fetchJobs();
          }
          break;
        case 'g':
          // Could add game switching if needed
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const actions = (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => triggerPricingRefresh('pokemon')}
          disabled={invoking === 'pokemon' || runningJobs > 0}
          size="sm"
          className="gap-2"
        >
          {invoking === 'pokemon' ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Pokémon EN
        </Button>
        <Button
          onClick={() => triggerPricingRefresh('pokemon-japan')}
          disabled={invoking === 'pokemon-japan' || runningJobs > 0}
          size="sm"
          className="gap-2"
        >
          {invoking === 'pokemon-japan' ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Pokémon JP
        </Button>
        <Button
          onClick={() => triggerPricingRefresh('mtg')}
          disabled={invoking === 'mtg' || runningJobs > 0}
          size="sm"
          className="gap-2"
        >
          {invoking === 'mtg' ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          MTG
        </Button>
      </div>
      <Button
        onClick={cleanupStuckJobs}
        disabled={cleaning}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {cleaning ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Clean Stuck
      </Button>
      <Button
        onClick={checkApiHealth}
        disabled={healthChecking}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        {healthChecking ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Settings className="h-4 w-4" />
        )}
        API Health
      </Button>
        <Button
          onClick={fetchJobs}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
        <Button
          onClick={() => runTestPricing('mtg')}
          disabled={testingPricing}
          variant="secondary"
          size="sm"
          className="gap-2"
        >
          {testingPricing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Test Run (10 items)
        </Button>
        <Button
          onClick={checkSystemHealth}
          disabled={checkingSystemHealth}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {checkingSystemHealth ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Activity className="h-4 w-4" />
          )}
          System Health
        </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Monitor"
        subtitle="Monitor and manage nightly variant pricing refresh jobs for Pokémon EN/JP and MTG"
        actions={actions}
      />

      <div className="px-6 space-y-6">
        {/* Test Progress */}
        {testProgress && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Zap className="h-5 w-5" />
                🧪 Test Pricing Job Progress
              </CardTitle>
              <CardDescription>Real-time monitoring of test batch (10 cards)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{testProgress.stage}</span>
                  <span className="text-sm text-muted-foreground">{testProgress.progress}%</span>
                </div>
                <Progress value={testProgress.progress} className="h-2" />
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-blue-600">{testProgress.cardsProcessed}</div>
                    <div className="text-muted-foreground">Cards Processed</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-green-600">{Math.max(0, testProgress.cardsProcessed - testProgress.errors)}</div>
                    <div className="text-muted-foreground">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-red-600">{testProgress.errors}</div>
                    <div className="text-muted-foreground">Errors</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Jobs"
            value={runningJobs}
            icon={<Activity className="h-4 w-4 text-blue-500" />}
          />
          <StatCard
            title="Completed Today"
            value={pricingStats?.total_jobs_last_30_days || completedJobs}
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          />
          <StatCard
            title="Success Rate"
            value={pricingStats ? `${Math.round(pricingStats.success_rate_percentage)}%` : `${Math.round((completedJobs / Math.max(jobs.length, 1)) * 100)}%`}
            icon={<TrendingUp className="h-4 w-4 text-green-500" />}
          />
          <StatCard
            title="Avg Duration"
            value={pricingStats ? `${Math.round(pricingStats.avg_job_duration_minutes)}m` : `${Math.round(avgDuration / 60000)}m`}
            icon={<Clock className="h-4 w-4 text-gray-500" />}
          />
        </div>

        {/* API Usage & Success Dashboard */}
        {apiStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                API Usage & Success Metrics (24h)
              </CardTitle>
              <CardDescription>
                Real-time monitoring of JustTCG API performance and usage patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  title="Total Requests"
                  value={apiStats.total_requests}
                  icon={<Zap className="h-4 w-4 text-blue-500" />}
                />
                <StatCard
                  title="Success Rate"
                  value={`${Math.round(apiStats.success_rate)}%`}
                  icon={<CheckCircle className="h-4 w-4 text-green-500" />}
                />
                <StatCard
                  title="Avg Response"
                  value={`${Math.round(apiStats.avg_response_time)}ms`}
                  icon={<Clock className="h-4 w-4 text-orange-500" />}
                />
                <StatCard
                  title="Requests/Hour"
                  value={apiStats.requests_last_hour}
                  icon={<Activity className="h-4 w-4 text-purple-500" />}
                />
                <StatCard
                  title="Errors/Hour"
                  value={apiStats.errors_last_hour}
                  icon={<XCircle className="h-4 w-4 text-red-500" />}
                />
              </div>

              {/* 💰 Enterprise Plan Cost Analysis */}
              <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="font-medium mb-2 flex items-center gap-2">
                      <span className="text-green-600">💰</span>
                      Enterprise Cost Analysis:
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Cards per $1: ~{Math.round((apiStats.total_requests * 30) / 99 * 1000) || 5050} cards
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Est. monthly cost: ${Math.round((apiStats.monthly_requests || 0) / 500000 * 99 * 100) / 100}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium mb-2">Monthly Usage Limits:</div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>Monthly:</span>
                        <span className={apiStats.monthly_requests > 500000 ? 'text-red-600' : 'text-green-600'}>
                          {(apiStats.monthly_requests || 0).toLocaleString()} / 500K
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>Daily:</span>
                        <span className={apiStats.daily_requests > 50000 ? 'text-red-600' : 'text-green-600'}>
                          {(apiStats.daily_requests || 0).toLocaleString()} / 50K
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                        <span>Hourly:</span>
                        <span className={apiStats.requests_last_hour > 500 ? 'text-red-600' : 'text-green-600'}>
                          {apiStats.requests_last_hour} / 500 (using 400 limit)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium mb-2">Performance Metrics:</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {apiStats.success_rate >= 95 ? 
                          <CheckCircle className="h-3 w-3 text-green-500" /> : 
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                        }
                        <span className="text-xs">Success Rate: {apiStats.success_rate >= 95 ? 'Excellent' : apiStats.success_rate >= 90 ? 'Good' : 'Poor'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {apiStats.avg_response_time <= 2000 ? 
                          <CheckCircle className="h-3 w-3 text-green-500" /> : 
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                        }
                        <span className="text-xs">Response Time: {apiStats.avg_response_time <= 2000 ? 'Fast' : 'Slow'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="text-xs">Lookup Priority: variantId → tcgplayerId → search</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* System Health Status */}
        {systemHealth && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                🔍 System Health Check Results
              </CardTitle>
              <CardDescription>
                Comprehensive system status including circuit breakers, retry queues, and job history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Circuit Breaker Status */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Circuit Breaker Status
                  </h4>
                  {systemHealth.circuit_breaker_status.length > 0 ? (
                    <div className="space-y-2">
                      {systemHealth.circuit_breaker_status.map((breaker: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <span className="text-sm">{breaker.game}</span>
                          <Badge variant={breaker.state === 'closed' ? 'outline' : 'destructive'}>
                            {breaker.state}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-green-600 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      All circuit breakers healthy
                    </div>
                  )}
                </div>

                {/* Retry Queue */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry Queue Status
                  </h4>
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-sm">Pending Retries</span>
                    <Badge variant={systemHealth.retry_queue_size > 100 ? 'destructive' : 'outline'}>
                      {systemHealth.retry_queue_size}
                    </Badge>
                  </div>
                </div>

                {/* Last Successful Runs */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Last Successful Runs
                  </h4>
                  <div className="space-y-2">
                    {systemHealth.last_successful_runs.map((run: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <span className="text-sm">{getGameDisplayName(run.game)}</span>
                        <div className="text-right">
                          {run.lastRun ? (
                            <>
                              <div className="text-xs text-green-600">Success</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(run.lastRun).toLocaleString()}
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-orange-600">No recent success</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stuck Jobs */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Stuck Jobs
                  </h4>
                  {systemHealth.stuck_jobs.length > 0 ? (
                    <div className="space-y-2">
                      {systemHealth.stuck_jobs.map((job: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
                          <span className="text-sm">{job.game}</span>
                          <Badge variant="destructive">Stuck 60min+</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-green-600 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      No stuck jobs detected
                    </div>
                  )}
                </div>
              </div>

              {/* Health Summary */}
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Overall System Status:</span>
                  <Badge variant={
                    systemHealth.stuck_jobs.length === 0 && 
                    systemHealth.retry_queue_size < 100 &&
                    systemHealth.circuit_breaker_status.every((b: any) => b.state === 'closed')
                      ? 'outline' : 'destructive'
                  }>
                    {systemHealth.stuck_jobs.length === 0 && 
                     systemHealth.retry_queue_size < 100 &&
                     systemHealth.circuit_breaker_status.every((b: any) => b.state === 'closed')
                      ? '✅ Healthy' : '⚠️ Needs Attention'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cron Jobs Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Automated Scheduling Status
            </CardTitle>
            <CardDescription>
              Current status of enabled cron jobs for automated pricing updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cronJobs.length > 0 ? (
              <div className="space-y-3">
                {cronJobs.map((job, index) => (
                  <div key={job.job_id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${job.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <div className="font-medium text-sm">{job.job_name}</div>
                        <div className="text-xs text-muted-foreground">Schedule: {job.schedule}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={job.active ? "outline" : "secondary"} className={job.active ? "text-green-600 border-green-200 bg-green-50" : ""}>
                        {job.active ? "Active" : "Inactive"}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">ID: {job.job_id}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No automated cron jobs found</p>
                <p className="text-xs">Cron jobs may need to be enabled via migration</p>
              </div>
            )}
            
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <div className="text-sm">
                <div className="font-medium mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Enabled Schedules:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>• Pokémon EN: Daily at 2:00 AM UTC</div>
                  <div>• Pokémon JP: Daily at 3:00 AM UTC</div>
                  <div>• MTG: Daily at 4:00 AM UTC</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Scheduled Jobs
            </CardTitle>
            <CardDescription>
              Automated pricing refresh schedules for each game
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Pokémon EN */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Pokémon EN</CardTitle>
                  <CardDescription>Daily at 2:00 AM UTC</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Batches:</span>
                      <span className="font-medium">~45</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Duration:</span>
                      <span className="font-medium">8-12min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Run:</span>
                      <span className="font-medium">Success</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => triggerPricingRefresh('pokemon')}
                    disabled={invoking === 'pokemon' || runningJobs > 0}
                    size="sm"
                    className="w-full gap-2"
                  >
                    {invoking === 'pokemon' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Run Now
                  </Button>
                </CardContent>
              </Card>

              {/* Pokémon JP */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Pokémon JP</CardTitle>
                  <CardDescription>Daily at 3:00 AM UTC</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Batches:</span>
                      <span className="font-medium">~35</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Duration:</span>
                      <span className="font-medium">6-10min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Run:</span>
                      <span className="font-medium">Success</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => triggerPricingRefresh('pokemon-japan')}
                    disabled={invoking === 'pokemon-japan' || runningJobs > 0}
                    size="sm"
                    className="w-full gap-2"
                  >
                    {invoking === 'pokemon-japan' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Run Now
                  </Button>
                </CardContent>
              </Card>

              {/* MTG */}
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">MTG</CardTitle>
                  <CardDescription>Daily at 4:00 AM UTC</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Batches:</span>
                      <span className="font-medium">~120</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Est. Duration:</span>
                      <span className="font-medium">20-30min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Run:</span>
                      <span className="font-medium">Pending</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => triggerPricingRefresh('mtg')}
                    disabled={invoking === 'mtg' || runningJobs > 0}
                    size="sm"
                    className="w-full gap-2"
                  >
                    {invoking === 'mtg' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Run Now
                  </Button>
                </CardContent>
              </Card>
            </div>
            
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Scheduled jobs run automatically via cron. Manual runs via "Run Now" buttons are immediate but subject to API rate limits.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Health Status */}
        {healthStatus && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                API Configuration Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Status:</span>
                  <Badge variant={healthStatus.success ? "outline" : "destructive"} className={healthStatus.success ? "text-green-600 border-green-200 bg-green-50" : ""}>
                    {healthStatus.success ? "Healthy" : "Error"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      {healthStatus.checks?.api_key_configured ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">API Key</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      {healthStatus.checks?.api_connection ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">Connection</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      {healthStatus.checks?.games_accessible ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">Games API</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-1">
                      {healthStatus.checks?.variants_accessible ? 
                        <CheckCircle className="h-4 w-4 text-green-500" /> : 
                        <XCircle className="h-4 w-4 text-red-500" />
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">Variants API</div>
                  </div>
                </div>

                {!healthStatus.success && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{healthStatus.message}</p>
                  </div>
                )}

                {healthStatus.games && (
                  <div className="text-sm">
                    <div className="font-medium mb-2">Available Games:</div>
                    <div className="grid grid-cols-3 gap-2">
                      {healthStatus.games.map((game: any) => (
                        <div key={game.slug} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${game.supported ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs">{game.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Pricing Jobs
            </CardTitle>
            <CardDescription>
              Status of recent and ongoing pricing refresh jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pricing jobs found
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground flex items-center justify-between">
                  <div>
                    <kbd className="px-2 py-1 text-xs bg-muted rounded">R</kbd> Refresh • <kbd className="px-2 py-1 text-xs bg-muted rounded">J/K</kbd> Navigate rows
                  </div>
                  <div aria-live="polite" aria-atomic="true">
                    {runningJobs > 0 && `${runningJobs} job${runningJobs === 1 ? '' : 's'} running`}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                     <TableHeader>
                       <TableRow>
                         <TableHead>Game</TableHead>
                         <TableHead>Status</TableHead>
                         <TableHead>Progress</TableHead>
                         <TableHead>Batches</TableHead>
                         <TableHead>Processed</TableHead>
                         <TableHead>Updated</TableHead>
                         <TableHead>Duration</TableHead>
                         <TableHead>Started</TableHead>
                         <TableHead>Error</TableHead>
                         <TableHead>Actions</TableHead>
                       </TableRow>
                     </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">
                            {getGameDisplayName(job.game)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(job.status)}
                              {getStatusBadge(job.status, job.id)}
                            </div>
                          </TableCell>
                           <TableCell>
                             <div className="w-24">
                               <Progress value={calculateProgress(job)} className="h-2" />
                               <div className="text-xs text-muted-foreground mt-1">
                                 {calculateProgress(job)}%
                                 {job.status === 'running' && (
                                   <span className="ml-1 text-blue-600">●</span>
                                 )}
                               </div>
                             </div>
                           </TableCell>
                          <TableCell>
                            {job.actual_batches} / {job.expected_batches}
                          </TableCell>
                          <TableCell>{job.cards_processed}</TableCell>
                          <TableCell>{job.variants_updated}</TableCell>
                          <TableCell>
                            {formatDuration(job.started_at, job.finished_at)}
                          </TableCell>
                           <TableCell>
                             {new Date(job.started_at).toLocaleString()}
                           </TableCell>
                           <TableCell>
                             {job.error ? (
                               <div className="max-w-xs">
                                 <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-xs">
                                   {job.error.includes('API key') ? 'API Key Missing' : 
                                    job.error.includes('authentication failed') ? 'Auth Failed' :
                                    job.error.length > 30 ? `${job.error.substring(0, 30)}...` : job.error}
                                 </Badge>
                               </div>
                             ) : (
                               <span className="text-muted-foreground text-sm">-</span>
                             )}
                           </TableCell>
                           <TableCell>
                            {job.status === 'running' && (
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => forceStopJob(job.id)}
                                  disabled={cancelling === job.id}
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                >
                                  {cancelling === job.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Square className="h-3 w-3" />
                                  )}
                                  Force Stop
                                </Button>
                                <Button
                                  onClick={() => adminCancelJob(job.id)}
                                  disabled={cancelling === job.id}
                                  variant="destructive"
                                  size="sm"
                                  className="gap-2"
                                >
                                  {cancelling === job.id ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
                                  Admin Cancel
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}