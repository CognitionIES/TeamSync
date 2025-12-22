import { useState, useEffect, useRef, useMemo } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, MessageSquare, AlertCircle } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { Task, TaskStatus } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import TaskTypeIndicator from "./TaskTypeIndicator";
import axios, { AxiosError } from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface PIDBasedTaskCardProps {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  onItemToggle?: (
    taskId: string,
    itemId: string,
    isCompleted: boolean,
    category: string,
    blocks?: number
  ) => void;
  onOpenComments?: (task: Task) => void;
  onUpdate?: () => void;
}

interface PIDWorkItem {
  id: string;
  pid_id: string;
  pid_number: string;
  line_id?: string;
  line_number?: string;
  equipment_id?: string;
  equipment_number?: string;
  status: string;
  completed_at?: string;
  remarks?: string;
  blocks: number;
}

interface PIDGroup {
  pidNumber: string;
  items: PIDWorkItem[];
  allCompleted: boolean;
  completedCount: number;
  totalCount: number;
}

const PIDBasedTaskCard = ({
  task,
  onStatusChange,
  onOpenComments,
  onUpdate,
}: PIDBasedTaskCardProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [openPIDs, setOpenPIDs] = useState<Record<string, boolean>>({});
  const [processingItems, setProcessingItems] = useState<Set<string>>(new Set());
  const [itemBlocks, setItemBlocks] = useState<Record<string, number>>({});
  
  // //   Use useMemo to ensure pidWorkItems is stable and deduplicated
  // const pidWorkItems = useMemo(() => {
  //   const items = task.pidWorkItems || [];
  //   // Deduplicate by ID
  //   const uniqueItems = Array.from(
  //     new Map(items.map(item => [item.id, item])).values()
  //   );
    
  //   console.log(`[${task.id}] useMemo: Input=${items.length}, Unique=${uniqueItems.length}`);
    
  //   if (items.length !== uniqueItems.length) {
  //     console.error(`[${task.id}] DUPLICATES DETECTED IN PROPS!`, {
  //       total: items.length,
  //       unique: uniqueItems.length,
  //       duplicateIds: items.map(i => i.id).filter((id, idx, arr) => arr.indexOf(id) !== idx)
  //     });
  //   }
    
  //   return uniqueItems;
  // }, [task.pidWorkItems, task.id]);
const pidWorkItems = task.pidWorkItems || [];

  // Initialize blocks state only once
  // useEffect(() => {
  //   const initialBlocks: Record<string, number> = {};
  //   pidWorkItems.forEach((item) => {
  //     initialBlocks[item.id] = item.blocks || 0;
  //   });
  //   setItemBlocks(initialBlocks);
    
  //   console.log(`[${task.id}] Initialized with ${pidWorkItems.length} items`);
  // }, [task.id]); // Only re-init if task ID changes

  useEffect(() => {
  const initialBlocks: Record<string, number> = {};
  pidWorkItems.forEach((item) => {
    initialBlocks[item.id] = item.blocks || 0;
  });
  setItemBlocks(initialBlocks);
}, [pidWorkItems]); //  Now depends on pidWorkItems

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
      await onStatusChange(task.originalId || task.id, "In Progress");
      toast.success("Task started - you can now complete items");
    } catch (error) {
      toast.error("Failed to start task");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleComplete = async () => {
    if (!onStatusChange) return;
    setIsUpdating(true);
    try {
      await onStatusChange(task.originalId || task.id, "Completed");
      toast.success("Task marked as completed");
    } catch (error) {
      toast.error("Failed to complete task");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePIDItemToggle = async (
    pidWorkItemId: string,
    pidId: string,
    lineId: string | undefined,
    equipmentId: string | undefined,
    completed: boolean,
    blocks: number
  ) => {
    if (processingItems.has(pidWorkItemId)) {
      console.log(`⏸[${task.id}] Item ${pidWorkItemId} already processing`);
      return;
    }

    if (completed && blocks <= 0) {
      toast.error("Please enter a block count greater than 0");
      return;
    }

    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");

      // console.log(` [${task.id}] Toggling item ${pidWorkItemId}:`, { 
      //   completed, 
      //   blocks,
      //   currentItemCount: pidWorkItems.length 
      // });

      // Mark as processing
      setProcessingItems(prev => new Set(prev).add(pidWorkItemId));
      setIsUpdating(true);

      // Make API call
      await axios.post(
        `${API_URL}/tasks/pid-work-items/mark-complete`,
        {
          pid_id: pidId,
          line_id: lineId || null,
          equipment_id: equipmentId || null,
          user_id: task.assigneeId,
          task_type: task.type,
          status: completed ? "Completed" : "In Progress",
          remarks: "",
          blocks: completed ? blocks : 0,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }
      );

      //console.log(`[${task.id}] Backend updated successfully`);
      
      toast.success(
        completed 
          ? `  Completed with ${blocks} blocks` 
          : "Progress updated"
      );
      
      //   DO NOT call onUpdate - let parent handle refetch on its own schedule
      
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error(`❌ [${task.id}] Error:`, axiosError.response?.data);

      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(pidWorkItemId);
        return newSet;
      });

      toast.error(axiosError.response?.data?.message || "Failed to update");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkipItem = async (
    pidWorkItemId: string,
    pidId: string,
    lineId: string | undefined,
    equipmentId: string | undefined
  ) => {
    if (processingItems.has(pidWorkItemId)) return;

    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");

      setProcessingItems(prev => new Set(prev).add(pidWorkItemId));
      setIsUpdating(true);

      await axios.post(
        `${API_URL}/tasks/pid-work-items/mark-complete`,
        {
          pid_id: pidId,
          line_id: lineId || null,
          equipment_id: equipmentId || null,
          user_id: task.assigneeId,
          task_type: task.type,
          status: "Skipped",
          remarks: "Item skipped by user",
          blocks: 0,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }
      );

      toast.success("Item skipped");
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error("❌ Error skipping:", axiosError);

      setProcessingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(pidWorkItemId);
        return newSet;
      });

      toast.error(axiosError.response?.data?.message || "Failed to skip");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBlocksChange = (itemId: string, newBlocks: number) => {
    setItemBlocks(prev => ({
      ...prev,
      [itemId]: newBlocks
    }));
  };

  //   Group items using the memoized pidWorkItems
  const pidGroups: Record<string, PIDGroup> = useMemo(() => {
    const groups = pidWorkItems.reduce((acc, item) => {
      if (!acc[item.pid_id]) {
        acc[item.pid_id] = {
          pidNumber: item.pid_number,
          items: [],
          allCompleted: true,
          completedCount: 0,
          totalCount: 0,
        };
      }
      acc[item.pid_id].items.push(item);
      acc[item.pid_id].totalCount++;

      const isCompleted = item.status === "Completed" || item.status === "Skipped";
      if (isCompleted) {
        acc[item.pid_id].completedCount++;
      } else {
        acc[item.pid_id].allCompleted = false;
      }

      return acc;
    }, {} as Record<string, PIDGroup>);
    
    // console.log(` [${task.id}] Grouped into ${Object.keys(groups).length} PIDs, ${pidWorkItems.length} total items`);
    
    return groups;
  }, [pidWorkItems, task.id]);

  const allCompleted = Object.values(pidGroups).every(group => group.allCompleted);
  const totalItems = pidWorkItems.length;
  const completedItems = pidWorkItems.filter(
    (item) => item.status === "Completed" || item.status === "Skipped"
  ).length;

  const togglePID = (pidId: string) => {
    setOpenPIDs(prev => ({ ...prev, [pidId]: !prev[pidId] }));
  };

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
            <div className="flex items-center gap-2">
              <TaskTypeIndicator type={task.type} />
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                📋 PID-Based
              </span>
            </div>
            <CardTitle className="text-lg font-semibold text-gray-800">
              {task.type} Assignment - PID: {task.pidNumber}
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
          <div className="bg-purple-50 p-2 rounded-lg">
            <p className="text-xs text-purple-700">
              📊 Progress: {completedItems} / {totalItems} items completed (
              {totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0}%)
            </p>
            <p className="text-xs text-purple-600 mt-1">
              {Object.keys(pidGroups).length} PID(s) assigned
            </p>
          </div>
          <div className="bg-gray-50 p-2 rounded-lg">
            <p className="text-xs text-gray-600">
              Assigned: {formatDate(task.createdAt)} at {formatTime(task.createdAt)}
            </p>
            {task.completedAt && (
              <p className="text-xs text-gray-600">
                Completed: {formatDate(task.completedAt)} at{" "}
                {formatTime(task.completedAt)}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-grow p-4 overflow-y-auto max-h-96">
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          PIDs & Lines/Equipment
        </h4>
        <div className="space-y-3">
          {Object.entries(pidGroups).map(([pidId, group]) => {
            const isOpen = openPIDs[pidId] ?? true;

            return (
              <div
                key={pidId}
                className="border-2 border-purple-200 rounded-lg bg-purple-50/30"
              >
                <Collapsible open={isOpen} onOpenChange={() => togglePID(pidId)}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-purple-100/50 rounded-t-lg transition-colors">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="flex items-center">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-purple-700" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-purple-700" />
                          )}
                        </div>
                        <Checkbox
                          checked={group.allCompleted}
                          disabled={true}
                          className="h-5 w-5 text-purple-600 border-purple-300 rounded cursor-not-allowed opacity-50"
                        />
                        <div className="flex-1">
                          <h5 className="text-sm font-semibold text-purple-900">
                            📋 PID: {group.pidNumber}
                          </h5>
                          <p className="text-xs text-purple-700 mt-0.5">
                            {group.allCompleted ? (
                              <span className="text-green-600 font-medium">
                                  All {group.totalCount} items completed
                              </span>
                            ) : (
                              <span>
                                ○ {group.completedCount}/{group.totalCount} items completed
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-3 pb-3 space-y-2">
                      {group.items.map((item) => {
                        const blocks = itemBlocks[item.id] ?? item.blocks ?? 0;
                        const isCompleted = item.status === "Completed";
                        const isSkipped = item.status === "Skipped";
                        const isProcessing = processingItems.has(item.id);
                        const isEditable =
                          task.status === "In Progress" && 
                          !isCompleted && 
                          !isSkipped && 
                          !isProcessing;
                        const isCheckable = isEditable && blocks > 0;

                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg shadow-sm transition-all duration-200",
                              isCompleted
                                ? "bg-green-50 border-2 border-green-300"
                                : isSkipped
                                  ? "bg-gray-100 border-2 border-gray-300"
                                  : "bg-white hover:bg-blue-50 border-2 border-gray-200"
                            )}
                          >
                            <div className="flex items-center space-x-3 flex-grow">
                              <Checkbox
                                id={`pid-item-${item.id}`}
                                checked={isCompleted}
                                disabled={
                                  isUpdating ||
                                  isCompleted ||
                                  isSkipped ||
                                  isProcessing ||
                                  task.status !== "In Progress" ||
                                  !isCheckable
                                }
                                onCheckedChange={(checked) => {
                                  if (checked && !isCompleted && !isProcessing && blocks > 0) {
                                    handlePIDItemToggle(
                                      item.id,
                                      pidId,
                                      item.line_id,
                                      item.equipment_id,
                                      true,
                                      blocks
                                    );
                                  }
                                }}
                                className={cn(
                                  "h-5 w-5 border-2 rounded transition-all",
                                  isCompleted
                                    ? "bg-green-500 border-green-500"
                                    : isCheckable
                                      ? "border-blue-400 hover:border-blue-500 cursor-pointer"
                                      : "border-gray-300 cursor-not-allowed opacity-50"
                                )}
                              />
                              <label
                                htmlFor={`pid-item-${item.id}`}
                                className={cn(
                                  "text-sm font-medium flex-1 transition-all duration-200",
                                  isCompleted
                                    ? "line-through text-gray-400"
                                    : isSkipped
                                      ? "line-through text-gray-400 italic"
                                      : "text-gray-800"
                                )}
                              >
                                <span className="block">
                                  {item.line_number
                                    ? `Line: ${item.line_number}`
                                    : `Equipment: ${item.equipment_number}`}
                                </span>
                                {isCompleted && (
                                  <span className="text-xs text-green-600 font-semibold mt-1 flex items-center gap-1">
                                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                                    {blocks} {blocks === 1 ? "block" : "blocks"} completed
                                  </span>
                                )}
                                {isSkipped && (
                                  <span className="text-xs text-gray-500 italic mt-1">
                                    (Skipped - data unavailable)
                                  </span>
                                )}
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              {!isCompleted && !isSkipped && !isProcessing && (
                                <>
                                  <div className="flex flex-col items-end">
                                    <input
                                      type="number"
                                      min="0"
                                      value={blocks}
                                      onChange={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (isEditable) {
                                          const newBlocks = parseInt(e.target.value) || 0;
                                          handleBlocksChange(item.id, newBlocks);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                        }
                                      }}
                                      className={cn(
                                        "w-20 p-2 border-2 rounded-md text-sm text-center font-semibold focus:outline-none focus:ring-2 transition-all",
                                        isEditable
                                          ? "border-blue-300 focus:ring-blue-500 focus:border-blue-500 bg-blue-50"
                                          : "border-gray-200 bg-gray-100 cursor-not-allowed text-gray-500"
                                      )}
                                      placeholder="0"
                                      disabled={!isEditable}
                                    />
                                    <span className="text-xs text-gray-500 mt-1">blocks</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSkipItem(
                                        item.id,
                                        pidId,
                                        item.line_id,
                                        item.equipment_id
                                      );
                                    }}
                                    disabled={!isEditable || isUpdating}
                                    className="h-10 px-3 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 border border-orange-200 hover:border-orange-300 transition-all"
                                  >
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    Skip
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}
        </div>

        {task.status === "In Progress" && !allCompleted && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800 flex items-start">
              <AlertCircle className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
              <span>
                Complete all items or skip unavailable ones before marking task complete
              </span>
            </p>
          </div>
        )}
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
            {allCompleted ? "Complete Task" : "Complete All Items First"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default PIDBasedTaskCard;