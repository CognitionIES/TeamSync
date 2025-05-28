import React, { useState } from "react";
import { Task, TaskStatus } from "@/types";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import TaskTypeIndicator from "./TaskTypeIndicator";
import StatusBadge from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Format time in HH:MM 24-hour format
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
};

interface MiscTaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onOpenComments?: (task: Task) => void;
}

const MiscTaskCard: React.FC<MiscTaskCardProps> = ({
  task,
  onStatusChange,
  onOpenComments,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

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

  return (
    <Card
      className={cn(
        "h-full flex flex-col",
        task.isComplex && "border-teamsync-complex border-2"
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <TaskTypeIndicator type={task.type} />
            <h2 className="text-lg font-semibold">Miscellaneous Task</h2>
          </div>
          <StatusBadge
            status={task.status as TaskStatus}
            isComplex={task.isComplex}
          />
        </div>
        <div className="text-sm text-gray-500 space-y-1 mt-1">
          <p>Assigned to: {task.assignee}</p>
          <p>Project: {task.projectName || "Unknown"}</p>
          <p>Area No: {task.areaNumber || "N/A"}</p>
        </div>
        <div className="text-xs text-gray-400 space-y-1 mt-1">
          <p>Assigned at: {formatTime(task.createdAt)}</p>
          {task.completedAt && (
            <p>Completed at: {formatTime(task.completedAt)}</p>
          )}
          {!task.completedAt && task.status !== "Assigned" && (
            <p>Not completed</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="mt-2">
          <div className=" py-1  rounded-md inline-block">
            <h3 className="text-base font-medium text-gray-800">
              Description:
            </h3>
            <p className="text-base text-gray-800">
              {task.description || "No description provided."}
            </p>
          </div>
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
            disabled={isUpdating}
            className="bg-teamsync-completed text-white hover:bg-opacity-90"
          >
            Complete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default MiscTaskCard;
