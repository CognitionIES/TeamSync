import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StatusBadge from "./StatusBadge";
import { Task, TaskStatus, TaskType } from "@/types";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  ArrowUpDown,
  Clock,
  RefreshCw,
  Filter,
  Users,
  Calendar,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TaskTableProps {
  tasks: Task[];
  teamMembers?: string[];
  showFilters?: boolean;
  showProgress?: boolean;
  showCurrentWork?: boolean;
  showComments?: boolean;
  showProjectName?: boolean;
  showAreaName?: boolean;
  showPidNumber?: boolean;
  loading?: boolean;
  onViewCurrentWork?: (taskId: string, userId: string) => void;
  onViewComments?: (taskId: string) => void;
}

const truncateText = (text: string, maxLength: number = 20) => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

const getCurrentWork = (task: Task): string => {
  if (task.status === "Completed") return "Completed";

  const pidItem = task.items.find((item) => item.type === "PID");
  if (pidItem) return `P&ID ${pidItem.name}`;

  const lineItem = task.items.find((item) => item.type === "Line");
  if (lineItem) return `Line ${lineItem.name}`;

  const equipmentItem = task.items.find((item) => item.type === "Equipment");
  if (equipmentItem) return `Equipment ${equipmentItem.name}`;

  const instrumentItem = task.items.find(
    (item) => item.type === "NonInlineInstrument"
  );
  if (instrumentItem) return `Instrument ${instrumentItem.name}`;

  return "No active items";
};

const formatDateTime = (dateStr: string | null, label: string): string => {
  if (!dateStr) return `Not ${label}`;
  try {
    const date = parseISO(dateStr);
    const offsetMinutes = 5 * 60 + 30;
    const adjustedDate = new Date(date.getTime() + offsetMinutes * 60 * 1000);
    return (
      adjustedDate.toLocaleString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + ""
    );
  } catch (error) {
    console.error(`Invalid date format: ${dateStr}`, error);
    return "Invalid Date";
  }
};

const TableSkeleton = () => (
  <div className="space-y-3">
    <div className="flex space-x-3">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="h-9 w-32 bg-gray-100 rounded-md animate-pulse"
        />
      ))}
    </div>
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/50">
            {[...Array(6)].map((_, index) => (
              <TableHead key={index} className="p-3">
                <div className="h-4 bg-gray-100 rounded animate-pulse" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(4)].map((_, index) => (
            <TableRow key={index}>
              {[...Array(6)].map((_, cellIndex) => (
                <TableCell key={cellIndex} className="p-3">
                  <div className="h-4 bg-gray-100 rounded animate-pulse" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  teamMembers,
  showFilters,
  showCurrentWork,
  showComments = false,
  showProjectName = false,
  showAreaName = false,
  showPidNumber = false,
  loading = false,
  onViewCurrentWork,
  onViewComments,
}) => {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "All">("All");
  const [filterType, setFilterType] = useState<TaskType | "All">("All");
  const [filterAssignee, setFilterAssignee] = useState<string | "All">("All");
  const [sortColumn, setSortColumn] =
    useState<keyof (typeof rows)[0]>("assignedTime");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const tasksPerPage = 20;

  const filteredTasks = tasks.filter((task) => {
    const statusMatch = filterStatus === "All" || task.status === filterStatus;
    const typeMatch = filterType === "All" || task.type === filterType;
    const assigneeMatch =
      filterAssignee === "All" || task.assignee === filterAssignee;
    return statusMatch && typeMatch && assigneeMatch;
  });

  const rows = filteredTasks.map((task) => {
    const parseSafeDate = (dateStr: string | null) => {
      if (!dateStr) return null;
      try {
        return parseISO(dateStr);
      } catch (error) {
        console.error(`Invalid date format: ${dateStr}`, error);
        return null;
      }
    };

    const updatedAt = parseSafeDate(task.updatedAt);
    const completedAt = parseSafeDate(task.completedAt);

    const assignedTime = formatDateTime(task.createdAt, "Assigned");
    const completedTime = formatDateTime(task.completedAt, "Completed");

    // Calculate completed lines and total lines
    const lineItems = task.items.filter((item) => item.type === "Line");
    const completedLines = lineItems.filter((item) => item.completed).length;
    const totalLines = lineItems.length;

    return {
      id: task.id,
      type: task.type,
      assignee: task.assignee,
      completedLines: lineItems.length > 0 ? completedLines : null,
      totalLines: lineItems.length > 0 ? totalLines : null,
      currentWork: truncateText(getCurrentWork(task), 20),
      status: task.status,
      assignedTime: assignedTime,
      completedTime: completedTime,
      updatedAt: updatedAt || completedAt || new Date(0),
      assigneeId: task.assigneeId,
      comments: task.comments || [],
      projectName: task.projectName || "Unknown",
      areaNumber: task.areaNumber || "N/A",
      pidNumber: task.pidNumber || "N/A",
    };
  });

  const sortedRows = [...rows].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    if (sortColumn === "updatedAt") {
      const aDate = a.updatedAt?.getTime() || 0;
      const bDate = b.updatedAt?.getTime() || 0;
      return sortDirection === "asc" ? aDate - bDate : bDate - aDate;
    }
    if (sortColumn === "completedLines" || sortColumn === "totalLines") {
      const aNum = (aValue as number | null) ?? -1;
      const bNum = (bValue as number | null) ?? -1;
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    }
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    return sortDirection === "asc"
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  const totalPages = Math.ceil(sortedRows.length / tasksPerPage);
  const startIndex = (currentPage - 1) * tasksPerPage;
  const endIndex = startIndex + tasksPerPage;
  const paginatedRows = sortedRows.slice(startIndex, endIndex);

  const handleSort = (column: keyof (typeof rows)[0]) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilterStatus("All");
    setFilterType("All");
    setFilterAssignee("All");
    setCurrentPage(1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const hasActiveFilters =
    filterStatus !== "All" || filterType !== "All" || filterAssignee !== "All";

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-xl border border-gray-100">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {showFilters && (
        <div className="p-4 bg-gray-50/30 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters</span>
            {hasActiveFilters && (
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[140px]">
              <Select
                onValueChange={(value) => {
                  setFilterStatus(value as TaskStatus | "All");
                  setCurrentPage(1);
                }}
                value={filterStatus}
              >
                <SelectTrigger className="h-9 text-sm border-gray-200 focus:border-gray-300 shadow-none">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[140px]">
              <Select
                onValueChange={(value) => {
                  setFilterType(value as TaskType | "All");
                  setCurrentPage(1);
                }}
                value={filterType}
              >
                <SelectTrigger className="h-9 text-sm border-gray-200 focus:border-gray-300 shadow-none">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Types</SelectItem>
                  <SelectItem value="Redline">Redline</SelectItem>
                  <SelectItem value="UPV">UPV</SelectItem>
                  <SelectItem value="QC">QC</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {teamMembers && (
              <div className="min-w-[140px]">
                <Select
                  onValueChange={(value) => {
                    setFilterAssignee(value);
                    setCurrentPage(1);
                  }}
                  value={filterAssignee}
                >
                  <SelectTrigger className="h-9 text-sm border-gray-200 focus:border-gray-300 shadow-none">
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Assignees</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member} value={member}>
                        {member}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 px-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {paginatedRows.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-8 w-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No tasks found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-100">
                <TableHead className="px-4 py-3">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("type")}
                    className="h-auto p-0 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Type
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="px-4 py-3">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("assignee")}
                    className="h-auto p-0 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Assignee
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="px-4 py-3">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("completedLines")}
                    className="h-auto p-0 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Lines
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                {showCurrentWork && (
                  <TableHead className="px-4 py-3 text-xs font-medium text-gray-600">
                    Current Work
                  </TableHead>
                )}
                <TableHead className="px-4 py-3">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("status")}
                    className="h-auto p-0 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Status
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="px-4 py-3">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("assignedTime")}
                    className="h-auto p-0 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Assigned
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="px-4 py-3">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("completedTime")}
                    className="h-auto p-0 text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Completed
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                {showComments && (
                  <TableHead className="px-4 py-3 text-xs font-medium text-gray-600">
                    Comments
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedRows.map((row, index) => (
                <TableRow
                  key={row.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                >
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="text-xs font-medium">
                      {row.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <span className="text-sm font-medium text-gray-900">
                      {row.assignee}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    {row.completedLines !== null && row.totalLines !== null ? (
                      <span className="text-sm text-gray-600">
                        <span className="font-medium text-gray-900">
                          {row.completedLines}
                        </span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span>{row.totalLines}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </TableCell>
                  {showCurrentWork && (
                    <TableCell className="px-4 py-3">
                      <button
                        onClick={() =>
                          onViewCurrentWork?.(row.id, row.assigneeId)
                        }
                        className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                      >
                        {row.currentWork}
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="px-4 py-3">
                    <StatusBadge status={row.status as TaskStatus} />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>{row.assignedTime}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{row.completedTime}</span>
                    </div>
                  </TableCell>
                  {showComments && (
                    <TableCell className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewComments?.(row.id)}
                        className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        disabled={!onViewComments}
                      >
                        Comments
                        {row.comments.length > 0 && (
                          <Badge variant="secondary" className="ml-1 text-xs">
                            {row.comments.length}
                          </Badge>
                        )}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {sortedRows.length > tasksPerPage && (
        <div className="flex justify-between items-center p-4 bg-gray-50/30 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="h-8 px-3 text-xs border-gray-200 hover:bg-white disabled:opacity-40"
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {currentPage} of {totalPages}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-400">
              {sortedRows.length} tasks
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="h-8 px-3 text-xs border-gray-200 hover:bg-white disabled:opacity-40"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default TaskTable;
