/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
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
import { InfoIcon } from "lucide-react";
import axios, { AxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface Line {
  id: string;
  name: string;
  pidId: string;
}

const RedlineTaskCard = ({
  task,
  onStatusChange,
  onItemToggle,
  onOpenComments,
}: {
  task: Task;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void>;
  onItemToggle?: (
    taskId: string,
    itemId: string,
    isCompleted: boolean
  ) => Promise<void>;
  onOpenComments?: (task: Task) => void;
}) => {
  const [pidLines, setPidLines] = useState<
    { id: string; name: string; completed: boolean }[]
  >([]);

  useEffect(() => {
    const fetchLines = async () => {
      if (task.type === "Redline") {
        const pidItem = task.items.find((item) => item.type === "PID");
        if (pidItem) {
          try {
            const token = localStorage.getItem("teamsync_token");
            if (!token) throw new Error("No authentication token found");

            const response = await axios.get<{
              data: { id: number; line_number: string; pid_id: number }[];
            }>(`${API_URL}/lines`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            const linesData = response.data.data
              .filter((line) => line.pid_id.toString() === pidItem.id)
              .map((line) => ({
                id: line.id.toString(),
                name: line.line_number,
                completed: false, // Not tracking completion since we're not showing checkboxes
              }));

            setPidLines(linesData);
          } catch (error) {
            const axiosError = error as AxiosError<{ message: string }>;
            console.error("Error fetching lines:", axiosError);
            toast.error(
              axiosError.response?.data?.message || "Failed to fetch lines"
            );
          }
        }
      }
    };

    fetchLines();
  }, [task]);

  const pidItem = task.items.find((item) => item.type === "PID");
  if (pidItem && !pidItem.id) {
    console.warn("Invalid PID item in task:", task, pidItem);
    return;
  }
  const pidCount = pidItem ? 1 : 0;
  const lineCount = pidLines.length;

  if (task.type !== "Redline") {
    return (
      <TaskCard
        task={task}
        onStatusChange={onStatusChange}
        onItemToggle={onItemToggle}
        onOpenComments={onOpenComments}
      />
    );
  }

  return (
    <Card className="shadow-md hover:shadow-lg transition-all duration-300">
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
            <h3 className="text-lg font-semibold">Redline Task</h3>
          </div>
          <div className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            {task.status}
          </div>
        </div>
        <div className="text-center mt-2 py-1 px-3 bg-blue-100 rounded-md inline-block">
          <p className="text-base font-medium text-blue-800">
            P&ID: {pidCount}, Lines: {lineCount}
          </p>
          {pidItem && (
            <p className="text-sm text-blue-700 mt-1">{pidItem.name}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col gap-2 text-sm text-gray-600 mb-4">
          <div>Assigned at: {formatTime(task.createdAt)}</div>
          <div>
            {task.completedAt
              ? `Completed at: ${formatTime(task.completedAt)}`
              : "Not completed"}
          </div>
        </div>

        <h4 className="text-sm font-medium mb-2">Lines in P&ID:</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {pidLines.length > 0 ? (
            <p className="text-sm text-gray-600">
              This P&ID contains {pidLines.length} lines.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              No lines found for this P&ID.
            </p>
          )}
        </div>
        <div className="mt-4">
          <div className="flex justify-between space-x-2">
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
                  onClick={() => onStatusChange?.(task.id, "In Progress")}
                  className="bg-orange-50 text-orange-600 hover:bg-orange-100"
                >
                  Start Task
                </Button>
              )}

              {task.status === "In Progress" && (
                <Button
                  size="sm"
                  onClick={() => onStatusChange?.(task.id, "Completed")}
                  className="bg-green-500 text-white hover:bg-green-600"
                >
                  Complete Task
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Format time in HH:MM 24-hour format
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const TeamMemberDashboard = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  // Check for token on mount
  const token = localStorage.getItem("teamsync_token");

  // Redirect to login if not authenticated, not a Team Member, or no token
  useEffect(() => {
    if (!isAuthenticated || !token) {
      toast.error("Please log in to access the dashboard.");
      navigate("/login", { replace: true });
    } else if (user?.role !== "Team Member") {
      toast.error("You are not authorized to access this dashboard.");
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, user, token, navigate]);

  // Helper to get the headers with the token
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

  // Fetch tasks assigned to the team member
  const fetchTasks = async () => {
    try {
      console.log("Starting fetchTasks...");
      console.log("Setting isLoading to true...");
      setIsLoading(true); // Line 214
      console.log("isLoading set to true");

      console.log("Making API request to /api/tasks...");
      const response = await axios.get<{ data: any[] }>(
        `${API_URL}/tasks`,
        getAuthHeaders()
      );
      console.log("Fetch tasks response:", response.data);

      const tasksData = response.data.data.map((task, taskIndex) => {
        console.log("Mapping task:", task);
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
          projectId: task.project_id?.toString() || "Unknown", // Ensure projectId is included
          items: mappedItems,
          comments: uniqueComments,
        };
      });

      console.log("Mapped tasks:", tasksData);
      setTasks(tasksData);
    } catch (error) {
      console.error("Raw error in fetchTasks:", error); // Line 284
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
      console.log("Setting isLoading to false..."); // Line 295
      setIsLoading(false);
      console.log("isLoading set to false");
    }
  };

  // Load tasks on initial render
  useEffect(() => {
    if (isAuthenticated && user?.role === "Team Member" && token) {
      fetchTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await axios.post(
        `${API_URL}/tasks/${taskId}/comments`,
        { comment },
        authHeaders
      );
      // Fetch updated tasks and ensure selectedTask is updated synchronously
      await fetchTasks();
      const updatedTask = tasks.find((task) => task.id === taskId);
      if (updatedTask && selectedTask?.id === taskId) {
        setSelectedTask(updatedTask);
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error adding comment:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to add comment"
      );
      throw error;
    }
  };

  if (!isAuthenticated || user?.role !== "Team Member" || !token) {
    return null;
  }

  const assignedTasks = tasks.filter((task) => task.status === "Assigned");
  const inProgressTasks = tasks.filter((task) => task.status === "In Progress");
  const completedTasks = tasks.filter((task) => task.status === "Completed");

  const taskCounts = {
    assigned: assignedTasks.length,
    inProgress: inProgressTasks.length,
    completed: completedTasks.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
                <div className="text-center py-8">Loading tasks...</div>
              ) : assignedTasks.length > 0 ? (
                assignedTasks.map((task) => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onItemToggle={handleItemToggle}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No assigned tasks
                </div>
              )}
            </TabsContent>

            <TabsContent value="inProgress" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : inProgressTasks.length > 0 ? (
                inProgressTasks.map((task) => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onItemToggle={handleItemToggle}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No in-progress tasks
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : completedTasks.length > 0 ? (
                completedTasks.map((task) => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No completed tasks
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
                <div className="text-center py-8">Loading tasks...</div>
              ) : assignedTasks.length > 0 ? (
                assignedTasks.map((task) => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onItemToggle={handleItemToggle}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No assigned tasks
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
                <div className="text-center py-8">Loading tasks...</div>
              ) : inProgressTasks.length > 0 ? (
                inProgressTasks.map((task) => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onItemToggle={handleItemToggle}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No in-progress tasks
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
                <div className="text-center py-8">Loading tasks...</div>
              ) : completedTasks.length > 0 ? (
                completedTasks.map((task) => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No completed tasks
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
