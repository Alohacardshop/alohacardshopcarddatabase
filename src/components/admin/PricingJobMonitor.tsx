import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle, Calendar, Info as InfoIcon } from "lucide-react";
import { toast } from "sonner";

interface PricingJob {
  id: string;
  game_name: string;
  total_batches: number;
  batches_processed: number;
  batches_failed: number;
  started_at: string;
  finished_at: string | null;
  status: string;
  error: string | null;
}

export function PricingJobMonitor() {
  const [jobs, setJobs] = useState<PricingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      // Temporarily bypass type system since new function isn't in types yet
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
    try {
      const { data, error } = await supabase.functions.invoke('justtcg-refresh-variants', {
        body: { game }
      });

      if (error) {
        throw error;
      }
      
      if (data?.success) {
        toast.success(`Pricing refresh started for ${game}`);
        setTimeout(fetchJobs, 1000); // Refresh after 1 second
      } else {
        toast.error(data?.error || 'Failed to start pricing refresh');
      }
    } catch (error) {
      console.error('Error triggering pricing refresh:', error);
      toast.error('Failed to trigger pricing refresh');
    }
  };

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'started':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'ok':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'preflight_ceiling':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      started: 'default',
      ok: 'default',
      error: 'destructive',
      preflight_ceiling: 'secondary'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatDuration = (startedAt: string, finishedAt: string | null) => {
    const start = new Date(startedAt);
    const end = finishedAt ? new Date(finishedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    return `${diffMins}m ${diffSecs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sticky Action Bar */}
      <div className="sticky top-2 z-40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 rounded-lg border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">Manual Pricing Refresh</h2>
            <p className="text-sm text-muted-foreground">Trigger immediate variant pricing updates</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => triggerPricingRefresh('pokemon')}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Pokémon EN</span>
              <span className="sm:hidden">EN</span>
            </Button>
            <Button 
              onClick={() => triggerPricingRefresh('pokemon-japan')}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Pokémon JP</span>
              <span className="sm:hidden">JP</span>
            </Button>
            <Button 
              onClick={() => triggerPricingRefresh('mtg')}
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              MTG
            </Button>
            <Button 
              onClick={fetchJobs}
              variant="outline" 
              size="sm"
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Job List */}
      <Card className="min-h-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <CardTitle>Recent Pricing Jobs</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {jobs.length} jobs
            </Badge>
          </div>
          <CardDescription>
            Status of recent and ongoing pricing refresh jobs
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-2">No pricing jobs found</h3>
              <p className="text-sm text-muted-foreground mb-4">Start a refresh to see job progress here</p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background border-b z-10">
                    <TableRow>
                      <TableHead className="w-[120px]">Game</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[140px]">Progress</TableHead>
                      <TableHead className="w-[80px] text-right">Batches</TableHead>
                      <TableHead className="w-[80px] text-right">Processed</TableHead>
                      <TableHead className="w-[80px] text-right">Failed</TableHead>
                      <TableHead className="w-[100px]">Duration</TableHead>
                      <TableHead className="min-w-[140px]">Started</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-mono">
                            {job.game_name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            {getStatusBadge(job.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span className="font-mono">
                                {job.batches_processed}/{job.total_batches || 0}
                              </span>
                            </div>
                            <Progress 
                              value={job.total_batches ? (job.batches_processed / job.total_batches) * 100 : 0} 
                              className="h-2"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {job.total_batches || 0}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {job.batches_processed || 0}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {job.batches_failed || 0}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatDuration(job.started_at, job.finished_at)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {new Date(job.started_at).toLocaleString()}
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

      {/* Scheduled Jobs Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription>
            Automatic pricing update schedules for different games
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground">Pokémon EN</h4>
                <Badge variant="secondary" className="text-xs">Daily</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Runs every night at <span className="font-mono">00:00 UTC</span>
                </p>
                <div className="text-xs text-muted-foreground">
                  Avg: ~500-1000 batches per run
                </div>
                <div className="text-xs font-mono text-primary">
                  Next: Tonight at 00:00
                </div>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground">Pokémon Japan</h4>
                <Badge variant="secondary" className="text-xs">Daily</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Runs every night at <span className="font-mono">01:00 UTC</span>
                </p>
                <div className="text-xs text-muted-foreground">
                  Avg: ~300-600 batches per run
                </div>
                <div className="text-xs font-mono text-primary">
                  Next: Tonight at 01:00
                </div>
              </div>
            </div>
            
            <div className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors sm:col-span-2 xl:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground">Magic: The Gathering</h4>
                <Badge variant="secondary" className="text-xs">Daily</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Runs every night at <span className="font-mono">02:00 UTC</span>
                </p>
                <div className="text-xs text-muted-foreground">
                  Avg: ~1000-2000 batches per run
                </div>
                <div className="text-xs font-mono text-primary">
                  Next: Tonight at 02:00
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t mt-6">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <InfoIcon className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Scheduled jobs run automatically via edge functions. Manual triggers above will start additional refresh cycles 
                that run independently of the nightly schedule.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}