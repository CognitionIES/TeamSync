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
import { Download } from "lucide-react";
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
import { useAuth } from "@/context/AuthContext";
import axios from "axios";

// API URL - consistent with AuthContext
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Helper function to truncate text
const truncateText = (text: string | undefined | null, maxLength: number) => {
  if (!text) return ""; // Return empty string if text is undefined or null
  if (text.length > maxLength) {
    return text.substring(0, maxLength) + "...";
  }
  return text;
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

const AdminDashboard = () => {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
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
  const [currentPage, setCurrentPage] = useState(1); // Pagination: Current page
  const [logsPerPage, setLogsPerPage] = useState(10); // Pagination: Logs per page
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, token } = useAuth();

  // Fetch all necessary data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!token) {
        throw new Error("Token missing during fetchData");
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      };

      const queryParams = new URLSearchParams();
      if (selectedProject !== "all") {
        queryParams.append("project", selectedProject);
      }
      if (selectedTeam !== "all") {
        queryParams.append("team", selectedTeam);
      }
      const queryString = queryParams.toString();
      const urlSuffix = queryString ? `?${queryString}` : "";

      const projectsPromise = axios
        .get(`${API_URL}/projects${urlSuffix}`, config)
        .catch((error) => {
          console.error("Error fetching projects:", error);
          return { data: { data: [] } };
        });

      const teamsPromise = axios
        .get(`${API_URL}/teams${urlSuffix}`, config)
        .catch((error) => {
          console.error("Error fetching teams:", error);
          return { data: { data: [] } };
        });

      const statsPromise = axios
        .get(`${API_URL}/project-stats${urlSuffix}`, config)
        .catch((error) => {
          console.error("Error fetching project stats:", error);
          return {
            data: { data: { pidCount: 0, lineCount: 0, equipmentCount: 0 } },
          };
        });

      const statusPromise = axios
        .get(`${API_URL}/task-status${urlSuffix}`, config)
        .catch((error) => {
          console.error("Error fetching task status:", error);
          return {
            data: { data: { assigned: 0, inProgress: 0, completed: 0 } },
          };
        });

      const logsPromise = axios
        .get(`${API_URL}/audit-logs${urlSuffix}`, config)
        .catch((error) => {
          console.error("Error fetching audit logs:", error);
          return { data: { data: [] } };
        });

      const [
        projectsResponse,
        teamsResponse,
        statsResponse,
        statusResponse,
        logsResponse,
      ] = await Promise.all([
        projectsPromise,
        teamsPromise,
        statsPromise,
        statusPromise,
        logsPromise,
      ]);

      setProjects(
        projectsResponse.data.data.map(
          (project: { id: string; name: string }) => ({
            id: project.id,
            name: project.name,
          })
        ) || []
      );
      setTeams(
        teamsResponse.data.data.map(
          (team: { team_lead: string }) => team.team_lead
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

      toast.success("Data refreshed");
    } catch (error) {
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

  // Fetch data on component mount if authenticated and when filters change
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
    setCurrentPage(1); // Reset page on filter change
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
        "ID",
        "Type",
        "Name",
        "Created By",
        "Current Work",
        "Timestamp",
      ];
      const rows = auditLogs.map(
        (log: {
          id: string;
          type: string;
          name: string;
          createdBy: string;
          currentWork: string;
          timestamp: string;
        }) => [
          log.id,
          log.type,
          log.name,
          log.createdBy,
          log.currentWork,
          formatTime(log.timestamp),
        ]
      );

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

  // Calculate paginated logs
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = auditLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalPages = Math.ceil(auditLogs.length / logsPerPage);

  if (!isAuthenticated && location.pathname !== "/login") {
    return <div>Redirecting to login...</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onRefresh={handleRefresh} />

      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-500">Project statistics and audit trails</p>
          </div>

          <div className="mt-4 sm:mt-0">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleExport}
              disabled={isExporting}
            >
              <Download size={16} />
              Export Logs
            </Button>
          </div>
        </header>

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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map((project) => (
                      <SelectItem
                        key={project.id}
                        value={project.name.toLowerCase().replace(/\s+/g, "-")}
                      >
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map((team: string) => (
                      <SelectItem
                        key={team}
                        value={team.toLowerCase().replace(/\s+/g, "-")}
                      >
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
              <CardTitle>Project Metrics</CardTitle>
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
              <CardTitle>Task Status Breakdown</CardTitle>
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
                    currentLogs.map(
                      (log: {
                        id: string;
                        type: string;
                        name: string;
                        createdBy: string;
                        currentWork: string;
                        timestamp: string;
                      }) => (
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
                              <div>
                                Assigned at: {formatTime(log.timestamp)}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )
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

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
              {/* Logs per page dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Logs per page:</span>
                <Select
                  value={logsPerPage.toString()}
                  onValueChange={(value) => {
                    setLogsPerPage(Number(value));
                    setCurrentPage(1); // Reset to page 1
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

              {/* Page navigation */}
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
      </div>
    </div>
  );
};

export default AdminDashboard;
