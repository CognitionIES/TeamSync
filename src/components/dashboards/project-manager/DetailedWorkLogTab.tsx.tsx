import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Download, Search, ChevronLeft, ChevronRight, FileText, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import axios from 'axios';
import { toast } from 'sonner';
import type { DetailedWorkLogItem, DetailedWorkLogResponse, TaskTypeFilter } from '@/components/dashboards/team-lead/type';

interface DetailedWorkLogTabProps {
  selectedDate: Date;
}

const ITEMS_PER_PAGE = 100; // Backend default

export function DetailedWorkLogTab({ selectedDate }: DetailedWorkLogTabProps) {
  // State management
  const [data, setData] = useState<DetailedWorkLogItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filters & pagination
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch data from backend
  const fetchDetailedWorkLog = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params: Record<string, string | number> = {
        dateStart: format(selectedDate, 'yyyy-MM-dd'),
        dateEnd: format(selectedDate, 'yyyy-MM-dd'), // Same day for now
        limit: ITEMS_PER_PAGE,
        offset: (currentPage - 1) * ITEMS_PER_PAGE,
      };

      // Only add taskType if not "All"
      if (taskTypeFilter !== 'All') {
        params.taskType = taskTypeFilter;
      }

      const response = await axios.get<DetailedWorkLogResponse>('/api/metrics/detailed', {
        params,
      });

      setData(response.data.data);
      setTotalCount(response.data.totalCount);
    } catch (err) {
      const errorMessage = axios.isAxiosError(err)
        ? err.response?.data?.message || 'Failed to fetch detailed work log'
        : 'An unexpected error occurred';
      
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Detailed work log fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when filters change
  useEffect(() => {
    fetchDetailedWorkLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, taskTypeFilter, currentPage]);

  // Client-side search filtering
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data;

    const query = searchQuery.toLowerCase();
    return data.filter((item) =>
      item.lineNo.toLowerCase().includes(query) ||
      item.assignedTo.toLowerCase().includes(query) ||
      item.comments?.toLowerCase().includes(query) ||
      item.pid.toLowerCase().includes(query) ||
      item.areaNo.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  // CSV Export handler
  const handleExportCSV = () => {
    try {
      if (filteredData.length === 0) {
        toast.error('No data to export');
        return;
      }

      // Prepare CSV headers
      const headers = [
        'Area No.',
        'PID',
        'Line No.',
        'Assigned To',
        'Block Count',
        'Completed At',
        'Status',
        'Task Type',
        'Comments',
      ];

      // Prepare CSV rows
      const rows = filteredData.map((item) => [
        item.areaNo,
        item.pid,
        item.lineNo,
        item.assignedTo,
        item.blockCount.toString(),
        item.completedAt,
        item.status,
        item.taskType,
        item.comments || '',
      ]);

      // Create CSV content with proper escaping
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => {
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            const escaped = cell.toString().replace(/"/g, '""');
            return /[,"\n]/.test(cell) ? `"${escaped}"` : escaped;
          }).join(',')
        ),
      ].join('\n');

      // Create and download blob
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `detailed-work-log-${format(selectedDate, 'yyyy-MM-dd')}.csv`
      );
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('CSV exported successfully');
    } catch (err) {
      toast.error('Failed to export CSV');
      console.error('CSV export error:', err);
    }
  };

  // Status badge color mapping
  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('completed')) return 'default';
    if (statusLower.includes('progress')) return 'secondary';
    if (statusLower.includes('skipped')) return 'destructive';
    return 'outline';
  };

  // Task type badge color
  const getTaskTypeBadgeVariant = (taskType: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (taskType) {
      case 'UPV':
        return 'default';
      case 'QC':
        return 'secondary';
      case 'Redline':
        return 'destructive';
      case 'Rework':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Detailed Work Log</span>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportCSV}
              disabled={loading || filteredData.length === 0}
              size="sm"
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Filters Row */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Task Type Filter */}
          <Select
            value={taskTypeFilter}
            onValueChange={(value) => {
              setTaskTypeFilter(value as TaskTypeFilter);
              setCurrentPage(1); // Reset to first page on filter change
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Task Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              <SelectItem value="UPV">UPV</SelectItem>
              <SelectItem value="QC">QC</SelectItem>
              <SelectItem value="Redline">Redline</SelectItem>
              <SelectItem value="Rework">Rework</SelectItem>
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-[400px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search area, PID, line, assignee, comments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Results Count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredData.length} of {totalCount} items
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-8 text-destructive">
            <p className="mb-2">{error}</p>
            <Button onClick={fetchDetailedWorkLog} variant="outline" size="sm">
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredData.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">No work log entries found</p>
            <p className="text-sm mt-1">Try adjusting your filters or select a different date</p>
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && filteredData.length > 0 && (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Area No.</TableHead>
                    <TableHead>PID</TableHead>
                    <TableHead>Line No.</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Blocks</TableHead>
                    <TableHead>Completed At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="max-w-[200px]">Comments</TableHead>
                    <TableHead className="text-center">Audit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={`${item.workItemId}-${item.lineNo}`}>
                      <TableCell className="font-medium">{item.areaNo}</TableCell>
                      <TableCell className="font-mono text-sm">{item.pid}</TableCell>
                      <TableCell className="font-mono text-sm">{item.lineNo}</TableCell>
                      <TableCell>{item.assignedTo}</TableCell>
                      <TableCell className="text-right font-medium">{item.blockCount}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {item.completedAt}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTaskTypeBadgeVariant(item.taskType)}>
                          {item.taskType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.comments}>
                        {item.comments || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Navigate to audit view (implement based on your routing)
                            window.open(item.auditLink, '_blank');
                          }}
                          title="View audit trail"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({totalCount} total items)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={!hasPrevPage || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={!hasNextPage || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}