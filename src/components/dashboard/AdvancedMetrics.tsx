import { useState } from "react";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PerformanceMetrics } from "./PerformanceMetrics";

interface AdvancedMetricsProps {
  className?: string;
}

export function AdvancedMetrics({ className = "" }: AdvancedMetricsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-0 h-auto hover:bg-transparent"
              >
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <BarChart3 className="w-4 h-4" />
                  Advanced Performance Metrics
                </CardTitle>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground mb-4">
                Detailed performance metrics including response times, sync speeds, success rates, and throughput trends.
              </p>
              
              <PerformanceMetrics 
                isLive={true}
                className="animate-fade-in"
              />
              
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  These metrics update every 2 seconds. For more detailed analysis, visit the System Health tab.
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}