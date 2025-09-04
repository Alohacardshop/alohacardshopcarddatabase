import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

export function StatCard({ title, value, icon, trend, className }: StatCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <p className={cn(
                "text-xs",
                trend.positive ? "text-green-600" : "text-red-600"
              )}>
                {trend.value}
              </p>
            )}
          </div>
          {icon && (
            <div className="p-2 bg-muted rounded-lg">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}