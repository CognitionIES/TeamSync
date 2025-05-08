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
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TaskTable from "../shared/TaskTable";
import TeamPerformanceView from "../shared/TeamPerformanceView";

// Format time in HH:MM 24-hour format
const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const ProjectManagerDashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [teamLeads, setTeamLeads] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch data from API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      const tasksResponse = await fetch("/api/tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!tasksResponse.ok) {
        const errorText = await tasksResponse.text();
        throw new Error(
          `Tasks API error: ${tasksResponse.status} ${
            tasksResponse.statusText
          } - ${errorText.substring(0, 100)}`
        );
      }
      const tasksContentType = tasksResponse.headers.get("content-type");
      if (!tasksContentType || !tasksContentType.includes("application/json")) {
        const text = await tasksResponse.text();
        throw new Error(
          `Tasks API returned non-JSON response: ${text.substring(0, 100)}`
        );
      }
      const tasksData = await tasksResponse.json();
      if (!tasksData.data) {
        throw new Error("Tasks API response missing 'data' field");
      }
      setTasks(tasksData.data);

      const teamsResponse = await fetch("/api/teams", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!teamsResponse.ok) {
        const errorText = await teamsResponse.text();
        throw new Error(
          `Teams API error: ${teamsResponse.status} ${
            teamsResponse.statusText
          } - ${errorText.substring(0, 100)}`
        );
      }
      const teamsContentType = teamsResponse.headers.get("content-type");
      if (!teamsContentType || !teamsContentType.includes("application/json")) {
        const text = await teamsResponse.text();
        throw new Error(
          `Teams API returned non-JSON response: ${text.substring(0, 100)}`
        );
      }
      const teamsData = await teamsResponse.json();
      if (!teamsData.data) {
        throw new Error("Teams API response missing 'data' field");
      }
      setTeamLeads(teamsData.data);
      toast.success("Data refreshed");
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error(error.message || "Failed to fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, []);

  // Derive team members from teamLeads
  const teamMembers = Array.from(
    new Set(teamLeads.flatMap((lead) => lead.team.map((member) => member.name)))
  );

  // Get tasks assigned today
  const today = new Date().setHours(0, 0, 0, 0);
  const assignedToday = tasks.filter(
    (task) => new Date(task.created_at).setHours(0, 0, 0, 0) === today
  ).length;

  // Get tasks marked in progress today
  const startedToday = tasks.filter(
    (task) =>
      task.status === "In Progress" &&
      new Date(task.updated_at).setHours(0, 0, 0, 0) === today
  ).length;

  // Get tasks completed today
  const completedToday = tasks.filter(
    (task) =>
      task.status === "Completed" &&
      task.completed_at &&
      new Date(task.completed_at).setHours(0, 0, 0, 0) === today
  ).length;

  // Calculate task progress metrics
  const totalTasks = tasks.length;
  const completedCount = tasks.filter(
    (task) => task.status === "Completed"
  ).length;
  const completionRate =
    totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const handleRefresh = () => {
    fetchData();
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Convert tasks to CSV
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
        // Get current work
        let currentWork = "";
        if (task.status === "Completed") {
          currentWork = "Completed";
        } else {
          const pidItem = task.items.find((item) => item.item_type === "PID");
          if (pidItem) currentWork = `P&ID ${pidItem.item_name}`;

          const lineItem = task.items.find((item) => item.item_type === "Line");
          if (lineItem) currentWork = `Line ${lineItem.item_name}`;

          const equipmentItem = task.items.find(
            (item) => item.item_type === "Equipment"
          );
          if (equipmentItem)
            currentWork = `Equipment ${equipmentItem.item_name}`;
        }

        return [
          task.type,
          task.assignee,
          task.status,
          `${task.progress}%`,
          formatTime(task.created_at),
          task.completed_at ? formatTime(task.completed_at) : "N/A",
          task.is_complex ? "Yes" : "No",
          currentWork,
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      // Create download link
      const encodedUri =
        "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `teamsync_tasks_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);

      // Trigger download
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
            {/* Daily Progress Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <Card className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-transparent border-b">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <TrendingUp size={18} className="text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">Progress Overview</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-end gap-2">
                    <p className="text-4xl font-bold text-blue-600">
                      {completionRate}%
                    </p>
                    <p className="text-sm text-gray-500 mb-1">completion</p>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {completedCount} of {totalTasks} tasks completed
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
                  <p className="text-sm text-gray-500 mt-1">new tasks</p>
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
                    tasks in progress
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
                  <p className="text-sm text-gray-500 mt-1">tasks finished</p>
                </CardContent>
              </Card>
            </div>

            {/* Tasks Overview */}
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
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="space-y-6 animate-fade-in">
            {/* Team Composition */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {teamLeads.map((lead) => (
                    <Card
                      key={lead.name}
                      className="border border-gray-200 bg-white shadow-sm"
                    >
                      <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-transparent">
                        <CardTitle className="text-base">{lead.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Team Lead
                        </p>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <h4 className="text-sm font-medium mb-2">
                          Team Members:
                        </h4>
                        <ul className="space-y-1 ml-1">
                          {lead.team.map((member) => (
                            <li
                              key={member.id}
                              className="text-sm flex items-center gap-2 text-gray-700"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                              {member.name}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6 animate-fade-in">
            {/* Consolidated Task Table */}
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
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="animate-fade-in">
            <TeamPerformanceView tasks={tasks} teamLeads={teamLeads} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectManagerDashboard;
