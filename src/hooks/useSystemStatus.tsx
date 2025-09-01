import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SystemStatus {
  isHealthy: boolean;
  activeJobs: number;
  apiLatency: number | null;
  lastHealthCheck: Date | null;
  errorMessage?: string;
}

export const useSystemStatus = () => {
  const [status, setStatus] = useState<SystemStatus>({
    isHealthy: false,
    activeJobs: 0,
    apiLatency: null,
    lastHealthCheck: null,
  });
  
  const [isLoading, setIsLoading] = useState(true);

  const checkSystemHealth = async () => {
    try {
      const startTime = Date.now();
      
      // Check active jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('sync_jobs')
        .select('id')
        .in('status', ['running', 'queued']);
      
      if (jobsError) throw jobsError;
      
      // Simple DB ping test
      const { error: pingError } = await supabase
        .from('games')
        .select('id')
        .limit(1);
      
      if (pingError) throw pingError;
      
      const latency = Date.now() - startTime;
      
      setStatus({
        isHealthy: true,
        activeJobs: jobs?.length || 0,
        apiLatency: latency,
        lastHealthCheck: new Date(),
      });
      
    } catch (error) {
      setStatus({
        isHealthy: false,
        activeJobs: 0,
        apiLatency: null,
        lastHealthCheck: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial check
    checkSystemHealth();
    
    // Check every 30 seconds
    const interval = setInterval(checkSystemHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { status, isLoading, refresh: checkSystemHealth };
};