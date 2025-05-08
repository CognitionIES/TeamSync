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
import { useState, useEffect } from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { formatDistance } from "date-fns";
import { ArrowUpDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

// Interface for API response data (snake_case)
interface ApiTask {
  id: string;
  type: TaskType;
  assignee: string;
  assignee_id: string;
  status: TaskStatus;
  is_complex: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  progress: number;
  items: Array<{
    id: string;
    item_name: string;
    item_type: string;
    completed: boolean;
  }>;
  comments: Array<{
    id: string;
    user_id: string;
    user_name: string;
    user_role: string;
    comment: string;
    created_at: string;
  }>;
}

// Transform API data to match the expected Task type (camelCase)
const transformTask = (apiTask: ApiTask): Task => ({
  id: apiTask.id,
  type: apiTask.type,
  assignee: apiTask.assignee,
  assigneeId: apiTask.assignee_id,
  status: apiTask.status,
  isComplex: apiTask.is_complex,
  createdAt: apiTask.created_at,
  updatedAt: apiTask.updated_at,
  completedAt: apiTask.completed_at,
  progress: apiTask.progress,
  items: apiTask.items.map((item) => ({
    id: item.id,
    name: item.item_name,
    type: item.item_type,
    completed: item.completed,
  })),
  comments: apiTask.comments.map((comment) => ({
    id: comment.id,
    userId: comment.user_id,
    userName: comment.user_name,
    userRole: comment.user_role,
    comment: comment.comment,
    createdAt: comment.created_at,
  })),
});

interface TaskTableProps {
  tasks: ApiTask[];
  teamMembers?: string[];
  showFilters?: boolean;
  showProgress?: boolean;
  showCurrentWork?: boolean;
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

// Convert task time to HH:MM format
const formatTaskTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, "0")}`;
};

// Calculate estimated time based on complexity and type
const getEstimatedTime = (task: Task): string => {
  const baseMinutes = task.isComplex ? 120 : 60;
  const typeMultiplier =
    task.type === "Redline" ? 1.5 : task.type === "UPV" ? 1.2 : 1;
  const totalMinutes = baseMinutes * typeMultiplier;
  return formatTaskTime(Math.round(totalMinutes));
};

// Calculate actual time spent
const getActualTime = (task: Task): string => {
  if (task.status === "Assigned") return "0:00";

  const estimatedMinutes =
    parseInt(getEstimatedTime(task).split(":")[0]) * 60 +
    parseInt(getEstimatedTime(task).split(":")[1]);

  let actualMinutes;

  if (task.status === "Completed") {
    const randomFactor = Math.random() * 0.4 + 0.8; // 80% to 120% of estimated
    actualMinutes = Math.round(estimatedMinutes * randomFactor);
  } else {
    actualMinutes = Math.round(estimatedMinutes * (task.progress / 100));
  }

  return formatTaskTime(actualMinutes);
};

const TaskTable = ({
  tasks: apiTasks,
  teamMembers,
  showFilters = false,
  showProgress = false,
  showCurrentWork = false,
}: TaskTableProps) => {
  // Log the received tasks prop
  console.log("TaskTable received tasks:", apiTasks);

  // Transform API tasks to match the expected Task type
  const tasks = apiTasks.map(transformTask);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<TaskType | "All">("All");
  const [assigneeFilter, setAssigneeFilter] = useState<string | "All">("All");
  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Apply filters to tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus =
      statusFilter === "All" || task.status === statusFilter;
    const matchesType = typeFilter === "All" || task.type === typeFilter;
    const matchesAssignee =
      assigneeFilter === "All" || task.assignee === assigneeFilter;

    return matchesStatus && matchesType && matchesAssignee;
  });

  // Log filtered tasks to check if filters are excluding tasks
  console.log("Filtered tasks in TaskTable:", filteredTasks);

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let aValue, bValue;

    switch (sortField) {
      case "type":
        aValue = a.type;
        bValue = b.type;
        break;
      case "assignee":
        aValue = a.assignee;
        bValue = b.assignee;
        break;
      case "status":
        aValue = a.status;
        bValue = b.status;
        break;
      case "progress":
        aValue = a.progress;
        bValue = b.progress;
        break;
      case "createdAt":
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case "completedAt":
        aValue = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        bValue = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        break;
      default:
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
    }

    if (sortDirection === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Pagination logic
  const itemsPerPage = 50;
  const paginatedTasks = sortedTasks.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  useEffect(() => {
    setTotalPages(Math.ceil(sortedTasks.length / itemsPerPage));
  }, [sortedTasks]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="w-full sm:w-auto">
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as TaskStatus | "All")
              }
            >
              <SelectTrigger className="w-full sm:w-[150px]">
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

          <div className="w-full sm:w-auto">
            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as TaskType | "All")
              }
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Task Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Types</SelectItem>
                <SelectItem value="Redline">Redline</SelectItem>
                <SelectItem value="UPV">UPV</SelectItem>
                <SelectItem value="QC">QC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {teamMembers && teamMembers.length > 0 && (
            <div className="w-full sm:w-auto">
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Team Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Team Members</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member} value={member}>
                      {member}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleSort("type")}
              >
                <div className="flex items-center">
                  Type
                  {sortField === "type" && (
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  )}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleSort("assignee")}
              >
                <div className="flex items-center">
                  Assignee
                  {sortField === "assignee" && (
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  )}
                </div>
              </TableHead>
              {showProgress && (
                <TableHead
                  className="cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => handleSort("progress")}
                >
                  <div className="flex items-center">
                    Progress
                    {sortField === "progress" && (
                      <ArrowUpDown className="ml-2 h-3 w-3" />
                    )}
                  </div>
                </TableHead>
              )}
              {showCurrentWork && <TableHead>Current Work</TableHead>}
              <TableHead
                className="cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center">
                  Status
                  {sortField === "status" && (
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  )}
                </div>
              </TableHead>
              <TableHead>
                <div className="flex items-center">
                  <Clock className="mr-1 h-4 w-4" />
                  Time (HH:MM)
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleSort("updatedAt")}
              >
                <div className="flex items-center">
                  Updated
                  {sortField === "updatedAt" && (
                    <ArrowUpDown className="ml-2 h-3 w-3" />
                  )}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTasks.length > 0 ? (
              paginatedTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{task.type}</TableCell>
                  <TableCell>{task.assignee}</TableCell>
                  {showProgress && (
                    <TableCell>
                      <Progress
                        value={task.progress}
                        className={`w-full h-2 ${
                          task.status === "Completed"
                            ? "bg-green-500"
                            : task.progress > 66
                            ? "bg-emerald-500"
                            : task.progress > 33
                            ? "bg-amber-500"
                            : "bg-blue-500"
                        }`}
                      />
                      <span className="text-xs text-gray-500 mt-1">{task.progress}%</span>
                    </TableCell>
                  )}
                  {showCurrentWork && (
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help text-left">
                            <span className="text-sm">{truncateText(getCurrentWork(task))}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{getCurrentWork(task)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  )}
                  <TableCell>
                    <StatusBadge status={task.status} isComplex={task.isComplex} />
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Est:</span>
                        <span className="font-mono">{getEstimatedTime(task)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Act:</span>
                        <span
                          className={`font-mono ${
                            task.status === "Completed" ? "text-green-600 font-medium" : ""
                          }`}
                        >
                          {getActualTime(task)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {task.status === "Completed" && task.completedAt
                      ? `Completed ${formatDistance(
                          new Date(task.completedAt),
                          new Date(),
                          { addSuffix: true }
                        )}`
                      : task.status === "In Progress"
                      ? `Updated ${formatDistance(
                          new Date(task.updatedAt),
                          new Date(),
                          { addSuffix: true }
                        )}`
                      : `Assigned ${formatDistance(
                          new Date(task.createdAt),
                          new Date(),
                          { addSuffix: true }
                        )}`}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={showProgress ? (showCurrentWork ? 7 : 6) : (showCurrentWork ? 6 : 5)}
                  className="h-24 text-center"
                >
                  No tasks found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center">
        <Button
          disabled={page === 1}
          onClick={() => setPage((prev) => prev - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {totalPages}
        </span>
        <Button
          disabled={page === totalPages}
          onClick={() => setPage((prev) => prev + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default TaskTable;