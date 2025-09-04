import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Database, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface SyncAllConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function SyncAllConfirmation({ open, onClose, onConfirm, isLoading }: SyncAllConfirmationProps) {
  const [apiUsage, setApiUsage] = useState(0);
  const [dailyLimit] = useState(500);
  const [estimatedUsage] = useState(420);

  useEffect(() => {
    if (open) {
      // Simulate API usage check
      setApiUsage(Math.floor(Math.random() * 150) + 50);
    }
  }, [open]);

  const remainingRequests = dailyLimit - apiUsage;
  const canProceed = remainingRequests >= estimatedUsage;
  
  const syncSteps = [
    { name: 'Pokémon EN', cards: '~25,000 cards', time: '3-4 min' },
    { name: 'Pokémon JP', cards: '~20,000 cards', time: '3-4 min' },
    { name: 'Magic: The Gathering', cards: '~30,000 cards', time: '4-5 min' },
    { name: 'Yu-Gi-Oh', cards: '~15,000 cards', time: '2-3 min' },
    { name: 'Sealed Products', cards: '~8,000 products', time: '3-4 min' }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Confirm Sync All Operation
          </DialogTitle>
          <DialogDescription>
            This will trigger a comprehensive sync across all supported games and products.
            Please review the details below before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Impact Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="text-center">
              <Database className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Total Products</p>
              <p className="font-bold text-lg">~98,000</p>
            </div>
            <div className="text-center">
              <Zap className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">API Calls</p>
              <p className="font-bold text-lg">{estimatedUsage}</p>
            </div>
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-bold text-lg">15-20 min</p>
            </div>
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-warning" />
              <p className="text-sm text-muted-foreground">Priority</p>
              <p className="font-bold text-lg">High</p>
            </div>
          </div>

          {/* API Usage Check */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Daily API Usage</span>
              <Badge variant={canProceed ? 'default' : 'destructive'}>
                {apiUsage}/{dailyLimit} requests
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mb-2">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${(apiUsage / dailyLimit) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Used: {apiUsage}</span>
              <span>Remaining: {remainingRequests}</span>
            </div>
            {!canProceed && (
              <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
                <p className="text-sm text-destructive">
                  ⚠️ Insufficient API requests remaining. Need at least {estimatedUsage} requests.
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Sync Plan */}
          <div>
            <h4 className="font-medium mb-3">Sync Execution Plan</h4>
            <div className="space-y-2">
              {syncSteps.map((step, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{step.name}</p>
                      <p className="text-xs text-muted-foreground">{step.cards}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{step.time}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <h4 className="font-medium text-warning mb-2">⚠️ Important Notes</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• This operation will use significant API quota</li>
              <li>• Jobs will run with high priority, potentially delaying other operations</li>
              <li>• The process cannot be easily stopped once started</li>
              <li>• Database performance may be impacted during sync</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canProceed || isLoading}
            className="bg-primary"
          >
            {isLoading ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Starting Sync...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Start Sync All
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}