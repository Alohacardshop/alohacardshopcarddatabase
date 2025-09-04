interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDots?: boolean;
  className?: string;
}

export function SparklineChart({
  data,
  width = 60,
  height = 20,
  color = "hsl(var(--primary))",
  strokeWidth = 1.5,
  showDots = false,
  className = ""
}: SparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div 
        className={`inline-block bg-muted/30 rounded ${className}`}
        style={{ width, height }}
      />
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Prevent division by zero

  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - strokeWidth);
    const y = height - strokeWidth - ((value - min) / range) * (height - strokeWidth * 2);
    return `${x},${y}`;
  });

  const pathData = `M${points.join(' L')}`;

  // Determine trend color
  const isPositive = data[data.length - 1] >= data[0];
  const trendColor = isPositive ? "hsl(var(--success))" : "hsl(var(--danger))";
  const finalColor = color === "hsl(var(--primary))" ? trendColor : color;

  return (
    <svg
      width={width}
      height={height}
      className={`inline-block ${className}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Gradient definition */}
      <defs>
        <linearGradient id={`gradient-${data.length}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={finalColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={finalColor} stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* Fill area */}
      <path
        d={`${pathData} L${width - strokeWidth},${height - strokeWidth} L${strokeWidth / 2},${height - strokeWidth} Z`}
        fill={`url(#gradient-${data.length})`}
        stroke="none"
      />

      {/* Line */}
      <path
        d={pathData}
        fill="none"
        stroke={finalColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="drop-shadow-sm"
      />

      {/* Dots */}
      {showDots && points.map((point, index) => {
        const [x, y] = point.split(',').map(Number);
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r={strokeWidth}
            fill={finalColor}
            className="drop-shadow-sm"
          />
        );
      })}
    </svg>
  );
}