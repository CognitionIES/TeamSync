/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import {
  Download,
  TrendingUp,
  Clock,
  CheckCircle,
  Users,
  RefreshCw,
  AlertTriangle,
  Calendar as CalendarIcon,
  PlusCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import TaskTable from "../shared/TaskTable";
import TeamPerformanceView from "../shared/TeamPerformanceView";
import { Task, TaskStatus, TaskType, UserRole, ItemType } from "@/types";
import Modal from "react-modal";
import DashboardBackground from "../shared/DashboardBackground";
import AssignedItemsModal from "../shared/AssignedItemsModal";
import axios, { AxiosError } from "axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { MetricsTable } from "../MetricsTable"; // Import MetricsTable
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useNavigate } from "react-router-dom";
// Bind modal to appElement for accessibility
Modal.setAppElement("#root");

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
};

interface ApiTask {
  id: string;
  type: TaskType;
  assignee: string;
  assignee_id: string;
  status: TaskStatus;
  is_complex: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  progress: number;
  items: Array<{
    id: string;
    item_name: string;
    item_type: string;
    completed: boolean;
  }>;
  comments: Array<{
    id: string;
    user_id: string;
    user_name: string;
    user_role: string;
    comment: string;
    created_at: string;
  }>;
}

interface ApiTeamLead {
  id: string;
  team_lead: string;
  team_members: Array<{
    id: string;
    member_id: string;
    member_name: string;
  }>;
  tasks: Array<{
    id: string;
    type: string;
    assignee: string;
    assignee_id: string;
    status: string;
    items: Array<{
      id: string;
      name: string;
      item_type: string;
      completed: boolean;
    }>;
  }>;
}
interface ApiUser {
  id: string;
  name: string;
  role: string;
}
interface FetchedAssignedItems {
  pids: any;
  lines: any;
  equipment: any;
  upvLines: {
    count: number;
    items: { id: string; line_number: string; project_id: string }[];
  };
  qcLines: {
    count: number;
    items: { id: string; line_number: string; project_id: string }[];
  };
  redlinePIDs: {
    count: number;
    items: { id: string; pid_number: string; project_id: string }[];
  };
  upvEquipment: {
    count: number;
    items: { id: string; equipment_name: string; project_id: string }[];
  };
  qcEquipment: {
    count: number;
    items: { id: string; equipment_name: string; project_id: string }[];
  };
}
interface TeamLead {
  id: string;
  name: string;
  team: string[];
}
interface MetricEntry {
  teamName: ReactNode;
  userId: string;
  date?: string;
  week_start?: string;
  month_start?: string;
  counts: { [key: string]: { [key: string]: number } | number };
  totalBlocks: number;
}
interface MetricsData {
  daily: MetricEntry[];
  weekly: MetricEntry[];
  monthly: MetricEntry[];
}
interface ProjectProgress {
  projectId: string;
  projectName: string;
  completedItems: number;
  targetItems: number;
  progress: string;
}
interface AreaProgress {
  areaId: string;
  areaName: string;
  completedItems: number;
  targetItems: number;
  progress: string;
}
interface BlockTotals {
  [userId: string]: { daily: number; weekly: number; monthly: number };
}
const transformTeamLead = (apiTeamLead: ApiTeamLead): TeamLead => ({
  id: apiTeamLead.id,
  name: apiTeamLead.team_lead,
  team: apiTeamLead.team_members.map((member) => member.member_name),
});
const transformTask = (apiTask: ApiTask): Task => {
 // console.log("Transforming Task:", apiTask.id, "Raw Items:", apiTask.items);
  const validTaskTypes = Object.values(TaskType);
  const taskType = validTaskTypes.includes(apiTask.type as TaskType)
    ? (apiTask.type as TaskType)
    : TaskType.UPV;
  const validItemTypes = Object.values(ItemType);
  const items = apiTask.items.map((item) => {
    const rawCompleted = item.completed;
    const transformedItem = {
      id: item.id,
      name: item.item_name || `Unnamed-${item.id}`,
      type: validItemTypes.includes(item.item_type as ItemType)
        ? (item.item_type as ItemType)
        : ItemType.Line,
      completed: typeof item.completed === "boolean" ? item.completed : false,
    };
//console.log(
//  "Raw Completed:",
//  rawCompleted,
//  "Transformed Item:",
//  transformedItem,
//);
    return transformedItem;
  });
 // console.log("Raw Comments:", apiTask.comments);
  const transformedComments = Array.isArray(apiTask.comments)
    ? apiTask.comments.map((comment) => ({
        id: comment.id,
        userId: comment.user_id,
        userName: comment.user_name,
        userRole: comment.user_role as UserRole,
        comment: comment.comment,
        createdAt: comment.created_at,
      }))
    : [];
//  console.log("Transformed Comments:", transformedComments);
  if (
    !items.some((item) => item.type === ItemType.Line) &&
    process.env.NODE_ENV === "development"
  ) {
    items.push(
      {
        id: "dummy-line-1",
        name: "L-Dummy-1",
        type: ItemType.Line,
        completed: false,
      },
      {
        id: "dummy-line-2",
        name: "L-Dummy-2",
        type: ItemType.Line,
        completed: true,
      },
    );
  }
  return {
    id: apiTask.id,
    type: taskType,
    assignee: apiTask.assignee,
    assigneeId: apiTask.assignee_id,
    status: apiTask.status,
    isComplex: apiTask.is_complex,
    createdAt: apiTask.created_at,
    updatedAt: apiTask.updated_at,
    completedAt: apiTask.completed_at,
    progress: apiTask.progress,
    items,
    comments: transformedComments,
    projectId: "",
    pidNumber: "",
    projectName: "",
    areaNumber: "",
    description: "",
    lines:
      apiTask.items
        .filter((item) => item.item_type === "Line")
        .map((item) => ({
          id: item.id,
          name: item.item_name,
          type: item.item_type,
          completed: item.completed,
        })) || undefined,
  };
};

const ProjectManagerDashboard = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamLeads, setTeamLeads] = useState<TeamLead[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [commentsModalIsOpen, setCommentsModalIsOpen] = useState(false);
  const [selectedComments, setSelectedComments] = useState<Task["comments"]>(
    [],
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [assignedItems, setAssignedItems] =
    useState<FetchedAssignedItems | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedTaskType, setSelectedTaskType] = useState<string>("");
  const [selectedItemType, setSelectedItemType] = useState<string>("");
  const [selectedMetricsUser, setSelectedMetricsUser] = useState<string>("");
  const [selectedMetricsTeam, setSelectedMetricsTeam] = useState<string>("");
  const [selectedProjectItemType, setSelectedProjectItemType] =
    useState<string>("lines");
  const [selectedProjectTaskType, setSelectedProjectTaskType] =
    useState<string>("all");
  const [individualMetrics, setIndividualMetrics] = useState<MetricsData>({
    daily: [],
    weekly: [],
    monthly: [],
  });
  const [teamMetrics, setTeamMetrics] = useState<MetricsData>({
    daily: [],
    weekly: [],
    monthly: [],
  });
  const [teamMetricsError, setTeamMetricsError] = useState<string | null>(null);
  const [projectProgress, setProjectProgress] = useState<ProjectProgress[]>([]);
  const [individualMetricsError, setIndividualMetricsError] = useState<
    string | null
  >(null);
  const [areaProgress, setAreaProgress] = useState<AreaProgress[]>([]);
  const [areaProgressError, setAreaProgressError] = useState<string | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [blockTotals, setBlockTotals] = useState<BlockTotals>({}); // Updated to object structure
  const fetchAssignedItems = async (userId: string, taskId: string) => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) {
        throw new Error("No authentication token found");
      }
      const response = await axios.get<{ data: FetchedAssignedItems }>(
        `${API_URL}/users/${userId}/assigned-items/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );
//console.log("Raw API Response for Assigned Items:", response.data.data);
      return response.data.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error(
        "Error fetching assigned items:",
        axiosError.response?.data || axiosError.message,
      );
      throw new Error(
        axiosError.response?.data?.message || "Failed to fetch assigned items",
      );
    }
  };
  const handleViewCurrentWork = async (taskId: string, userId: string) => {
    setSelectedUserId(userId);
    setLoadingItems(true);
    try {
      const task = tasks.find((t) => t.id === taskId);
     // console.log("Selected Task:", task);
      if (!task) {
        setSelectedTaskType("");
        setSelectedItemType("");
     //   console.log("Task not found");
        toast.error("Task not found. Cannot display assigned items.");
        return;
      }
      setSelectedTaskType(task.type);
      let itemType: ItemType | null = null;
      if (task.items.length > 0) {
        itemType = task.items[0].type;
      } else {
        switch (task.type) {
          case TaskType.Redline:
            itemType = ItemType.PID;
            break;
          case TaskType.UPV:
          case TaskType.QC:
            itemType = ItemType.Line;
            break;
          default:
            itemType = null;
        }
      }
    //  console.log("Determined Item Type:", itemType);
      if (!itemType) {
        toast.error(
          `Unsupported task type: ${task.type}. Cannot display assigned items.`,
        );
        setSelectedTaskType("");
        setSelectedItemType("");
        return;
      }
      setSelectedItemType(itemType);
      const items = await fetchAssignedItems(userId, taskId);
    //  console.log("Fetched Assigned Items:", items);
      const mappedItems: FetchedAssignedItems = {
        pids: items.pids ?? [],
        lines: items.lines ?? [],
        equipment: items.equipment ?? [],
        upvLines: {
          count: items.upvLines?.count || 0,
          items:
            items.upvLines?.items.map((item: any) => ({
              area_number: item.area_number ?? "",
              project_name: item.project_name ?? "",
              id: item.id,
              line_number: item.line_number ?? "N/A",
              project_id: item.project_id ?? "",
            })) || [],
        },
        qcLines: {
          count: items.qcLines?.count || 0,
          items:
            items.qcLines?.items.map((item: any) => ({
              area_number: item.area_number ?? "",
              project_name: item.project_name ?? "",
              id: item.id,
              line_number: item.line_number ?? "N/A",
              project_id: item.project_id ?? "",
            })) || [],
        },
        redlinePIDs: {
          count: items.redlinePIDs?.count || 0,
          items:
            items.redlinePIDs?.items.map((item: any) => ({
              area_number: item.area_number ?? "",
              project_name: item.project_name ?? "",
              id: item.id,
              pid_number: item.pid_number ?? "N/A",
              project_id: item.project_id ?? "",
            })) || [],
        },
        upvEquipment: {
          count: items.upvEquipment?.count || 0,
          items:
            items.upvEquipment?.items.map((item: any) => ({
              area_number: item.area_number ?? "",
              project_name: item.project_name ?? "",
              id: item.id,
              equipment_name: item.equipment_name ?? "N/A",
              project_id: item.project_id ?? "",
            })) || [],
        },
        qcEquipment: {
          count: items.qcEquipment?.count || 0,
          items:
            items.qcEquipment?.items.map((item: any) => ({
              area_number: item.area_number ?? "",
              project_name: item.project_name ?? "",
              id: item.id,
              equipment_name: item.equipment_name ?? "N/A",
              project_id: item.project_id ?? "",
            })) || [],
        },
      };
      setAssignedItems(mappedItems);
      setModalIsOpen(true);
    } catch (error) {
      console.error("Error in handleViewCurrentWork:", error);
      toast.error(`Failed to fetch assigned items: ${error.message}`);
      setAssignedItems(null);
      setSelectedTaskType("");
      setSelectedItemType("");
    } finally {
      setLoadingItems(false);
    }
  };
  const closeModal = () => {
    setModalIsOpen(false);
    setAssignedItems(null);
    setSelectedUserId(null);
    setSelectedTaskType("");
    setSelectedItemType("");
  };
  const handleViewComments = (taskId: string) => {
 //   console.log("handleViewComments called for taskId:", taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
 //     console.log("Found Task Comments:", task.comments);
      setSelectedTask(task);
      setSelectedComments(task.comments || []);
      setCommentsModalIsOpen(true);
    } else {
      toast.error("Task not found. Cannot display comments.");
    }
  };
  const closeCommentsModal = () => {
    setCommentsModalIsOpen(false);
    setSelectedComments([]);
    setSelectedTask(null);
  };
  const updateTaskItemCompletion = async (
    taskId: string,
    itemId: string,
    completed: boolean,
  ) => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");
      const task = tasks.find((t) => t.id === taskId);
      if (!task) throw new Error("Task not found");
      const updatedItems = task.items.map((item) =>
        item.id === itemId ? { ...item, completed } : item,
      );
      const updatedTask = { ...task, items: updatedItems };
      await axios.put(
        `${API_URL}/tasks/${taskId}`,
        { items: updatedItems },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === taskId ? updatedTask : t)),
      );
      toast.success("Task item updated successfully");
      if (completed) {
        const userId = task.assigneeId;
        const itemType =
          updatedItems.find((item) => item.id === itemId)?.type || "Line";
        const taskType = task.type;
        await axios.post(
          `${API_URL}/metrics/individual/update`,
          {
            userId,
            taskId,
            itemId,
            itemType,
            taskType,
            action: "increment",
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
            },
          },
        );
        await fetchIndividualMetrics(); // Refresh metrics
      }
    } catch (error) {
      console.error("Error updating task item:", error);
      toast.error("Failed to update task item");
    }
  };
  const fetchIndividualMetrics = async () => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      //console.log("Fetching metrics for date:", formattedDate);
     // console.log("Users:", users);

      const response = await axios.get<MetricsData>(
        `${API_URL}/metrics/individual/all?date=${formattedDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
          params: {
            userId: users.map((u) => u.id.toString()).join(",") || "all",
          }, // Pass all userIds or "all"
        },
      );

     // console.log("Response for all users:", response.data);

      const combinedMetrics: MetricsData = {
        daily: response.data.daily || [],
        weekly: response.data.weekly || [],
        monthly: response.data.monthly || [],
      };

    //  console.log("Final combined user metrics:", combinedMetrics.daily);

      setIndividualMetrics(combinedMetrics);
      setIndividualMetricsError(null);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching individual metrics:", {
        message: axiosError.message,
        response: axiosError.response?.data,
      });
      setIndividualMetricsError(
        axiosError.response?.data?.message ||
          "Failed to fetch individual metrics",
      );
      setIndividualMetrics({ daily: [], weekly: [], monthly: [] });
    }
  };
  const fetchAreaProgress = async () => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");
   //   console.log("Fetching area-wise progress");
      const response = await axios.get<{ data: AreaProgress[] }>(
        `${API_URL}/metrics/area/progress`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );
      setAreaProgress(response.data.data);
      setAreaProgressError(null);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching area progress:", axiosError);
      setAreaProgressError(
        axiosError.response?.data?.message || "Failed to fetch area progress",
      );
      setAreaProgress([]);
    }
  };
  const fetchBlockTotals = async () => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");
      const formattedDate = format(selectedDate, "yyyy-MM-dd");
      const response = await axios.get<BlockTotals>(
        `${API_URL}/metrics/blocks/totals?date=${formattedDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );
      setBlockTotals(response.data);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching block totals:", {
        message: axiosError.message,
        response: axiosError.response?.data,
      });
      toast.error("Failed to fetch block totals");
      setBlockTotals({});
    }
  };
  const calculateTeamMetrics = () => {
    const today = selectedDate.setHours(0, 0, 0, 0); // Use selectedDate
    const metrics: MetricEntry[] = teamLeads.map((team) => {
      const memberIds = team.team
        .map((memberName) => users.find((u) => u.name === memberName)?.id || "")
        .filter(Boolean);
      const teamTasks = tasks.filter(
        (task) =>
          memberIds.includes(task.assigneeId) &&
          task.completedAt &&
          new Date(task.completedAt).setHours(0, 0, 0, 0) === today,
      );
      const counts: { [itemType: string]: { [taskType: string]: number } } = {
        [ItemType.Line]: { UPV: 0, QC: 0, Redline: 0 },
        [ItemType.Equipment]: { UPV: 0, QC: 0, Redline: 0 },
        [ItemType.PID]: { Redline: 0 },
        [ItemType.NonInlineInstrument]: { UPV: 0, QC: 0, Redline: 0 },
      };
      teamTasks.forEach((task) => {
        task.items.forEach((item) => {
          if (item.completed) {
            counts[item.type][task.type] =
              (counts[item.type][task.type] || 0) + 1;
          }
        });
      });
      return { userId: team.id, counts, totalBlocks: 0 }; // totalBlocks set to 0 as it's not calculated client-side
    });
    setTeamMetrics({ daily: metrics, weekly: [], monthly: [] });
    setTeamMetricsError(null);
  };
  const fetchProjectProgress = async (itemType: string, taskType: string) => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");
      const params = new URLSearchParams({ itemType });
      if (taskType && taskType !== "all") params.append("taskType", taskType);
      const response = await axios.get(
        `${API_URL}/metrics/projects/progress?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );
      setProjectProgress(response.data.data);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching project progress:", axiosError);
      toast.error(
        axiosError.response?.data?.message ||
          "Failed to fetch project progress",
      );
    }
  };
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) {
        throw new Error("No authentication token found");
      }
      const usersResponse = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });
      const usersText = await usersResponse.text();
      if (!usersResponse.ok) {
        throw new Error(
          `Users API error: ${usersResponse.status} ${
            usersResponse.statusText
          } - ${usersText.substring(0, 100)}`,
        );
      }
      const usersDataResponse = JSON.parse(usersText);
      const usersData = usersDataResponse.data || [];
      setUsers(usersData);
      //console.log("Fetched users:", usersData);
      const [tasksResponse, teamsResponse] = await Promise.all([
        fetch(`${API_URL}/tasks`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }),
        fetch(`${API_URL}/teams`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }),
      ]);
      if (!tasksResponse.ok) {
        throw new Error(
          `Tasks API error: ${tasksResponse.status} ${tasksResponse.statusText}`,
        );
      }
      if (!teamsResponse.ok) {
        throw new Error(
          `Teams API error: ${teamsResponse.status} ${teamsResponse.statusText}`,
        );
      }
      const tasksData = await tasksResponse.json();
      const teamsData = await teamsResponse.json();
      setTasks(tasksData.data ? tasksData.data.map(transformTask) : []);
      setTeamLeads(teamsData.data ? teamsData.data.map(transformTeamLead) : []);
      if (usersData.length > 0) setSelectedMetricsUser("all");
      else console.warn("No users found, skipping selectedMetricsUser set");
      if (teamsData.data && teamsData.data.length > 0)
        setSelectedMetricsTeam(teamsData.data[0].id);
      else
        console.warn("No team leads found, skipping selectedMetricsTeam set");
      await Promise.all([
        fetchProjectProgress(selectedProjectItemType, selectedProjectTaskType),
        fetchIndividualMetrics(),
        fetchBlockTotals(),
        fetchAreaProgress(),
      ]);
     // calculateTeamMetrics();
      toast.success("Data refreshed");
    } catch (error) {
      console.error("Fetch error:", error.message, error.stack);
      setError(error.message || "Failed to fetch data");
      toast.error(error.message || "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };
  const fetchTeamMetrics = async () => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");

      const formattedDate = format(selectedDate, "yyyy-MM-dd");
    //  console.log("Fetching team metrics for date:", formattedDate);

      const response = await axios.get<MetricsData>(
        `${API_URL}/metrics/team/all?date=${formattedDate}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );

     // console.log("Team metrics response:", response.data);

      setTeamMetrics({
        daily: response.data.daily || [],
        weekly: response.data.weekly || [],
        monthly: response.data.monthly || [],
      });
      setTeamMetricsError(null);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching team metrics:", {
        message: axiosError.message,
        response: axiosError.response?.data,
      });
      setTeamMetricsError(
        axiosError.response?.data?.message || "Failed to fetch team metrics",
      );
      setTeamMetrics({ daily: [], weekly: [], monthly: [] });
    }
  };
  useEffect(() => {
    fetchIndividualMetrics();
    fetchBlockTotals();
    //fetchTeamMetrics(); // Changed from calculateTeamMetrics
    fetchAreaProgress();
  }, [selectedDate]);
  useEffect(() => {
    fetchData();
  }, []);
  useEffect(() => {
    fetchIndividualMetrics();
    fetchBlockTotals();
    calculateTeamMetrics();
  }, [selectedDate]);
  useEffect(() => {
    fetchProjectProgress(selectedProjectItemType, selectedProjectTaskType);
  }, [selectedProjectItemType, selectedProjectTaskType]);
  const teamMembers = Array.from(new Set(users.map((user) => user.name)));
  const teamLeadMembers = new Set(teamLeads.flatMap((lead) => lead.team));
  const usersNotInTeams = users.filter(
    (user) => !teamLeadMembers.has(user.name),
  );
  const today = selectedDate.setHours(0, 0, 0, 0);
  const assignedToday = tasks.filter(
    (task) => new Date(task.createdAt).setHours(0, 0, 0, 0) === today,
  ).length;
  const startedToday = tasks.filter(
    (task) =>
      task.status === "In Progress" &&
      new Date(task.updatedAt).setHours(0, 0, 0, 0) === today,
  ).length;
  const completedToday = tasks.filter(
    (task) =>
      task.status === "Completed" &&
      task.completedAt &&
      new Date(task.completedAt).setHours(0, 0, 0, 0) === today,
  ).length;
  const totalTasks = tasks.length;
  const completedCount = tasks.filter(
    (task) => task.status === "Completed",
  ).length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const handleRefresh = () => {
    fetchData()
      .then(() => {
        toast.success("Data refreshed");
      })
      .catch((error) => {
        console.error("Error refreshing data:", error);
        toast.error("Failed to refresh data");
      });
  };
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const headers = [
        "Type",
        "Assignee",
        "Status",
        "Progress",
        "Created",
        "Completed",
        "Is Complex",
        "Current Work",
      ];
      const rows = tasks.map((task) => {
        let currentWork = "";
        if (task.status === "Completed") {
          currentWork = "Completed";
        } else {
          const pidItem = task.items.find((item) => item.type === "PID");
          if (pidItem) currentWork = `P&ID ${pidItem.name}`;
          const lineItem = task.items.find((item) => item.type === "Line");
          if (lineItem) currentWork = `Line ${lineItem.name}`;
          const equipmentItem = task.items.find(
            (item) => item.type === "Equipment",
          );
          if (equipmentItem) currentWork = `Equipment ${equipmentItem.name}`;
        }
        return [
          task.type,
          task.assignee,
          task.status,
          `${task.progress}%`,
          formatTime(task.createdAt),
          task.completedAt ? formatTime(task.completedAt) : "N/A",
          task.isComplex ? "Yes" : "No",
          currentWork,
        ];
      });
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");
      const encodedUri =
        "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `teamsync_tasks_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV exported successfully");
    } catch (error) {
      toast.error("Failed to export CSV");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };
  const MetricsSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {[...Array(4)].map((_, index) => (
        <Card key={index} className="shadow-md">
          <CardHeader className="pb-2 border-b">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-200 rounded-lg h-10 w-10 animate-pulse"></div>
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-10 w-16 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-gray-200 rounded mt-2 animate-pulse"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
  const testApiEndpoint = async () => {
    try {
      const token = localStorage.getItem("teamsync_token");
      const response = await axios.get(
        `${API_URL}/metrics/individual/all?date=2025-09-22&userId=all`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
     // console.log("Direct API test response:", response.data);
    } catch (error) {
      console.error("API test error:", error);
    }
  };
  const handleExportPIDProgress = async () => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");

      // Fetch PID work items summary
      const response = await axios.get(
        `${API_URL}/tasks/pid-work-items/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );

      const data = response.data.data;

      if (!data || data.length === 0) {
        toast.error("No PID progress data available to export");
        return;
      }

      // Create Excel-friendly headers
      const headers = [
        "User Name",
        "PID Number",
        "Task Type",
        "Assigned Date",
        "Status",
        "Total Items",
        "Completed Items",
        "Skipped Items",
        "Pending Items",
        "Total Blocks",
        "Progress %",
        "Completion Date",
      ];

      // Map data to rows
      const rows = data.map((item: any) => {
        const completedItems = parseInt(item.completed_items) || 0;
        const skippedItems = parseInt(item.skipped_items) || 0;
        const totalItems = parseInt(item.total_items) || 0;
        const pendingItems = totalItems - completedItems - skippedItems;
        const progressPercent =
          totalItems > 0
            ? Math.round(((completedItems + skippedItems) / totalItems) * 100)
            : 0;

        return [
          item.user_name || "Unknown",
          item.pid_number || "N/A",
          item.task_type || "N/A",
          item.assigned_date
            ? new Date(item.assigned_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
              })
            : "N/A",
          item.status || "In Progress",
          totalItems,
          completedItems,
          skippedItems,
          pendingItems,
          parseInt(item.total_blocks) || 0,
          `${progressPercent}%`,
          item.completion_date
            ? new Date(item.completion_date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "2-digit",
              })
            : "Not Completed",
        ];
      });

      // Convert to CSV
      const escapeCsvValue = (value: any) => {
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = [
        headers.map(escapeCsvValue).join(","),
        ...rows.map((row) => row.map(escapeCsvValue).join(",")),
      ].join("\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `pid_progress_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PID progress exported successfully!");
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error exporting PID progress:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to export PID progress",
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Call this in useEffect temporarily
  useEffect(() => {
    testApiEndpoint();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Navbar onRefresh={handleRefresh} />
        <div className="container mx-auto p-4 sm:p-8">
          <header className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-800">
                  Project Manager Dashboard
                </h1>
                <p className="text-gray-600 mt-1">
                  Track project progress and team performance
                </p>
              </div>
              <div className="mt-4 sm:mt-0 flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} />
                  {isLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>
          </header>
          <Card className="shadow-md">
            <CardContent className="p-6 text-center">
              <div className="flex justify-center items-center gap-2 text-red-600">
                <AlertTriangle size={24} />
                <p className="text-lg font-semibold">Error</p>
              </div>
              <p className="text-gray-600 mt-2">{error}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen">
      <DashboardBackground role="Project Manager" />
      <Navbar onRefresh={handleRefresh} />
      <div className="container mx-auto p-4 sm:p-8">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-800">
                Project Manager Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Track project progress and team performance
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex gap-3">
              {/* ✅ NEW BUTTON */}
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate("/create-task")}
              >
                <PlusCircle size={16} />
                Assign Task
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw size={16} />
                {isLoading ? "Refreshing..." : "Refresh"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleExportPIDProgress}
                disabled={isExporting || isLoading}
              >
                <Download size={16} />
                {isExporting ? "Exporting..." : "Export CSV"}
              </Button>
            </div>
          </div>
        </header>

        <Tabs
          defaultValue="overview"
          className="space-y-6"
          onValueChange={setActiveTab}
        >
          <TabsList className="mb-2 bg-white border shadow-sm">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-6 animate-fade-in">
            {isLoading ? (
              <MetricsSkeleton />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-transparent border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <TrendingUp size={18} className="text-blue-600" />
                      </div>
                      <CardTitle className="text-lg">
                        Progress Overview
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="flex items-end gap-2">
                      <p className="text-4xl font-bold text-blue-600">
                        {completionRate}%
                      </p>
                      <p className="text-sm text-gray-500 mb-1">Completion</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {completedCount} of {totalTasks} Tasks Completed
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50 to-transparent border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Clock size={18} className="text-indigo-600" />
                      </div>
                      <CardTitle className="text-lg">Assigned Today</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-4xl font-bold text-indigo-600">
                      {assignedToday}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">New Tasks</p>
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2 bg-gradient-to-r from-orange-50 to-transparent border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Clock size={18} className="text-orange-600" />
                      </div>
                      <CardTitle className="text-lg">Started Today</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-4xl font-bold text-orange-600">
                      {startedToday}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Tasks in Progress
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2 bg-gradient-to-r from-green-50 to-transparent border-b">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle size={18} className="text-green-600" />
                      </div>
                      <CardTitle className="text-lg">Completed Today</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-4xl font-bold text-green-600">
                      {completedToday}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Tasks Finished</p>
                  </CardContent>
                </Card>
              </div>
            )}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Tasks Overview</CardTitle>
                <CardDescription>Summary of all project tasks</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <TaskTable
                  tasks={tasks}
                  teamMembers={teamMembers}
                  showFilters={true}
                  showProgress={true}
                  showCurrentWork={true}
                  showComments={true}
                  loading={isLoading}
                  onViewCurrentWork={handleViewCurrentWork}
                  onViewComments={handleViewComments}
                  onUpdateItemCompletion={updateTaskItemCompletion}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="teams" className="space-y-6 animate-fade-in">
            <Card className="shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Users size={18} className="text-slate-600" />
                  </div>
                  <div>
                    <CardTitle>Team Composition</CardTitle>
                    <CardDescription>
                      Organization of team members and leads
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[...Array(2)].map((_, index) => (
                      <Card
                        key={index}
                        className="border border-gray-200 bg-white shadow-sm"
                      >
                        <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-transparent">
                          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-4 w-24 bg-gray-200 rounded mt-1 animate-pulse"></div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="h-4 w-28 bg-gray-200 rounded mb-2 animate-pulse"></div>
                          <ul className="space-y-1 ml-1">
                            {[...Array(3)].map((_, i) => (
                              <li
                                key={i}
                                className="flex items-center gap-2 text-gray-700"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-gray-200 animate-pulse"></span>
                                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <>
                    {teamLeads.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-4">
                          Team Leads
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {teamLeads.map((lead) => (
                            <Card
                              key={lead.id}
                              className="border border-gray-200 bg-white shadow-sm"
                            >
                              <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-transparent">
                                <CardTitle className="text-base">
                                  {lead.name}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  Team Lead
                                </p>
                              </CardHeader>
                              <CardContent className="pt-4">
                                <h4 className="text-sm font-medium mb-2">
                                  Team Members:
                                </h4>
                                {lead.team.length === 0 ? (
                                  <p className="text-sm text-gray-500">
                                    No team members assigned.
                                  </p>
                                ) : (
                                  <ul className="space-y-1 ml-1">
                                    {lead.team.map((member, index) => (
                                      <li
                                        key={index}
                                        className="text-sm flex items-center gap-2 text-gray-700"
                                      >
                                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                                        {member}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    {usersNotInTeams.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">
                          Other Users (Not in Teams)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {usersNotInTeams.map((user) => (
                            <Card
                              key={user.id}
                              className="border border-gray-200 bg-white shadow-sm"
                            >
                              <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-transparent">
                                <CardTitle className="text-base">
                                  {user.name}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  {user.role}
                                </p>
                              </CardHeader>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                    {teamLeads.length === 0 && usersNotInTeams.length === 0 && (
                      <p className="text-gray-500 text-center py-4">
                        No users or team leads available.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="tasks" className="space-y-6 animate-fade-in">
            <Card className="shadow-md">
              <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-transparent">
                <CardTitle>All Tasks</CardTitle>
                <CardDescription>
                  Complete task list with filtering and sorting options
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                <TaskTable
                  tasks={tasks}
                  teamMembers={teamMembers}
                  showFilters={true}
                  showProgress={true}
                  showCurrentWork={true}
                  showComments={true}
                  loading={isLoading}
                  onViewCurrentWork={handleViewCurrentWork}
                  onViewComments={handleViewComments}
                  onUpdateItemCompletion={updateTaskItemCompletion}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="performance" className="animate-fade-in">
            <TeamPerformanceView
              teamLeads={teamLeads}
              onViewCurrentWork={handleViewCurrentWork}
              onViewComments={handleViewComments}
              tasks={tasks}
            />
          </TabsContent>
          <TabsContent value="metrics" className="space-y-6 animate-fade-in">
            <Card className="shadow-md border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-transparent border-b border-blue-100">
                <CardTitle className="text-lg text-blue-800">
                  Individual Metrics
                </CardTitle>
                <CardDescription>
                  Metrics for all individuals by item and task type
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {individualMetricsError && (
                  <p className="text-red-600 text-center py-4">
                    {individualMetricsError}
                  </p>
                )}
                <Tabs defaultValue="daily" className="space-y-4">
                  <TabsList className="grid grid-cols-3 w-full max-w-md">
                    {["daily", "weekly", "monthly"].map((period) => (
                      <TabsTrigger
                        key={period}
                        value={period}
                        className="flex items-center gap-2"
                      >
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                        <Popover>
                          <PopoverTrigger asChild>
                            <span className="p-0 h-6 w-6">
                              <CalendarIcon className="h-4 w-4" />
                            </span>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => date && setSelectedDate(date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {["daily", "weekly", "monthly"].map((period) => (
                    <TabsContent key={period} value={period}>
                      <MetricsTable
                        period={period as "daily" | "weekly" | "monthly"}
                        metrics={individualMetrics[period as keyof MetricsData]}
                        blockTotals={blockTotals}
                        users={users.map((user) => ({
                          ...user,
                          id: parseInt(user.id),
                        }))}
                      />
                      {period === "daily" && (
                        <div className="mt-4 text-sm text-gray-500">
                          Selected Date: {format(selectedDate, "PPP")}
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
            <Card className="shadow-md border-teal-200">
              <CardHeader className="bg-gradient-to-r from-teal-50 to-transparent border-b border-teal-100">
                <CardTitle className="text-lg text-teal-800">
                  Total Blocks
                </CardTitle>
                <CardDescription>
                  Accumulated blocks by time period
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Tabs defaultValue="daily" className="space-y-4">
                  <TabsList className="grid grid-cols-3 w-full max-w-md">
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="weekly">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  </TabsList>
                  {["daily", "weekly", "monthly"].map((period) => (
                    <TabsContent key={period} value={period}>
                      <div className="text-3xl font-bold text-teal-600 mb-2">
                        {Object.values(blockTotals).reduce(
                          (sum, user) =>
                            sum + (user[period as keyof typeof user] || 0),
                          0,
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {period.charAt(0).toUpperCase() + period.slice(1)} Total
                        Blocks
                      </p>
                      {period === "daily" && (
                        <div className="mt-4 text-sm text-gray-500">
                          Selected Date: {format(selectedDate, "PPP")}
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
            <Card className="shadow-md border-orange-200">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-transparent border-b border-orange-100">
                <CardTitle className="text-lg text-orange-800">
                  Area-wise Progress
                </CardTitle>
                <CardDescription>Progress of projects by area</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {areaProgressError && (
                  <p className="text-red-600 text-center py-4">
                    {areaProgressError}
                  </p>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Area Name</TableHead>
                      <TableHead>Completed Items</TableHead>
                      <TableHead>Target Items</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-gray-500"
                        >
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : areaProgress.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-gray-500"
                        >
                          No area progress data available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      areaProgress.map((area) => (
                        <TableRow key={area.areaId}>
                          <TableCell>{area.areaName}</TableCell>
                          <TableCell>{area.completedItems}</TableCell>
                          <TableCell>{area.targetItems}</TableCell>
                          <TableCell className="flex items-center gap-2">
                            <Progress
                              value={parseFloat(area.progress)}
                              className="w-[200px]"
                            />
                            <span>{area.progress}%</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className="shadow-md border-green-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-transparent border-b border-green-100">
                <CardTitle className="text-lg text-green-800">
                  Team Metrics
                </CardTitle>
                <CardDescription>
                  Metrics for teams by item and task type
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {teamMetricsError && (
                  <p className="text-red-600 text-center py-4">
                    {teamMetricsError}
                  </p>
                )}
                <Tabs defaultValue="daily" className="space-y-4">
                  <TabsList className="grid grid-cols-3 w-full max-w-md">
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="weekly">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  </TabsList>

                  <TabsContent value="daily">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team Name</TableHead>
                          <TableHead>Lines (UPV)</TableHead>
                          <TableHead>Lines (QC)</TableHead>
                          <TableHead>Lines (Redline)</TableHead>
                          <TableHead>Equipment (UPV)</TableHead>
                          <TableHead>Equipment (QC)</TableHead>
                          <TableHead>Equipment (Redline)</TableHead>
                          <TableHead>P&IDs (Redline)</TableHead>
                          <TableHead>Total Blocks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-center text-gray-500"
                            >
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : teamMetrics.daily.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-center text-gray-500"
                            >
                              No team metrics data available.
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamMetrics.daily.map((metric) => (
                            <TableRow key={metric.teamId}>
                              <TableCell className="font-medium">
                                {metric.teamName}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.UPV || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.QC || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.Redline || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.UPV || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.QC || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.Redline || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.PID?.Redline || 0}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {metric.totalBlocks || 0}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <div className="mt-4 text-sm text-gray-500">
                      Selected Date: {format(selectedDate, "PPP")}
                    </div>
                  </TabsContent>

                  <TabsContent value="weekly">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team Name</TableHead>
                          <TableHead>Lines (UPV)</TableHead>
                          <TableHead>Lines (QC)</TableHead>
                          <TableHead>Lines (Redline)</TableHead>
                          <TableHead>Equipment (UPV)</TableHead>
                          <TableHead>Equipment (QC)</TableHead>
                          <TableHead>Equipment (Redline)</TableHead>
                          <TableHead>P&IDs (Redline)</TableHead>
                          <TableHead>Total Blocks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-center text-gray-500"
                            >
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : teamMetrics.weekly.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-center text-gray-500"
                            >
                              No weekly data available.
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamMetrics.weekly.map((metric) => (
                            <TableRow key={metric.teamId}>
                              <TableCell className="font-medium">
                                {metric.teamName}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.UPV || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.QC || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.Redline || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.UPV || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.QC || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.Redline || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.PID?.Redline || 0}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {metric.totalBlocks || 0}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="monthly">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Team Name</TableHead>
                          <TableHead>Lines (UPV)</TableHead>
                          <TableHead>Lines (QC)</TableHead>
                          <TableHead>Lines (Redline)</TableHead>
                          <TableHead>Equipment (UPV)</TableHead>
                          <TableHead>Equipment (QC)</TableHead>
                          <TableHead>Equipment (Redline)</TableHead>
                          <TableHead>P&IDs (Redline)</TableHead>
                          <TableHead>Total Blocks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-center text-gray-500"
                            >
                              Loading...
                            </TableCell>
                          </TableRow>
                        ) : teamMetrics.monthly.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={9}
                              className="text-center text-gray-500"
                            >
                              No monthly data available.
                            </TableCell>
                          </TableRow>
                        ) : (
                          teamMetrics.monthly.map((metric) => (
                            <TableRow key={metric.teamId}>
                              <TableCell className="font-medium">
                                {metric.teamName}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.UPV || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.QC || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Line?.Redline || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.UPV || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.QC || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.Equipment?.Redline || 0}
                              </TableCell>
                              <TableCell>
                                {metric.counts?.PID?.Redline || 0}
                              </TableCell>
                              <TableCell className="font-semibold">
                                {metric.totalBlocks || 0}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="shadow-md border-slate-200">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-transparent border-b border-slate-100">
                <CardTitle className="text-lg text-slate-800">
                  Project Progress
                </CardTitle>
                <CardDescription>
                  Progress of projects by item type and task type
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="mb-4 flex gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Item Type
                    </label>
                    <Select
                      value={selectedProjectItemType}
                      onValueChange={setSelectedProjectItemType}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Choose item type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lines">Lines</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="non_inline_instruments">
                          Non-Inline Instruments
                        </SelectItem>
                        <SelectItem value="pids">P&IDs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Task Type
                    </label>
                    <Select
                      value={selectedProjectTaskType}
                      onValueChange={setSelectedProjectTaskType}
                      disabled={isLoading}
                    >
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Choose task type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="upv">UPV</SelectItem>
                        <SelectItem value="qc">QC</SelectItem>
                        <SelectItem value="redline">Redline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {projectProgress.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No project progress data available.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project Name</TableHead>
                        <TableHead>Completed Items</TableHead>
                        <TableHead>Target Items</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectProgress.map((project) => (
                        <TableRow key={project.projectId}>
                          <TableCell>{project.projectName}</TableCell>
                          <TableCell>{project.completedItems}</TableCell>
                          <TableCell>{project.targetItems}</TableCell>
                          <TableCell className="flex items-center gap-2">
                            <Progress
                              value={parseFloat(project.progress)}
                              className="w-[200px]"
                            />
                            <span>{project.progress}%</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <Modal
          isOpen={modalIsOpen}
          onRequestClose={closeModal}
          className="bg-white p-6 rounded-lg shadow-xl max-w-3xl w-full mx-auto my-8 outline-none max-h-[80vh] overflow-y-auto"
          overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center"
        >
          {selectedUserId &&
            selectedTaskType &&
            selectedItemType &&
            assignedItems && (
              <AssignedItemsModal
                isOpen={modalIsOpen}
                onClose={closeModal}
                assignedItems={assignedItems}
                loadingItems={loadingItems}
                userName={
                  tasks.find((t) => t.assigneeId === selectedUserId)
                    ?.assignee || "Unknown"
                }
                taskType={selectedTaskType}
                itemType={selectedItemType}
              />
            )}
        </Modal>
        <Modal
          isOpen={commentsModalIsOpen}
          onRequestClose={closeCommentsModal}
          className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full mx-auto my-8 outline-none max-h-[80vh] overflow-y-auto"
          overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items"
        >
          <h2 className="text-xl font-semibold mb-4">Comments</h2>
          {selectedComments.length === 0 ? (
            <p className="text-gray-500">No comments available.</p>
          ) : (
            <ul className="space-y-4">
              {selectedComments.map((comment) => (
                <li key={comment.id} className="border-b pb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">{comment.userName}</p>
                      <p className="text-sm text-gray-500">
                        {comment.userRole} •{" "}
                        {comment.createdAt
                          ? new Date(comment.createdAt).toLocaleString(
                              "en-IN",
                              {
                                timeZone: "Asia/Kolkata",
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                              },
                            )
                          : "Unknown Date"}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1">{comment.comment}</p>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={closeCommentsModal}
          >
            Close
          </Button>
        </Modal>
      </div>
    </div>
  );
};
export default ProjectManagerDashboard;
