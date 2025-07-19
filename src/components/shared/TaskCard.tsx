/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import StatusBadge from "./StatusBadge";
import { Task, TaskItem, TaskStatus } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import TaskTypeIndicator from "./TaskTypeIndicator";
import { MessageSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import axios from "axios";

// Use Vite's environment variable or fallback
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface TaskCardProps {
  task: Task;
  onStatusChange?: (
    taskId: string,
    newStatus: "Assigned" | "In Progress" | "Completed"
  ) => void;
  onItemToggle?: (taskId: string, itemId: string, isCompleted: boolean) => void;
  onOpenComments?: (task: Task) => void;
}

const TaskCard = ({
  task,
  onStatusChange,
  onItemToggle,
  onOpenComments,
}: TaskCardProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const allCompleted = task.items.every((item) => item.completed);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kolkata",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  const handleStart = async () => {
    if (!onStatusChange) return;

    setIsUpdating(true);
    try {
      await onStatusChange(task.id, "In Progress");
      toast.success("Task status updated to In Progress");
    } catch (error) {
      toast.error("Failed to update task status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!onStatusChange) return;

    setIsUpdating(true);
    try {
      await onStatusChange(task.id, "Completed");
      toast.success("Task marked as completed");
    } catch (error) {
      toast.error("Failed to mark task as complete");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleItemToggle = async (item: TaskItem, isChecked: boolean) => {
    if (!onItemToggle) return;

    if (task.status !== "In Progress" && isChecked) {
      toast.error("You must start the task before marking items as completed");
      return Promise.reject("Task not started");
    }

    if (!isChecked && item.completed) {
      toast.error("Items cannot be unchecked once completed");
      return Promise.reject("Item cannot be unchecked");
    }

    try {
      await onItemToggle(task.id, item.id, isChecked);
      const token = localStorage.getItem("teamsync_token");
      if (token && isChecked) {
        try {
          const response = await axios.post(
            `${API_URL}/metrics/individual/lines/daily`,
            { userId: task.assigneeId, taskId: task.id, itemId: item.id },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log("Metrics update response:", response.data);
          toast.success("Line count updated successfully");
        } catch (metricsError) {
          const axiosError = metricsError as any;
          console.error("Metrics update failed:", {
            message: axiosError.message,
            status: axiosError.response?.status,
            data: axiosError.response?.data,
            taskId: task.id,
            itemId: item.id,
          });
          toast.error(
            `Failed to update line count metric: ${axiosError.message}`
          );
        }
      }
    } catch (error) {
      toast.error(`Failed to update ${item.type} status`);
      throw error;
    }
  };

  const isLineTask = task.type === "Redline";
  const pidItem = task.items.find((item) => item.type === "PID");

  return (
    <Card
      className={cn(
        "h-full flex flex-col",
        task.isComplex && "border-teamsync-complex border-2"
      )}
    >
      <CardHeader
        className={`
          pb-2 
          ${
            task.status === "Completed"
              ? "bg-green-50"
              : task.status === "In Progress"
              ? "bg-orange-50"
              : "bg-blue-50"
          }`}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <TaskTypeIndicator type={task.type} />
            <CardTitle className="text-lg font-semibold mb-2">
              {task.type}
            </CardTitle>
          </div>
          <StatusBadge
            status={task.status as TaskStatus}
            isComplex={task.isComplex}
          />
        </div>
        <div className="mt-2 space-y-2">
          <div className="text-center py-1 px-3 bg-blue-100 rounded-md inline-block">
            <p className="text-base font-medium text-blue-800">
              Project: {task.projectName || "Unknown"}
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Area No: {task.areaNumber || "N/A"}
            </p>
          </div>
          {isLineTask && pidItem && (
            <div className="text-center py-1 px-3 bg-blue-100 rounded-md inline-block">
              <p className="text-base font-medium text-blue-800">
                P&ID No: {task.pidNumber || pidItem.id || "N/A"}
              </p>
            </div>
          )}
          <div className="text-center py-1 px-3 bg-gray-100 rounded-md inline-block">
            <p className="text-sm text-gray-600">
              Assigned: {formatDate(task.createdAt)} at{" "}
              {formatTime(task.createdAt)}
            </p>
            {task.completedAt ? (
              <p className="text-sm text-gray-600 mt-1">
                Completed: {formatDate(task.completedAt)} at{" "}
                {formatTime(task.completedAt)}
              </p>
            ) : task.status !== "Assigned" ? (
              <p className="text-sm text-gray-600 mt-1">Not completed</p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow">
        <h4 className="text-sm font-medium mb-2">Items</h4>
        <div className="space-y-2">
          {task.items.map((item) => (
            <div key={item.id} className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-2 flex-grow">
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={item.completed}
                        disabled={
                          task.status === "Completed" ||
                          isUpdating ||
                          (task.status !== "In Progress" && !item.completed) ||
                          item.completed
                        }
                        onCheckedChange={(checked) =>
                          handleItemToggle(item, checked as boolean)
                        }
                      />
                      <label
                        htmlFor={`item-${item.id}`}
                        className={cn(
                          "text-sm",
                          item.completed && "line-through text-gray-400"
                        )}
                      >
                        {item.type}: {item.name}
                      </label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {task.status !== "In Progress" && !item.completed
                      ? "Start task to enable this checkbox"
                      : item.completed
                      ? "This item cannot be unchecked"
                      : "Mark as completed"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-2 flex justify-end space-x-2">
        {onOpenComments && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenComments(task)}
            className="mr-auto"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            {task.comments?.length || 0}
          </Button>
        )}

        {task.status === "Assigned" && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStart}
            disabled={isUpdating}
            className="bg-teamsync-assigned bg-opacity-10 hover:bg-opacity-20"
          >
            Start
          </Button>
        )}

        {task.status === "In Progress" && (
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={isUpdating || !allCompleted}
            className="bg-teamsync-completed text-white hover:bg-opacity-90"
          >
            Complete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default TaskCard;
