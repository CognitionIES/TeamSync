/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Download, Eye, EyeOff, Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { getRandomMessage } from "@/components/shared/messages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import LoginAnimation from "../landing/LoginAnimation";
import { Badge } from "@/components/ui/badge";

// API URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

console.log("VITE_API_URL from env:", import.meta.env.VITE_API_URL);
console.log("Using API_URL:", API_URL);

// Helper functions
const truncateText = (text: string | undefined | null, maxLength: number) => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
};

interface Project {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  team_lead_id?: string;
  team_lead_name?: string;
}

interface TeamLead {
  id: string;
  name: string;
}

const AdminDashboard = () => {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<string[]>([]);
  const [projectStats, setProjectStats] = useState({
    pidCount: 0,
    lineCount: 0,
    equipmentCount: 0,
  });
  const [statusData, setStatusData] = useState([
    { name: "Assigned", value: 0, color: "#1E40AF" },
    { name: "In Progress", value: 0, color: "#F97316" },
    { name: "Completed", value: 0, color: "#16A34A" },
  ]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(10);

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [teamLeads, setTeamLeads] = useState<TeamLead[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("");
  const [newUserTeamLead, setNewUserTeamLead] = useState<string>("none");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserRole, setEditUserRole] = useState<string>("");
  const [editUserTeamLead, setEditUserTeamLead] = useState<string>("none");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Delete user state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, token } = useAuth();

  const validRoles = ["Data Entry", "Team Member", "Team Lead", "Project Manager", "Admin"];

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!token) throw new Error("Token missing during fetchData");

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      };

      const queryParams = new URLSearchParams();
      if (selectedProject !== "all")
        queryParams.append("projectId", selectedProject);
      if (selectedTeam !== "all") queryParams.append("teamLead", selectedTeam);
      const queryString = queryParams.toString();
      const urlSuffix = queryString ? `?${queryString}` : "";

      const [
        projectsResponse,
        teamsResponse,
        statsResponse,
        statusResponse,
        logsResponse,
        usersWithTeamsResponse,
      ] = await Promise.all([
        axios
          .get(`${API_URL}/projects`, config)
          .catch(() => ({ data: { data: [] } })),
        axios
          .get(`${API_URL}/teams`, config)
          .catch(() => ({ data: { data: [] } })),
        axios
          .get(`${API_URL}/project-stats${urlSuffix}`, config)
          .catch(() => ({
            data: { data: { pidCount: 0, lineCount: 0, equipmentCount: 0 } },
          })),
        axios
          .get(`${API_URL}/task-status${urlSuffix}`, config)
          .catch(() => ({
            data: { data: { assigned: 0, inProgress: 0, completed: 0 } },
          })),
        axios
          .get(`${API_URL}/audit-logs${urlSuffix}`, config)
          .catch(() => ({ data: { data: [] } })),
        axios
          .get(`${API_URL}/users/with-teams`, config)
          .catch(() => ({ data: { data: [] } })),
      ]);

      setProjects(
        projectsResponse.data.data.map((p: { id: string; name: string }) => ({
          id: p.id.toString(),
          name: p.name,
        })) || []
      );
      setTeams(
        teamsResponse.data.data.map(
          (t: { team_lead: string }) => t.team_lead
        ) || []
      );
      setProjectStats(
        statsResponse.data.data || {
          pidCount: 0,
          lineCount: 0,
          equipmentCount: 0,
        }
      );
      setStatusData([
        {
          name: "Assigned",
          value: statusResponse.data.data.assigned || 0,
          color: "#1E40AF",
        },
        {
          name: "In Progress",
          value: statusResponse.data.data.inProgress || 0,
          color: "#F97316",
        },
        {
          name: "Completed",
          value: statusResponse.data.data.completed || 0,
          color: "#16A34A",
        },
      ]);
      setAuditLogs(logsResponse.data.data || []);
      
      const usersData = usersWithTeamsResponse.data.data.map((u: any) => ({
        id: u.id.toString(),
        name: u.name,
        role: u.role,
        is_active: u.is_active !== false,
        team_lead_id: u.team_lead_id?.toString() || null,
        team_lead_name: u.team_lead_name || null,
      })) || [];
      
      setUsers(usersData);
      
      // Extract team leads for dropdown
      const leads = usersData
        .filter((u: User) => u.role === "Team Lead")
        .map((u: User) => ({ id: u.id, name: u.name }));
      setTeamLeads(leads);

      toast.success("Data refreshed");
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(
        error.response?.data?.message || error.message || "Failed to fetch data"
      );
      if (
        error.response?.status === 401 &&
        location.pathname !== "/login" &&
        !isRedirecting
      ) {
        setIsRedirecting(true);
        navigate("/login", { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (location.pathname === "/login") {
      console.log("Already on login page, skipping redirect...");
      return;
    }
    if (isRedirecting) {
      console.log(
        "Redirect already in progress, skipping authentication check..."
      );
      return;
    }
    if (!isAuthenticated || !token) {
      console.log("Not authenticated or no token, redirecting to login...");
      setIsRedirecting(true);
      navigate("/login", { replace: true });
      return;
    }
    console.log("User is authenticated, fetching data...");
    setIsRedirecting(false);
    setCurrentPage(1);
    fetchData();
  }, [
    isAuthenticated,
    token,
    navigate,
    location.pathname,
    selectedProject,
    selectedTeam,
  ]);

  const handleRefresh = () => {
    fetchData()
      .then(() => toast.success("Data refreshed"))
      .catch((error) => {
        console.error("Error refreshing data:", error);
        toast.error("Failed to refresh data");
      });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const headers = [
        "ID",
        "Type",
        "Name",
        "Created By",
        "Current Work",
        "Timestamp",
      ];
      const rows = auditLogs.map((log: any) => [
        log.id,
        log.type,
        log.name,
        log.createdBy,
        log.currentWork,
        formatTime(log.timestamp),
      ]);
      const csvContent = [
        headers.join(","),
        ...rows.map((row: string[]) => row.join(",")),
      ].join("\n");
      const encodedUri =
        "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `project_audit_logs_${new Date().toISOString().split("T")[0]}.csv`
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

  const handleAddUser = async () => {
    if (!newUserName || !newUserRole) {
      toast.error("Please provide a name and role for the new user");
      return;
    }
    if (!newUserPassword || !confirmPassword) {
      toast.error("Please provide a password and confirm it");
      return;
    }
    if (newUserPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsAddingUser(true);
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };
      
      // First, create the user
      const userData = {
        name: newUserName,
        role: newUserRole,
        password: newUserPassword,
        is_active: true,
      };
      
      console.log("Creating user:", userData);
      const response = await axios.post(`${API_URL}/users`, userData, config);
      console.log("User created:", response.data);
      
      const newUserId = response.data.data.id;
      
      // Then, assign to team if selected
      if (newUserTeamLead !== "none") {
        console.log(`Assigning user ${newUserId} to team lead ${newUserTeamLead}`);
        await axios.patch(
          `${API_URL}/users/${newUserId}/team`,
          { lead_id: newUserTeamLead },
          config
        );
        console.log("Team assignment successful");
      }
      
      await fetchData();
      setNewUserName("");
      setNewUserRole("");
      setNewUserTeamLead("none");
      setNewUserPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setIsModalOpen(false);
      toast.success(`User ${newUserName} added successfully`);
    } catch (error: any) {
      console.error("Error adding user:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to add user";
      toast.error(errorMessage);
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditUserRole(user.role);
    setEditUserTeamLead(user.team_lead_id || "none");
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setIsUpdatingUser(true);
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      };

      // Update role if changed
      if (editUserRole !== editingUser.role) {
        console.log(`Updating user ${editingUser.id} role to ${editUserRole}`);
        await axios.patch(
          `${API_URL}/users/${editingUser.id}/role`,
          { role: editUserRole },
          config
        );
      }

      // Update team if changed
      if (editUserTeamLead !== (editingUser.team_lead_id || "none")) {
        console.log(`Updating user ${editingUser.id} team to ${editUserTeamLead}`);
        await axios.patch(
          `${API_URL}/users/${editingUser.id}/team`,
          { lead_id: editUserTeamLead === "none" ? null : editUserTeamLead },
          config
        );
      }

      await fetchData();
      setIsEditModalOpen(false);
      setEditingUser(null);
      toast.success("User updated successfully");
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast.error(error.response?.data?.message || "Failed to update user");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);
    try {
      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      console.log(`Deleting user ${userToDelete.id}`);
      await axios.delete(`${API_URL}/users/${userToDelete.id}`, config);

      await fetchData();
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      toast.success(`User ${userToDelete.name} deleted successfully`);
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.response?.data?.message || "Failed to delete user");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = auditLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(auditLogs.length / logsPerPage);

  if (!isAuthenticated && location.pathname !== "/login")
    return <div>Redirecting to login...</div>;
  if (isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">{getRandomMessage("loading")}</div>
      </div>
    );

  return (
    <div className="min-h-screen">
      <LoginAnimation />
      <Navbar onRefresh={handleRefresh} />

      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-500">
              Project statistics and admin controls
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                setActiveTab("users");
                setIsModalOpen(true);
              }}
            >
              <Plus size={16} /> Add User
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                setActiveTab("audits");
                handleExport();
              }}
              disabled={isExporting}
            >
              <Download size={16} /> Export Logs
            </Button>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="audits">Audits</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                      Filter by Project
                    </label>
                    <Select
                      value={selectedProject}
                      onValueChange={setSelectedProject}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Projects" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Projects</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                      Filter by Team
                    </label>
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Teams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Teams</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team} value={team}>
                            {team}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedProject === "all"
                      ? "Overall Project Metrics"
                      : `Project Metrics for ${
                          projects.find((p) => p.id === selectedProject)?.name
                        }`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total P&IDs:</span>
                    <span className="text-lg font-bold">
                      {projectStats.pidCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Lines:</span>
                    <span className="text-lg font-bold">
                      {projectStats.lineCount}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Equipment:</span>
                    <span className="text-lg font-bold">
                      {projectStats.equipmentCount}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                  <CardTitle>
                    {selectedTeam === "all"
                      ? "Overall Task Status Breakdown"
                      : `Task Status Breakdown for ${selectedTeam}`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`${value} tasks`, "Count"]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audits" className="mt-6">
            {/* Audit Trails */}
            <Card>
              <CardHeader>
                <CardTitle>Audit Trails</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Current Work</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLogs.length > 0 ? (
                        currentLogs.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell>{log.type}</TableCell>
                            <TableCell>{log.name}</TableCell>
                            <TableCell>{log.createdBy}</TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger className="cursor-help text-left">
                                    <span className="text-sm">
                                      {truncateText(log.currentWork, 50)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{log.currentWork}</p>
                                  </TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div>Assigned at: {formatTime(log.timestamp)}</div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            No audit logs found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Logs per page:</span>
                    <Select
                      value={logsPerPage.toString()}
                      onValueChange={(value) => {
                        setLogsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            {/* User Management Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users size={20} />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Team Lead</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length > 0 ? (
                        users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role}</Badge>
                            </TableCell>
                            <TableCell>
                              {user.team_lead_name || (
                                <span className="text-gray-400">No team</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={user.is_active ? "default" : "secondary"}
                              >
                                {user.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditUser(user)}
                                >
                                  <Pencil size={16} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleDeleteUser(user)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            No users found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add User Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <Input
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Enter user name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <Select value={newUserRole} onValueChange={setNewUserRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {validRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Team Lead (Optional)
                  </label>
                  <Select
                    value={newUserTeamLead}
                    onValueChange={setNewUserTeamLead}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team lead" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Team</SelectItem>
                      {teamLeads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setNewUserName("");
                  setNewUserRole("");
                  setNewUserTeamLead("none");
                  setNewUserPassword("");
                  setConfirmPassword("");
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                  setIsModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddUser}
                disabled={isAddingUser}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isAddingUser ? "Adding..." : "Add User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit User: {editingUser?.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <Select value={editUserRole} onValueChange={setEditUserRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {validRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Team Lead
                </label>
                <Select
                  value={editUserTeamLead}
                  onValueChange={setEditUserTeamLead}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Team</SelectItem>
                    {teamLeads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingUser(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateUser}
                disabled={isUpdatingUser}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isUpdatingUser ? "Updating..." : "Update User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation Dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the user{" "}
                <strong>{userToDelete?.name}</strong> and remove them from all
                teams. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUserToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteUser}
                disabled={isDeletingUser}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeletingUser ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AdminDashboard;