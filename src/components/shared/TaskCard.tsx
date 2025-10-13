/* eslint-disable react-hooks/rules-of-hooks */
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
import { Task, TaskItem, TaskStatus, TaskType } from "@/types";
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
import axios, { AxiosError } from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface TaskCardProps {
  task: Task;
  onStatusChange?: (
    taskId: string,
    newStatus: "Assigned" | "In Progress" | "Completed"
  ) => void;
  onItemToggle?: (
    taskId: string,
    itemId: string,
    isCompleted: boolean,
    category: string,
    blocks?: number
  ) => void;
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

  const getCategory = (
    itemType: string,
    taskType: TaskType | string
  ): string => {
    const baseTypes = {
      Line: "Line",
      Equipment: "Equipment",
      PID: "PID",
      NonInlineInstrument: "NonInlineInstrument",
    };
    return baseTypes[itemType] || "Equipment";
  };

  const handleItemToggle = async (
    taskId: string,
    itemId: string,
    completed: boolean,
    category: string,
    blocks?: number
  ) => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");
      const effectiveBlocks = blocks !== undefined && blocks >= 0 ? blocks : 0;
      console.log("PATCH Request Config:", {
        url: `${API_URL}/tasks/${taskId}/items/${itemId}`,
        data: { completed, blocks: effectiveBlocks },
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });
      const response = await axios.patch(
        `${API_URL}/tasks/${taskId}/items/${itemId}`,
        { completed, blocks: effectiveBlocks },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }
      );
      if (completed && onItemToggle) {
        onItemToggle(taskId, itemId, completed, category, effectiveBlocks);
      }
      toast.success("Task item updated successfully");
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error("Axios error:", axiosError.response?.data || axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to update task item"
      );
    }
  };

  const isLineTask = task.type === "Redline";
  const pidItem = task.items.find((item) => item.type === "PID");

  return (
    <Card
      className={cn(
        "h-full flex flex-col shadow-md hover:shadow-lg transition-shadow duration-200",
        task.isComplex && "border-teamsync-complex border-2"
      )}
    >
      <CardHeader
        className={cn(
          "pb-3",
          task.status === "Completed"
            ? "bg-green-50 border-b-2 border-green-200"
            : task.status === "In Progress"
            ? "bg-orange-50 border-b-2 border-orange-200"
            : "bg-blue-50 border-b-2 border-blue-200"
        )}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <TaskTypeIndicator type={task.type} />
            <CardTitle className="text-lg font-semibold text-gray-800">
              {task.type}
            </CardTitle>
          </div>
          <StatusBadge
            status={task.status as TaskStatus}
            isComplex={task.isComplex}
          />
        </div>
        <div className="mt-3 grid gap-2">
          <div className="bg-blue-50 p-2 rounded-lg">
            <p className="text-sm font-medium text-blue-800">
              Project: {task.projectName || "Unknown"}
            </p>
            <p className="text-xs text-blue-700">
              Area No: {task.areaNumber || "N/A"}
            </p>
          </div>
          {isLineTask && pidItem && (
            <div className="bg-blue-50 p-2 rounded-lg">
              <p className="text-sm font-medium text-blue-800">
                P&ID No: {task.pidNumber || pidItem.id || "N/A"}
              </p>
            </div>
          )}
          <div className="bg-gray-50 p-2 rounded-lg">
            <p className="text-xs text-gray-600">
              Assigned: {formatDate(task.createdAt)} at{" "}
              {formatTime(task.createdAt)}
            </p>
            {task.completedAt ? (
              <p className="text-xs text-gray-600">
                Completed: {formatDate(task.completedAt)} at{" "}
                {formatTime(task.completedAt)}
              </p>
            ) : task.status !== "Assigned" ? (
              <p className="text-xs text-gray-600">Not completed</p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Items</h4>
        <div className="space-y-3">
          {task.items.map((item) => {
            const [blocks, setBlocks] = useState(item.blocks || 0);
            const [isCheckboxUpdating, setIsCheckboxUpdating] = useState(false); // NEW
            const isEditable = task.status === "In Progress" && !item.completed;
            const isCheckable = isEditable && blocks > 0;
            const category = getCategory(item.type, task.type);

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-3 flex-grow">
                        <Checkbox
                          id={`item-${item.id}`}
                          checked={item.completed}
                          disabled={
                            isUpdating ||
                            isCheckboxUpdating || // NEW
                            item.completed ||
                            (task.status !== "In Progress" &&
                              !item.completed) ||
                            !isCheckable
                          }
                          onCheckedChange={async (checked: boolean) => {
                            if (checked && !item.completed) {
                              setIsCheckboxUpdating(true); // NEW - Disable immediately
                              try {
                                await handleItemToggle(
                                  task.id,
                                  item.id,
                                  true,
                                  category,
                                  blocks
                                );
                              } finally {
                                setIsCheckboxUpdating(false); // NEW
                              }
                            }
                          }}
                          className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                        <label
                          htmlFor={`item-${item.id}`}
                          className={cn(
                            "text-sm text-gray-800 flex-1",
                            item.completed && "line-through text-gray-400"
                          )}
                        >
                          {item.type}: {item.name}
                          {/* NEW - Show block count */}
                          {item.blocks > 0 && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({item.blocks}{" "}
                              {item.blocks === 1 ? "block" : "blocks"})
                            </span>
                          )}
                        </label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {task.status !== "In Progress" && !item.completed
                        ? "Start task to enable this checkbox"
                        : item.completed
                        ? "This item is completed and cannot be changed"
                        : !isCheckable
                        ? "Enter a valid number of blocks (> 0) to check"
                        : "Mark as completed and enter blocks"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    value={blocks}
                    onChange={(e) =>
                      isEditable && setBlocks(parseInt(e.target.value) || 0)
                    }
                    onBlur={() =>
                      isEditable &&
                      handleItemToggle(
                        task.id,
                        item.id,
                        item.completed,
                        category,
                        blocks
                      )
                    }
                    className={cn(
                      "w-20 p-1 border rounded-md text-sm focus:outline-none focus:ring-1",
                      isEditable
                        ? "border-gray-300 focus:ring-blue-500"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed"
                    )}
                    placeholder="Blocks"
                    disabled={!isEditable}
                    readOnly={!isEditable}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <CardFooter className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
        {onOpenComments && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenComments(task)}
            className="mr-auto flex items-center text-gray-600 hover:text-gray-800 hover:bg-gray-100"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            {task.comments?.length || 0} Comments
          </Button>
        )}

        {task.status === "Assigned" && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStart}
            disabled={isUpdating}
            className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          >
            Start
          </Button>
        )}

        {task.status === "In Progress" && (
          <Button
            size="sm"
            onClick={handleComplete}
            disabled={isUpdating || !allCompleted}
            className="bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400"
          >
            Complete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default TaskCard;
