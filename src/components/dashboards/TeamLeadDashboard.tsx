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
import { Task, TaskComment, TaskItem, TaskType } from "@/types";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import TaskTable from "../shared/TaskTable";
import axios, { AxiosError } from "axios";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import Modal from "react-modal";
import { getRandomMessage } from "@/components/shared/messages";
import { Progress } from "@/components/ui/progress";

// Bind modal to appElement for accessibility
Modal.setAppElement("#root");

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface User {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface PID {
  id: string;
  name: string;
}

interface Line {
  id: string;
  name: string;
  pidId: string;
}

interface Equipment {
  id: string;
  name: string;
  areaId: string;
}

interface AssignedItems {
  upvLines: string[];
  upvEquipment: string[];
  qcLines: string[];
  qcEquipment: string[];
  redlinePIDs: string[];
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

const TeamLeadDashboard = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [pids, setPIDs] = useState<PID[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [generalMessage, setGeneralMessage] = useState<string>("");
  // Form state
  const [taskType, setTaskType] = useState<TaskType | "">("");
  const [assignmentType, setAssignmentType] = useState<
    "PID" | "Line" | "Equipment" | ""
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
    null
  );
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

  const token = localStorage.getItem("teamsync_token");

  useEffect(() => {
    if (!isAuthenticated || !token) {
      toast.info(getRandomMessage("login"));
      navigate("/login", { replace: true });
    } else if (user?.role !== "Team Lead") {
      toast.error("You are not authorized to access this dashboard.");
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, user, token, navigate]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("teamsync_token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    console.log("Token being sent:", token);
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get<{
        data: { id: number; name: string }[];
      }>(`${API_URL}/projects`, getAuthHeaders());
      const projectData = response.data.data.map((project) => ({
        id: project.id.toString(),
        name: project.name,
      }));
      console.log("Fetched projects:", projectData);
      setProjects(projectData);
      if (projectData.length > 0) {
        setSelectedProject(projectData[0].id);
      } else {
        toast.warning(
          "No projects available. Please contact an Admin to be assigned to a project."
        );
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching projects:", axiosError);
      const errorMessage =
        axiosError.response?.data?.message || "Failed to fetch projects";
      toast.error(errorMessage);
      if (axiosError.response?.status === 403) {
        toast.error(
          "You are not authorized to view projects. Redirecting to login..."
        );
        navigate("/login", { replace: true });
      } else if (axiosError.response?.status === 500) {
        toast.error(
          "A server error occurred while fetching projects. Please try again later or contact support."
        );
      }
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await axios.get<{ data: User[] }>(
        `${API_URL}/users/team-members`,
        getAuthHeaders()
      );
      const members = response.data.data.map((user) => ({
        id: user.id.toString(),
        name: user.name,
      }));
      if (members.length === 0) {
        toast.warning("No team members found. Please add team members.");
      }
      setTeamMembers(members);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching team members:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch team members."
      );
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
            !assignedItemsForDuplicates.redlinePIDs.includes(pid.id.toString())
        )
        .map((pid) => ({
          id: pid.id.toString(),
          name: pid.pid_number,
        }));
      console.log(`Fetched PIDs for project ${selectedProject}:`, pidsData);
      setPIDs(pidsData);
      setSelectedPIDs((prev) =>
        prev.filter((pidId) => pidsData.some((pid) => pid.id === pidId))
      );
      if (pidsData.length === 0) {
        toast.info("No unassigned P&IDs available for this project.");
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching P&IDs:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch P&IDs"
      );
      setPIDs([]);
      setSelectedPIDs([]);
    }
  };

  const fetchLines = async () => {
    if (!selectedProject) return;
    try {
      const response = await axios.get<{
        data: {
          id: number;
          line_number: string;
          pid_id: number;
          pid_number: string;
        }[];
      }>(`${API_URL}/lines/unassigned/${selectedProject}`, getAuthHeaders());
      const linesData = response.data.data
        .filter(
          (line) =>
            !assignedItemsForDuplicates.upvLines.includes(line.id.toString()) &&
            !assignedItemsForDuplicates.qcLines.includes(line.id.toString())
        )
        .map((line) => ({
          id: line.id.toString(),
          name: line.line_number,
          pidId: line.pid_id.toString(),
        }));
      console.log(`Fetched lines for project ${selectedProject}:`, linesData);
      setLines(linesData);
      setSelectedLines((prev) =>
        prev.filter((lineId) => linesData.some((line) => line.id === lineId))
      );
      if (linesData.length === 0) {
        toast.info("No unassigned lines available for this project.");
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching unassigned lines:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch unassigned lines"
      );
      setLines([]);
      setSelectedLines([]);
    }
  };

  const fetchEquipment = async () => {
    if (!selectedProject) return;
    try {
      const response = await axios.get<{
        data: {
          id: number;
          equipment_number: string;
          area_id?: number;
          project_id: number;
        }[];
      }>(`${API_URL}/equipment`, getAuthHeaders());
      const equipmentData = response.data.data
        .filter((equip) => equip.project_id.toString() === selectedProject)
        .filter(
          (equip) =>
            !assignedItemsForDuplicates.upvEquipment.includes(
              equip.id.toString()
            ) &&
            !assignedItemsForDuplicates.qcEquipment.includes(
              equip.id.toString()
            )
        )
        .map((equip) => ({
          id: equip.id.toString(),
          name: equip.equipment_number,
          areaId: equip.area_id?.toString() || "",
        }));
      setEquipment(equipmentData);
      setSelectedEquipment((prev) =>
        prev.filter((equipId) =>
          equipmentData.some((equip) => equip.id === equipId)
        )
      );
      if (equipmentData.length === 0) {
        toast.info("No unassigned equipment available for this project.");
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching equipment:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch equipment"
      );
      setEquipment([]);
      setSelectedEquipment([]);
    }
  };

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get<{ data: any[] }>(
        `${API_URL}/tasks`,
        getAuthHeaders()
      );
      const tasksData = response.data.data
        .filter((task) => {
          return (
            !selectedProject ||
            task.project_id?.toString() === selectedProject ||
            task.project_id === null
          );
        })
        .map((task, taskIndex) => {
          const commentMap = new Map<string, TaskComment>();
          (task.comments || []).forEach(
            (comment: any, commentIndex: number) => {
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
                  userName: comment.user_name || "",
                  userRole: comment.user_role || "",
                  comment: comment.comment || "",
                  createdAt: comment.created_at,
                });
              }
            }
          );
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
                name: item.name || "",
                type: item.item_type || "",
                completed: item.completed || false,
              };
            })
            .filter((item): item is TaskItem => item !== null);

          return {
            id: task.id.toString(),
            type: task.type as TaskType,
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
            pidNumber: task.pid_number ?? null,
            projectName: task.project_name ?? "",
            areaNumber: task.area_number ?? null,
            description: task.description || "",
          };
        });

      setTasks(tasksData);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching tasks:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch tasks"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssignedItems = async (userId: string, taskId: string) => {
    try {
      const response = await axios.get<{ data: FetchedAssignedItems }>(
        `${API_URL}/users/${userId}/assigned-items/${taskId}`,
        getAuthHeaders()
      );
      return response.data.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching assigned items:", axiosError);
      throw axiosError;
    }
  };

  const handleViewCurrentWork = async (taskId: string, userId: string) => {
    setSelectedUserId(userId);
    setLoadingItems(true);
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setSelectedTaskType(task.type);
        const itemType = task.items.length > 0 ? task.items[0].type : null;
        setSelectedItemType(itemType as "PID" | "Line" | "Equipment" | null);
      } else {
        setSelectedTaskType(null);
        setSelectedItemType(null);
      }

      const items = await fetchAssignedItems(userId, taskId);
      setAssignedItems(items);
      setModalIsOpen(true);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching assigned items:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch assigned items"
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

  useEffect(() => {
    if (isAuthenticated && user?.role === "Team Lead" && token) {
      fetchProjects();
      setGeneralMessage(getRandomMessage("general"));
    }
  }, [isAuthenticated, user, token]);

  useEffect(() => {
    if (selectedProject) {
      Promise.all([
        fetchTeamMembers(),
        fetchPIDs(),
        fetchLines(),
        fetchEquipment(),
        fetchTasks(),
      ]).catch((error) => {
        console.error("Error fetching dashboard data:", error);
        toast.error("Failed to load dashboard data");
      });
    }
  }, [selectedProject]);

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
    if (
      value === "PID" ||
      value === "Line" ||
      value === "Equipment" ||
      value === ""
    ) {
      setAssignmentType(value);
      setSelectedPIDs([]);
      setSelectedLines([]);
      setSelectedEquipment([]);
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

    let selectedItems: {
      itemId: string;
      itemType: string;
      itemName: string;
    }[] = [];

    if (taskType === "Misc") {
      if (
        !description ||
        typeof description !== "string" ||
        description.trim().length === 0
      ) {
        toast.error("Please provide a description for the miscellaneous task");
        return;
      }
    } else {
      let validSelection = false;

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
                  `Equipment with ID ${equip} not found in equipment array`
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
                  `Equipment with ID ${equip} not found in equipment array`
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
        }
      }

      if (!validSelection || selectedItems.length === 0) {
        toast.error("Please select at least one valid item to assign");
        return;
      }
    }

    setIsSubmitting(true);
    setSubmissionProgress(0);

    try {
      const authHeaders = getAuthHeaders();
      const assigneeMember = teamMembers.find(
        (member) => member.id === assignee
      );
      if (!assigneeMember) {
        throw new Error("Assignee not found");
      }

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
        newTask.description
      );
      console.log("Sending task payload:", newTask);
      const response = await axios.post(
        `${API_URL}/tasks`,
        newTask,
        authHeaders
      );
      setSubmissionProgress(50);

      if (assignmentType === "Line" && taskType !== "Misc") {
        const lineIds = selectedItems.map((item) => parseInt(item.itemId));
        await axios.put(
          `${API_URL}/lines/assign/batch`,
          { lineIds, userId: assigneeId },
          authHeaders
        );
      }
      setSubmissionProgress(100);

      await Promise.all([
        fetchTasks(),
        fetchPIDs(),
        fetchLines(),
        fetchEquipment(),
      ]);

      setTaskType("");
      setAssignmentType("");
      setSelectedPIDs([]);
      setSelectedLines([]);
      setSelectedEquipment([]);
      setAssignee("");
      setIsComplex(false);
      setDescription("");

      toast.success(
        `Task assigned to ${assigneeMember.name}. ${getRandomMessage(
          "completion"
        )}`
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
    e: React.ChangeEvent<HTMLInputElement>
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
    checked: boolean
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
          (id) => !pidsToSelect.includes(id)
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

  // Handler for group selection of Lines
  const handleLineCheckboxChange = (
    lineId: string,
    index: number,
    checked: boolean
  ) => {
    if (groupSelectCount > 1) {
      const startIndex = index;
      const endIndex = Math.min(startIndex + groupSelectCount, lines.length);
      const linesToSelect = lines
        .slice(startIndex, endIndex)
        .map((line) => line.id);
      if (checked) {
        const newSelectedLines = [
          ...new Set([...selectedLines, ...linesToSelect]),
        ];
        setSelectedLines(newSelectedLines);
        toast.success(`Selected ${linesToSelect.length} lines`);
      } else {
        const newSelectedLines = selectedLines.filter(
          (id) => !linesToSelect.includes(id)
        );
        setSelectedLines(newSelectedLines);
        toast.success(`Deselected ${linesToSelect.length} lines`);
      }
    } else {
      if (checked) {
        setSelectedLines([...selectedLines, lineId]);
      } else {
        setSelectedLines(selectedLines.filter((id) => id !== lineId));
      }
    }
  };

  // Handler for group selection of Equipment
  const handleEquipmentCheckboxChange = (
    equipId: string,
    index: number,
    checked: boolean
  ) => {
    if (groupSelectCount > 1) {
      const startIndex = index;
      const endIndex = Math.min(
        startIndex + groupSelectCount,
        equipment.length
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
          (id) => !equipmentToSelect.includes(id)
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

  if (!isAuthenticated || user?.role !== "Team Lead" || !token) {
    return null;
  }

  const selectedUser = teamMembers.find(
    (member) => member.id === selectedUserId
  );
  const userName = selectedUser ? selectedUser.name : "";

  return (
    <div className="min-h-screen">
      <Navbar onRefresh={handleRefresh} />

      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Team Lead Dashboard</h1>
          <p className="text-gray-500">Assign and manage tasks for your team</p>
          {generalMessage && (
            <p className="text-sm text-gray-600 italic mt-2">
              "{generalMessage}"
            </p>
          )}
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
                      {taskType === "QC" && (
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
                  onValueChange={setAssignee}
                  disabled={!taskType || teamMembers.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.length === 0 ? (
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
                        : "Equipment"}
                    </h3>
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
                            : equipment.length
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
                                  checked as boolean
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
                                  checked as boolean
                                )
                              }
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
                                  checked as boolean
                                )
                              }
                            />
                            <label htmlFor={equip.id} className="text-sm">
                              {equip.name}
                            </label>
                          </div>
                        ))}
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
                    ? "Assigning lines..."
                    : "Finalizing..."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-2 text-gray-600">
                  {getRandomMessage("loading")}
                </p>
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-gray-500">No tasks available.</p>
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
              />
            )}
          </CardContent>
        </Card>

        {/* Modal for Assigned Items */}
        <Modal
          isOpen={modalIsOpen}
          onRequestClose={closeModal}
          style={{
            content: {
              top: "50%",
              left: "50%",
              right: "auto",
              bottom: "auto",
              marginRight: "-50%",
              transform: "translate(-50%, -50%)",
              width: "90%",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: "24px",
              borderRadius: "12px",
              backgroundColor: "#fff",
              boxShadow: "0 4px 20px rgba(0, 0,0, 0.15)",
            },
            overlay: {
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              zIndex: 1000,
            },
          }}
          contentLabel="Assigned Items Modal"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Assigned Items {userName ? `for ${userName}` : ""}
            </h2>
            <button
              onClick={closeModal}
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

          {loadingItems ? (
            <div className="text-center py-8">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-2 text-gray-600">
                {getRandomMessage("loading")}
              </p>
            </div>
          ) : assignedItems && selectedTaskType && selectedItemType ? (
            <div className="space-y-6">
              {selectedTaskType === "UPV" && selectedItemType === "Line" && (
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    UPV Lines ({assignedItems.upvLines.count})
                  </h3>
                  {assignedItems.upvLines.count > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                      <ul className="space-y-2">
                        {assignedItems.upvLines.items.map((line) => (
                          <li
                            key={line.id}
                            className="text-sm text-gray-600 flex justify-between items-center"
                          >
                            <span>
                              <strong>Line:</strong> {line.line_number}
                            </span>
                            <span className="text-gray-500">
                              Project ID: {line.project_id}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No UPV lines assigned.
                    </p>
                  )}
                </div>
              )}

              {selectedTaskType === "QC" && selectedItemType === "Line" && (
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    QC Lines ({assignedItems.qcLines.count})
                  </h3>
                  {assignedItems.qcLines.count > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                      <ul className="space-y-2">
                        {assignedItems.qcLines.items.map((line) => (
                          <li
                            key={line.id}
                            className="text-sm text-gray-600 flex justify-between items-center"
                          >
                            <span>
                              <strong>Line:</strong> {line.line_number}
                            </span>
                            <span className="text-gray-500">
                              Project ID: {line.project_id}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No QC lines assigned.
                    </p>
                  )}
                </div>
              )}

              {selectedTaskType === "Redline" && selectedItemType === "PID" && (
                <div className="border-b border-gray-200 pb-4">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Redline P&IDs ({assignedItems.redlinePIDs.count})
                  </h3>
                  {assignedItems.redlinePIDs.count > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                      <ul className="space-y-2">
                        {assignedItems.redlinePIDs.items.map((pid) => (
                          <li
                            key={pid.id}
                            className="text-sm text-gray-600 flex justify-between items-center"
                          >
                            <span>
                              <strong>P&ID:</strong> {pid.pid_number}
                            </span>
                            <span className="text-gray-500">
                              Project ID: {pid.project_id}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No Redline P&IDs assigned.
                    </p>
                  )}
                </div>
              )}

              {selectedTaskType === "UPV" &&
                selectedItemType === "Equipment" && (
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      UPV Equipment ({assignedItems.upvEquipment.count})
                    </h3>
                    {assignedItems.upvEquipment.count > 0 ? (
                      <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                        <ul className="space-y-2">
                          {assignedItems.upvEquipment.items.map((equip) => (
                            <li
                              key={equip.id}
                              className="text-sm text-gray-600 flex justify-between items-center"
                            >
                              <span>
                                <strong>Equipment:</strong>{" "}
                                {equip.equipment_name}
                              </span>
                              <span className="text-gray-500">
                                Project ID: {equip.project_id}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No UPV equipment assigned.
                      </p>
                    )}
                  </div>
                )}

              {selectedTaskType === "QC" &&
                selectedItemType === "Equipment" && (
                  <div className="pb-4">
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">
                      QC Equipment ({assignedItems.qcEquipment.count})
                    </h3>
                    {assignedItems.qcEquipment.count > 0 ? (
                      <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                        <ul className="space-y-2">
                          {assignedItems.qcEquipment.items.map((equip) => (
                            <li
                              key={equip.id}
                              className="text-sm text-gray-600 flex justify-between items-center"
                            >
                              <span>
                                <strong>Equipment:</strong>{" "}
                                {equip.equipment_name}
                              </span>
                              <span className="text-gray-500">
                                Project ID: {equip.project_id}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        No QC equipment assigned.
                      </p>
                    )}
                  </div>
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

          {!loadingItems && (
            <div className="mt-6 flex justify-end">
              <Button
                onClick={closeModal}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200"
              >
                Close
              </Button>
            </div>
          )}
        </Modal>

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
                              }
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
    </div>
  );
};

export default TeamLeadDashboard;
