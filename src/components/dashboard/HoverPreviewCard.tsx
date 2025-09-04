import { useState, useRef } from "react";
import { ExternalLink, TrendingUp, TrendingDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { StatusBadge } from "./StatusBadge";
import { SparklineChart } from "./SparklineChart";

interface ProductPreview {
  id: string;
  name: string;
  image_url?: string;
  current_price_cents: number;
  price_range_low_cents?: number;
  price_range_high_cents?: number;
  conditions?: string[];
  game_name?: string;
  set_name?: string;
  rarity?: string;
  price_trend?: number[];
  percentage_change?: number;
  last_updated?: string;
}

interface HoverPreviewCardProps {
  product: ProductPreview;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

export function HoverPreviewCard({ 
  product, 
  children, 
  side = "top" 
}: HoverPreviewCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getPriceChangeIcon = (change?: number) => {
    if (!change) return null;
    return change > 0 ? 
      <TrendingUp className="w-3 h-3 text-success" /> : 
      <TrendingDown className="w-3 h-3 text-danger" />;
  };

  const getPriceChangeColor = (change?: number) => {
    if (!change) return "text-muted-foreground";
    return change > 0 ? "text-success" : "text-danger";
  };

  return (
    <HoverCard 
      open={isOpen} 
      onOpenChange={setIsOpen}
      openDelay={300}
      closeDelay={150}
    >
      <HoverCardTrigger asChild>
        <span className="cursor-pointer hover:text-primary transition-colors underline-offset-4 hover:underline">
          {children}
        </span>
      </HoverCardTrigger>
      
      <HoverCardContent 
        side={side} 
        className="w-80 p-0 animate-scale-in"
        sideOffset={8}
      >
        <Card className="border-0 shadow-lg">
          <CardContent className="p-0">
            {/* Header with image */}
            <div className="relative">
              {product.image_url ? (
                <div className="aspect-video relative overflow-hidden rounded-t-lg">
                  <img 
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  
                  {/* Price change overlay */}
                  {product.percentage_change && (
                    <div className="absolute top-2 right-2">
                      <StatusBadge 
                        status={product.percentage_change > 0 ? 'success' : 'danger'}
                        icon={product.percentage_change > 0 ? TrendingUp : TrendingDown}
                      >
                        {product.percentage_change > 0 ? '+' : ''}{product.percentage_change.toFixed(1)}%
                      </StatusBadge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg">
                  <Eye className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Title and metadata */}
              <div>
                <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                  {product.name}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                  {product.game_name && (
                    <Badge variant="outline" className="text-xs">
                      {product.game_name}
                    </Badge>
                  )}
                  {product.set_name && (
                    <span>{product.set_name}</span>
                  )}
                  {product.rarity && (
                    <Badge variant="secondary" className="text-xs">
                      {product.rarity}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Price information */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Price</span>
                  <div className="flex items-center gap-1">
                    <span className="text-lg font-bold">
                      {formatPrice(product.current_price_cents)}
                    </span>
                    {getPriceChangeIcon(product.percentage_change)}
                  </div>
                </div>

                {/* Price range */}
                {product.price_range_low_cents && product.price_range_high_cents && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Price Range</span>
                    <span>
                      {formatPrice(product.price_range_low_cents)} - {formatPrice(product.price_range_high_cents)}
                    </span>
                  </div>
                )}

                {/* Price trend sparkline */}
                {product.price_trend && product.price_trend.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">7-Day Trend</span>
                    <SparklineChart 
                      data={product.price_trend}
                      width={60}
                      height={20}
                      showDots={false}
                    />
                  </div>
                )}
              </div>

              {/* Conditions available */}
              {product.conditions && product.conditions.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Available Conditions</p>
                  <div className="flex flex-wrap gap-1">
                    {product.conditions.slice(0, 4).map((condition, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {condition}
                      </Badge>
                    ))}
                    {product.conditions.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{product.conditions.length - 4} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  View Details
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  External Link
                </Button>
              </div>

              {/* Last updated */}
              {product.last_updated && (
                <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                  Updated {new Date(product.last_updated).toLocaleString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </HoverCardContent>
    </HoverCard>
  );
}