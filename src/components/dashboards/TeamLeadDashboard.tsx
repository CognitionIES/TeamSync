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
import { Task, TaskType } from "@/types";
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
  pids: string[];
  lines: string[];
  equipment: string[];
}

const TeamLeadDashboard = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pids, setPIDs] = useState<PID[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  // Form state
  const [taskType, setTaskType] = useState<TaskType | "">("");
  const [assignmentType, setAssignmentType] = useState<
    "PID" | "Line" | "Equipment" | ""
  >("");
  const [selectedPIDs, setSelectedPIDs] = useState<string[]>([]);
  const [selectedPID, setSelectedPID] = useState<string>("");
  const [showPIDLines, setShowPIDLines] = useState<boolean>(false);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [isComplex, setIsComplex] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track assigned items to prevent duplicates
  const [assignedItems, setAssignedItems] = useState<AssignedItems>({
    pids: [],
    lines: [],
    equipment: [],
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
    console.log("Token being sent:", token); // Add logging
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // Fetch team members
  const fetchTeamMembers = async () => {
    try {
      const response = await axios.get<{ data: User[] }>(
        `${API_URL}/users/team-members`,
        getAuthHeaders()
      );
      console.log("Team members response:", response.data);
      const members = response.data.data.map((user) => ({
        id: user.id.toString(),
        name: user.name,
      }));
      console.log("Team members:", members);
      if (members.length === 0) {
        toast.warning("No team members found. Please add team members.");
      }
      setTeamMembers(members);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching team members:", {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      toast.error(
        axiosError.response?.data?.message ||
          "Failed to fetch team members. Please try again."
      );
    }
  };

  // Fetch P&IDs
  const fetchPIDs = async () => {
    try {
      const response = await axios.get<{
        data: { id: number; pid_number: string }[];
      }>(`${API_URL}/pids`, getAuthHeaders());
      const pidsData = response.data.data.map((pid) => ({
        id: pid.id.toString(),
        name: pid.pid_number,
      }));
      setPIDs(pidsData);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching P&IDs:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch P&IDs"
      );
    }
  };

  // Fetch lines
  const fetchLines = async () => {
    try {
      const response = await axios.get<{
        data: { id: number; line_number: string; pid_id: number }[];
      }>(`${API_URL}/lines`, getAuthHeaders());
      const linesData = response.data.data.map((line) => ({
        id: line.id.toString(),
        name: line.line_number,
        pidId: line.pid_id.toString(),
      }));
      setLines(linesData);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching lines:", axiosError);
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch lines"
      );
    }
  };

  // Fetch equipment
  const fetchEquipment = async () => {
    try {
      const response = await axios.get<{
        data: { id: number; equipment_number: string; area_id?: number }[];
      }>(`${API_URL}/equipment`, getAuthHeaders());
      const equipmentData = response.data.data.map((equip) => ({
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

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await axios.get<{ data: any[] }>(
        `${API_URL}/tasks`,
        getAuthHeaders()
      );
      console.log("Fetch tasks response:", response.data);
      if (!response.data.data || response.data.data.length === 0) {
        console.log("No tasks returned from API");
      }
      const tasksData = response.data.data.map((task) => {
        console.log("Mapping task:", task);
        return {
          id: task.id.toString(),
          type: task.type as TaskType,
          assignee: task.assignee || "Unknown",
          assigneeId: task.assignee_id.toString(),
          status: task.status,
          isComplex: task.is_complex,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          completedAt: task.completed_at,
          progress: task.progress,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: task.items.map((item: any) => ({
            id: item.id.toString(),
            name: item.item_name,
            type: item.item_type as "PID" | "Line" | "Equipment",
            completed: item.completed,
          })),
          comments: task.comments || [],
        };
      });
      console.log("Mapped tasks:", tasksData);
      setTasks(tasksData);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error fetching tasks:", {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      toast.error(
        axiosError.response?.data?.message || "Failed to fetch tasks"
      );
    }
  };

  // Fetch all data on mount
  useEffect(() => {
    if (isAuthenticated && user?.role === "Team Lead" && token) {
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
  }, [isAuthenticated, user, token]);

  // Update assigned items when tasks change
  useEffect(() => {
    const assignedPids: string[] = [];
    const assignedLines: string[] = [];
    const assignedEquipment: string[] = [];

    tasks.forEach((task) => {
      task.items.forEach((item) => {
        if (item.type === "PID") assignedPids.push(item.id);
        if (item.type === "Line") assignedLines.push(item.id);
        if (item.type === "Equipment") assignedEquipment.push(item.id);
      });
    });

    setAssignedItems({
      pids: assignedPids,
      lines: assignedLines,
      equipment: assignedEquipment,
    });

    console.log("Updated assignedItems:", {
      pids: assignedPids,
      lines: assignedLines,
      equipment: assignedEquipment,
    });
  }, [tasks]);

  // Reset form fields when task type changes
  const handleTaskTypeChange = (value: string) => {
    setTaskType(value as TaskType);
    setAssignmentType("");
    setSelectedPIDs([]);
    setSelectedPID("");
    setShowPIDLines(false);
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

      // Reset selections when assignment type changes
      if (value === "PID") {
        setSelectedLines([]);
        setSelectedEquipment([]);
        setShowPIDLines(false);
      } else if (value === "Line") {
        setSelectedPIDs([]);
        setSelectedEquipment([]);
      } else if (value === "Equipment") {
        setSelectedPIDs([]);
        setSelectedLines([]);
        setShowPIDLines(false);
      }
    }
  };

  // Handle PID selection for showing lines
  const handlePIDSelection = (pidId: string, checked: boolean) => {
    if (taskType === "Redline") {
      if (checked) {
        setSelectedPIDs([pidId]);
        setSelectedPID(pidId);
        setShowPIDLines(true);
      } else {
        setSelectedPIDs([]);
        setSelectedPID("");
        setShowPIDLines(false);
      }
    } else {
      if (checked) {
        setSelectedPIDs([...selectedPIDs, pidId]);
      } else {
        setSelectedPIDs(selectedPIDs.filter((id) => id !== pidId));
      }
    }
  };

  // Filter selectable items based on task type and what's already assigned
  const getSelectableItems = () => {
    const availablePIDs = pids.filter(
      (pid) => !assignedItems.pids.includes(pid.id)
    );
    const availableLines = lines.filter(
      (line) => !assignedItems.lines.includes(line.id)
    );
    const availableEquipment = equipment.filter(
      (equip) => !assignedItems.equipment.includes(equip.id)
    );

    console.log("Selectable items:", {
      availablePIDs,
      availableLines,
      availableEquipment,
    });

    switch (taskType) {
      case "Redline":
        return {
          pids: availablePIDs,
          lines: availableLines,
          equipment: [] as Equipment[],
        };
      case "UPV":
        return {
          pids: [] as PID[],
          lines: availableLines,
          equipment: availableEquipment,
        };
      case "QC":
        return {
          pids: availablePIDs,
          lines: availableLines,
          equipment: availableEquipment,
        };
      default:
        return {
          pids: [] as PID[],
          lines: [] as Line[],
          equipment: [] as Equipment[],
        };
    }
  };

  const {
    pids: selectablePIDs,
    lines: selectableLines,
    equipment: selectableEquipment,
  } = getSelectableItems();

  // Get lines for selected PID in Redline task
  const getSelectedPIDLines = () => {
    if (!selectedPID) return [];
    const pidLines = lines.filter(
      (line) =>
        line.pidId === selectedPID && !assignedItems.lines.includes(line.id)
    );
    console.log("Lines for selected PID:", { selectedPID, pidLines });
    return pidLines;
  };

  const pidLines = getSelectedPIDLines();

  const handleRefresh = () => {
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
    if (!taskType || !assignee) {
      toast.error("Please select task type and assignee");
      return;
    }

    // Validate assignee is a numeric string
    const assigneeId = parseInt(assignee);
    if (isNaN(assigneeId)) {
      toast.error("Invalid assignee selected");
      return;
    }

    let validSelection = false;
    let selectedItems: {
      itemId: string;
      itemType: string;
      itemName: string;
    }[] = [];

    if (taskType === "Redline") {
      if (selectedPIDs.length > 0) {
        validSelection = true;
        selectedItems = [
          ...selectedPIDs.map((pid) => {
            const pidObj = pids.find((p) => p.id === pid);
            return {
              itemId: pid,
              itemType: "PID",
              itemName: pidObj?.name || pid,
            };
          }),
        ];

        if (showPIDLines && selectedLines.length > 0) {
          selectedItems = [
            ...selectedItems,
            ...selectedLines.map((line) => {
              const lineObj = lines.find((l) => l.id === line);
              return {
                itemId: line,
                itemType: "Line",
                itemName: lineObj?.name || line,
              };
            }),
          ];
        }
      }
    } else if (taskType === "UPV") {
      if (selectedLines.length > 0 || selectedEquipment.length > 0) {
        validSelection = true;
        selectedItems = [
          ...selectedLines.map((line) => {
            const lineObj = lines.find((l) => l.id === line);
            return {
              itemId: line,
              itemType: "Line",
              itemName: lineObj?.name || line,
            };
          }),
          ...selectedEquipment.map((equip) => {
            const equipObj = equipment.find((e) => e.id === equip);
            return {
              itemId: equip,
              itemType: "Equipment",
              itemName: equipObj?.name || equip,
            };
          }),
        ];
      }
    } else if (taskType === "QC") {
      if (
        selectedPIDs.length > 0 ||
        selectedLines.length > 0 ||
        selectedEquipment.length > 0
      ) {
        validSelection = true;
        selectedItems = [
          ...selectedPIDs.map((pid) => {
            const pidObj = pids.find((p) => p.id === pid);
            return {
              itemId: pid,
              itemType: "PID",
              itemName: pidObj?.name || pid,
            };
          }),
          ...selectedLines.map((line) => {
            const lineObj = lines.find((l) => l.id === line);
            return {
              itemId: line,
              itemType: "Line",
              itemName: lineObj?.name || line,
            };
          }),
          ...selectedEquipment.map((equip) => {
            const equipObj = equipment.find((e) => e.id === equip);
            return {
              itemId: equip,
              itemType: "Equipment",
              itemName: equipObj?.name || equip,
            };
          }),
        ];
      }
    }

    if (!validSelection) {
      toast.error("Please select at least one item to assign");
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
        assigneeId, // Use the validated assigneeId
        isComplex,
        items: selectedItems,
      };

      console.log("Sending POST request with data:", newTask); // Add logging

      const response = await axios.post(
        `${API_URL}/tasks`,
        newTask,
        authHeaders
      );
      console.log("Task creation response:", response.data);

      // Re-fetch tasks to update the table and assigned items
      await fetchTasks();

      setTaskType("");
      setAssignmentType("");
      setSelectedPIDs([]);
      setSelectedPID("");
      setShowPIDLines(false);
      setSelectedLines([]);
      setSelectedEquipment([]);
      setAssignee("");
      setIsComplex(false);

      toast.success(`Task assigned to ${assigneeMember.name}`);
    } catch (error) {
      const axiosError = error as AxiosError<{ message: string }>;
      console.error("Error assigning task:", {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      if (axiosError.message === "No authentication token found") {
        toast.error("Session expired. Please log in again.");
        navigate("/login", { replace: true });
      } else {
        toast.error(
          axiosError.response?.data?.message || "Failed to assign task"
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Task Type */}
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

              {/* Assignment Type */}
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
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
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

              {/* Mark Complex */}
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

              {/* Assign Button */}
              <div className="flex items-end">
                <Button
                  onClick={handleAssign}
                  disabled={!taskType || !assignee || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Assigning..." : "Assign Task"}
                </Button>
              </div>
            </div>

            {/* Selection Area */}
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
                  {assignmentType === "PID" &&
                    selectablePIDs.map((pid) => (
                      <div key={pid.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={pid.id}
                          checked={selectedPIDs.includes(pid.id)}
                          onCheckedChange={(checked) => {
                            handlePIDSelection(pid.id, !!checked);
                          }}
                        />
                        <label htmlFor={pid.id} className="text-sm">
                          {pid.name}
                        </label>
                      </div>
                    ))}

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

            {/* Show Lines for Selected PID in Redline task */}
            {taskType === "Redline" && showPIDLines && (
              <div className="border p-4 rounded-md mt-4">
                <h3 className="font-medium mb-3">Lines in Selected P&ID</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {pidLines.length > 0 ? (
                    pidLines.map((line) => (
                      <div
                        key={line.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={`line-${line.id}`}
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
                        <label htmlFor={`line-${line.id}`} className="text-sm">
                          {line.name}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      No available lines found for this P&ID
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Task Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskTable
              tasks={tasks}
              teamMembers={teamMembers.map((member) => member.name)}
              showFilters={true}
              showProgress={true}
              showCurrentWork={true}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamLeadDashboard;
