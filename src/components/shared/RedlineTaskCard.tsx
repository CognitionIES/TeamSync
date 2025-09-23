import { memo, useState } from "react";
import { Task, TaskStatus, TaskType } from "@/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import TaskTypeIndicator from "../shared/TaskTypeIndicator";
import { FileText, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface RedlineTaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onItemToggle?: (
    taskId: string,
    itemId: string,
    isCompleted: boolean,
    category: string,
    blocks?: number
  ) => Promise<void>;
  onOpenComments?: (task: Task) => void;
}

const RedlineTaskCard = memo(
  ({
    task,
    onStatusChange,
    onItemToggle,
    onOpenComments,
  }: RedlineTaskCardProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isOpenPID, setIsOpenPID] = useState(false);
    const [completedItems, setCompletedItems] = useState<string[]>(
      task.items.filter((item) => item.completed).map((item) => item.id)
    );

    const pidItems = task.items.filter((item) => item.type === "PID");
    const lineItems = task.lines || [];
    const pidCount = pidItems.length;
    const lineCount = lineItems.length;

    const formatTime = (dateString: string) => {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      });
    };

    const getCategory = (
      itemType: string,
      taskType: TaskType | string
    ): string => {
      const baseTypes = {
        Line: "Line",
        Equipment: "Equipment",
        PID: "PID",
        NonLineInstrument: "NonInlineInstrument",
      };
      return baseTypes[itemType] || "Unknown";
    };

    const handleCheckItem = async (itemId: string, checked: boolean) => {
      if (!onItemToggle) return;
      if (task.status !== "In Progress" && checked) {
        toast.error(
          "You must start the task before marking items as completed"
        );
        return;
      }
      if (!checked && completedItems.includes(itemId)) {
        toast.error("Items cannot be unchecked once completed");
        return;
      }
      const item = [...pidItems, ...lineItems].find((i) => i.id === itemId);
      if (!item) return;
      const category = getCategory(item.type, task.type);
      if (checked && !completedItems.includes(itemId)) {
        setCompletedItems([...completedItems, itemId]);
        try {
          await onItemToggle(task.id, itemId, true, category, 0);
          const token = localStorage.getItem("teamsync_token");
          if (token) {
            await axios.post(
              `${API_URL}/metrics/individual/update`,
              {
                userId: task.assigneeId,
                taskId: task.id,
                itemId: itemId,
                itemType: item.type,
                taskType: task.type,
                category: category,
                action: "increment",
                blocks: 0,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(`${category} count updated successfully`);
          }
        } catch (error) {
          setCompletedItems(completedItems);
          toast.error(`Failed to update ${item.type} status`);
          throw error;
        }
      }
      const totalItems = pidItems.length + lineItems.length;
      const newCompletedCount = completedItems.length + (checked ? 1 : 0);
      if (newCompletedCount === totalItems) {
        toast.success(
          "All P&IDs and lines checked! Task is ready to be marked as complete."
        );
      }
    };

    const handleStatusChange = (status: TaskStatus) => {
      if (onStatusChange) {
        onStatusChange(task.id, status);
      }
    };

    const isInProgress = task.status === "In Progress";
    const isCompleted = task.status === "Completed";

    if (task.type !== "Redline") {
      return null;
    }

    return (
      <Card className="shadow-md hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 animate-fade-in">
        <CardHeader
          className={`
          pb-2 
          ${
            isCompleted
              ? "bg-green-50"
              : isInProgress
              ? "bg-orange-50"
              : "bg-blue-50"
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <TaskTypeIndicator type={task.type} />
                <h3 className="text-lg font-semibold">Redline Task</h3>
              </div>
            </div>
            <div className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-800">
              {task.status}
            </div>
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
            <div className="text-center py-1 px-3 bg-blue-100 rounded-md inline-block">
              <p className="text-base font-medium text-blue-800">
                P&ID: {pidCount}, Lines: {lineCount}
              </p>
              {pidItems.length > 0 && (
                <p className="text-sm text-blue-700 mt-1">
                  P&ID Names: {pidItems.map((item) => item.name).join(", ")}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-2">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">
                Progress:
              </span>
              <span className="text-sm font-medium">{task.progress}%</span>
            </div>
            <Progress value={task.progress} className="h-2" />
            <div className="flex flex-col gap-1 text-xs text-gray-600">
              <div>Assigned at: {formatTime(task.createdAt)}</div>
              <div>
                {task.completedAt
                  ? `Completed at: ${formatTime(task.completedAt)}`
                  : "Not completed"}
              </div>
            </div>

            {pidItems.length > 0 && (
              <Collapsible
                open={isOpenPID}
                onOpenChange={setIsOpenPID}
                className="mt-4"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex w-full justify-between p-0 h-8"
                  >
                    <span className="font-medium">
                      P&ID List ({pidItems.length})
                    </span>
                    {isOpenPID ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {pidItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center space-x-2 py-1 border-b border-gray-100 last:border-0"
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center space-x-2 flex-grow">
                                <Checkbox
                                  id={`pid-${item.id}`}
                                  checked={
                                    completedItems.includes(item.id) ||
                                    item.completed
                                  }
                                  onCheckedChange={(checked: boolean) => {
                                    if (
                                      checked &&
                                      !completedItems.includes(item.id)
                                    ) {
                                      handleCheckItem(item.id, true);
                                    }
                                  }}
                                  disabled={
                                    isCompleted ||
                                    completedItems.includes(item.id) ||
                                    item.completed ||
                                    !isInProgress
                                  }
                                  className="data-[state=checked]:bg-green-500"
                                />
                                <label
                                  htmlFor={`pid-${item.id}`}
                                  className={`text-sm flex-1 cursor-pointer ${
                                    completedItems.includes(item.id) ||
                                    item.completed
                                      ? "line-through text-gray-500"
                                      : ""
                                  }`}
                                >
                                  {item.name}
                                </label>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {!isInProgress
                                ? "Start task to enable this checkbox"
                                : completedItems.includes(item.id) ||
                                  item.completed
                                ? "This item cannot be unchecked"
                                : "Mark as completed"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {lineItems.length > 0 && (
              <Collapsible
                open={isOpen}
                onOpenChange={setIsOpen}
                className="mt-4"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex w-full justify-between p-0 h-8"
                  >
                    <span className="font-medium">
                      Line List ({lineItems.length})
                    </span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {lineItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center space-x-2 py-1 border-b border-gray-100 last:border-0"
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center space-x-2 flex-grow">
                                <Checkbox
                                  id={`line-${item.id}`}
                                  checked={
                                    completedItems.includes(item.id) ||
                                    item.completed
                                  }
                                  onCheckedChange={(checked: boolean) => {
                                    if (
                                      checked &&
                                      !completedItems.includes(item.id)
                                    ) {
                                      handleCheckItem(item.id, true);
                                    }
                                  }}
                                  disabled={
                                    isCompleted ||
                                    completedItems.includes(item.id) ||
                                    item.completed ||
                                    !isInProgress
                                  }
                                  className="data-[state=checked]:bg-green-500"
                                />
                                <label
                                  htmlFor={`line-${item.id}`}
                                  className={`text-sm flex-1 cursor-pointer ${
                                    completedItems.includes(item.id) ||
                                    item.completed
                                      ? "line-through text-gray-500"
                                      : ""
                                  }`}
                                >
                                  {item.name}
                                </label>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {!isInProgress
                                ? "Start task to enable this checkbox"
                                : completedItems.includes(item.id) ||
                                  item.completed
                                ? "This item cannot be unchecked"
                                : "Mark as completed"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CardContent>
        <CardContent className="pt-2 pb-4 flex justify-between">
          {onOpenComments && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenComments(task)}
              className="text-sm"
            >
              Comments{" "}
              {task.comments?.length ? `(${task.comments.length})` : ""}
            </Button>
          )}
          <div className="flex space-x-2">
            {task.status === "Assigned" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange("In Progress")}
                className="bg-orange-50 text-orange-600 hover:bg-orange-100"
              >
                Start Task
              </Button>
            )}
            {task.status === "In Progress" && (
              <Button
                size="sm"
                onClick={() => handleStatusChange("Completed")}
                className="bg-green-500 text-white hover:bg-green-600"
                disabled={
                  completedItems.length !== pidItems.length + lineItems.length
                }
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Complete Task
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.task.id === nextProps.task.id &&
      prevProps.task.status === nextProps.task.status &&
      prevProps.task.lines?.length === nextProps.task.lines?.length &&
      prevProps.task.progress === nextProps.task.progress
    );
  }
);

export default RedlineTaskCard;
