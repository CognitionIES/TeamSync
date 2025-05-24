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
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ArrowUpDown, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskTableProps {
  tasks: Task[];
  teamMembers?: string[];
  showFilters?: boolean;
  showProgress?: boolean;
  showCurrentWork?: boolean;
  showComments?: boolean; // Added to toggle Comments column
  loading?: boolean;
  onViewCurrentWork?: (taskId: string, userId: string) => void;
  onViewComments?: (taskId: string) => void; // Added to handle comments modal
}

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 20) => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

// Helper function to get current work description
const getCurrentWork = (task: Task): string => {
  if (task.status === "Completed") return "Completed";

  const pidItem = task.items.find((item) => item.type === "PID");
  if (pidItem) return `P&ID ${pidItem.name}`;

  const lineItem = task.items.find((item) => item.type === "Line");
  if (lineItem) return `Line ${lineItem.name}`;

  const equipmentItem = task.items.find((item) => item.type === "Equipment");
  if (equipmentItem) return `Equipment ${equipmentItem.name}`;

  return "No active items";
};

// Format the date in GMT+5:30
const formatDateTime = (dateStr: string | null, label: string): string => {
  if (!dateStr) return `Not ${label}`;
  try {
    const date = parseISO(dateStr);
    const offsetMinutes = 5 * 60 + 30; // 5 hours 30 minutes in minutes
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

// Skeleton loading component
const TableSkeleton = () => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead className="w-[100px]">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </TableHead>
        <TableHead>
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </TableHead>
        <TableHead>
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </TableHead>
        <TableHead>
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </TableHead>
        <TableHead>
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </TableHead>
        <TableHead>
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </TableHead>
        <TableHead>
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </TableHead>
        <TableHead>
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {[...Array(5)].map((_, index) => (
        <TableRow key={index}>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
          <TableCell>
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  teamMembers,
  showFilters,
  showProgress,
  showCurrentWork,
  showComments = false, // Default to false
  loading = false,
  onViewCurrentWork,
  onViewComments,
}) => {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "All">("All");
  const [filterType, setFilterType] = useState<TaskType | "All">("All");
  const [filterAssignee, setFilterAssignee] = useState<string | "All">("All");
  const [sortColumn, setSortColumn] =
    useState<keyof (typeof rows)[0]>("updated");
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

    let updated: string;
    if (task.status === "In Progress") {
      updated = "In Progress";
    } else {
      updated = completedAt
        ? `Completed ${formatDistanceToNow(completedAt, { addSuffix: true })}`
        : updatedAt
        ? `Updated ${formatDistanceToNow(updatedAt, { addSuffix: true })}`
        : "Not Updated";
    }

    const assignedTime = formatDateTime(task.createdAt, "Assigned");
    const completedTime = formatDateTime(task.completedAt, "Completed");

    return {
      id: task.id,
      type: task.type,
      assignee: task.assignee,
      progress: task.progress,
      currentWork: truncateText(getCurrentWork(task), 20),
      status: task.status,
      assignedTime: assignedTime,
      completedTime: completedTime,
      updated: updated,
      updatedAt: updatedAt || completedAt || new Date(0),
      assigneeId: task.assigneeId,
      comments: task.comments || [], // Include comments for the button
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

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <TableSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      {showFilters && (
        <div className="mb-6">
          <div className="flex items-end space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <Select
                onValueChange={(value) => {
                  setFilterStatus(value as TaskStatus | "All");
                  setCurrentPage(1);
                }}
                value={filterStatus}
              >
                <SelectTrigger className="w-[180px] border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all duration-200">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Type
              </label>
              <Select
                onValueChange={(value) => {
                  setFilterType(value as TaskType | "All");
                  setCurrentPage(1);
                }}
                value={filterType}
              >
                <SelectTrigger className="w-[180px] border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all duration-200">
                  <SelectValue placeholder="Filter by Type" />
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assignee
                </label>
                <Select
                  onValueChange={(value) => {
                    setFilterAssignee(value);
                    setCurrentPage(1);
                  }}
                  value={filterAssignee}
                >
                  <SelectTrigger className="w-[180px] border-gray-300 focus:ring-2 focus:ring-blue-500 transition-all duration-200">
                    <SelectValue placeholder="Filter by Assignee" />
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
              variant="outline"
              onClick={clearFilters}
              className="ml-4 flex items-center space-x-2 text-gray-600 hover:text-gray-800 border-gray-300 hover:border-gray-400 transition-all duration-200"
              aria-label="Clear all filters"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Clear Filters</span>
            </Button>
          </div>
        </div>
      )}

      {paginatedRows.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <p>No tasks found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("type")}
                  className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors duration-200"
                  aria-label="Sort by Type"
                >
                  <span>Type</span>
                  <ArrowUpDown
                    className={`h-4 w-4 ${
                      sortColumn === "type" && sortDirection === "asc"
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("assignee")}
                  className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors duration-200"
                  aria-label="Sort by Assignee"
                >
                  <span>Assignee</span>
                  <ArrowUpDown
                    className={`h-4 w-4 ${
                      sortColumn === "assignee" && sortDirection === "asc"
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </Button>
              </TableHead>
              {showProgress && (
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort("progress")}
                    className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors duration-200"
                    aria-label="Sort by Progress"
                  >
                    <span>Progress</span>
                    <ArrowUpDown
                      className={`h-4 w-4 ${
                        sortColumn === "progress" && sortDirection === "asc"
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </Button>
                </TableHead>
              )}
              {showCurrentWork && <TableHead>Current Work</TableHead>}
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("status")}
                  className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors duration-200"
                  aria-label="Sort by Status"
                >
                  <span>Status</span>
                  <ArrowUpDown
                    className={`h-4 w-4 ${
                      sortColumn === "status" && sortDirection === "asc"
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("assignedTime")}
                  className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors duration-200"
                  aria-label="Sort by Assigned Time"
                >
                  <span>Assigned</span>
                  <ArrowUpDown
                    className={`h-4 w-4 ${
                      sortColumn === "assignedTime" && sortDirection === "asc"
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("completedTime")}
                  className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors duration-200"
                  aria-label="Sort by Completed Time"
                >
                  <span>Completed</span>
                  <ArrowUpDown
                    className={`h-4 w-4 ${
                      sortColumn === "completedTime" && sortDirection === "asc"
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort("updated")}
                  className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition-colors duration-200"
                  aria-label="Sort by Updated"
                >
                  <span>Updated</span>
                  <ArrowUpDown
                    className={`h-4 w-4 ${
                      sortColumn === "updated" && sortDirection === "asc"
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </Button>
              </TableHead>
              {showComments && <TableHead>Comments</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row, index) => (
              <TableRow
                key={row.id}
                className={`border-b border-gray-100 transition-colors duration-200 ${
                  index % 2 === 0 ? "bg-white" : "bg-gray-50"
                } hover:bg-blue-50 cursor-pointer`}
              >
                <TableCell className="py-4">{row.type}</TableCell>
                <TableCell className="py-4">{row.assignee}</TableCell>
                {showProgress && (
                  <TableCell className="py-4">
                    <div className="flex items-center space-x-2">
                      <Progress
                        value={row.progress}
                        className="w-[60px] h-2 bg-gray-200 [&>[data-state='complete']]:bg-blue-500 [&>[data-state='loading']]:bg-blue-500 transition-all duration-500 ease-in-out"
                      />
                      <span className="text-sm text-gray-600">
                        {row.progress}%
                      </span>
                    </div>
                  </TableCell>
                )}
                {showCurrentWork && (
                  <TableCell className="py-4">
                    <button
                      onClick={() =>
                        onViewCurrentWork?.(row.id, row.assigneeId)
                      }
                      className="text-blue-600 hover:underline focus:outline-none"
                    >
                      {row.currentWork}
                    </button>
                  </TableCell>
                )}
                <TableCell className="py-4">
                  <StatusBadge
                    status={row.status as TaskStatus}
                    className={
                      row.status === "Completed"
                        ? "bg-green-100 text-green-800"
                        : row.status === "In Progress"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }
                  />
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center space-x-1 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{row.assignedTime}</span>
                  </div>
                </TableCell>
                <TableCell className="py-4">
                  <div className="flex items-center space-x-1 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{row.completedTime}</span>
                  </div>
                </TableCell>
                <TableCell className="py-4">{row.updated}</TableCell>
                {showComments && (
                  <TableCell className="py-4">
                    <Button
                      variant="outline"
                      onClick={() => onViewComments?.(row.id)}
                      className="text-blue-600 hover:text-blue-800 border-blue-300 hover:border-blue-400 transition-all duration-200"
                      disabled={!onViewComments}
                    >
                      Comments{" "}
                      {row.comments.length ? `(${row.comments.length})` : ""}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {sortedRows.length > tasksPerPage && (
        <div className="flex justify-between items-center mt-4">
          <Button
            variant="outline"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="text-gray-600 hover:text-gray-800 border-gray-300 hover:border-gray-400 transition-all duration-200"
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="text-gray-600 hover:text-gray-800 border-gray-300 hover:border-gray-400 transition-all duration-200"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default TaskTable;
