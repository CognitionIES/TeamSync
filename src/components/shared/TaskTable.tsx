
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
import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TaskTableProps {
  tasks: Task[];
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
  
  const pidItem = task.items.find(item => item.type === "PID");
  if (pidItem) return `P&ID ${pidItem.name}`;
  
  const lineItem = task.items.find(item => item.type === "Line");
  if (lineItem) return `Line ${lineItem.name}`;
  
  const equipmentItem = task.items.find(item => item.type === "Equipment");
  if (equipmentItem) return `Equipment ${equipmentItem.name}`;
  
  return "No active items";
};

// Format time in HH:MM 24-hour format
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

const TaskTable = ({
  tasks,
  teamMembers,
  showFilters = false,
  showProgress = false,
  showCurrentWork = false,
}: TaskTableProps) => {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<TaskType | "All">("All");
  const [assigneeFilter, setAssigneeFilter] = useState<string | "All">("All");
  
  // Apply filters to tasks
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = statusFilter === "All" || task.status === statusFilter;
    const matchesType = typeFilter === "All" || task.type === typeFilter;
    const matchesAssignee = assigneeFilter === "All" || task.assignee === assigneeFilter;
    
    return matchesStatus && matchesType && matchesAssignee;
  });

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="w-full sm:w-auto">
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as TaskStatus | "All")}
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
              onValueChange={(value) => setTypeFilter(value as TaskType | "All")}
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
              <Select
                value={assigneeFilter}
                onValueChange={setAssigneeFilter}
              >
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

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Assignee</TableHead>
              {showProgress && (
                <TableHead>Progress</TableHead>
              )}
              {showCurrentWork && (
                <TableHead>Current Work</TableHead>
              )}
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{task.type}</TableCell>
                  <TableCell>{task.assignee}</TableCell>
                  {showProgress && (
                    <TableCell>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500 mt-1">
                        {task.progress}%
                      </span>
                    </TableCell>
                  )}
                  {showCurrentWork && (
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="cursor-help text-left">
                            <span className="text-sm">
                              {truncateText(getCurrentWork(task))}
                            </span>
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
                  <TableCell className="text-sm text-gray-500">
                    <div className="space-y-1">
                      <div>Assigned at: {formatTime(task.createdAt)}</div>
                      {task.status === "Completed" && task.completedAt ? (
                        <div>Completed at: {formatTime(task.completedAt)}</div>
                      ) : (
                        task.status === "In Progress" && (
                          <div>Not completed</div>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={showProgress ? 6 : 5} className="h-24 text-center">
                  No tasks found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TaskTable;
