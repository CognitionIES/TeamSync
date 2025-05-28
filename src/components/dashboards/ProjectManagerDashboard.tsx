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
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TaskTable from "../shared/TaskTable";
import TeamPerformanceView from "../shared/TeamPerformanceView";
import { Task, TaskStatus, TaskType, UserRole } from "@/types";
import Modal from "react-modal";
import DashboardBackground from "../shared/DashboardBackground";

// Bind modal to appElement for accessibility
Modal.setAppElement("#root");

// Define API_URL using environment variable, with a fallback for local development
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

// Interface for raw API task data (snake_case)
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

// Interface for raw API team lead data
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

// Transform API team lead data to match TeamLead type
const transformTeamLead = (apiTeamLead: ApiTeamLead): TeamLead => ({
  name: apiTeamLead.team_lead,
  team: apiTeamLead.team_members.map((member) => member.member_name),
});

// Interface for raw API user data
interface ApiUser {
  id: string;
  name: string;
  role: string;
}

// Interface for transformed team lead data (matches TeamPerformanceView expectation)
interface TeamLead {
  name: string;
  team: string[];
}

// Transform API task data to match Task type (camelCase)
const transformTask = (apiTask: ApiTask): Task => ({
  id: apiTask.id,
  type: apiTask.type,
  assignee: apiTask.assignee,
  assigneeId: apiTask.assignee_id,
  status: apiTask.status,
  isComplex: apiTask.is_complex,
  createdAt: apiTask.created_at,
  updatedAt: apiTask.updated_at,
  completedAt: apiTask.completed_at,
  progress: apiTask.progress,
  items: apiTask.items.map((item) => ({
    id: item.id,
    name: item.item_name,
    type: item.item_type as "PID" | "Line" | "Equipment",
    completed: item.completed,
  })),
  comments: apiTask.comments.map((comment) => ({
    id: comment.id,
    userId: comment.user_id,
    userName: comment.user_name,
    userRole: comment.user_role as UserRole,
    comment: comment.comment,
    createdAt: comment.created_at,
  })),
  projectId: "",
  pidNumber: "",
  projectName: "",
  areaNumber: "",
  description: ""
});

const ProjectManagerDashboard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamLeads, setTeamLeads] = useState<TeamLead[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [assignedItems, setAssignedItems] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const fetchAssignedItems = async (userId: string, taskId: string) => {
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(
        `${API_URL}/users/${userId}/assigned-items/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch assigned items: ${errorText}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error("Error fetching assigned items:", error.message);
      throw error;
    }
  };

  const handleViewCurrentWork = async (taskId: string, userId: string) => {
    setSelectedUserId(userId);
    setLoadingItems(true);
    try {
      const items = await fetchAssignedItems(userId, taskId);
      setAssignedItems(items);
      setModalIsOpen(true);
    } catch (error) {
      toast.error("Failed to fetch assigned items");
      setAssignedItems(null);
    } finally {
      setLoadingItems(false);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setAssignedItems(null);
    setSelectedUserId(null);
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const tasksResponse = await fetch(`${API_URL}/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
        },
      });

      console.log("Tasks Response Status:", tasksResponse.status);
      console.log(
        "Tasks Response Headers:",
        tasksResponse.headers.get("content-type")
      );

      const tasksText = await tasksResponse.text();
      console.log("Tasks Response Body:", tasksText.substring(0, 200));

      if (!tasksResponse.ok) {
        let errorMessage = `Tasks API error: ${tasksResponse.status} ${tasksResponse.statusText}`;
        const contentType = tasksResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = JSON.parse(tasksText);
          errorMessage += ` - ${errorData.message || "Unknown error"}`;
          if (errorData.error) {
            errorMessage += `: ${errorData.error}`;
          }
        } else {
          errorMessage += ` - ${tasksText.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }

      const tasksContentType = tasksResponse.headers.get("content-type");
      if (!tasksContentType || !tasksContentType.includes("application/json")) {
        throw new Error(
          `Tasks API returned non-JSON response: ${tasksText.substring(0, 100)}`
        );
      }

      const tasksData = JSON.parse(tasksText);
      if (!tasksData.data) {
        throw new Error("Tasks API response missing 'data' field");
      }
      const transformedTasks = tasksData.data.map(transformTask);
      setTasks(transformedTasks);
      console.log("Transformed Tasks:", transformedTasks);

      let teamLeadsData = [];
      try {
        const teamsResponse = await fetch(`${API_URL}/teams`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        });

        console.log("Teams Response Status:", teamsResponse.status);
        console.log(
          "Teams Response Headers:",
          teamsResponse.headers.get("content-type")
        );

        const teamsText = await teamsResponse.text();
        console.log("Teams Response Body:", teamsText.substring(0, 200));

        if (!teamsResponse.ok) {
          let errorMessage = `Teams API error: ${teamsResponse.status} ${teamsResponse.statusText}`;
          const contentType = teamsResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = JSON.parse(teamsText);
            errorMessage += ` - ${errorData.message || "Unknown error"}`;
            if (errorData.error) {
              errorMessage += `: ${errorData.error}`;
            }
          } else {
            errorMessage += ` - ${teamsText.substring(0, 100)}`;
          }
          console.warn(errorMessage);
          throw new Error(errorMessage);
        }

        const teamsContentType = teamsResponse.headers.get("content-type");
        if (
          !teamsContentType ||
          !teamsContentType.includes("application/json")
        ) {
          throw new Error(
            `Teams API returned non-JSON response: ${teamsText.substring(
              0,
              100
            )}`
          );
        }

        let teamsData;
        try {
          teamsData = JSON.parse(teamsText);
          console.log("Parsed Teams Data:", teamsData);
        } catch (parseError) {
          console.error("Error parsing teams response:", parseError.message);
          throw new Error(
            `Failed to parse Teams API response: ${teamsText.substring(0, 100)}`
          );
        }

        if (
          !teamsData ||
          typeof teamsData !== "object" ||
          !("data" in teamsData)
        ) {
          throw new Error("Teams API response missing or invalid 'data' field");
        }

        if (!Array.isArray(teamsData.data)) {
          throw new Error("Teams API 'data' field is not an array");
        }

        teamLeadsData = teamsData.data.map(transformTeamLead);
      } catch (teamError) {
        console.error("Error fetching teams:", teamError.message);
        toast.error("Failed to fetch teams data");
      }
      setTeamLeads(teamLeadsData);

      let usersData = [];
      try {
        const usersResponse = await fetch(`${API_URL}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        });

        const usersText = await usersResponse.text();
        if (!usersResponse.ok) {
          let errorMessage = `Users API error: ${usersResponse.status} ${usersResponse.statusText}`;
          const contentType = usersResponse.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errorData = JSON.parse(usersText);
            errorMessage += ` - ${errorData.message || "Unknown error"}`;
            if (errorData.error) {
              errorMessage += `: ${errorData.error}`;
            }
          } else {
            errorMessage += ` - ${usersText.substring(0, 100)}`;
          }
          console.warn(errorMessage);
          toast.error("Failed to fetch users data");
        } else {
          const usersContentType = usersResponse.headers.get("content-type");
          if (
            !usersContentType ||
            !usersContentType.includes("application/json")
          ) {
            throw new Error(
              `Users API returned non-JSON response: ${usersText.substring(
                0,
                100
              )}`
            );
          }

          const usersDataResponse = JSON.parse(usersText);
          if (!usersDataResponse.data) {
            throw new Error("Users API response missing 'data' field");
          }
          usersData = usersDataResponse.data;
        }
      } catch (userError) {
        console.error("Error fetching users:", userError.message);
        toast.error("Failed to fetch users data");
      }
      setUsers(usersData);

      toast.success("Data refreshed");
    } catch (error) {
      console.error("Fetch error:", error.message);
      setError(error.message || "Failed to fetch data");
      toast.error(error.message || "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const teamMembers = Array.from(new Set(users.map((user) => user.name)));

  const teamLeadMembers = new Set(teamLeads.flatMap((lead) => lead.team));
  const usersNotInTeams = users.filter(
    (user) => !teamLeadMembers.has(user.name)
  );

  const today = new Date().setHours(0, 0, 0, 0);
  const assignedToday = tasks.filter(
    (task) => new Date(task.createdAt).setHours(0, 0, 0, 0) === today
  ).length;

  const startedToday = tasks.filter(
    (task) =>
      task.status === "In Progress" &&
      new Date(task.updatedAt).setHours(0, 0, 0, 0) === today
  ).length;

  const completedToday = tasks.filter(
    (task) =>
      task.status === "Completed" &&
      task.completedAt &&
      new Date(task.completedAt).setHours(0, 0, 0, 0) === today
  ).length;

  const totalTasks = tasks.length;
  const completedCount = tasks.filter(
    (task) => task.status === "Completed"
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
            (item) => item.type === "Equipment"
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
        `teamsync_tasks_${new Date().toISOString().split("T")[0]}.csv`
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
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleExport}
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
                        <BarChart3 size={18} className="text-indigo-600" />
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
                    <p className="text-sm text-gray-500 mt-1">tasks Finished</p>
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
                  loading={isLoading}
                  onViewCurrentWork={handleViewCurrentWork}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6 animate-fade-in">
            <Card className="shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users size={18} className="text-purple-600" />
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
                              key={lead.name}
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
                  loading={isLoading}
                  onViewCurrentWork={handleViewCurrentWork}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="animate-fade-in">
            {isLoading ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-48 bg-gray-200 rounded mt-1 animate-pulse"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 bg-gray-200 rounded animate-pulse"></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-48 bg-gray-200 rounded mt-1 animate-pulse"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 bg-gray-200 rounded animate-pulse"></div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <TeamPerformanceView tasks={tasks} teamLeads={teamLeads} />
            )}
          </TabsContent>
        </Tabs>

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
              boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
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
              Assigned Items{" "}
              {selectedUserId
                ? `for ${
                    users.find((user) => user.id === selectedUserId)?.name ||
                    "Unknown User"
                  }`
                : ""}
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
              <p className="mt-2 text-gray-600">Loading assigned items...</p>
            </div>
          ) : assignedItems ? (
            <div className="space-y-6">
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
                            <strong>Equipment:</strong> {equip.equipment_name}
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
                            <strong>Equipment:</strong> {equip.equipment_name}
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
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-red-600 font-medium">
                Failed to load assigned items.
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
      </div>
    </div>
  );
};

export default ProjectManagerDashboard;
