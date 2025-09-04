import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  variant?: 'text' | 'card' | 'table' | 'circular' | 'button';
  width?: string;
  height?: string;
  rows?: number;
  className?: string;
}

export function LoadingSkeleton({
  variant = 'text',
  width = 'w-full',
  height = 'h-4',
  rows = 3,
  className
}: LoadingSkeletonProps) {
  const baseClasses = "bg-muted animate-shimmer rounded relative overflow-hidden";
  
  // Shimmer overlay effect
  const shimmerOverlay = (
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
  );

  if (variant === 'text') {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn(baseClasses, width, height)}>
            {shimmerOverlay}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={cn("p-6 space-y-4", className)}>
        <div className={cn(baseClasses, "w-3/4 h-6")}>
          {shimmerOverlay}
        </div>
        <div className="space-y-3">
          <div className={cn(baseClasses, "w-full h-4")}>
            {shimmerOverlay}
          </div>
          <div className={cn(baseClasses, "w-2/3 h-4")}>
            {shimmerOverlay}
          </div>
        </div>
        <div className={cn(baseClasses, "w-1/3 h-8 rounded-md")}>
          {shimmerOverlay}
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn("space-y-2", className)}>
        {/* Table header */}
        <div className="flex space-x-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn(baseClasses, "flex-1 h-10")}>
              {shimmerOverlay}
            </div>
          ))}
        </div>
        
        {/* Table rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex space-x-4">
            {Array.from({ length: 4 }).map((_, colIndex) => (
              <div key={colIndex} className={cn(baseClasses, "flex-1 h-8")}>
                {shimmerOverlay}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'circular') {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className={cn(baseClasses, "w-24 h-24 rounded-full")}>
          {shimmerOverlay}
        </div>
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <div className={cn(baseClasses, "w-24 h-10 rounded-md", className)}>
        {shimmerOverlay}
      </div>
    );
  }

  return (
    <div className={cn(baseClasses, width, height, className)}>
      {shimmerOverlay}
    </div>
  );
}