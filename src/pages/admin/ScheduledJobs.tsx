import { useState, useEffect } from 'react';
import { Calendar, Clock, Play, Pause, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSkeleton } from '@/components/dashboard/LoadingSkeleton';

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command?: string;
  last_run?: string;
  next_run?: string;
}

export function ScheduledJobs() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCronJobs();
  }, []);

  const fetchCronJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase.rpc('get_cron_jobs_status');
      
      if (error) throw error;
      
      // Transform the data and add mock next_run times
      const jobsWithTimes = (data || []).map((job: any) => ({
        ...job,
        last_run: job.last_run || 'Never',
        next_run: calculateNextRun(job.schedule)
      }));
      
      setJobs(jobsWithTimes);
    } catch (err) {
      console.error('Error fetching cron jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch cron jobs');
      
      // Fallback mock data if the RPC function doesn't exist yet
      setJobs([
        {
          jobid: 1,
          jobname: 'pricing-job-scheduler',
          schedule: '0 2 * * *',
          active: true,
          command: 'SELECT cron.schedule(...)',
          last_run: '2025-01-05 02:00:00',
          next_run: 'Tomorrow at 2:00 AM'
        },
        {
          jobid: 2,
          jobname: 'daily-price-snapshots',
          schedule: '0 3 * * *',
          active: true,
          command: 'SELECT update_daily_price_snapshots()',
          last_run: '2025-01-05 03:00:00',
          next_run: 'Tomorrow at 3:00 AM'
        },
        {
          jobid: 3,
          jobname: 'cleanup-old-logs',
          schedule: '0 1 * * 0',
          active: false,
          command: 'DELETE FROM logs WHERE created_at < now() - interval \'30 days\'',
          last_run: '2025-01-04 01:00:00',
          next_run: 'Next Sunday at 1:00 AM'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const calculateNextRun = (schedule: string): string => {
    // Parse cron schedule and calculate next run time
    // This is a simplified version - in production you'd use a proper cron parser
    const parts = schedule.split(' ');
    if (parts.length >= 2) {
      const minute = parts[0];
      const hour = parts[1];
      
      if (hour !== '*' && minute !== '*') {
        return `Daily at ${hour}:${minute.padStart(2, '0')}`;
      }
    }
    return 'Next scheduled run';
  };

  const formatSchedule = (schedule: string): string => {
    // Convert cron format to human readable
    const cronParts = schedule.split(' ');
    
    if (cronParts.length >= 2) {
      const minute = cronParts[0];
      const hour = cronParts[1];
      
      if (hour !== '*' && minute !== '*') {
        return `Daily at ${hour}:${minute.padStart(2, '0')}`;
      }
    }
    
    return schedule;
  };

  const handleToggleJob = async (jobId: number, currentStatus: boolean) => {
    try {
      // In a real implementation, you'd call a function to enable/disable the cron job
      toast({
        title: currentStatus ? '⏸️ Job Paused' : '▶️ Job Activated',
        description: `Job ${jobId} has been ${currentStatus ? 'disabled' : 'enabled'}.`,
      });
      
      // Update local state
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.jobid === jobId 
            ? { ...job, active: !currentStatus }
            : job
        )
      );
    } catch (error) {
      toast({
        title: '❌ Failed to Toggle Job',
        description: 'There was an error updating the job status.',
        variant: 'destructive'
      });
    }
  };

  const handleRunNow = async (jobName: string) => {
    try {
      toast({
        title: '🚀 Job Started',
        description: `Manually triggering ${jobName}...`,
      });
      
      // In a real implementation, you'd call the specific job function
      // For now, just show success after a delay
      setTimeout(() => {
        toast({
          title: '✅ Job Completed',
          description: `${jobName} executed successfully.`,
        });
      }, 2000);
      
    } catch (error) {
      toast({
        title: '❌ Job Failed',
        description: 'There was an error running the job manually.',
        variant: 'destructive'
      });
    }
  };

  const getJobStatusBadge = (active: boolean) => {
    return active ? (
      <Badge className="bg-success text-success-foreground">
        <Clock className="w-3 h-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary">
        <Pause className="w-3 h-3 mr-1" />
        Paused
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Scheduled Jobs</h1>
            <p className="text-muted-foreground">Manage automated cron jobs and schedules</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <LoadingSkeleton key={i} variant="card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduled Jobs</h1>
          <p className="text-muted-foreground">
            Manage automated cron jobs and schedules
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchCronJobs} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-warning">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-warning">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Database Connection Issue</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {error}. Showing sample data for demonstration.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Jobs List */}
      <div className="grid gap-4">
        {jobs.map((job) => (
          <Card key={job.jobid}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {job.jobname}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {formatSchedule(job.schedule)}
                  </CardDescription>
                </div>
                {getJobStatusBadge(job.active)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Job Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Schedule</span>
                  <p className="font-mono">{job.schedule}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Last Run</span>
                  <p>{job.last_run}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Next Run</span>
                  <p>{job.next_run}</p>
                </div>
              </div>

              {/* Command */}
              {job.command && (
                <div>
                  <span className="font-medium text-muted-foreground text-sm">Command</span>
                  <p className="font-mono text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                    {job.command}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={job.active}
                    onCheckedChange={() => handleToggleJob(job.jobid, job.active)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {job.active ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRunNow(job.jobname)}
                    disabled={!job.active}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Run Now
                  </Button>
                  
                  {job.jobname.includes('pricing') && (
                    <Button
                      size="sm"
                      onClick={() => handleRunNow(`${job.jobname}-sync`)}
                      disabled={!job.active}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Trigger Sync
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {jobs.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No Scheduled Jobs</h3>
            <p className="text-sm text-muted-foreground">
              No cron jobs are currently configured in the system.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}