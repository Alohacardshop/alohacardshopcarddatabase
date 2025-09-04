import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, MoreHorizontal, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { StatusBadge } from "./StatusBadge";
import { SearchFilterBar } from "./SearchFilterBar";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
  mobileHidden?: boolean;
}

interface EnhancedDataTableProps {
  data: any[];
  columns: Column[];
  loading?: boolean;
  searchable?: boolean;
  exportable?: boolean;
  pagination?: boolean;
  stickyHeader?: boolean;
  mobileCards?: boolean;
  emptyState?: {
    title: string;
    description: string;
    action?: React.ReactNode;
  };
  className?: string;
  onRowClick?: (row: any) => void;
  onExport?: () => void;
}

export function EnhancedDataTable({
  data,
  columns,
  loading = false,
  searchable = true,
  exportable = true,
  pagination = true,
  stickyHeader = true,
  mobileCards = true,
  emptyState,
  className,
  onRowClick,
  onExport
}: EnhancedDataTableProps) {
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchQuery) {
      filtered = data.filter(row =>
        columns.some(col => {
          const value = row[col.key];
          return value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
        })
      );
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchQuery, sortColumn, sortDirection]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!pagination) return filteredAndSortedData;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedData, currentPage, itemsPerPage, pagination]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);

  const handleSort = (columnKey: string) => {
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {searchable && <div className="h-10 bg-muted animate-pulse rounded" />}
        <LoadingSkeleton variant="table" rows={itemsPerPage} />
      </div>
    );
  }

  // Empty state
  if (!data.length) {
    return (
      <div className="text-center py-12">
        <div className="max-w-md mx-auto">
          <h3 className="text-lg font-medium text-foreground mb-2">
            {emptyState?.title || "No data available"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {emptyState?.description || "There's nothing to display right now."}
          </p>
          {emptyState?.action}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and export controls */}
      {(searchable || exportable) && (
        <SearchFilterBar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          onExportCsv={onExport}
          showExport={exportable}
          placeholder={`Search ${data.length} items...`}
        />
      )}

      {/* Mobile card view */}
      {mobileCards && (
        <div className="block md:hidden space-y-3">
          {paginatedData.map((row, index) => (
            <div
              key={index}
              className="p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((column) => {
                if (column.mobileHidden) return null;
                const value = row[column.key];
                return (
                  <div key={column.key} className="flex justify-between items-center py-1">
                    <span className="text-sm text-muted-foreground">{column.label}:</span>
                    <div className="text-sm font-medium">
                      {column.render ? column.render(value, row) : value}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Desktop table view */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={stickyHeader ? "sticky top-0 bg-background z-10" : ""}>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap",
                      column.sortable && "cursor-pointer hover:bg-accent/50 select-none",
                      column.className
                    )}
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <div className="flex flex-col">
                          <ChevronUp 
                            className={cn(
                              "w-3 h-3 -mb-1",
                              sortColumn === column.key && sortDirection === "asc" 
                                ? "text-primary" 
                                : "text-muted-foreground"
                            )} 
                          />
                          <ChevronDown 
                            className={cn(
                              "w-3 h-3",
                              sortColumn === column.key && sortDirection === "desc" 
                                ? "text-primary" 
                                : "text-muted-foreground"
                            )} 
                          />
                        </div>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, index) => (
                <TableRow
                  key={index}
                  className={cn(
                    "hover:bg-accent/50 transition-colors",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show:</span>
            <Select 
              value={itemsPerPage.toString()} 
              onValueChange={(value) => {
                setItemsPerPage(parseInt(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span>of {formatNumber(filteredAndSortedData.length)} items</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            >
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={i}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8"
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}