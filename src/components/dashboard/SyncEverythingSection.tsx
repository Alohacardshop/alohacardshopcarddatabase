import { useState } from 'react';
import { Zap, Clock, AlertTriangle, Database, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SyncAllConfirmation } from './SyncAllConfirmation';
import { SyncAllProgress } from './SyncAllProgress';

interface SyncEverythingSectionProps {
  onStartSync?: () => void;
}

export function SyncEverythingSection({ onStartSync }: SyncEverythingSectionProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartSync = async () => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowConfirmation(false);
      setSyncInProgress(true);
      onStartSync?.();
    } catch (error) {
      console.error('Failed to start sync:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncComplete = () => {
    setSyncInProgress(false);
  };

  const stats = [
    { label: 'Games', value: '4', icon: Database },
    { label: 'Est. Products', value: '98K+', icon: Activity },
    { label: 'API Calls', value: '~420', icon: Zap },
    { label: 'Duration', value: '15-20m', icon: Clock }
  ];

  if (syncInProgress) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            Sync All Operation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SyncAllProgress 
            isActive={syncInProgress} 
            onComplete={handleSyncComplete} 
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Zap className="w-6 h-6 text-primary" />
              Sync Everything
            </CardTitle>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Master Operation
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Action */}
          <div className="text-center space-y-4">
            <Button
              size="lg"
              onClick={() => setShowConfirmation(true)}
              className="h-12 px-8 text-lg font-medium bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg"
            >
              <Zap className="w-5 h-5 mr-2" />
              🔄 Sync All Products & Pricing
            </Button>
            
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Comprehensive sync across all games, cards, and sealed products with real-time pricing updates
            </p>
          </div>

          <Separator />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-3 rounded-lg bg-background/50 border">
                <stat.icon className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="font-bold text-lg">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Warning Notice */}
          <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-warning">High Impact Operation</p>
              <p className="text-sm text-muted-foreground">
                This will update ~100,000+ products and use ~420 API calls. 
                Estimated completion time: <strong>15-20 minutes</strong>.
              </p>
            </div>
          </div>

          {/* Game List */}
          <div className="space-y-3">
            <h4 className="font-medium">Included Games & Products</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { name: 'Pokémon EN', count: '~25,000 cards' },
                { name: 'Pokémon JP', count: '~20,000 cards' },
                { name: 'Magic: The Gathering', count: '~30,000 cards' },
                { name: 'Yu-Gi-Oh', count: '~15,000 cards' },
                { name: 'Sealed Products', count: '~8,000 products' }
              ].map((game, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <span className="font-medium text-sm">{game.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {game.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Clock className="w-4 h-4 mr-1" />
              View Schedule
            </Button>
            <Button variant="outline" size="sm">
              <Database className="w-4 h-4 mr-1" />
              Check API Usage
            </Button>
            <Button variant="outline" size="sm">
              <Activity className="w-4 h-4 mr-1" />
              Job History
            </Button>
          </div>
        </CardContent>
      </Card>

      <SyncAllConfirmation
        open={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={handleStartSync}
        isLoading={isLoading}
      />
    </>
  );
}