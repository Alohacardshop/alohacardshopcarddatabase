interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  backgroundColor?: string;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  color = "hsl(var(--success))",
  backgroundColor = "hsl(var(--muted))",
  showLabel = true,
  label,
  className = ""
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((value / max) * 100, 100);
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColorByValue = (percentage: number) => {
    if (percentage >= 80) return "hsl(var(--danger))";
    if (percentage >= 60) return "hsl(var(--warning))";
    return "hsl(var(--success))";
  };

  const progressColor = color === "hsl(var(--success))" ? getColorByValue(percentage) : color;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-20"
        />
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          style={{
            filter: percentage > 80 ? 'drop-shadow(0 0 6px hsl(var(--danger) / 0.5))' : undefined
          }}
        />
      </svg>
      
      {/* Center label */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: progressColor }}>
            {Math.round(percentage)}%
          </span>
          {label && (
            <span className="text-xs text-muted-foreground text-center px-2">
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}