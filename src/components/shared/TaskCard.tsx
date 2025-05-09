
import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import StatusBadge from "./StatusBadge";
import { Task, TaskItem } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import TaskTypeIndicator from "./TaskTypeIndicator";
import { MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: "Assigned" | "In Progress" | "Completed") => void;
  onItemToggle?: (taskId: string, itemId: string, isCompleted: boolean) => void;
  onOpenComments?: (task: Task) => void;
}

const TaskCard = ({ 
  task, 
  onStatusChange,
  onItemToggle,
  onOpenComments
}: TaskCardProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const allCompleted = task.items.every(item => item.completed);
  
  // Format time in HH:MM 24-hour format
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
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
    
    // Check if task is in progress
    if (task.status !== 'In Progress' && isChecked) {
      toast.error("You must start the task before marking items as completed");
      return;
    }
    
    // Cannot uncheck items once checked
    if (!isChecked && item.completed) {
      toast.error("Items cannot be unchecked once completed");
      return;
    }
    
    try {
      await onItemToggle(task.id, item.id, isChecked);
    } catch (error) {
      toast.error(`Failed to update ${item.type} status`);
    }
  };

  return (
    <Card className={cn(
      "h-full flex flex-col",
      task.isComplex && "border-teamsync-complex border-2"
    )}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <TaskTypeIndicator type={task.type} />
            <CardTitle className="text-lg font-semibold">{task.type}</CardTitle>
          </div>
          <StatusBadge status={task.status} isComplex={task.isComplex} />
        </div>
        <p className="text-sm text-gray-500">Assigned to: {task.assignee}</p>
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
                        disabled={task.status === "Completed" || isUpdating || (task.status !== "In Progress" && !item.completed) || item.completed}
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
                    {task.status !== 'In Progress' && !item.completed ? 
                      "Start task to enable this checkbox" : 
                      item.completed ? 
                        "This item cannot be unchecked" : 
                        "Mark as completed"}
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
