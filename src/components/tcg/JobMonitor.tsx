import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@supabase/supabase-js';
import { Loader2, AlertCircle, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

interface SyncJob {
  id: string;
  type: string;
  game_slug: string;
  set_code: string;
  status: string;
  progress: number;
  total: number;
  results: any;
  error_details: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

export function JobMonitor() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
    
    // Set up real-time subscription for job updates
    const subscription = supabase
      .channel('sync_jobs')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'sync_jobs' },
        (payload) => {
          console.log('Job update:', payload);
          fetchJobs(); // Refresh jobs list
        }
      )
      .subscribe();

    // Refresh every 10 seconds
    const interval = setInterval(fetchJobs, 10000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch sync jobs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge variant="secondary">Running</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const formatDuration = (startedAt: string, completedAt: string) => {
    if (!startedAt) return 'N/A';
    
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    
    if (diffMin > 0) {
      return `${diffMin}m ${diffSec % 60}s`;
    }
    return `${diffSec}s`;
  };

  const getProgressPercentage = (progress: number, total: number) => {
    if (!total || total === 0) return 0;
    return Math.round((progress / total) * 100);
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
                <AlertCircle className="h-5 w-5" />
                Sync Job Monitor
              </CardTitle>
              <CardDescription>
                Real-time monitoring of synchronization operations
              </CardDescription>
            </div>
            <Button 
              onClick={fetchJobs} 
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Jobs Found
              </h3>
              <p className="text-muted-foreground">
                Sync jobs will appear here once you start synchronizing data
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Results</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        {getStatusIcon(job.status)}
                        {job.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {job.game_slug && (
                          <div>Game: <code className="bg-muted px-1 rounded">{job.game_slug}</code></div>
                        )}
                        {job.set_code && (
                          <div>Set: <code className="bg-muted px-1 rounded">{job.set_code}</code></div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(job.status)}
                    </TableCell>
                    <TableCell>
                      {job.total > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={getProgressPercentage(job.progress, job.total)} 
                              className="w-16" 
                            />
                            <span className="text-sm text-muted-foreground">
                              {job.progress}/{job.total}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getProgressPercentage(job.progress, job.total)}%
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDuration(job.started_at, job.completed_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {job.results ? (
                        <div className="text-xs space-y-1">
                          {job.results.synced_count !== undefined && (
                            <div>✓ {job.results.synced_count} synced</div>
                          )}
                          {job.results.error_count > 0 && (
                            <div className="text-red-500">✗ {job.results.error_count} errors</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Job Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {jobs.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Jobs
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {jobs.filter(j => j.status === 'running').length}
              </div>
              <div className="text-sm text-muted-foreground">
                Running
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {jobs.filter(j => j.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">
                Completed
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {jobs.filter(j => j.status === 'failed').length}
              </div>
              <div className="text-sm text-muted-foreground">
                Failed
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}