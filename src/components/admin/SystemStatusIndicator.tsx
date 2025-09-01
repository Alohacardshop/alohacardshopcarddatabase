import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { cn } from '@/lib/utils';

export const SystemStatusIndicator = () => {
  const { status, isLoading, refresh } = useSystemStatus();

  const getStatusIcon = () => {
    if (isLoading) return <Clock className="h-3 w-3 animate-pulse" />;
    if (!status.isHealthy) return <AlertCircle className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  const getStatusColor = () => {
    if (isLoading) return 'secondary';
    if (!status.isHealthy) return 'destructive';
    return 'default';
  };

  const getStatusText = () => {
    if (isLoading) return 'Checking...';
    if (!status.isHealthy) return 'Degraded';
    return 'Healthy';
  };

  const formatLatency = (ms: number | null) => {
    if (!ms) return 'N/A';
    return `${ms}ms`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* System Health Badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getStatusColor()}
            className="flex items-center gap-1 cursor-help"
          >
            {getStatusIcon()}
            <span className="hidden sm:inline">{getStatusText()}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-sm">
            <div>Status: {getStatusText()}</div>
            {status.apiLatency && (
              <div>Latency: {formatLatency(status.apiLatency)}</div>
            )}
            {status.lastHealthCheck && (
              <div>Last check: {status.lastHealthCheck.toLocaleTimeString()}</div>
            )}
            {status.errorMessage && (
              <div className="text-destructive">Error: {status.errorMessage}</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Active Jobs Indicator */}
      {status.activeJobs > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {status.activeJobs}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {status.activeJobs} active job{status.activeJobs !== 1 ? 's' : ''}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Refresh Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            className="h-6 w-6 p-0"
          >
            <RefreshCw className={cn(
              "h-3 w-3",
              isLoading && "animate-spin"
            )} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Refresh system status
        </TooltipContent>
      </Tooltip>
    </div>
  );
};