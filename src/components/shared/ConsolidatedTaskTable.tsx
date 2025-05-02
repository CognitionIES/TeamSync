
import React, { useState } from 'react';
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
import TaskTypeIndicator from "./TaskTypeIndicator";
import { Task, TaskStatus, TaskType } from "@/types";
import { format, formatDistance } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Filter, ArrowUpDown, Clock } from "lucide-react";

interface ConsolidatedTaskTableProps {
  tasks: Task[];
  teamMembers?: string[];
}

const ConsolidatedTaskTable = ({
  tasks,
  teamMembers,
}: ConsolidatedTaskTableProps) => {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<TaskType | "All">("All");
  const [assigneeFilter, setAssigneeFilter] = useState<string | "All">("All");
  const [sortField, setSortField] = useState<string>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Convert task time to HH:MM format
  const formatTaskTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };
  
  // Calculate estimated time based on complexity and type (mock function)
  const getEstimatedTime = (task: Task): string => {
    // This would normally come from the task data
    // For this demo, we'll calculate it based on complexity and type
    const baseMinutes = task.isComplex ? 120 : 60;
    const typeMultiplier = task.type === 'Redline' ? 1.5 : 
                            task.type === 'UPV' ? 1.2 : 1;
    const totalMinutes = baseMinutes * typeMultiplier;
    return formatTaskTime(Math.round(totalMinutes));
  };
  
  // Calculate actual time spent (mock function)
  const getActualTime = (task: Task): string => {
    // This would normally come from time tracking data
    // For this demo, we'll use a calculation based on task progress and status
    if (task.status === 'Assigned') return '0:00';
    
    const estimatedMinutes = parseInt(getEstimatedTime(task).split(':')[0]) * 60 + 
                            parseInt(getEstimatedTime(task).split(':')[1]);
    
    let actualMinutes;
    
    if (task.status === 'Completed') {
      // Completed tasks have a random actual time around the estimated time
      const randomFactor = Math.random() * 0.4 + 0.8; // 80% to 120% of estimated
      actualMinutes = Math.round(estimatedMinutes * randomFactor);
    } else {
      // In progress tasks have time proportional to their progress
      actualMinutes = Math.round(estimatedMinutes * (task.progress / 100));
    }
    
    return formatTaskTime(actualMinutes);
  };
  
  // Apply filters to tasks
  const filteredTasks = tasks.filter(task => {
    const matchesStatus = statusFilter === "All" || task.status === statusFilter;
    const matchesType = typeFilter === "All" || task.type === typeFilter;
    const matchesAssignee = assigneeFilter === "All" || task.assignee === assigneeFilter;
    
    return matchesStatus && matchesType && matchesAssignee;
  });
  
  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortField) {
      case 'type':
        aValue = a.type;
        bValue = b.type;
        break;
      case 'assignee':
        aValue = a.assignee;
        bValue = b.assignee;
        break;
      case 'status':
        aValue = a.status;
        bValue = b.status;
        break;
      case 'progress':
        aValue = a.progress;
        bValue = b.progress;
        break;
      case 'createdAt':
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      case 'completedAt':
        aValue = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        bValue = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        break;
      default:
        aValue = new Date(a.updatedAt).getTime();
        bValue = new Date(b.updatedAt).getTime();
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
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
        
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => {
            setStatusFilter("All");
            setTypeFilter("All");
            setAssigneeFilter("All");
          }}
          className="ml-auto"
        >
          <Filter className="h-4 w-4" />
          <span className="sr-only">Reset filters</span>
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead 
                className="w-[120px] cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center">
                  Type
                  {sortField === 'type' && <ArrowUpDown className="ml-2 h-3 w-3" />}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleSort('assignee')}
              >
                <div className="flex items-center">
                  Assignee
                  {sortField === 'assignee' && <ArrowUpDown className="ml-2 h-3 w-3" />}
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center">
                  Status
                  {sortField === 'status' && <ArrowUpDown className="ml-2 h-3 w-3" />}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => handleSort('progress')}
              >
                <div className="flex items-center">
                  Progress
                  {sortField === 'progress' && <ArrowUpDown className="ml-2 h-3 w-3" />}
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
                onClick={() => handleSort('updatedAt')}
              >
                <div className="flex items-center">
                  Updated
                  {sortField === 'updatedAt' && <ArrowUpDown className="ml-2 h-3 w-3" />}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.length > 0 ? (
              sortedTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/30">
                  <TableCell>
                    <TaskTypeIndicator type={task.type} className="mr-1" />
                    {task.type}
                  </TableCell>
                  <TableCell>{task.assignee}</TableCell>
                  <TableCell>
                    <StatusBadge status={task.status} isComplex={task.isComplex} />
                  </TableCell>
                  <TableCell>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          task.status === 'Completed' ? 'bg-green-500' : 
                          task.progress > 66 ? 'bg-emerald-500' :
                          task.progress > 33 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${task.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 mt-1">
                      {task.progress}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Est:</span>
                        <span className="font-mono">{getEstimatedTime(task)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Act:</span>
                        <span className={`font-mono ${
                          task.status === 'Completed' ? 'text-green-600 font-medium' : ''
                        }`}>{getActualTime(task)}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {task.status === "Completed" && task.completedAt
                      ? `Completed ${formatDistance(new Date(task.completedAt), new Date(), { addSuffix: true })}`
                      : task.status === "In Progress"
                      ? `Updated ${formatDistance(new Date(task.updatedAt), new Date(), { addSuffix: true })}`
                      : `Assigned ${formatDistance(new Date(task.createdAt), new Date(), { addSuffix: true })}`
                    }
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
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

export default ConsolidatedTaskTable;
