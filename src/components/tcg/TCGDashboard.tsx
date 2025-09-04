import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Database, Zap, Activity, AlertCircle } from 'lucide-react';
import { SystemOverview } from './SystemOverview';
import { GamesManager } from './GamesManager';
import { SetsManager } from './SetsManager';
import { JobMonitor } from './JobMonitor';

export function TCGDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            TCG Database Service
          </h1>
          <p className="text-xl text-muted-foreground">
            High-performance Trading Card Game database with JustTCG API integration
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="games" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Games
            </TabsTrigger>
            <TabsTrigger value="sets" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Sets & Cards
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <SystemOverview />
          </TabsContent>

          <TabsContent value="games">
            <GamesManager />
          </TabsContent>

          <TabsContent value="sets">
            <SetsManager />
          </TabsContent>

          <TabsContent value="jobs">
            <JobMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}