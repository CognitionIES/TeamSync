/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Task, TaskComment, TaskItem, TaskStatus } from "@/types";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import TaskCard from "../shared/TaskCard";
import RedlineTaskCard from "../shared/RedlineTaskCard";
import PIDBasedTaskCard from "../shared/PIDBasedTaskCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TaskComments from "../shared/TaskComments";
import axios, { AxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getRandomMessage } from "@/components/shared/messages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const TeamLeadMemberView = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generalMessage, setGeneralMessage] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  const token = localStorage.getItem("teamsync_token");

  // ✅ Helper function to check if task is PID-based
  const isTaskPIDBased = (task: Task): boolean => {
    return task.isPIDBased === true || (
      task.pidWorkItems !== undefined &&
      Array.isArray(task.pidWorkItems) &&
      task.pidWorkItems.length > 0
    );
  };

  useEffect(() => {
    if (!isAuthenticated || !token) {
      toast.info(getRandomMessage("login"));
      navigate("/login", { replace: true });
    } else if (user?.role !== "Team Lead") {
      toast.error("You are not authorized to access this page.");
      navigate("/dashboard", { replace: true });
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

  const fetchMyTasks = async () => {
    try {
      setIsLoading(true);
      console.log("Fetching tasks for Team Lead (as member):", user?.id);

      const response = await axios.get<{ data: any[] }>(
        `${API_URL}/tasks`,
        getAuthHeaders()
      );

      // Filter tasks assigned to this team lead
      const myTasks = response.data.data.filter(
        (task) => task.assignee_id?.toString() === user?.id?.toString()
      );

      const tasksData = myTasks.map((task) => {
        const commentMap = new Map<string, TaskComment>();
        (task.comments || []).forEach((comment: any) => {
          if (
            !comment ||
            !comment.id ||
            !comment.user_id ||
            !comment.created_at
          ) {
            return;
          }
          const key = `${comment.user_id}-${comment.comment}-${comment.created_at}`;
          if (!commentMap.has(key)) {
            commentMap.set(key, {
              id: comment.id.toString(),
              userId: comment.user_id.toString(),
              userName: comment.user_name || "",
              userRole: comment.user_role || "",
              comment: comment.comment || "",
              createdAt: comment.created_at,
            });
          }
        });
        const uniqueComments = Array.from(commentMap.values());

        const mappedItems: TaskItem[] = (task.items || [])
          .map((item: any) => {
            if (!item || !item.id) {
              return null;
            }
            return {
              id: item.id.toString(),
              name: item.name || "",
              type: item.item_type || "",
              completed: item.completed || false,
              completedAt: item.completed_at || null,
              blocks: item.blocks || 0,
            };
          })
          .filter((item): item is TaskItem => item !== null);

        // ✅ Include PID work items
        const hasPIDWorkItems =
          task.pid_work_items &&
          Array.isArray(task.pid_work_items) &&
          task.pid_work_items.length > 0;

        return {
          id: task.id.toString(),
          type: task.type,
          assignee: task.assignee || "",
          assigneeId: task.assignee_id?.toString() || "",
          status: task.status || "Assigned",
          isComplex: task.is_complex || false,
          createdAt: task.created_at || new Date().toISOString(),
          updatedAt: task.updated_at || new Date().toISOString(),
          completedAt: task.completed_at || null,
          progress: task.progress || 0,
          projectId: task.project_id?.toString() || null,
          items: mappedItems,
          comments: uniqueComments,
          pidNumber: task.pid_number ?? "N/A",
          projectName: task.project_name ?? "Unknown",
          areaNumber: task.area_name ?? "N/A",
          description: task.description || "",
          lines: task.lines || [],
          isPIDBased: hasPIDWorkItems,
          pidWorkItems: task.pid_work_items || [],
        };
      });

      setTasks(tasksData);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching my tasks:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch your tasks"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchMyTasks();
    toast.success("Tasks refreshed");
    setGeneralMessage(getRandomMessage("general"));
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await axios.patch(
        `${API_URL}/tasks/${taskId}/status`,
        { status: newStatus },
        getAuthHeaders()
      );
      await fetchMyTasks();
      toast.success(`Task status updated to ${newStatus}`);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      toast.error(
        axiosError.response?.data?.message || "Failed to update task status"
      );
    }
  };

  const handleItemToggle = async (
    taskId: string,
    itemId: string,
    completed: boolean,
    category: string,
    blocks?: number
  ) => {
    try {
      const effectiveBlocks = blocks !== undefined && blocks >= 0 ? blocks : 0;

      await axios.patch(
        `${API_URL}/tasks/${taskId}/items/${itemId}`,
        { completed, blocks: effectiveBlocks },
        getAuthHeaders()
      );

      // Optimistic update
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                items: task.items.map((item) =>
                  item.id === itemId
                    ? { ...item, completed, blocks: effectiveBlocks }
                    : item
                ),
              }
            : task
        )
      );

      await fetchMyTasks();
      toast.success("Task item updated successfully");
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      toast.error(
        axiosError.response?.data?.message || "Failed to update task item"
      );
    }
  };

  const handleOpenComments = (task: Task) => {
    setSelectedTask(task);
    setIsCommentsOpen(true);
  };

  const handleAddComment = async (taskId: string, comment: string) => {
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/comments`,
        { comment },
        getAuthHeaders()
      );
      await fetchMyTasks();
      toast.success("Comment added");
    } catch {
      toast.error("Failed to add comment");
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.role === "Team Lead" && token) {
      fetchMyTasks();
      setGeneralMessage(getRandomMessage("general"));
    }
  }, [isAuthenticated, user, token]);

  if (!isAuthenticated || user?.role !== "Team Lead" || !token) {
    return null;
  }

  const assignedTasks = tasks.filter((task) => task.status === "Assigned");
  const inProgressTasks = tasks.filter((task) => task.status === "In Progress");
  const completedTasks = tasks.filter((task) => task.status === "Completed");

  // ✅ Helper function to render correct card type
  const renderTaskCard = (task: Task, showActions: boolean = true) => {
    if (isTaskPIDBased(task)) {
      return (
        <PIDBasedTaskCard
          key={task.id}
          task={task}
          onStatusChange={showActions ? handleStatusChange : undefined}
          onItemToggle={showActions ? handleItemToggle : undefined}
          onOpenComments={handleOpenComments}
          onUpdate={fetchMyTasks}
        />
      );
    } else if (task.type === "Redline") {
      return (
        <RedlineTaskCard
          key={task.id}
          task={task}
          onStatusChange={showActions ? handleStatusChange : undefined}
          onItemToggle={showActions ? handleItemToggle : undefined}
          onOpenComments={handleOpenComments}
        />
      );
    } else {
      return (
        <TaskCard
          key={task.id}
          task={task}
          onStatusChange={showActions ? handleStatusChange : undefined}
          onItemToggle={showActions ? handleItemToggle : undefined}
          onOpenComments={handleOpenComments}
        />
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onRefresh={handleRefresh} />

      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Button
              onClick={() => navigate("/dashboard")}
              variant="ghost"
              size="sm"
              className="hover:bg-gray-100"
            >
              <svg
                className="h-4 w-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Team Dashboard
            </Button>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">My Tasks</h1>
          <p className="text-gray-600 mt-1">
            View and manage tasks assigned to you
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              {assignedTasks.length} Assigned
            </div>
            <div className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
              {inProgressTasks.length} In Progress
            </div>
            <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              {completedTasks.length} Completed
            </div>
          </div>
          {generalMessage && (
            <p className="text-sm text-gray-600 italic mt-2">
              "{generalMessage}"
            </p>
          )}
        </header>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">{getRandomMessage("loading")}</p>
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <svg
                className="h-16 w-16 mx-auto text-gray-300 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="text-gray-500 text-lg font-medium">
                No tasks assigned to you yet
              </p>
              <p className="text-gray-400 text-sm mt-2">
                You can assign tasks to yourself from the Team Dashboard
              </p>
              <Button onClick={() => navigate("/dashboard")} className="mt-4">
                Go to Team Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile View - Tabs */}
            <div className="block md:hidden">
              <Tabs defaultValue="assigned">
                <TabsList className="grid grid-cols-3 mb-4">
                  <TabsTrigger value="assigned">
                    Assigned ({assignedTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="inProgress">
                    In Progress ({inProgressTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    Completed ({completedTasks.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="assigned" className="space-y-4">
                  {assignedTasks.map((task) => renderTaskCard(task, true))}
                </TabsContent>
                
                <TabsContent value="inProgress" className="space-y-4">
                  {inProgressTasks.map((task) => renderTaskCard(task, true))}
                </TabsContent>
                
                <TabsContent value="completed" className="space-y-4">
                  {completedTasks.map((task) => renderTaskCard(task, false))}
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop View - Columns */}
            <div className="hidden md:grid md:grid-cols-3 gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  Assigned ({assignedTasks.length})
                </h2>
                <div className="space-y-4">
                  {assignedTasks.map((task) => renderTaskCard(task, true))}
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                  In Progress ({inProgressTasks.length})
                </h2>
                <div className="space-y-4">
                  {inProgressTasks.map((task) => renderTaskCard(task, true))}
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  Completed ({completedTasks.length})
                </h2>
                <div className="space-y-4">
                  {completedTasks.map((task) => renderTaskCard(task, false))}
                </div>
              </div>
            </div>
          </>
        )}

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

export default TeamLeadMemberView;