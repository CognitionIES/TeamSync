/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PIDWorkItem, Task, TaskComment, TaskItem, TaskType } from "@/types";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import TaskTable from "../shared/TaskTable";
import axios, { AxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import Modal from "react-modal";
import { getRandomMessage } from "@/components/shared/messages";
import { Progress } from "@/components/ui/progress";
import AssignedItemsModal from "../shared/AssignedItemsModal";
import {User, TeamMember, Project, PID, Line, Equipment, AssignedItems, FetchedAssignedItems} from "./team-lead/type";

// Bind modal to appElement for accessibility
Modal.setAppElement("#root");
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";


const TeamLeadDashboard = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isTeamMembersLoading, setIsTeamMembersLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [pids, setPIDs] = useState<PID[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generalMessage, setGeneralMessage] = useState<string>("");
  // Form state
  const [taskType, setTaskType] = useState<TaskType | "Misc" | "">("");
  const [assignmentType, setAssignmentType] = useState<
    "PID" | "Line" | "Equipment" | "NonInlineInstrument" | ""
  >("");
  const [selectedPIDs, setSelectedPIDs] = useState<string[]>([]);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [isComplex, setIsComplex] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  // New state for group select count
  const [groupSelectCount, setGroupSelectCount] = useState<number>(30); // Default to 30
  // Modal state for assigned items
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [assignedItems, setAssignedItems] =
    useState<FetchedAssignedItems | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | null>(
    null,
  );
  const [usePIDBasedAssignment, setUsePIDBasedAssignment] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedItemType, setSelectedItemType] = useState<
    "PID" | "Line" | "Equipment" | null
  >(null);
  // Modal state for comments
  const [commentsModalIsOpen, setCommentsModalIsOpen] = useState(false);
  const [selectedTaskForComments, setSelectedTaskForComments] =
    useState<Task | null>(null);
  // Track assigned items to prevent duplicates
  const [assignedItemsForDuplicates, setAssignedItemsForDuplicates] =
    useState<AssignedItems>({
      upvLines: [],
      upvEquipment: [],
      qcLines: [],
      qcEquipment: [],
      redlinePIDs: [],
    });
  // Define the NonInlineInstrument type
  interface NonInlineInstrument {
    id: string;
    instrumentTag: string;
    description: string;
  }
  const [nonInlineInstruments, setNonInlineInstruments] = useState<
    NonInlineInstrument[]
  >([]);
  const [selectedNonInlineInstruments, setSelectedNonInlineInstruments] =
    useState<string[]>([]);
  const [selectedTaskForRetract, setSelectedTaskForRetract] =
    useState<Task | null>(null);
  const [newAssigneeId, setNewAssigneeId] = useState<string>("");
  const [retractModalOpen, setRetractModalOpen] = useState(false);
  const token = localStorage.getItem("teamsync_token");
  const isTaskPIDBased = (task: Task) => {
    return task.isPIDBased === true; // New field from backend
  };
  const handleSelectTaskForRetract = (task: Task | null) => {
    console.log("Select Task for Retract:", task);
    setSelectedTaskForRetract(task);
    if (task) {
      setRetractModalOpen(true);
    } else {
      setRetractModalOpen(false);
    }
  };
  useEffect(() => {
    if (!isAuthenticated || !token) {
      toast.info(getRandomMessage("login"));
      navigate("/login", { replace: true });
    } else if (!["Team Lead", "Project Manager"].includes(user?.role || "")) {
      toast.error("You are not authorized to access this page.");
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, user, token, navigate]);
  const getDashboardTitle = () => {
    if (user?.role === "Project Manager")
      return "Assign Tasks (Project Manager)";
    if (user?.role === "Team Lead") return "Team Lead Dashboard";
    return "Dashboard";
  };
  const handleRetractTask = async (taskId: string) => {
    console.log("Retracting Task:", taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      toast.error("Task not found");
      return;
    }
    // Check if task has completed items
    const completedItems = task.items.filter((item) => item.completed);
    const hasCompletedWork = completedItems.length > 0;
    if (hasCompletedWork && !newAssigneeId) {
      toast.error(
        "This task has completed work. Please select a new assignee to reassign incomplete items.",
      );
      return;
    }
    try {
      setIsLoading(true);
      const payload: { newAssigneeId?: string } = {};
      if (newAssigneeId) {
        payload.newAssigneeId = newAssigneeId;
      }
      const response = await axios.patch(
        `${API_URL}/tasks/${taskId}/retract`,
        payload,
        getAuthHeaders(),
      );
      console.log("Retract response:", response.data);
      // Refresh tasks to sync with backend
      await fetchTasks();
      if (response.data.data.newTask) {
        toast.success(
          `Task ${taskId} retracted and reassigned to new task #${response.data.data.newTask.id}`,
        );
      } else {
        toast.success(`Task ${taskId} retracted successfully`);
      }
      setSelectedTaskForRetract(null);
      setNewAssigneeId("");
      setRetractModalOpen(false);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error retracting task:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to retract task",
      );
    } finally {
      setIsLoading(false);
    }
  };
  const handleReassign = (assigneeId: string) => {
    setNewAssigneeId(assigneeId);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("teamsync_token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    console.log("Token being sent:", token); // Log the token
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };
  const fetchProjects = async () => {
    console.log("===== fetchProjects START =====");
    console.log("API_URL:", API_URL);
    console.log("Token exists:", !!localStorage.getItem("teamsync_token"));
    try {
      const headers = getAuthHeaders();
      console.log("Request headers:", headers);
      const response = await axios.get(`${API_URL}/projects`, headers);
      console.log("Response status:", response.status);
      console.log("Full axios response object:", response);
      console.log("response.data (raw):", response.data);
      // Safely extract projects - handle both wrapped and unwrapped responses
      const rawData = response.data?.data ?? response.data ?? [];
      console.log("Extracted raw data:", rawData);
      if (!Array.isArray(rawData)) {
        console.warn("Projects data is not an array:", rawData);
        setProjects([]);
        toast.warning("Invalid project data format from server");
        return;
      }
      const projectData = rawData
        .filter((p: any) => p?.id != null && p?.name)
        .map((project: any) => ({
          id: String(project.id),
          name: String(project.name),
        }));
      console.log("Processed projects array:", projectData);
      setProjects(projectData);
      if (projectData.length === 0) {
        toast.warning("No projects available. Contact Admin to create one.");
      } else {
        toast.success(`Loaded ${projectData.length} projects`);
      }
    } catch (error: any) {
      console.error("===== fetchProjects ERROR =====");
      console.error("Error object:", error);
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Response data:", error.response.data);
      } else if (error.request) {
        console.error("No response received - request details:", error.request);
      } else {
        console.error("Request setup error:", error.message);
      }
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch projects";
      toast.error(message);
      if (error.response?.status === 403) {
        toast.error("Not authorized to view projects. Redirecting...");
        navigate("/login", { replace: true });
      } else if (error.response?.status === 401) {
        toast.error("Session expired. Please log in again.");
        navigate("/login", { replace: true });
      }
      setProjects([]);
    } finally {
      console.log("===== fetchProjects END =====");
    }
  };
  const fetchTeamMembers = async () => {
    setIsTeamMembersLoading(true);
    try {
      console.log("Calling endpoint: /api/users/team-members"); // Add logging
      console.log("Logged-in user ID:", user?.id); // Log user ID
      const response = await axios.get<{ data: User[]; message?: string }>(
        `${API_URL}/users/team-members`,
        getAuthHeaders(),
      );
      console.log("Team members API response:", response.data);
      const members = response.data.data.map((user) => ({
        id: user.id.toString(),
        name: user.name,
      }));
      if (members.length === 0) {
        const message =
          response.data.message ||
          "No team members found. Please contact an Admin to assign team members.";
        toast.warning(message);
      }
      setTeamMembers(members);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching team members:", axiosError);
      console.log("Error response:", axiosError.response?.data);
      const errorMessage =
        axiosError.response?.data?.message ||
        "Failed to fetch team members. Please try again.";
      if (axiosError.response?.status === 401) {
        toast.error("Session expired. Please log in again.");
        navigate("/login", { replace: true });
      } else {
        toast.error(errorMessage);
      }
      setTeamMembers([]);
    } finally {
      setIsTeamMembersLoading(false);
    }
  };
  const fetchPIDs = async () => {
    if (!selectedProject) return;
    try {
      const response = await axios.get<{
        data: { id: number; pid_number: string; project_id: number }[];
      }>(`${API_URL}/pids?projectId=${selectedProject}`, getAuthHeaders());
      const pidsData = response.data.data
        .filter(
          (pid) =>
            !assignedItemsForDuplicates.redlinePIDs.includes(pid.id.toString()),
        )
        .map((pid) => ({
          id: pid.id.toString(),
          name: pid.pid_number,
        }));
      console.log(`Fetched PIDs for project ${selectedProject}:`, pidsData);
      setPIDs(pidsData);
      setSelectedPIDs((prev) =>
        prev.filter((pidId) => pidsData.some((pid) => pid.id === pidId)),
      );
      if (pidsData.length === 0) {
        toast.info("No unassigned P&IDs available for this project.");
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching P&IDs:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch P&IDs",
      );
      setPIDs([]);
      setSelectedPIDs([]);
    }
  };
  const fetchLines = async () => {
    if (!selectedProject) return;
    try {
      // NEW: Add taskType query param for QC filtering
      const taskTypeParam = taskType === "QC" ? "?taskType=QC" : "";
      const response = await axios.get<{
        data: {
          id: number;
          line_number: string;
          pid_id: number;
          pid_number: string;
        }[];
      }>(
        `${API_URL}/lines/unassigned/${selectedProject}${taskTypeParam}`,
        getAuthHeaders(),
      );
      const linesData = response.data.data
        .filter(
          (line) =>
            !assignedItemsForDuplicates.upvLines.includes(line.id.toString()) &&
            !assignedItemsForDuplicates.qcLines.includes(line.id.toString()),
        )
        .map((line) => ({
          id: line.id.toString(),
          name: line.line_number,
          pidId: line.pid_id.toString(),
        }));
      setLines(linesData);
      setSelectedLines((prev) =>
        prev.filter((lineId) => linesData.some((line) => line.id === lineId)),
      );
      if (linesData.length === 0) {
        const message =
          taskType === "QC"
            ? "No UPV-completed lines available for QC assignment."
            : "No unassigned lines available for this project.";
        toast.info(message);
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching unassigned lines:", axiosError);
      toast.error(
        axiosError.response?.data?.message ||
          "Failed to fetch unassigned lines",
      );
      setLines([]);
      setSelectedLines([]);
    }
  };
  const fetchEquipment = async () => {
    if (!selectedProject) return;
    try {
      const taskTypeParam = taskType === "QC" ? "?taskType=QC" : "";
      const response = await axios.get<{
        data: {
          id: number;
          equipment_number: string;
          area_id?: number;
          project_id: number;
        }[];
      }>(
        `${API_URL}/equipment/unassigned/${selectedProject}${taskTypeParam}`,
        getAuthHeaders(),
      );
      const equipmentData = response.data.data
        .filter(
          (equip) =>
            !assignedItemsForDuplicates.upvEquipment.includes(
              equip.id.toString(),
            ) &&
            !assignedItemsForDuplicates.qcEquipment.includes(
              equip.id.toString(),
            ),
        )
        .map((equip) => ({
          id: equip.id.toString(),
          name: equip.equipment_number,
          areaId: equip.area_id?.toString() || "",
        }));
      setEquipment(equipmentData);
      setSelectedEquipment((prev) =>
        prev.filter((equipId) =>
          equipmentData.some((equip) => equip.id === equipId),
        ),
      );
      if (equipmentData.length === 0) {
        const message =
          taskType === "QC"
            ? "No UPV-completed equipment available for QC assignment."
            : "No unassigned equipment available for this project.";
        toast.info(message);
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching equipment:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch equipment",
      );
      setEquipment([]);
      setSelectedEquipment([]);
    }
  };
  const fetchNonInlineInstruments = async () => {
    if (!selectedProject) return;
    try {
      const taskTypeParam = taskType === "QC" ? "?taskType=QC" : "";
      const response = await axios.get<{
        data: { id: number; instrument_tag: string; description: string }[];
      }>(
        `${API_URL}/non-inline-instruments/unassigned/${selectedProject}${taskTypeParam}`,
        getAuthHeaders(),
      );
      const instrumentsData = response.data.data.map((instrument) => ({
        id: instrument.id.toString(),
        instrumentTag: instrument.instrument_tag,
        description: instrument.description,
      }));
      setNonInlineInstruments(instrumentsData);
      setSelectedNonInlineInstruments((prev) =>
        prev.filter((id) =>
          instrumentsData.some((instrument) => instrument.id === id),
        ),
      );
      if (instrumentsData.length === 0) {
        const message =
          taskType === "QC"
            ? "No UPV-completed non-inline instruments available for QC assignment."
            : "No unassigned non-inline instruments available for this project.";
        toast.info(message);
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching non-inline instruments:", axiosError);
      toast.error(
        axiosError.response?.data?.message ||
          "Failed to fetch non-inline instruments",
      );
      setNonInlineInstruments([]);
      setSelectedNonInlineInstruments([]);
    }
  };
  // Replace the fetchTasks function in TeamLeadDashboard.tsx (lines ~499-533)
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      console.log("Fetching tasks for Team Lead with token:", token);
      console.log("Selected project:", selectedProject);
      const response = await axios.get<{ data: any[] }>(
        `${API_URL}/tasks`,
        getAuthHeaders(),
      );
      console.log("Tasks API response:", response.data);
      const tasksData = response.data.data
        .filter((task) => {
          const matchesProject =
            !selectedProject ||
            task.project_id?.toString() === selectedProject ||
            task.project_id === null;
          console.log(
            `Task ${task.id} project_id: ${task.project_id}, matches: ${matchesProject}`,
          );
          return matchesProject;
        })
        .map((task) => {
          const commentMap = new Map<string, TaskComment>();
          (task.comments || []).forEach((comment, commentIndex) => {
            if (
              !comment ||
              !comment.id ||
              !comment.user_id ||
              !comment.created_at
            ) {
              console.warn(
                `Invalid comment at comment index ${commentIndex}:`,
                comment,
              );
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
          const isPIDBased = task.is_pid_based === true;
          let mappedItems: any[] = [];
          if (isPIDBased) {
            // Map pid_work_items to TaskItem format
            mappedItems = (task.pid_work_items || []).map((pwi: any) => ({
              id: pwi.id.toString(),
              name: pwi.line_number
                ? `Line: ${pwi.line_number}`
                : pwi.equipment_number
                  ? `Equipment: ${pwi.equipment_number}`
                  : `PID: ${pwi.pid_number}`,
              type: pwi.line_id
                ? "Line"
                : pwi.equipment_id
                  ? "Equipment"
                  : "PID",
              completed: pwi.status === "Completed" || pwi.status === "Skipped",
              completedAt: pwi.completed_at || null,
              blocks: pwi.blocks || 0,
            }));
          } else {
            // Map legacy task_items
            mappedItems = (task.items || [])
              .map((item: any) => {
                if (!item || !item.id) {
                  console.warn(`Invalid item at task id ${task.id}:`, item);
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
              .filter((item: any) => item !== null);
          }
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
            isPIDBased: isPIDBased,
            pidWorkItems: task.pid_work_items || [],
          };
        });

      console.log("Processed tasks data:", tasksData);
      setTasks(tasksData);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Detailed error fetching tasks:", {
        message: axiosError.message,
        response: axiosError.response?.data,
        status: axiosError.response?.status,
        headers: axiosError.response?.headers,
      });
      toast.error(
        axiosError.response?.data?.message ||
          "Failed to fetch tasks. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };
  const fetchAssignedItems = async (userId: string, taskId: string) => {
    console.log("=== fetchAssignedItems START ===");
    console.log("Input - userId:", userId, "taskId:", taskId);
    try {
      const url = `${API_URL}/users/${userId}/assigned-items/${taskId}`;
      console.log("API URL:", url);
      console.log("API_URL constant:", API_URL);
      const headers = getAuthHeaders();
      console.log("Request headers:", headers);
      const response = await axios.get<{ data: FetchedAssignedItems }>(
        url,
        headers,
      );

      console.log("Raw axios response:", response);
      console.log("Response status:", response.status);
      console.log("Response data:", response.data);
      console.log("Response data.data:", response.data.data);
      const data = response.data.data;
      console.log("Extracted data object:", data);
      console.log("data.isPIDBased:", data.isPIDBased);
      console.log("data.pidWorkItems:", data.pidWorkItems);
      console.log("data.pidWorkItems type:", typeof data.pidWorkItems);
      console.log(
        "data.pidWorkItems is array:",
        Array.isArray(data.pidWorkItems),
      );
      console.log("data.pidWorkItems length:", data.pidWorkItems?.length);
      // Log each pidWorkItem
      if (data.pidWorkItems && data.pidWorkItems.length > 0) {
        console.log("First pidWorkItem:", data.pidWorkItems[0]);
        data.pidWorkItems.forEach((item, idx) => {
          console.log(`pidWorkItem[${idx}]:`, item);
        });
      }

      // Map project_id to project_name using the projects array
      const mapProjectName = (items: any[]) => {
        console.log("Mapping project names for items:", items);
        return items.map((item) => ({
          ...item,
          project_name:
            projects.find((p) => p.id === item.project_id)?.name || "Unknown",
        }));
      };

      const result = {
        isPIDBased: data.isPIDBased || false,
        pidWorkItems: data.pidWorkItems || [],
        upvLines: {
          count: data.upvLines?.count || 0,
          items: mapProjectName(data.upvLines?.items || []),
        },
        qcLines: {
          count: data.qcLines?.count || 0,
          items: mapProjectName(data.qcLines?.items || []),
        },
        redlinePIDs: {
          count: data.redlinePIDs?.count || 0,
          items: mapProjectName(data.redlinePIDs?.items || []),
        },
        upvEquipment: {
          count: data.upvEquipment?.count || 0,
          items: mapProjectName(data.upvEquipment?.items || []),
        },
        qcEquipment: {
          count: data.qcEquipment?.count || 0,
          items: mapProjectName(data.qcEquipment?.items || []),
        },
      };

      console.log("Final result object:", result);
      console.log("Result isPIDBased:", result.isPIDBased);
      console.log("Result pidWorkItems:", result.pidWorkItems);
      console.log("Result pidWorkItems length:", result.pidWorkItems.length);
      console.log("=== fetchAssignedItems END ===");

      return result;
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("=== fetchAssignedItems ERROR ===");
      console.error("Error:", axiosError);
      console.error("Error message:", axiosError.message);
      console.error("Error response:", axiosError.response);
      console.error("Error response data:", axiosError.response?.data);
      console.error("Error response status:", axiosError.response?.status);
      throw axiosError;
    }
  };
  const handleViewCurrentWork = async (taskId: string, userId: string) => {
    console.log("=== MODAL DEBUG START ===");
    console.log("Opening modal for taskId:", taskId, "userId:", userId);
    setSelectedUserId(userId);
    setLoadingItems(true);
    try {
      const task = tasks.find((t) => t.id === taskId);
      console.log("Found task:", task);
      if (!task) {
        toast.error("Task not found");
        setLoadingItems(false);
        return;
      }
      // FIX: Determine itemType correctly for both PID-based and legacy tasks
      let itemType: "PID" | "Line" | "Equipment" | null = null;
      if (task.isPIDBased) {
        console.log("Task is PID-based, pidWorkItems:", task.pidWorkItems);
        // For PID-based tasks, the itemType should be based on what's in the PID
        // Could be Line or Equipment
        if (task.pidWorkItems && task.pidWorkItems.length > 0) {
          const firstItem = task.pidWorkItems[0];
          if (firstItem.line_id || firstItem.line_number) {
            itemType = "Line";
          } else if (firstItem.equipment_id || firstItem.equipment_number) {
            itemType = "Equipment";
          }
        }
        console.log("Detected itemType for PID-based task:", itemType);
      } else {
        // Legacy task - get from task.items
        if (task.items && task.items.length > 0) {
          itemType = task.items[0].type as "PID" | "Line" | "Equipment";
        }
        console.log("Detected itemType for legacy task:", itemType);
      }
      setSelectedTaskType(task.type);
      setSelectedItemType(itemType);
      console.log(
        "Calling fetchAssignedItems for userId:",
        userId,
        "taskId:",
        taskId,
      );
      const items = await fetchAssignedItems(userId, taskId);
      console.log("fetchAssignedItems returned:", items);
      console.log("items.isPIDBased:", items.isPIDBased);
      console.log("items.pidWorkItems length:", items.pidWorkItems?.length);
      // FIX: Ensure we're spreading the data correctly
      const modalData = {
        ...items,
        isPIDBased: items.isPIDBased || false,
        pidWorkItems: items.pidWorkItems || [],
      };
      console.log("Setting modal data:", modalData);
      console.log("Modal data isPIDBased:", modalData.isPIDBased);
      console.log("Modal data pidWorkItems:", modalData.pidWorkItems);
      setAssignedItems(modalData);
      setModalIsOpen(true);
      console.log("=== MODAL DEBUG END ===");
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("=== MODAL ERROR ===");
      console.error("Error fetching assigned items:", axiosError);
      console.error("Error response:", axiosError.response?.data);
      console.error("Error status:", axiosError.response?.status);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch assigned items",
      );
      setAssignedItems(null);
      setSelectedTaskType(null);
      setSelectedItemType(null);
    } finally {
      setLoadingItems(false);
    }
  };
  const closeModal = () => {
    setModalIsOpen(false);
    setAssignedItems(null);
    setSelectedUserId(null);
    setSelectedTaskType(null);
    setSelectedItemType(null);
  };
  const handleViewComments = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setSelectedTaskForComments(task);
      setCommentsModalIsOpen(true);
    } else {
      toast.error("Task not found");
    }
  };
  const closeCommentsModal = () => {
    setCommentsModalIsOpen(false);
    setSelectedTaskForComments(null);
  };
  const handleAssigneeChange = (value: string) => {
    console.log("Selected assignee:", value); // Add logging for debugging
    setAssignee(value);
  };
  useEffect(() => {
    if (
      isAuthenticated &&
      token &&
      ["Team Lead", "Project Manager"].includes(user?.role || "")
    ) {
      console.log("Dashboard mount - fetching data for role:", user?.role);
      fetchProjects();
      fetchTeamMembers();
      setGeneralMessage(getRandomMessage("general"));
    }
  }, [isAuthenticated, token, user?.role]); // ← user?.role in deps is fine
  useEffect(() => {
    if (selectedProject && taskType) {
      Promise.all([
        fetchPIDs(),
        fetchLines(),
        fetchEquipment(),
        fetchNonInlineInstruments(),
        fetchTasks(),
      ]).catch((error) => {
        console.error("Error fetching dashboard data:", error);
        toast.error("Failed to load dashboard data");
      });
    }
  }, [selectedProject, taskType]);
  useEffect(() => {
    const upvLines: string[] = [];
    const upvEquipment: string[] = [];
    const qcLines: string[] = [];
    const qcEquipment: string[] = [];
    const redlinePIDs: string[] = [];
    tasks.forEach((task) => {
      task.items.forEach((item) => {
        if (task.type === "Redline" && item.type === "PID") {
          redlinePIDs.push(item.id);
        } else if (task.type === "UPV") {
          if (item.type === "Line") upvLines.push(item.id);
          if (item.type === "Equipment") upvEquipment.push(item.id);
        } else if (task.type === "QC") {
          if (item.type === "Line") qcLines.push(item.id);
          if (item.type === "Equipment") qcEquipment.push(item.id);
        }
      });
    });
    setAssignedItemsForDuplicates({
      upvLines,
      upvEquipment,
      qcLines,
      qcEquipment,
      redlinePIDs,
    });
  }, [tasks]);
  const handleTaskTypeChange = (value: string) => {
    setTaskType(value as TaskType);
    setAssignmentType("");
    setSelectedPIDs([]);
    setSelectedLines([]);
    setSelectedEquipment([]);
  };
  const handleAssignmentTypeChange = (value: string) => {
    console.log("Assignment type changed to:", value); // Add this log
    if (
      value === "PID" ||
      value === "Line" ||
      value === "Equipment" ||
      value === "NonInlineInstrument" ||
      value === ""
    ) {
      setAssignmentType(value);
      setSelectedPIDs([]);
      setSelectedLines([]);
      setSelectedEquipment([]);
      setSelectedNonInlineInstruments([]); // Reset non-inline instruments selection
    }
  };
  const handleRefresh = () => {
    if (!selectedProject) {
      toast.error("Please select a project first.");
      return;
    }
    Promise.all([
      fetchTeamMembers(),
      fetchPIDs(),
      fetchLines(),
      fetchEquipment(),
      fetchTasks(),
    ])
      .then(() => {
        toast.success("Data refreshed");
        setGeneralMessage(getRandomMessage("general"));
      })
      .catch((error) => {
        console.error("Error refreshing data:", error);
        toast.error("Failed to refresh data");
      });
  };
  const handleAssign = async () => {
    if (!taskType || !assignee || !selectedProject) {
      toast.error("Please select task type, assignee, and project");
      return;
    }
    const assigneeId = parseInt(assignee);
    if (isNaN(assigneeId)) {
      toast.error("Invalid assignee selected");
      return;
    }
    const project = projects.find((p) => p.id === selectedProject);
    if (!project) {
      toast.error("Selected project not found. Please refresh and try again.");
      return;
    }
    setIsSubmitting(true);
    setSubmissionProgress(0);
    try {
      const authHeaders = getAuthHeaders();
      const assigneeMember = teamMembers.find(
        (member) => member.id === assignee,
      );
      if (!assigneeMember) {
        throw new Error("Assignee not found");
      }
      if (
        taskType === "UPV" &&
        usePIDBasedAssignment &&
        selectedPIDs.length > 0
      ) {
        console.log("Using PID-based assignment workflow");
        console.log("Token being sent:", token);
        // FIXED: Changed from /api/pid-work/tasks/assign-pid to /api/tasks/assign-pid
        const pidAssignmentPromises = selectedPIDs.map((pidId) => {
          const payload = {
            pid_id: parseInt(pidId),
            user_id: assigneeId,
            task_type: "UPV",
            estimated_blocks: 0,
            project_id: selectedProject,
          };
          console.log(`---> Assigning PID ${pidId} with payload:`, payload);
          return axios.post(`${API_URL}/tasks/assign-pid`, payload, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
            },
          });
        });
        try {
          const results = await Promise.all(pidAssignmentPromises);
          console.log("---> PID assignment results:", results);
          setSubmissionProgress(100);
          // Refresh data
          await Promise.all([
            fetchTasks(),
            fetchPIDs(),
            fetchLines(),
            fetchEquipment(),
          ]);
          // Clear form
          setTaskType("");
          setAssignmentType("");
          setSelectedPIDs([]);
          setAssignee("");
          setUsePIDBasedAssignment(false);
          toast.success(
            `${selectedPIDs.length} PID(s) assigned to ${assigneeMember.name} using PID-based workflow. ${getRandomMessage("completion")}`,
          );
          return;
        } catch (error) {
          const axiosError = error as AxiosError<{ message: string }>;
          console.error("<---Error in PID assignment:", {
            message: axiosError.message,
            response: axiosError.response?.data,
            status: axiosError.response?.status,
          });
          throw error; // Re-throw to be caught by outer catch
        }
      }
      // EXISTING: Legacy line-based assignment continues below...
      let selectedItems: {
        itemId: string;
        itemType: string;
        itemName: string;
      }[] = [];
      let validSelection = false;
      if (taskType === "Misc") {
        if (
          !description ||
          typeof description !== "string" ||
          description.trim().length === 0
        ) {
          toast.error(
            "Please provide a description for the miscellaneous task",
          );
          return;
        }
      } else {
        // ... rest of existing validation logic ...
        if (taskType === "Redline" && assignmentType === "PID") {
          if (selectedPIDs.length > 0) {
            validSelection = true;
            selectedItems = selectedPIDs
              .map((pid) => {
                const pidObj = pids.find((p) => p.id === pid);
                if (!pidObj) {
                  console.warn(`PID with ID ${pid} not found in pids array`);
                  return null;
                }
                return {
                  itemId: pid,
                  itemType: "PID",
                  itemName: pidObj.name || pid,
                };
              })
              .filter((item) => item !== null);
          }
        } else if (taskType === "UPV") {
          if (assignmentType === "Line" && selectedLines.length > 0) {
            validSelection = true;
            selectedItems = selectedLines
              .map((line) => {
                const lineObj = lines.find((l) => l.id === line);
                if (!lineObj) {
                  console.warn(`Line with ID ${line} not found in lines array`);
                  return null;
                }
                return {
                  itemId: line,
                  itemType: "Line",
                  itemName: lineObj.name || line,
                };
              })
              .filter((item) => item !== null);
          } else if (
            assignmentType === "Equipment" &&
            selectedEquipment.length > 0
          ) {
            validSelection = true;
            selectedItems = selectedEquipment
              .map((equip) => {
                const equipObj = equipment.find((e) => e.id === equip);
                if (!equipObj) {
                  console.warn(
                    `Equipment with ID ${equip} not found in equipment array`,
                  );
                  return null;
                }
                return {
                  itemId: equip,
                  itemType: "Equipment",
                  itemName: equipObj.name || equip,
                };
              })
              .filter((item) => item !== null);
          } else if (assignmentType === "PID" && selectedPIDs.length > 0) {
            validSelection = true;
            selectedItems = selectedPIDs
              .map((pid) => {
                const pidObj = pids.find((p) => p.id === pid);
                if (!pidObj) {
                  console.warn(`PID with ID ${pid} not found in pids array`);
                  return null;
                }
                return {
                  itemId: pid,
                  itemType: "PID",
                  itemName: pidObj.name || pid,
                };
              })
              .filter((item) => item !== null);
          } else if (
            assignmentType === "NonInlineInstrument" &&
            selectedNonInlineInstruments.length > 0
          ) {
            validSelection = true;
            selectedItems = selectedNonInlineInstruments
              .map((instrumentId) => {
                const instrumentObj = nonInlineInstruments.find(
                  (i) => i.id === instrumentId,
                );
                if (!instrumentObj) {
                  console.warn(
                    `Non-inline instrument with ID ${instrumentId} not found`,
                  );
                  return null;
                }
                return {
                  itemId: instrumentId,
                  itemType: "NonInlineInstrument",
                  itemName: instrumentObj.instrumentTag,
                };
              })
              .filter((item) => item !== null);
          }
        } else if (taskType === "QC") {
          if (assignmentType === "PID" && selectedPIDs.length > 0) {
            validSelection = true;
            selectedItems = selectedPIDs
              .map((pid) => {
                const pidObj = pids.find((p) => p.id === pid);
                if (!pidObj) {
                  console.warn(`PID with ID ${pid} not found in pids array`);
                  return null;
                }
                return {
                  itemId: pid,
                  itemType: "PID",
                  itemName: pidObj.name || pid,
                };
              })
              .filter((item) => item !== null);
          } else if (assignmentType === "Line" && selectedLines.length > 0) {
            validSelection = true;
            selectedItems = selectedLines
              .map((line) => {
                const lineObj = lines.find((l) => l.id === line);
                if (!lineObj) {
                  console.warn(`Line with ID ${line} not found in lines array`);
                  return null;
                }
                return {
                  itemId: line,
                  itemType: "Line",
                  itemName: lineObj.name || line,
                };
              })
              .filter((item) => item !== null);
          } else if (
            assignmentType === "Equipment" &&
            selectedEquipment.length > 0
          ) {
            validSelection = true;
            selectedItems = selectedEquipment
              .map((equip) => {
                const equipObj = equipment.find((e) => e.id === equip);
                if (!equipObj) {
                  console.warn(
                    `Equipment with ID ${equip} not found in equipment array`,
                  );
                  return null;
                }
                return {
                  itemId: equip,
                  itemType: "Equipment",
                  itemName: equipObj.name || equip,
                };
              })
              .filter((item) => item !== null);
          } else if (
            assignmentType === "NonInlineInstrument" &&
            selectedNonInlineInstruments.length > 0
          ) {
            validSelection = true;
            selectedItems = selectedNonInlineInstruments
              .map((instrumentId) => {
                const instrumentObj = nonInlineInstruments.find(
                  (i) => i.id === instrumentId,
                );
                if (!instrumentObj) {
                  console.warn(
                    `Non-inline instrument with ID ${instrumentId} not found`,
                  );
                  return null;
                }
                return {
                  itemId: instrumentId,
                  itemType: "NonInlineInstrument",
                  itemName: instrumentObj.instrumentTag,
                };
              })
              .filter((item) => item !== null);
          }
        }
        if (!validSelection || selectedItems.length === 0) {
          toast.error("Please select at least one valid item to assign");
          return;
        }
      }
      // Legacy task creation
      const newTask = {
        type: taskType,
        assigneeId,
        isComplex,
        projectName: project.name,
        projectId: parseInt(selectedProject),
        items: taskType === "Misc" ? [] : selectedItems,
        description: taskType === "Misc" ? description : undefined,
      };
      console.log(
        "Sending task payload with description:",
        newTask.description,
      );
      console.log("Sending task payload:", newTask);
      const response = await axios.post(
        `${API_URL}/tasks`,
        newTask,
        authHeaders,
      );
      const taskId = response.data.data.id;
      setSubmissionProgress(50);
      if (assignmentType === "Line" && taskType !== "Misc") {
        const lineIds = selectedItems.map((item) => parseInt(item.itemId));
        await axios.put(
          `${API_URL}/lines/assign/batch`,
          { lineIds, userId: assigneeId },
          authHeaders,
        );
      } else if (
        assignmentType === "NonInlineInstrument" &&
        taskType !== "Misc"
      ) {
        const instrumentIds = selectedItems.map((item) =>
          parseInt(item.itemId),
        );
        // Validate instrumentIds
        const invalidIds = instrumentIds.filter((id) => isNaN(id) || id <= 0);
        if (invalidIds.length > 0) {
          throw new Error(
            `Invalid instrument IDs: ${invalidIds.join(
              ", ",
            )}. All IDs must be positive integers.`,
          );
        }
        console.log("Assigning non-inline instruments with payload:", {
          instrumentIds,
          userId: assigneeId,
          taskId,
        }); // Add logging
        await axios.put(
          `${API_URL}/non-inline-instruments/assign/batch`,
          { instrumentIds, userId: assigneeId, taskId },
          authHeaders,
        );
      }
      setSubmissionProgress(100);
      await Promise.all([
        fetchTasks(),
        fetchPIDs(),
        fetchLines(),
        fetchEquipment(),
        fetchNonInlineInstruments(),
      ]);
      setTaskType("");
      setAssignmentType("");
      setSelectedPIDs([]);
      setSelectedLines([]);
      setSelectedEquipment([]);
      setSelectedNonInlineInstruments([]);
      setAssignee("");
      setIsComplex(false);
      setDescription("");
      toast.success(
        `Task assigned to ${assigneeMember.name}. ${getRandomMessage(
          "completion",
        )}`,
      );
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error assigning task:", axiosError);
      console.log("Response data:", axiosError.response?.data);
      const errorMessage =
        axiosError.response?.data?.message ||
        axiosError.message ||
        "Failed to assign task. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
      setSubmissionProgress(0);
    }
  };
  // Handler for group select count change
  const handleGroupSelectCountChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const count = parseInt(e.target.value, 10);
    if (isNaN(count) || count < 1) {
      setGroupSelectCount(1);
    } else {
      const maxCount =
        assignmentType === "PID"
          ? pids.length
          : assignmentType === "Line"
            ? lines.length
            : equipment.length;
      setGroupSelectCount(Math.min(count, maxCount));
    }
  };
  // Handler for group selection of PIDs
  const handlePIDCheckboxChange = (
    pidId: string,
    index: number,
    checked: boolean,
  ) => {
    if (groupSelectCount > 1) {
      const startIndex = index;
      const endIndex = Math.min(startIndex + groupSelectCount, pids.length);
      const pidsToSelect = pids
        .slice(startIndex, endIndex)
        .map((pid) => pid.id);
      if (checked) {
        const newSelectedPIDs = [
          ...new Set([...selectedPIDs, ...pidsToSelect]),
        ];
        setSelectedPIDs(newSelectedPIDs);
        toast.success(`Selected ${pidsToSelect.length} P&IDs`);
      } else {
        const newSelectedPIDs = selectedPIDs.filter(
          (id) => !pidsToSelect.includes(id),
        );
        setSelectedPIDs(newSelectedPIDs);
        toast.success(`Deselected ${pidsToSelect.length} P&IDs`);
      }
    } else {
      if (checked) {
        setSelectedPIDs([...selectedPIDs, pidId]);
      } else {
        setSelectedPIDs(selectedPIDs.filter((id) => id !== pidId));
      }
    }
  };
  // const lineCount = 10;
  // Handler for group selection of Lines
  const handleLineCheckboxChange = (
    lineId: string,
    index: number,
    checked: boolean,
  ) => {
    setSelectedLines((prev) => {
      let newSelected = [...prev];
      if (checked) {
        if (!newSelected.includes(lineId)) {
          newSelected.push(lineId);
          // Auto-select next N-1 lines based on groupSelectCount
          const remainingCount = groupSelectCount - 1; // Changed from lineCount
          if (remainingCount > 0) {
            const availableLines = lines
              .slice(index + 1)
              .filter((line) => !newSelected.includes(line.id))
              .slice(0, remainingCount);
            newSelected = [
              ...newSelected,
              ...availableLines.map((line) => line.id),
            ];
          }
        }
      } else {
        newSelected = newSelected.filter((id) => id !== lineId);
      }
      return newSelected;
    });
  };
  // Handler for group selection of Equipment
  const handleEquipmentCheckboxChange = (
    equipId: string,
    index: number,
    checked: boolean,
  ) => {
    if (groupSelectCount > 1) {
      const startIndex = index;
      const endIndex = Math.min(
        startIndex + groupSelectCount,
        equipment.length,
      );
      const equipmentToSelect = equipment
        .slice(startIndex, endIndex)
        .map((equip) => equip.id);
      if (checked) {
        const newSelectedEquipment = [
          ...new Set([...selectedEquipment, ...equipmentToSelect]),
        ];
        setSelectedEquipment(newSelectedEquipment);
        toast.success(`Selected ${equipmentToSelect.length} equipment items`);
      } else {
        const newSelectedEquipment = selectedEquipment.filter(
          (id) => !equipmentToSelect.includes(id),
        );
        setSelectedEquipment(newSelectedEquipment);
        toast.success(`Deselected ${equipmentToSelect.length} equipment items`);
      }
    } else {
      if (checked) {
        setSelectedEquipment([...selectedEquipment, equipId]);
      } else {
        setSelectedEquipment(selectedEquipment.filter((id) => id !== equipId));
      }
    }
  };
  const handleExportCSV = async () => {
    if (tasks.length === 0) {
      toast.error("No tasks available to export.");
      return;
    }
    try {
      // Fetch detailed task data with blocks
      const csvData: any[] = [];
      for (const task of tasks) {
        for (const item of task.items) {
          const row = {
            "Area No": task.areaNumber || "N/A",
            "PID No": task.pidNumber || "N/A",
            "Line/Equipment/Instrument": item.name,
            Type: item.type,
            "Block Count": item.blocks || 0,
            Completed: item.completed ? "Yes" : "No",
            "QC Done By": item.completed ? task.assignee : "N/A",
            "Task Type": task.type,
            Project: task.projectName,
            Status: task.status,
            "Assigned On": new Date(task.createdAt).toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short",
            }),
            "Completed On": item.completedAt
              ? new Date(item.completedAt).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Not Completed",
          };
          csvData.push(row);
        }
      }
      // Create CSV headers
      const headers = [
        "Area No",
        "PID No",
        "Line/Equipment/Instrument",
        "Type",
        "Block Count",
        "Completed",
        "QC Done By",
        "Task Type",
        "Project",
        "Status",
        "Assigned On",
        "Completed On",
      ];
      // Convert to CSV
      const csvRows = csvData.map((row) =>
        headers.map((header) => {
          const value = row[header] || "";
          // Escape quotes and wrap in quotes if contains comma
          return value.toString().includes(",")
            ? `"${value.toString().replace(/"/g, '""')}"`
            : value;
        }),
      );
      const csvContent = [headers, ...csvRows]
        .map((row) => row.join(","))
        .join("\n");
      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `task_details_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully!");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export CSV");
    }
  };
  if (!isAuthenticated || !token || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800">
            Authenticating...
          </h2>
          <p className="text-gray-600 mt-2">
            Redirecting or loading session...
          </p>
        </div>
      </div>
    );
  }
  if (!["Team Lead", "Project Manager"].includes(user.role)) {
    console.warn(`Unauthorized access attempt — role: ${user.role}`);
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-800 mb-4">
            Access Denied
          </h2>
          <p className="text-red-700 mb-6">
            Only Team Leads and Project Managers can access this page.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }
  const selectedUser = teamMembers.find(
    (member) => member.id === selectedUserId,
  );
  const userName = selectedUser ? selectedUser.name : "";
  const RetractTaskModal = () => {
    if (!selectedTaskForRetract) return null;
    const completedItems = selectedTaskForRetract.items.filter(
      (item) => item.completed,
    );
    const incompleteItems = selectedTaskForRetract.items.filter(
      (item) => !item.completed,
    );
    const hasCompletedWork = completedItems.length > 0;

    return (
      <Modal
        isOpen={retractModalOpen}
        onRequestClose={() => {
          setRetractModalOpen(false);
          setSelectedTaskForRetract(null);
          setNewAssigneeId("");
        }}
        style={{
          content: {
            top: "50%",
            left: "50%",
            right: "auto",
            bottom: "auto",
            marginRight: "-50%",
            transform: "translate(-50%, -50%)",
            width: "90%",
            maxWidth: "500px",
            maxHeight: "80vh",
            overflowY: "auto",
            padding: "24px",
            borderRadius: "12px",
            backgroundColor: "#fff",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            zIndex: 1050,
          },
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            zIndex: 1000,
          },
        }}
        contentLabel="Retract Task Modal"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">
              Retract Task #{selectedTaskForRetract.id}
            </h2>

            <button
              onClick={() => {
                setRetractModalOpen(false);
                setSelectedTaskForRetract(null);
                setNewAssigneeId("");
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="bg-gray-50 p-3 rounded-md">
            <h3 className="font-medium text-gray-800 mb-2">Task Details:</h3>
            <p className="text-sm text-gray-600">
              Type: {selectedTaskForRetract.type}
            </p>
            <p className="text-sm text-gray-600">
              Current Assignee: {selectedTaskForRetract.assignee}
            </p>
            <p className="text-sm text-gray-600">
              Status: {selectedTaskForRetract.status}
            </p>
            <p className="text-sm text-gray-600">
              Progress: {selectedTaskForRetract.progress}%
            </p>
          </div>
          {hasCompletedWork && (
            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md">
              <h3 className="font-medium text-yellow-800 mb-2">
                ⚠️ Work Already Completed
              </h3>
              <p className="text-sm text-yellow-700 mb-2">
                This task has {completedItems.length} completed item(s) out of{" "}
                {selectedTaskForRetract.items.length} total items.
              </p>
              <p className="text-sm text-yellow-700">
                Completed work will remain with{" "}
                <strong>{selectedTaskForRetract.assignee}</strong>. Only
                incomplete items ({incompleteItems.length}) will be reassigned
                to the new assignee.
              </p>
            </div>
          )}
          {!hasCompletedWork && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
              <p className="text-sm text-blue-700">
                No work has been completed on this task. You can either reset it
                for the current assignee or reassign it to someone else.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              {hasCompletedWork
                ? "Select New Assignee (Required)"
                : "Reassign To (Optional)"}
            </label>
            <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
              <SelectTrigger style={{ zIndex: 1100 }}>
                <SelectValue placeholder="Select new assignee or leave empty to reset" />
              </SelectTrigger>
              <SelectContent
                style={{ zIndex: 1100 }}
                className="z-[1100]"
                position="popper"
              >
                {teamMembers
                  .filter(
                    (member) => member.id !== selectedTaskForRetract.assigneeId,
                  )
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {hasCompletedWork && !newAssigneeId && (
              <p className="text-sm text-yellow-600 mt-1">
                ⚠️ Completed work will remain with{" "}
                {selectedTaskForRetract.assignee}. Incomplete items will return
                to the unassigned pool.
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => handleRetractTask(selectedTaskForRetract.id)}
              disabled={isLoading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isLoading
                ? "Processing..."
                : newAssigneeId
                  ? "Retract & Reassign"
                  : "Retract Only"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRetractModalOpen(false);
                setSelectedTaskForRetract(null);
                setNewAssigneeId("");
              }}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    );
  };
  return (
    <div className="min-h-screen">
      <Navbar onRefresh={handleRefresh} />

      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{getDashboardTitle()}</h1>
              <p className="text-gray-500">
                Assign and manage tasks for your team
              </p>
              {generalMessage && (
                <p className="text-sm text-gray-600 italic mt-2">
                  "{generalMessage}"
                </p>
              )}
            </div>
            {/* Only show "View My Tasks" for Team Leads, not Project Managers */}
            {user?.role === "Team Lead" && (
              <Button
                onClick={() => navigate("/my-tasks")}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
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
                View My Tasks
              </Button>
            )}
            {/* Add Back button for Project Manager */}
            {user?.role === "Project Manager" && (
              <Button
                onClick={() => navigate("/dashboard")}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
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
                Back to Dashboard
              </Button>
            )}
          </div>
        </header>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Task Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Project
                </label>
                <p className="text-xs text-blue-600 mb-1 font-medium">
                  Debug: {projects.length} projects in state | First:{" "}
                  {projects[0]?.name || "—"}
                </p>
                <Select
                  value={selectedProject}
                  onValueChange={setSelectedProject}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Task Type
                </label>
                <Select value={taskType} onValueChange={handleTaskTypeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Redline">Redline</SelectItem>
                    <SelectItem value="UPV">UPV</SelectItem>
                    <SelectItem value="QC">QC</SelectItem>
                    <SelectItem value="Misc">Miscellaneous</SelectItem>
                  </SelectContent>
                </Select>
                {!taskType && (
                  <p className="text-sm text-gray-500 mt-1">
                    Please select a task type to enable team member selection.
                  </p>
                )}
              </div>
              {taskType && taskType !== "Misc" && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Assignment Type
                  </label>
                  <Select
                    value={assignmentType}
                    onValueChange={handleAssignmentTypeChange}
                    disabled={!taskType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {taskType === "Redline" && (
                        <SelectItem value="PID">P&ID</SelectItem>
                      )}
                      {(taskType === "UPV" || taskType === "QC") && (
                        <SelectItem value="Line">Line</SelectItem>
                      )}
                      {(taskType === "UPV" || taskType === "QC") && (
                        <SelectItem value="Equipment">Equipment</SelectItem>
                      )}
                      {(taskType === "UPV" || taskType === "QC") && (
                        <SelectItem value="NonInlineInstrument">
                          Non-inline Instrument
                        </SelectItem>
                      )}
                      {(taskType === "UPV" || taskType === "QC") && (
                        <SelectItem value="PID">P&ID</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Assign To
                </label>
                <Select
                  value={assignee}
                  onValueChange={handleAssigneeChange}
                  disabled={
                    !taskType ||
                    teamMembers.length === 0 ||
                    isTeamMembersLoading
                  }
                >
                  <SelectTrigger>
                    {isTeamMembersLoading ? (
                      <span className="text-gray-500">
                        Loading team members...
                      </span>
                    ) : (
                      <SelectValue placeholder="Select member" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {isTeamMembersLoading ? (
                      <div className="p-2 text-sm text-gray-500">
                        Loading...
                      </div>
                    ) : teamMembers.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">
                        No team members available
                      </div>
                    ) : (
                      teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAssign}
                  disabled={
                    !taskType || !assignee || isSubmitting || !selectedProject
                  }
                  className="w-full"
                >
                  {isSubmitting ? "Assigning..." : "Assign Task"}
                </Button>
              </div>
            </div>
            {taskType &&
              (taskType === "Misc" ? (
                <div className="border p-4 rounded-md">
                  <h3 className="font-medium mb-3">Task Description</h3>
                  <textarea
                    className="w-full p-2 border rounded-md"
                    rows={4}
                    placeholder="Enter the task description..."
                    value={description}
                    onChange={(e) => {
                      console.log("Textarea value changed to:", e.target.value);
                      setDescription(e.target.value);
                    }}
                  />
                </div>
              ) : (
                assignmentType && (
                  <div className="border p-4 rounded-md">
                    <h3 className="font-medium mb-3">
                      Select{" "}
                      {assignmentType === "PID"
                        ? "P&IDs"
                        : assignmentType === "Line"
                          ? "Lines"
                          : assignmentType === "Equipment"
                            ? "Equipment"
                            : "Non-inline Instruments"}
                    </h3>
                    {taskType === "UPV" && assignmentType === "PID" && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          UPV Assignment Method
                        </h3>
                        <div className="space-y-3">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="upvAssignmentMethod"
                              checked={usePIDBasedAssignment}
                              onChange={() => setUsePIDBasedAssignment(true)}
                              className="mt-1"
                            />
                            <div>
                              <span className="font-medium text-sm text-gray-900">
                                🆕 PID-Based Assignment (Recommended)
                              </span>
                              <p className="text-xs text-gray-600 mt-1">
                                Assign entire P&IDs to users. System
                                auto-populates all lines/equipment in each PID.
                                User completes items within PID context.{" "}
                                <strong>
                                  Supports multiple users working on same line
                                  in different PIDs.
                                </strong>
                              </p>
                            </div>
                          </label>
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="upvAssignmentMethod"
                              checked={!usePIDBasedAssignment}
                              onChange={() => setUsePIDBasedAssignment(false)}
                              className="mt-1"
                            />
                            <div>
                              <span className="font-medium text-sm text-gray-700">
                                Line-Based Assignment (Legacy)
                              </span>
                              <p className="text-xs text-gray-600 mt-1">
                                Traditional method: Assign individual
                                lines/equipment. Each item can only be assigned
                                once.
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}
                    {/* Group Select Control */}
                    <div className="mb-4 flex items-center">
                      <label
                        htmlFor="groupSelectCount"
                        className="mr-2 font-medium"
                      >
                        Select how many at once:
                      </label>
                      <input
                        type="number"
                        id="groupSelectCount"
                        value={groupSelectCount}
                        onChange={handleGroupSelectCountChange}
                        min="1"
                        max={
                          assignmentType === "PID"
                            ? pids.length
                            : assignmentType === "Line"
                              ? lines.length
                              : assignmentType === "Equipment"
                                ? equipment.length
                                : assignmentType === "NonInlineInstrument"
                                  ? nonInlineInstruments.length
                                  : 0
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                      <span className="ml-2 text-gray-600">
                        (Click a checkbox to select the next {groupSelectCount}{" "}
                        items)
                      </span>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {assignmentType === "PID" && pids.length === 0 && (
                        <p className="text-sm text-gray-500">
                          No available P&IDs
                        </p>
                      )}
                      {assignmentType === "PID" && pids.length > 0 && (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {pids.map((pid, index) => (
                            <div
                              key={pid.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={pid.id}
                                checked={selectedPIDs.includes(pid.id)}
                                onCheckedChange={(checked) =>
                                  handlePIDCheckboxChange(
                                    pid.id,
                                    index,
                                    checked as boolean,
                                  )
                                }
                              />
                              <label htmlFor={pid.id} className="text-sm">
                                {pid.name}
                              </label>
                            </div>
                          ))}
                          <p className="text-sm text-gray-600 mt-2">
                            Selected P&IDs: {selectedPIDs.length}
                          </p>
                        </div>
                      )}
                      {assignmentType === "PID" &&
                        pids.map((pid, index) => (
                          <div
                            key={pid.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={pid.id}
                              checked={selectedPIDs.includes(pid.id)}
                              onCheckedChange={(checked) =>
                                handlePIDCheckboxChange(
                                  pid.id,
                                  index,
                                  checked as boolean,
                                )
                              }
                            />
                            <label htmlFor={pid.id} className="text-sm">
                              {pid.name}
                            </label>
                          </div>
                        ))}
                      {assignmentType === "Line" && lines.length === 0 && (
                        <p className="text-sm text-gray-500">
                          No available lines
                        </p>
                      )}
                      {assignmentType === "Line" && lines.length > 0 && (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {Object.entries(
                            lines.reduce(
                              (acc, line) => {
                                const pid = pids.find(
                                  (p) => p.id === line.pidId,
                                );
                                const pidNumber = pid
                                  ? pid.name
                                  : "Unknown PID";
                                if (!acc[pidNumber]) acc[pidNumber] = [];
                                acc[pidNumber].push(line);
                                return acc;
                              },
                              {} as { [key: string]: Line[] },
                            ),
                          ).map(([pidNumber, pidLines], pidIndex) => {
                            const previousPids = Object.entries(
                              lines.reduce(
                                (acc, line) => {
                                  const pid = pids.find(
                                    (p) => p.id === line.pidId,
                                  );
                                  const pidNumber = pid
                                    ? pid.name
                                    : "Unknown PID";
                                  if (!acc[pidNumber]) acc[pidNumber] = [];
                                  acc[pidNumber].push(line);
                                  return acc;
                                },
                                {} as { [key: string]: Line[] },
                              ),
                            ).slice(0, pidIndex);
                            const globalStartIndex = previousPids.reduce(
                              (sum, [, lines]) => sum + lines.length,
                              0,
                            );
                            return (
                              <div key={pidNumber + pidIndex}>
                                <div className="border-t border-gray-300 my-4">
                                  <h4 className="text-sm font-semibold text-gray-700 mt-2">
                                    Lines from PID {pidNumber}
                                  </h4>
                                </div>
                                {pidLines.map((line, localIndex) => {
                                  const globalIndex =
                                    globalStartIndex + localIndex;
                                  return (
                                    <div
                                      key={line.id}
                                      className="flex items-center space-x-2"
                                    >
                                      <Checkbox
                                        id={line.id}
                                        checked={selectedLines.includes(
                                          line.id,
                                        )}
                                        onCheckedChange={(checked) =>
                                          handleLineCheckboxChange(
                                            line.id,
                                            globalIndex,
                                            checked as boolean,
                                          )
                                        }
                                      />
                                      <label
                                        htmlFor={line.id}
                                        className="text-sm"
                                      >
                                        {line.name}
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                          <p className="text-sm text-gray-600 mt-2">
                            Selected Lines: {selectedLines.length}
                          </p>
                        </div>
                      )}{" "}
                      {assignmentType === "Line" &&
                        lines.map((line, index) => (
                          <div
                            key={line.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={line.id}
                              checked={selectedLines.includes(line.id)}
                              onCheckedChange={(checked) =>
                                handleLineCheckboxChange(
                                  line.id,
                                  index,
                                  checked as boolean,
                                )
                              } //
                            />
                            <label htmlFor={line.id} className="text-sm">
                              {line.name}
                            </label>
                          </div>
                        ))}
                      {assignmentType === "Equipment" &&
                        equipment.length === 0 && (
                          <p className="text-sm text-gray-500">
                            No available equipment
                          </p>
                        )}
                      {assignmentType === "Equipment" &&
                        equipment.map((equip, index) => (
                          <div
                            key={equip.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={equip.id}
                              checked={selectedEquipment.includes(equip.id)}
                              onCheckedChange={(checked) =>
                                handleEquipmentCheckboxChange(
                                  equip.id,
                                  index,
                                  checked as boolean,
                                )
                              }
                            />
                            <label htmlFor={equip.id} className="text-sm">
                              {equip.name}
                            </label>
                          </div>
                        ))}
                      {/* Add NonInlineInstrument selection here */}
                      {assignmentType === "NonInlineInstrument" && (
                        <div className="max-h-60 overflow-y-auto space-y-2">
                          {nonInlineInstruments.length === 0 && (
                            <p className="text-sm text-gray-500">
                              No available non-inline instruments
                            </p>
                          )}
                          {nonInlineInstruments.map((instrument, index) => (
                            <div
                              key={instrument.id}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={instrument.id}
                                checked={selectedNonInlineInstruments.includes(
                                  instrument.id,
                                )}
                                onCheckedChange={(checked: boolean) => {
                                  console.log(
                                    `Checkbox for instrument ${instrument.id} changed to:`,
                                    checked,
                                  );
                                  console.log(
                                    "Current selectedNonInlineInstruments:",
                                    selectedNonInlineInstruments,
                                  );
                                  if (groupSelectCount > 1) {
                                    const startIndex = index;
                                    const endIndex = Math.min(
                                      startIndex + groupSelectCount,
                                      nonInlineInstruments.length,
                                    );
                                    const itemsToSelect = nonInlineInstruments
                                      .slice(startIndex, endIndex)
                                      .map((i) => i.id);
                                    if (checked) {
                                      const newSelected = [
                                        ...new Set([
                                          ...selectedNonInlineInstruments,
                                          ...itemsToSelect,
                                        ]),
                                      ];
                                      setSelectedNonInlineInstruments(
                                        newSelected,
                                      );
                                      toast.success(
                                        `Selected ${itemsToSelect.length} non-inline instruments`,
                                      );
                                    } else {
                                      const newSelected =
                                        selectedNonInlineInstruments.filter(
                                          (id) => !itemsToSelect.includes(id),
                                        );
                                      setSelectedNonInlineInstruments(
                                        newSelected,
                                      );
                                      toast.success(
                                        `Deselected ${itemsToSelect.length} non-inline instruments`,
                                      );
                                    }
                                  } else {
                                    if (checked) {
                                      setSelectedNonInlineInstruments([
                                        ...selectedNonInlineInstruments,
                                        instrument.id,
                                      ]);
                                    } else {
                                      setSelectedNonInlineInstruments(
                                        selectedNonInlineInstruments.filter(
                                          (id) => id !== instrument.id,
                                        ),
                                      );
                                    }
                                  }
                                  console.log(
                                    "Updated selectedNonInlineInstruments:",
                                    selectedNonInlineInstruments,
                                  );
                                }}
                              />
                              <label
                                htmlFor={instrument.id}
                                className="text-sm"
                              >
                                {instrument.instrumentTag} -{" "}
                                {instrument.description}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}{" "}
                    </div>
                  </div>
                )
              ))}
            {isSubmitting && (
              <div className="mt-4">
                <Progress value={submissionProgress} className="h-2" />
                <p className="text-sm text-gray-500 mt-2">
                  {submissionProgress < 50
                    ? "Creating task..."
                    : submissionProgress < 100
                      ? "Assigning items..."
                      : "Finalizing..."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Team Tasks</CardTitle>
              <Button
                onClick={handleExportCSV}
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={isLoading || tasks.length === 0}
              >
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedProject ? (
              <p className="text-gray-500 text-center py-8">
                Please select a project to view tasks.
              </p>
            ) : isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-2 text-gray-600">
                  {getRandomMessage("loading")}
                </p>
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No tasks available for the selected project.
              </p>
            ) : (
              <TaskTable
                tasks={tasks}
                teamMembers={teamMembers.map((member) => member.name)}
                showFilters={true}
                showProgress={true}
                showCurrentWork={true}
                onViewCurrentWork={handleViewCurrentWork}
                showComments={true}
                onViewComments={handleViewComments}
                onSelectTaskForRetract={handleSelectTaskForRetract} // Updated prop name
                onRetractTask={handleSelectTaskForRetract} //
              />
            )}
            {selectedTaskForRetract && (
              <div className="mt-4 p-4 border rounded-md bg-gray-50">
                <h3 className="text-lg font-semibold">Retract Task</h3>
                <p>
                  Task: {selectedTaskForRetract.id} (Assignee:{" "}
                  {selectedTaskForRetract.assignee})
                </p>
                <Select onValueChange={handleReassign} value={newAssigneeId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select new assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => handleRetractTask(selectedTaskForRetract.id)}
                  className="mt-2"
                  disabled={isLoading || !newAssigneeId}
                >
                  Retract and Reassign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <AssignedItemsModal
          isOpen={modalIsOpen}
          onClose={closeModal}
          assignedItems={assignedItems}
          loadingItems={loadingItems}
          userName={userName}
          taskType={selectedTaskType}
          itemType={selectedItemType}
          onUpdateItem={function (
            itemId: string,
            completed: boolean,
            blocks: number,
          ): void {
            throw new Error("Function not implemented.");
          }}
        />
        {/* Modal for Comments */}
        <Modal
          isOpen={commentsModalIsOpen}
          onRequestClose={closeCommentsModal}
          style={{
            content: {
              top: "50%",
              left: "50%",
              right: "auto",
              bottom: "auto",
              marginRight: "-50%",
              transform: "translate(-50%, -50%)",
              width: "90%",
              maxWidth: "500px",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "12px",
              backgroundColor: "#fff",
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            },
            overlay: {
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              zIndex: 1000,
            },
          }}
          contentLabel="Task Comments Modal"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Task Comments
              {selectedTaskForComments?.assignee
                ? ` for ${selectedTaskForComments.assignee}`
                : ""}
            </h2>
            <button
              onClick={closeCommentsModal}
              className="text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200"
              aria-label="Close modal"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          {selectedTaskForComments ? (
            <div className="space-y-4">
              {selectedTaskForComments.comments &&
              selectedTaskForComments.comments.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-4">
                  {selectedTaskForComments.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border-b border-gray-200 pb-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {comment.userName} ({comment.userRole})
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(comment.createdAt).toLocaleString(
                              "en-IN",
                              {
                                timeZone: "Asia/Kolkata",
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="text-gray-700 mt-1">{comment.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No comments available for this task.
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-red-600 font-medium">
                {getRandomMessage("error")}
              </p>
              <p className="text-gray-500 mt-2">
                Please try again or contact support if the issue persists.
              </p>
            </div>
          )}
          <div className="mt-6 flex justify-end">
            <Button
              onClick={closeCommentsModal}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200"
            >
              Close
            </Button>
          </div>
        </Modal>
      </div>
      <RetractTaskModal />
    </div>
  );
};
export default TeamLeadDashboard;
