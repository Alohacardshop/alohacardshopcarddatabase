import { 
  Database, 
  Bell, 
  Zap, 
  TrendingUp, 
  Package, 
  Search,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface EmptyStateProps {
  type: 'products' | 'alerts' | 'jobs' | 'analytics' | 'search' | 'general';
  title?: string;
  description?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  showStats?: boolean;
  className?: string;
}

export function EnhancedEmptyState({
  type,
  title,
  description,
  primaryAction,
  secondaryAction,
  showStats = false,
  className = ""
}: EmptyStateProps) {
  const getEmptyStateConfig = (type: string) => {
    switch (type) {
      case 'products':
        return {
          icon: <Package className="w-16 h-16 text-muted-foreground/50" />,
          defaultTitle: "No products synchronized",
          defaultDescription: "Start by syncing your first batch of products to see pricing data and analytics.",
          defaultPrimary: {
            label: "Sync Products",
            icon: <Database className="w-4 h-4" />
          },
          defaultSecondary: {
            label: "View Documentation", 
            icon: <ArrowRight className="w-4 h-4" />
          },
          stats: [
            { label: "Games Available", value: "3" },
            { label: "Avg Sync Time", value: "2 min" },
            { label: "Success Rate", value: "98%" }
          ]
        };
      
      case 'alerts':
        return {
          icon: <Bell className="w-16 h-16 text-muted-foreground/50" />,
          defaultTitle: "No price alerts configured",
          defaultDescription: "Set up price alerts to get notified when your favorite cards hit target prices or show significant movement.",
          defaultPrimary: {
            label: "Create First Alert",
            icon: <Bell className="w-4 h-4" />
          },
          defaultSecondary: {
            label: "Browse Popular Cards",
            icon: <TrendingUp className="w-4 h-4" />
          },
          stats: [
            { label: "Alert Types", value: "3" },
            { label: "Avg Response", value: "< 1 min" },
            { label: "Accuracy Rate", value: "99%" }
          ]
        };

      case 'jobs':
        return {
          icon: <Zap className="w-16 h-16 text-muted-foreground/50" />,
          defaultTitle: "No pricing jobs running",
          defaultDescription: "Pricing jobs sync card data and update market prices. Run your first test to see how it works.",
          defaultPrimary: {
            label: "Run Test Job",
            icon: <Zap className="w-4 h-4" />
          },
          defaultSecondary: {
            label: "Schedule Automatic Sync",
            icon: <ArrowRight className="w-4 h-4" />
          },
          stats: [
            { label: "Processing Speed", value: "500/min" },
            { label: "Queue Limit", value: "1,000" },
            { label: "Retry Logic", value: "Auto" }
          ]
        };

      case 'analytics':
        return {
          icon: <TrendingUp className="w-16 h-16 text-muted-foreground/50" />,
          defaultTitle: "No analytics data available",
          defaultDescription: "Analytics appear after products are synced and price data becomes available. Sync some products first.",
          defaultPrimary: {
            label: "Sync Data First",
            icon: <Database className="w-4 h-4" />
          },
          defaultSecondary: {
            label: "View Sample Dashboard",
            icon: <ArrowRight className="w-4 h-4" />
          },
          stats: [
            { label: "Chart Types", value: "5" },
            { label: "Data Retention", value: "1 year" },
            { label: "Export Formats", value: "CSV, JSON" }
          ]
        };

      case 'search':
        return {
          icon: <Search className="w-16 h-16 text-muted-foreground/50" />,
          defaultTitle: "No search results found",
          defaultDescription: "Try adjusting your search terms or check if the products you're looking for have been synced yet.",
          defaultPrimary: {
            label: "Clear Filters",
            icon: <Search className="w-4 h-4" />
          },
          defaultSecondary: {
            label: "Sync More Data",
            icon: <Database className="w-4 h-4" />
          },
          stats: []
        };

      default:
        return {
          icon: <Sparkles className="w-16 h-16 text-muted-foreground/50" />,
          defaultTitle: "Nothing to display",
          defaultDescription: "This section will populate with data as you use the system.",
          defaultPrimary: {
            label: "Get Started",
            icon: <ArrowRight className="w-4 h-4" />
          },
          stats: []
        };
    }
  };

  const config = getEmptyStateConfig(type);

  return (
    <Card className={`border-dashed border-2 ${className}`}>
      <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center">
        {/* Icon */}
        <div className="mb-6 p-4 rounded-full bg-muted/30">
          {config.icon}
        </div>

        {/* Title and Description */}
        <h3 className="text-xl font-semibold text-foreground mb-3">
          {title || config.defaultTitle}
        </h3>
        
        <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
          {description || config.defaultDescription}
        </p>

        {/* Quick Stats */}
        {showStats && config.stats && config.stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 w-full max-w-md">
            {config.stats.map((stat, index) => (
              <div key={index} className="text-center p-3 rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-semibold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
          {primaryAction && (
            <Button 
              onClick={primaryAction.onClick}
              className="flex-1 h-11"
            >
              {primaryAction.icon || config.defaultPrimary?.icon}
              {primaryAction.label}
            </Button>
          )}

          {secondaryAction && (
            <Button 
              variant="outline"
              onClick={secondaryAction.onClick}
              className="flex-1 h-11"
            >
              {secondaryAction.icon || config.defaultSecondary?.icon}
              {secondaryAction.label}
            </Button>
          )}

          {/* Default actions if none provided */}
          {!primaryAction && config.defaultPrimary && (
            <Button className="flex-1 h-11">
              {config.defaultPrimary.icon}
              {config.defaultPrimary.label}
            </Button>
          )}

          {!secondaryAction && config.defaultSecondary && !primaryAction && (
            <Button variant="outline" className="flex-1 h-11">
              {config.defaultSecondary.icon}
              {config.defaultSecondary.label}
            </Button>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-info-muted rounded-lg w-full max-w-md">
          <p className="text-sm text-info">
            💡 <strong>Pro tip:</strong> Use the floating action button (bottom right) for quick actions, 
            or press <Badge variant="outline" className="mx-1 px-2 py-0.5 text-xs">Cmd+K</Badge> 
            to open the command palette.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}