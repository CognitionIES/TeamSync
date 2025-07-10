/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, memo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Navbar from "../shared/Navbar";
import TaskCard from "../shared/TaskCard";
import { Button } from "@/components/ui/button";
import { Task, TaskItem, TaskComment, TaskType, TaskStatus } from "@/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import TaskComments from "../shared/TaskComments";
import TaskTypeIndicator from "../shared/TaskTypeIndicator";
import { InfoIcon, FileText, CheckCircle } from "lucide-react";
import axios, { AxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getRandomMessage } from "@/components/shared/messages";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import MiscTaskCard from "../shared/MiscTaskCard";
import RedlineTaskCard from "../shared/RedlineTaskCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

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

// Format date as "MMM DD, YYYY"
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const TeamMemberDashboard = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const token = localStorage.getItem("teamsync_token");

  useEffect(() => {
    if (!isAuthenticated || !token) {
      toast.error("Please log in to access the dashboard.");
      navigate("/login", { replace: true });
    } else if (user?.role !== "Team Member") {
      toast.error("You are not authorized to access this dashboard.");
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, user, token, navigate]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("teamsync_token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get<{ data: any[] }>(
        `${API_URL}/tasks`,
        getAuthHeaders()
      );

      const tasksData = response.data.data.map((task, taskIndex) => {
        const commentMap = new Map<string, TaskComment>();
        (task.comments || []).forEach((comment: any, commentIndex: number) => {
          if (
            !comment ||
            !comment.id ||
            !comment.user_id ||
            !comment.created_at
          ) {
            console.warn(
              `Invalid comment at task index ${taskIndex}, comment index ${commentIndex}:`,
              comment
            );
            return;
          }
          const key = `${comment.user_id}-${comment.comment}-${comment.created_at}`;
          if (!commentMap.has(key)) {
            commentMap.set(key, {
              id: comment.id.toString(),
              userId: comment.user_id.toString(),
              userName: comment.user_name || "Unknown",
              userRole: comment.user_role || "Unknown",
              comment: comment.comment || "",
              createdAt: comment.created_at,
            });
          }
        });
        const uniqueComments = Array.from(commentMap.values());

        const mappedItems = (task.items || [])
          .map((item: any, itemIndex: number) => {
            if (!item || !item.id) {
              console.warn(
                `Invalid item at task index ${taskIndex}, item index ${itemIndex}:`,
                item
              );
              return null;
            }
            return {
              id: item.id.toString(),
              name: item.name || "Unnamed Item",
              type: item.item_type || "Unknown",
              completed: item.completed || false,
            };
          })
          .filter((item): item is TaskItem => item !== null);

        return {
          id: task.id.toString(),
          type: task.type as TaskType,
          assignee: task.assignee || "Unknown",
          assigneeId: task.assignee_id.toString(),
          status: task.status || "Assigned",
          isComplex: task.is_complex || false,
          createdAt: task.created_at || new Date().toISOString(),
          updatedAt: task.updated_at || new Date().toISOString(),
          completedAt: task.completed_at || null,
          progress: task.progress || 0,
          projectId: task.project_id?.toString() || "Unknown",
          projectName: task.project_name || "Unknown",
          areaNumber: task.area_name || "N/A",
          items: mappedItems,
          comments: uniqueComments,
          description: task.description || "",
          pidNumber: task.pid_number ?? "",
        };
      });

      const tasksWithLines = tasksData.map((task) => {
        const pidItem = task.items.find((item) => item.type === "PID");
        const taskLines = task.items
          .filter((item) => item.type === "Line")
          .map((item) => ({
            id: item.id,
            name: item.name,
            pidId: pidItem?.id || "",
            completed: item.completed,
          }));
        const updatedPidNumber = pidItem
          ? pidItem.name
          : task.pidNumber || "N/A";
        return { ...task, lines: taskLines, pidNumber: updatedPidNumber };
      });

      console.log("Mapped tasks with updated pidNumber:", tasksWithLines);
      setTasks(tasksWithLines);
    } catch (error) {
      console.error("Raw error in fetchTasks:", error);
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching tasks:", {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch tasks"
      );
    } finally {
      console.log("Setting isLoading to false...");
      setIsLoading(false);
      console.log("isLoading set to false");
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === "Team Member" && token) {
      fetchTasks();
    }
  }, [isAuthenticated, user, token]);

  const handleRefresh = () => {
    fetchTasks()
      .then(() => {
        toast.success("Tasks refreshed");
      })
      .catch((error) => {
        console.error("Error refreshing tasks:", error);
        toast.error("Failed to refresh tasks");
      });
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const authHeaders = getAuthHeaders();
      await axios.patch(
        `${API_URL}/tasks/${taskId}/status`,
        { status: newStatus },
        authHeaders
      );
      await fetchTasks();
      if (newStatus === "In Progress") {
        toast.success("Task started successfully");
      } else if (newStatus === "Completed") {
        toast.success("Task completed successfully");
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error updating task status:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to update task status"
      );
      throw error;
    }
  };

  const handleItemToggle = async (
    taskId: string,
    itemId: string,
    isCompleted: boolean
  ) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== "In Progress" && isCompleted) {
      toast.error("You must start the task before marking items as completed");
      return Promise.reject("Task not started");
    }

    const item = task?.items.find((i) => i.id === itemId);
    if (item?.completed && !isCompleted) {
      toast.error("Items cannot be unchecked once completed");
      return Promise.reject("Item cannot be unchecked");
    }

    try {
      const authHeaders = getAuthHeaders();
      await axios.patch(
        `${API_URL}/tasks/${taskId}/items/${itemId}`,
        { completed: isCompleted },
        authHeaders
      );
      await fetchTasks();
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error updating item status:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to update item status"
      );
      throw error;
    }
  };

  const handleOpenComments = (task: Task) => {
    setSelectedTask(task);
    setIsCommentsOpen(true);
  };

  const handleAddComment = async (taskId: string, comment: string) => {
    try {
      const authHeaders = getAuthHeaders();
      console.log("Sending comment to:", `${API_URL}/tasks/${taskId}/comments`);
      await axios.post(
        `${API_URL}/tasks/${taskId}/comments`,
        { comment },
        authHeaders
      );
      await fetchTasks();
      const updatedTask = tasks.find((task) => task.id === taskId);
      if (updatedTask && selectedTask?.id === taskId) {
        setSelectedTask(updatedTask);
      }
      toast.success("Comment added successfully");
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error adding comment:", axiosError);
      if (axiosError.code === "ERR_NETWORK") {
        toast.error(
          "Cannot connect to the server. Please ensure the backend is running and the API URL is correct."
        );
      } else if (axiosError.response?.status === 404) {
        toast.error(
          "The task does not exist or the comment endpoint is unavailable."
        );
      } else if (axiosError.response?.status === 401) {
        toast.error(
          "You are not authorized to add a comment. Please log in again."
        );
      } else {
        toast.error(
          axiosError.response?.data?.message || "Failed to add comment"
        );
      }
      throw error;
    }
  };

  if (!isAuthenticated || user?.role !== "Team Member" || !token) {
    return null;
  }

  const assignedTasks = tasks.filter((task) => task.status === "Assigned");
  const inProgressTasks = tasks.filter((task) => task.status === "In Progress");
  const completedTasks = tasks
    .filter((task) => task.status === "Completed")
    .sort((a, b) => {
      const dateA = new Date(a.completedAt!);
      const dateB = new Date(b.completedAt!);
      if (isNaN(dateA.getTime())) return 1;
      if (isNaN(dateB.getTime())) return -1;
      return dateB.getTime() - dateA.getTime();
    });

  const taskCounts = {
    assigned: assignedTasks.length,
    inProgress: inProgressTasks.length,
    completed: completedTasks.length,
  };

  return (
    <div className="min-h-screen">
      <Navbar onRefresh={handleRefresh} />
      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Team Member Dashboard</h1>
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="px-3 py-1 bg-blue-100 text-teamsync-assigned rounded-full text-sm">
              {taskCounts.assigned} Assigned
            </div>
            <div className="px-3 py-1 bg-orange-100 text-teamsync-inProgress rounded-full text-sm">
              {taskCounts.inProgress} In Progress
            </div>
            <div className="px-3 py-1 bg-green-100 text-teamsync-completed rounded-full text-sm">
              {taskCounts.completed} Completed
            </div>
          </div>
          <div className="mt-4">
            <AlertDescription className="text-yellow-700">
              {getRandomMessage("general") ||
                "Stay on top of your tasks to keep the project moving!"}
            </AlertDescription>
          </div>
        </header>

        {assignedTasks.length > 0 && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <InfoIcon className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">
              Task Workflow Reminder
            </AlertTitle>
            <AlertDescription className="text-blue-700">
              Remember to click "Start Task" before you can mark items as
              completed. Once marked complete, items cannot be unchecked.
            </AlertDescription>
          </Alert>
        )}

        <div className="block md:hidden mb-6">
          <Tabs defaultValue="assigned">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="assigned">Assigned</TabsTrigger>
              <TabsTrigger value="inProgress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <TabsContent value="assigned" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : assignedTasks.length > 0 ? (
                assignedTasks.map((task) =>
                  task.type === TaskType.Misc ? (
                    <MiscTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onOpenComments={handleOpenComments}
                    />
                  ) : (
                    <RedlineTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onItemToggle={handleItemToggle}
                      onOpenComments={handleOpenComments}
                    />
                  )
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {getRandomMessage("noTasks") || "No assigned tasks"}
                </div>
              )}
            </TabsContent>

            <TabsContent value="inProgress" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : inProgressTasks.length > 0 ? (
                inProgressTasks.map((task) =>
                  task.type === "Misc" ? (
                    <MiscTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onOpenComments={handleOpenComments}
                    />
                  ) : (
                    <RedlineTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onItemToggle={handleItemToggle}
                      onOpenComments={handleOpenComments}
                    />
                  )
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {getRandomMessage("noTasks") || "No in-progress tasks"}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : completedTasks.length > 0 ? (
                completedTasks.map((task) =>
                  task.type === "Misc" ? (
                    <MiscTaskCard
                      key={task.id}
                      task={task}
                      onOpenComments={handleOpenComments}
                    />
                  ) : (
                    <RedlineTaskCard
                      key={task.id}
                      task={task}
                      onOpenComments={handleOpenComments}
                    />
                  )
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {getRandomMessage("noTasks") || "No completed tasks"}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden md:grid md:grid-cols-3 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 bg-teamsync-assigned rounded-full mr-2"></div>
              Assigned
            </h2>
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : assignedTasks.length > 0 ? (
                assignedTasks.map((task) =>
                  task.type === "Misc" ? (
                    <MiscTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onOpenComments={handleOpenComments}
                    />
                  ) : (
                    <RedlineTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onItemToggle={handleItemToggle}
                      onOpenComments={handleOpenComments}
                    />
                  )
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {getRandomMessage("noTasks") || "No assigned tasks"}
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 bg-teamsync-inProgress rounded-full mr-2"></div>
              In Progress
            </h2>
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : inProgressTasks.length > 0 ? (
                inProgressTasks.map((task) =>
                  task.type === "Misc" ? (
                    <MiscTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onOpenComments={handleOpenComments}
                    />
                  ) : (
                    <RedlineTaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={handleStatusChange}
                      onItemToggle={handleItemToggle}
                      onOpenComments={handleOpenComments}
                    />
                  )
                )
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {getRandomMessage("noTasks") || "No in-progress tasks"}
                </div>
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 bg-teamsync-completed rounded-full mr-2"></div>
              Completed
            </h2>
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading...</div>
              ) : completedTasks.length > 0 ? (
                completedTasks.map((task) => (
                  <Collapsible key={task.id} defaultOpen={false}>
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="flex w-full justify-between items-center h-[60px] p-3 bg-green-50 hover:bg-green-100 rounded-lg shadow-sm transition-all duration-200"
                      >
                        <div className="flex flex-col items-start text-left">
                          <span className="font-semibold text-sm text-green-800 truncate">
                            {task.type} - {task.projectName} - Area No:{" "}
                            {task.areaNumber}
                          </span>
                          <div className="text-xs text-gray-600 mt-1">
                            <span>Assigned: {formatDate(task.createdAt)}</span>
                            {task.completedAt && (
                              <span className="ml-2">
                                Completed: {formatDate(task.completedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <ChevronDown className="h-4 w-4 CollapsibleChevron text-green-600" />
                          <ChevronUp className="h-4 w-4 hidden CollapsibleChevron text-green-600" />
                        </div>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 px-2 transition-all duration-200">
                      <div className="border-l-2 border-green-200 pl-4">
                        {task.type === "Misc" ? (
                          <MiscTaskCard
                            task={task}
                            onOpenComments={handleOpenComments}
                          />
                        ) : (
                          <RedlineTaskCard
                            task={task}
                            onOpenComments={handleOpenComments}
                          />
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {getRandomMessage("noTasks") || "No completed tasks"}
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Task Comments</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <TaskComments
                taskId={selectedTask.id}
                comments={selectedTask.comments}
                onAddComment={handleAddComment}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TeamMemberDashboard;

/*
.CollapsibleTrigger[aria-expanded="true"] .CollapsibleChevron:first-child {
  display: none;
}

.CollapsibleTrigger[aria-expanded="true"] .CollapsibleChevron:last-child {
  display: block !important;
}

.CollapsibleTrigger[aria-expanded="false"] .CollapsibleChevron:first-child {
  display: block !important;
}

.CollapsibleTrigger[aria-expanded="false"] .CollapsibleChevron:last-child {
  display: none;
}
*/
