import { useEffect, useState } from "react";
import { RefreshCw, Clock, CheckCircle, XCircle, TrendingUp, Activity, AlertTriangle, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/ui/stat-card";
import { PageHeader } from "@/components/shell/PageHeader";
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

export function PricingMonitorPage() {
  const [jobs, setJobs] = useState<PricingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoking, setInvoking] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const fetchJobs = async () => {
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
    
    // Adaptive polling: faster when jobs are active
    const hasRunningOrCancelling = runningJobs > 0 || cancelling !== null;
    const pollInterval = hasRunningOrCancelling ? 5000 : 30000;
    
    const interval = setInterval(fetchJobs, pollInterval);
    return () => clearInterval(interval);
  }, [runningJobs, cancelling]);

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
        onClick={fetchJobs}
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Refresh
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
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Jobs"
            value={runningJobs}
            icon={<Activity className="h-4 w-4 text-blue-500" />}
          />
          <StatCard
            title="Completed Today"
            value={completedJobs}
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
          />
          <StatCard
            title="Failed Jobs"
            value={failedJobs}
            icon={<XCircle className="h-4 w-4 text-red-500" />}
          />
          <StatCard
            title="Avg Duration"
            value={`${Math.round(avgDuration / 60000)}m`}
            icon={<Clock className="h-4 w-4 text-gray-500" />}
          />
        </div>

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