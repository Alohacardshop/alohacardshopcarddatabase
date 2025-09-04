import { useState, useEffect } from 'react';
import { Activity, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SyncStep {
  game: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  jobId?: string;
  error?: string;
  startTime?: string;
  endTime?: string;
}

interface SyncProgressData {
  totalSteps: number;
  currentStep: number;
  currentGame: string;
  status: 'starting' | 'syncing' | 'waiting' | 'completed' | 'error';
  results: Record<string, SyncStep>;
  estimatedTimeRemaining: number;
  cardsProcessed: number;
}

interface SyncAllProgressProps {
  isActive: boolean;
  onComplete?: () => void;
}

export function SyncAllProgress({ isActive, onComplete }: SyncAllProgressProps) {
  const [progress, setProgress] = useState<SyncProgressData>({
    totalSteps: 5,
    currentStep: 0,
    currentGame: '',
    status: 'starting',
    results: {},
    estimatedTimeRemaining: 1200, // 20 minutes
    cardsProcessed: 0
  });
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!isActive) return;

    // Initialize progress
    const initialResults: Record<string, SyncStep> = {
      'pokemon': { game: 'pokemon', name: 'Pokémon EN', status: 'pending' },
      'pokemon-japan': { game: 'pokemon-japan', name: 'Pokémon JP', status: 'pending' },
      'mtg': { game: 'mtg', name: 'Magic: The Gathering', status: 'pending' },
      'yugioh': { game: 'yugioh', name: 'Yu-Gi-Oh', status: 'pending' },
      'sealed-products': { game: 'sealed-products', name: 'Sealed Products', status: 'pending' }
    };

    setProgress(prev => ({
      ...prev,
      results: initialResults
    }));

    addLog('🚀 Initializing sync-all operation...');
    addLog('📊 Checking API usage limits...');
    
    // Simulate progress updates
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev.status === 'completed') {
          clearInterval(progressTimer);
          onComplete?.();
          return prev;
        }

        const newProgress = { ...prev };
        
        // Update estimated time remaining
        if (newProgress.estimatedTimeRemaining > 0) {
          newProgress.estimatedTimeRemaining = Math.max(0, newProgress.estimatedTimeRemaining - 1);
        }

        // Simulate step progression
        const gameKeys = Object.keys(newProgress.results);
        const currentGameKey = gameKeys[newProgress.currentStep];
        
        if (currentGameKey && newProgress.status !== 'completed') {
          const currentResult = newProgress.results[currentGameKey];
          
          if (currentResult.status === 'pending') {
            newProgress.results[currentGameKey] = {
              ...currentResult,
              status: 'running',
              startTime: new Date().toISOString()
            };
            newProgress.currentGame = currentResult.name;
            newProgress.status = 'syncing';
            addLog(`🎯 Starting ${currentResult.name} sync...`);
          } else if (currentResult.status === 'running') {
            // Randomly complete after some time
            if (Math.random() < 0.1) {
              newProgress.results[currentGameKey] = {
                ...currentResult,
                status: 'completed',
                endTime: new Date().toISOString(),
                jobId: `job_${Math.random().toString(36).substr(2, 9)}`
              };
              newProgress.cardsProcessed += Math.floor(Math.random() * 5000) + 2000;
              addLog(`✅ ${currentResult.name} sync completed successfully`);
              
              if (newProgress.currentStep < newProgress.totalSteps - 1) {
                newProgress.currentStep++;
                newProgress.status = 'waiting';
                addLog(`⏱️ Waiting 30 seconds before next sync...`);
              } else {
                newProgress.status = 'completed';
                addLog('🎉 All syncs completed successfully!');
              }
            }
          }
        }

        return newProgress;
      });
    }, 1000);

    return () => clearInterval(progressTimer);
  }, [isActive, onComplete]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="default">Running</Badge>;
      case 'completed':
        return <Badge className="bg-success text-success-foreground">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const progressPercentage = (progress.currentStep / progress.totalSteps) * 100;
  const completedCount = Object.values(progress.results).filter(r => r.status === 'completed').length;

  if (!isActive) return null;

  return (
    <div className="space-y-6">
      {/* Main Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Sync All Games Progress
            </CardTitle>
            <Badge variant={progress.status === 'completed' ? 'default' : 'secondary'}>
              {progress.status === 'completed' ? 'Completed' : 'In Progress'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overall Progress */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Overall Progress ({completedCount}/{progress.totalSteps})
              </span>
              <span className="text-sm text-muted-foreground">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Current Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Current Game</p>
              <p className="font-medium">{progress.currentGame || 'Initializing...'}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Cards Processed</p>
              <p className="font-medium">{progress.cardsProcessed.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Time Remaining</p>
              <p className="font-medium">{formatTime(progress.estimatedTimeRemaining)}</p>
            </div>
          </div>

          {/* Step Details */}
          <div className="space-y-3">
            <h4 className="font-medium">Sync Steps</h4>
            {Object.values(progress.results).map((step, index) => (
              <div
                key={step.game}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(step.status)}
                  <div>
                    <p className="font-medium">{step.name}</p>
                    {step.jobId && (
                      <p className="text-xs text-muted-foreground">Job ID: {step.jobId}</p>
                    )}
                    {step.error && (
                      <p className="text-xs text-destructive">{step.error}</p>
                    )}
                  </div>
                </div>
                {getStatusBadge(step.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Live Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Live Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            <div className="space-y-1 font-mono text-xs">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">Waiting for logs...</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="text-muted-foreground">
                    {log}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}