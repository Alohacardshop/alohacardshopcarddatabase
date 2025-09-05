import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, RefreshCw, Trash2, Eye, Loader2 } from 'lucide-react';

interface StuckJob {
  source: string;
  id: string;
  game: string;
  status: string;
  started_at: string;
  duration_minutes: number;
  details: string;
}

export function EmergencyControls() {
  const [loading, setLoading] = useState(false);
  const [stuckJobs, setStuckJobs] = useState<StuckJob[]>([]);
  const [showStuckJobs, setShowStuckJobs] = useState(false);
  const { toast } = useToast();

  const killStuckJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('kill_stuck_jobs' as any, {
        p_max_runtime_minutes: 120
      });

      if (error) throw error;

      const result = data as {
        pricing_jobs_killed: number;
        sync_jobs_failed: number;
        queue_cancelled: number;
      };

      toast({
        title: "Stuck Jobs Terminated",
        description: `Killed ${result.pricing_jobs_killed} pricing jobs, failed ${result.sync_jobs_failed} sync jobs, cancelled ${result.queue_cancelled} queue items.`,
        variant: "destructive",
      });
      
      // Refresh stuck jobs view if open
      if (showStuckJobs) {
        await viewStuckJobs();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetSyncSystem = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('reset_sync_system' as any);

      if (error) throw error;

      const result = data as {
        queue_cleared: number;
        breakers_reset: number;
      };

      toast({
        title: "Sync System Reset",
        description: `System fully reset. Queue cleared (${result.queue_cleared} items), ${result.breakers_reset} circuit breakers reset.`,
        variant: "destructive",
      });
      
      // Clear stuck jobs view
      setStuckJobs([]);
      setShowStuckJobs(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const viewStuckJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_stuck_jobs' as any, {
        p_max_runtime_minutes: 120
      });

      if (error) throw error;

      const stuckJobsData = (data as StuckJob[]) || [];
      setStuckJobs(stuckJobsData);
      setShowStuckJobs(true);
      
      if (stuckJobsData.length === 0) {
        toast({
          title: "No Stuck Jobs",
          description: "No jobs running longer than 2 hours found.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Emergency Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {/* Kill Stuck Jobs */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="bg-red-600 hover:bg-red-700"
                  disabled={loading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  KILL ALL STUCK JOBS
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive">Kill All Stuck Jobs?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will immediately terminate all jobs running longer than 2 hours and mark them as failed. 
                    This action cannot be undone but will unblock the sync system.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={killStuckJobs}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Killing Jobs...
                      </>
                    ) : (
                      'Kill Stuck Jobs'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Reset Sync System */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="bg-orange-600 hover:bg-orange-700"
                  disabled={loading}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reset Sync System
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-orange-600">Reset Entire Sync System?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will cancel ALL running jobs, clear the job queue, and reset circuit breakers. 
                    Use this as a nuclear option to completely restart the sync system.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={resetSyncSystem}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      'Reset System'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* View Stuck Jobs */}
            <Button 
              variant="outline"
              onClick={viewStuckJobs}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              View Stuck Jobs
            </Button>
          </div>

          {/* Stuck Jobs Table */}
          {showStuckJobs && (
            <div className="mt-6">
              <h3 className="text-lg font-medium mb-3">
                Stuck Jobs (Running &gt; 2 hours)
                <Badge variant="secondary" className="ml-2">{stuckJobs.length}</Badge>
              </h3>
              
              {stuckJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Game</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stuckJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <Badge variant={job.source === 'pricing' ? 'default' : 'secondary'}>
                            {job.source}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{job.game}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{job.status}</Badge>
                        </TableCell>
                        <TableCell className="text-red-600 font-medium">
                          {formatDuration(job.duration_minutes)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(job.started_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">{job.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No stuck jobs found. System appears healthy!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}