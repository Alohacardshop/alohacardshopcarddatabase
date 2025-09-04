import { useState } from "react";
import { Search, Filter, Download, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FilterOption {
  key: string;
  label: string;
  value: string;
}

interface SearchFilterBarProps {
  placeholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onExportCsv?: () => void;
  showExport?: boolean;
  filterOptions?: FilterOption[];
  activeFilters?: FilterOption[];
  onFilterChange?: (filters: FilterOption[]) => void;
  className?: string;
}

export function SearchFilterBar({
  placeholder = "Search...",
  searchValue = "",
  onSearchChange,
  onExportCsv,
  showExport = true,
  filterOptions = [],
  activeFilters = [],
  onFilterChange,
  className
}: SearchFilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterAdd = (key: string, value: string) => {
    const newFilter = filterOptions.find(f => f.key === key && f.value === value);
    if (newFilter && !activeFilters.some(f => f.key === key && f.value === value)) {
      onFilterChange?.([...activeFilters, newFilter]);
    }
  };

  const handleFilterRemove = (filterToRemove: FilterOption) => {
    onFilterChange?.(activeFilters.filter(f => 
      !(f.key === filterToRemove.key && f.value === filterToRemove.value)
    ));
  };

  const clearAllFilters = () => {
    onFilterChange?.([]);
  };

  // Group filter options by key
  const groupedFilters = filterOptions.reduce((acc, filter) => {
    if (!acc[filter.key]) acc[filter.key] = [];
    acc[filter.key].push(filter);
    return acc;
  }, {} as Record<string, FilterOption[]>);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main search and action bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {filterOptions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-2",
                showFilters && "bg-accent"
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          )}

          {showExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {activeFilters.map((filter, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="flex items-center gap-1"
            >
              <span className="text-xs text-muted-foreground">{filter.key}:</span>
              {filter.label}
              <button
                onClick={() => handleFilterRemove(filter)}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {activeFilters.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs h-6"
            >
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Filter panel */}
      {showFilters && filterOptions.length > 0 && (
        <div className="p-4 border rounded-lg bg-card animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(groupedFilters).map(([key, options]) => (
              <div key={key}>
                <label className="text-sm font-medium text-foreground mb-2 block capitalize">
                  {key.replace('_', ' ')}
                </label>
                <Select onValueChange={(value) => handleFilterAdd(key, value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={`Select ${key}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option, index) => (
                      <SelectItem key={index} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}