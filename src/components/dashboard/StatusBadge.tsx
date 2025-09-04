import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'danger' | 'info' | 'healthy' | 'error' | 'pending' | 'processing';
  icon?: LucideIcon;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ status, icon: Icon, children, size = 'md', className }: StatusBadgeProps) {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'success':
      case 'healthy':
        return 'default';
      case 'warning':
      case 'pending':
        return 'secondary';
      case 'danger':
      case 'error':
        return 'destructive';
      case 'info':
      case 'processing':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'healthy':
        return 'text-success';
      case 'warning':
      case 'pending':
        return 'text-warning';
      case 'danger':
      case 'error':
        return 'text-danger';
      case 'info':
      case 'processing':
        return 'text-info';
      default:
        return 'text-muted-foreground';
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-1 gap-1';
      case 'lg':
        return 'text-sm px-3 py-1.5 gap-2';
      default:
        return 'text-xs px-2.5 py-1 gap-1.5';
    }
  };

  return (
    <Badge 
      variant={getStatusVariant(status)}
      className={cn(
        "inline-flex items-center font-medium",
        getSizeClasses(size),
        className
      )}
    >
      {Icon && (
        <Icon 
          className={cn(
            getStatusColor(status),
            size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'
          )} 
        />
      )}
      {children}
    </Badge>
  );
}