import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Copy,
  ArrowDown,
  Pause,
  X,
  RefreshCw,
  ChevronDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

interface LogsDrawerProps {
  jobId?: string;
  jobName?: string;
  jobStatus?: string;
  children: React.ReactNode;
}

export function LogsDrawer({ jobId, jobName, jobStatus, children }: LogsDrawerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [wordWrap, setWordWrap] = useState(true);
  const { toast } = useToast();

  const fetchLogs = async () => {
    if (!jobId) return;
    
    setLoading(true);
    try {
      // Mock logs for demonstration
      const mockLogs: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Starting pricing refresh job for ${jobName}`,
        },
        {
          id: '2',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Fetching variant batches from JustTCG API...',
        },
        {
          id: '3',
          timestamp: new Date().toISOString(),
          level: 'debug',
          message: 'Processing batch 1/500: variants 1-100',
        },
      ];
      setLogs(mockLogs);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch job logs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      fetchLogs();
    }
  }, [jobId]);

  const copyLogs = () => {
    const logText = logs
      .map((log) => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
      .join('\n');
    
    navigator.clipboard.writeText(logText);
    toast({
      title: 'Copied',
      description: 'Logs copied to clipboard',
    });
  };

  const scrollToBottom = () => {
    const element = document.getElementById('logs-container');
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-destructive';
      case 'warn':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'info':
        return 'text-primary';
      case 'debug':
        return 'text-muted-foreground';
      default:
        return 'text-foreground';
    }
  };

  const getLevelBadge = (level: string) => {
    const variants = {
      error: 'destructive',
      warn: 'outline',
      info: 'default',
      debug: 'secondary',
    } as const;

    return (
      <Badge 
        variant={variants[level as keyof typeof variants] || 'secondary'} 
        className="text-xs font-mono w-12 justify-center"
      >
        {level.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl flex flex-col h-full">
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-2 text-left">
            <FileText className="h-5 w-5" />
            Job Logs: {jobName || 'Unknown Job'}
          </SheetTitle>
          <SheetDescription className="flex items-center justify-between">
            <span>Real-time logs for job {jobId}</span>
            {jobStatus && (
              <Badge variant="outline" className="text-xs">
                {jobStatus}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Controls */}
        <div className="flex items-center gap-2 py-3 border-b shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={copyLogs}
            disabled={logs.length === 0}
          >
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWordWrap(!wordWrap)}
          >
            <ChevronDown className="h-4 w-4 mr-1" />
            {wordWrap ? 'No Wrap' : 'Word Wrap'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={scrollToBottom}
            disabled={logs.length === 0}
          >
            <ArrowDown className="h-4 w-4 mr-1" />
            Jump to Latest
          </Button>

          {jobStatus === 'running' && (
            <>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="outline" size="sm">
                <Pause className="h-4 w-4 mr-1" />
                Pause Job
              </Button>
            </>
          )}
        </div>

        {/* Logs Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-2">No logs available</h3>
              <p className="text-sm text-muted-foreground">Logs will appear here as the job runs</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div id="logs-container" className="p-4 space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="shrink-0 pt-0.5">
                      {getLevelBadge(log.level)}
                    </div>
                    <div className="shrink-0 font-mono text-xs text-muted-foreground pt-1 w-24">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                    <div className={`flex-1 min-w-0 text-sm ${getLevelColor(log.level)}`}>
                      <pre
                        className={`font-mono ${
                          wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'
                        }`}
                      >
                        {log.message}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}