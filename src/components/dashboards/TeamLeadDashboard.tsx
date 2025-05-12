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

const API_URL = "http://localhost:3000/api";

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

  // Track assigned items to prevent duplicates
  const [assignedItems, setAssignedItems] = useState<AssignedItems>({
    upvLines: [],
    upvEquipment: [],
    qcLines: [],
    qcEquipment: [],
    redlinePIDs: [],
  });

  // Check for token on mount
  const token = localStorage.getItem("teamsync_token");

  // Redirect to login if not authenticated, not a Team Lead, or no token
  useEffect(() => {
    if (!isAuthenticated || !token) {
      toast.error("Please log in to access the dashboard.");
      navigate("/login", { replace: true });
    } else if (user?.role !== "Team Lead") {
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
    console.log("Token being sent:", token);
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // Fetch projects
  // Fetch projects
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
  }; // Fetch team members
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

  // Fetch P&IDs
  const fetchPIDs = async () => {
    if (!selectedProject) return;
    try {
      const response = await axios.get<{
        data: { id: number; pid_number: string; project_id: number }[];
      }>(`${API_URL}/pids?projectId=${selectedProject}`, getAuthHeaders());
      const pidsData = response.data.data.map((pid) => ({
        id: pid.id.toString(),
        name: pid.pid_number,
      }));
      console.log(`Fetched PIDs for project ${selectedProject}:`, pidsData);
      setPIDs(pidsData);
      // Reset selectedPIDs to only include PIDs that exist in pidsData
      setSelectedPIDs((prev) =>
        prev.filter((pidId) => pidsData.some((pid) => pid.id === pidId))
      );
      if (pidsData.length === 0) {
        toast.info("No P&IDs available for this project.");
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

  // Fetch unassigned lines for the selected project
  // Fetch unassigned lines for the selected project
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
      const linesData = response.data.data.map((line) => ({
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
  // Fetch equipment
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
        .map((equip) => ({
          id: equip.id.toString(),
          name: equip.equipment_number,
          areaId: equip.area_id?.toString() || "",
        }));
      setEquipment(equipmentData);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching equipment:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch equipment"
      );
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
          // Only include tasks that match the selected project (or where project_id is NULL for existing tasks)
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
                  userName: comment.user_name || "Unknown",
                  userRole: comment.user_role || "Unknown",
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
            projectId: task.project_id?.toString() || null, // Add projectId
            items: mappedItems,
            comments: uniqueComments,
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

  // Fetch all data on mount
  useEffect(() => {
    if (isAuthenticated && user?.role === "Team Lead" && token) {
      fetchProjects();
    }
  }, [isAuthenticated, user, token]);

  // Fetch project-specific data when selectedProject changes
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

  // Update assigned items when tasks change
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

    setAssignedItems({
      upvLines,
      upvEquipment,
      qcLines,
      qcEquipment,
      redlinePIDs,
    });
  }, [tasks]);

  // Reset form fields when task type changes
  const handleTaskTypeChange = (value: string) => {
    setTaskType(value as TaskType);
    setAssignmentType("");
    setSelectedPIDs([]);
    setSelectedLines([]);
    setSelectedEquipment([]);
  };

  // Handle assignment type change
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

  // Filter selectable items based on task type
  const getSelectableItems = () => {
    let availablePIDs: PID[] = [];
    let availableLines: Line[] = [];
    let availableEquipment: Equipment[] = [];

    if (taskType === "Redline") {
      availablePIDs = pids.filter(
        (pid) => !assignedItems.redlinePIDs.includes(pid.id)
      );
    } else if (taskType === "UPV") {
      availableLines = lines; // Already filtered by the backend to be unassigned
      availableEquipment = equipment.filter(
        (equip) => !assignedItems.upvEquipment.includes(equip.id)
      );
    } else if (taskType === "QC") {
      availablePIDs = pids.filter(
        (pid) => !assignedItems.redlinePIDs.includes(pid.id)
      );
      availableLines = lines; // Already filtered by the backend to be unassigned
      availableEquipment = equipment.filter(
        (equip) => !assignedItems.qcEquipment.includes(equip.id)
      );
    }

    return {
      pids: availablePIDs,
      lines: availableLines,
      equipment: availableEquipment,
    };
  };

  const {
    pids: selectablePIDs,
    lines: selectableLines,
    equipment: selectableEquipment,
  } = getSelectableItems();

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

    let validSelection = false;
    let selectedItems: {
      itemId: string;
      itemType: string;
      itemName: string;
    }[] = [];

    console.log("selectedProject:", selectedProject);
    console.log("project:", project);
    console.log("lines:", lines);
    console.log("pids:", pids);
    console.log("selectedLines:", selectedLines);
    console.log("selectedPIDs:", selectedPIDs);

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

    setIsSubmitting(true);

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
        items: selectedItems,
      };

      console.log("newTask:", newTask);

      const response = await axios.post(
        `${API_URL}/tasks`,
        newTask,
        authHeaders
      );

      // Update lines' assigned_to_id if assigning lines
      if (assignmentType === "Line") {
        for (const item of selectedItems) {
          await axios.put(
            `${API_URL}/lines/${item.itemId}/assign`,
            { userId: assigneeId },
            authHeaders
          );
        }
      }

      await fetchTasks();
      await fetchLines();

      setTaskType("");
      setAssignmentType("");
      setSelectedPIDs([]);
      setSelectedLines([]);
      setSelectedEquipment([]);
      setAssignee("");
      setIsComplex(false);

      toast.success(`Task assigned to ${assigneeMember.name}`);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error assigning task:", axiosError);
      if (axiosError.message === "No authentication token found") {
        toast.error("Session expired. Please log in again.");
        navigate("/login", { replace: true });
      } else if (axiosError.response?.status === 403) {
        toast.error("You are not authorized to assign tasks.");
        navigate("/login", { replace: true });
      } else {
        toast.error(
          axiosError.response?.data?.message ||
            "Failed to assign task. Please try again."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  //
  if (!isAuthenticated || user?.role !== "Team Lead" || !token) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onRefresh={handleRefresh} />

      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Team Lead Dashboard</h1>
          <p className="text-gray-500">Assign and manage tasks for your team</p>
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
                  </SelectContent>
                </Select>
              </div>

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
                <div className="flex items-center space-x-2 h-10">
                  <Checkbox
                    id="complex"
                    checked={isComplex}
                    onCheckedChange={(checked) => setIsComplex(!!checked)}
                    disabled={!taskType}
                  />
                  <label
                    htmlFor="complex"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Mark as Complex
                  </label>
                </div>
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

            {taskType && assignmentType && (
              <div className="border p-4 rounded-md">
                <h3 className="font-medium mb-3">
                  Select{" "}
                  {assignmentType === "PID"
                    ? "P&IDs"
                    : assignmentType === "Line"
                    ? "Lines"
                    : "Equipment"}
                </h3>

                <div className="max-h-60 overflow-y-auto space-y-2">
                  {assignmentType === "PID" && selectablePIDs.length === 0 && (
                    <p className="text-sm text-gray-500">No available P&IDs</p>
                  )}
                  {assignmentType === "PID" &&
                    selectablePIDs.map((pid) => (
                      <div key={pid.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={pid.id}
                          checked={selectedPIDs.includes(pid.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedPIDs([...selectedPIDs, pid.id]);
                            } else {
                              setSelectedPIDs(
                                selectedPIDs.filter((id) => id !== pid.id)
                              );
                            }
                          }}
                        />
                        <label htmlFor={pid.id} className="text-sm">
                          {pid.name}
                        </label>
                      </div>
                    ))}

                  {assignmentType === "Line" &&
                    selectableLines.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No available lines
                      </p>
                    )}
                  {assignmentType === "Line" &&
                    selectableLines.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No available lines
                      </p>
                    )}
                  {assignmentType === "Line" &&
                    selectableLines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={line.id}
                          checked={selectedLines.includes(line.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedLines([...selectedLines, line.id]);
                            } else {
                              setSelectedLines(
                                selectedLines.filter((id) => id !== line.id)
                              );
                            }
                          }}
                        />
                        <label htmlFor={line.id} className="text-sm">
                          {line.name}
                        </label>
                      </div>
                    ))}

                  {assignmentType === "Equipment" &&
                    selectableEquipment.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No available equipment
                      </p>
                    )}
                  {assignmentType === "Equipment" &&
                    selectableEquipment.map((equip) => (
                      <div
                        key={equip.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={equip.id}
                          checked={selectedEquipment.includes(equip.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedEquipment([
                                ...selectedEquipment,
                                equip.id,
                              ]);
                            } else {
                              setSelectedEquipment(
                                selectedEquipment.filter(
                                  (id) => id !== equip.id
                                )
                              );
                            }
                          }}
                        />
                        <label htmlFor={equip.id} className="text-sm">
                          {equip.name}
                        </label>
                      </div>
                    ))}
                </div>
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
              <p className="text-gray-500">Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p className="text-gray-500">No tasks available.</p>
            ) : (
              <TaskTable
                tasks={tasks}
                teamMembers={teamMembers.map((member) => member.name)}
                showFilters={true}
                showProgress={true}
                showCurrentWork={true}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamLeadDashboard;
