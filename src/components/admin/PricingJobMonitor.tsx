import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
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

export function PricingJobMonitor() {
  const [jobs, setJobs] = useState<PricingJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    try {
      // Use RPC to bypass schema restrictions since ops.pricing_job_runs isn't in types
      const { data: jobsData, error } = await supabase.rpc('get_pricing_jobs_recent');

      if (error) {
        console.error('Error fetching pricing jobs:', error);
        // Fallback to empty array for now
        setJobs([]);
      } else {
        setJobs(jobsData || []);
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
      <Card>
        <CardHeader>
          <CardTitle>Pricing Job Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading pricing jobs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pricing Job Monitor</CardTitle>
          <CardDescription>Monitor nightly variant pricing refresh jobs</CardDescription>
          <div className="flex gap-2">
            <Button onClick={() => triggerPricingRefresh('pokemon')} size="sm">
              Refresh Pokemon
            </Button>
            <Button onClick={() => triggerPricingRefresh('pokemon-japan')} size="sm">
              Refresh Pokemon Japan
            </Button>
            <Button onClick={() => triggerPricingRefresh('mtg')} size="sm">
              Refresh MTG
            </Button>
            <Button onClick={fetchJobs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No pricing jobs found. Click a refresh button to start one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Cards</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium capitalize">
                      {job.game.replace('-', ' ')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        {getStatusBadge(job.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {job.expected_batches > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min((job.actual_batches / job.expected_batches) * 100, 100)}%`
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {job.actual_batches}/{job.expected_batches}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{job.cards_processed.toLocaleString()}</TableCell>
                    <TableCell>{job.variants_updated.toLocaleString()}</TableCell>
                    <TableCell>{formatDuration(job.started_at, job.finished_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(job.started_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>Nightly cron jobs for automatic pricing updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Pokemon EN</h4>
              <p className="text-sm text-muted-foreground">Daily at 00:00 UTC</p>
              <p className="text-xs text-muted-foreground mt-1">~115 batches</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Pokemon Japan</h4>
              <p className="text-sm text-muted-foreground">Daily at 00:02 UTC</p>
              <p className="text-xs text-muted-foreground mt-1">~74 batches</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold">Magic: The Gathering</h4>
              <p className="text-sm text-muted-foreground">Daily at 00:04 UTC</p>
              <p className="text-xs text-muted-foreground mt-1">~250 batches</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}