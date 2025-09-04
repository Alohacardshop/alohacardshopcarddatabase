import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface DateRangePickerProps {
  date?: DateRange;
  onDateChange?: (date: DateRange | undefined) => void;
  presets?: boolean;
  compareToggle?: boolean;
  onCompareToggle?: (enabled: boolean) => void;
  className?: string;
}

export function DateRangePicker({
  date,
  onDateChange,
  presets = true,
  compareToggle = false,
  onCompareToggle,
  className
}: DateRangePickerProps) {
  const [isCompareEnabled, setIsCompareEnabled] = useState(false);

  const presetRanges = [
    {
      label: "Today",
      getValue: () => ({
        from: new Date(),
        to: new Date(),
      }),
    },
    {
      label: "Last 7 days",
      getValue: () => ({
        from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
    },
    {
      label: "Last 30 days",
      getValue: () => ({
        from: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
    },
    {
      label: "Last 90 days",
      getValue: () => ({
        from: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000),
        to: new Date(),
      }),
    },
  ];

  const handleCompareToggle = () => {
    const newState = !isCompareEnabled;
    setIsCompareEnabled(newState);
    onCompareToggle?.(newState);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {presets && (
              <div className="border-r p-3 space-y-1">
                <div className="text-sm font-medium mb-2">Presets</div>
                {presetRanges.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start font-normal"
                    onClick={() => onDateChange?.(preset.getValue())}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={onDateChange}
              numberOfMonths={2}
              className="p-3"
            />
          </div>
          
          {compareToggle && (
            <div className="border-t p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isCompareEnabled}
                  onChange={handleCompareToggle}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                />
                <span className="text-sm font-medium">Compare to previous period</span>
              </label>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {isCompareEnabled && (
        <Badge variant="secondary" className="ml-2">
          Comparing enabled
        </Badge>
      )}
    </div>
  );
}