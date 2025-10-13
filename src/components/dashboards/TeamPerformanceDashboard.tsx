/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Task, TaskStatus } from "@/types";
import {
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TeamPerformanceProps {
  tasks: Task[];
  teamLeads: { name: string; team: string[] }[];
}

interface TeamStats {
  name: string;
  assigned: number;
  inProgress: number;
  completed: number;
  totalTime: number;
  avgCompletionTime: number;
  performance: number;
}

const COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff8042",
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
];

const TeamPerformanceDashboard = ({
  tasks,
  teamLeads,
}: TeamPerformanceProps) => {
  const [timePeriod, setTimePeriod] = useState<string>("all");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  // Helper function to calculate team statistics
  const calculateTeamStats = (): TeamStats[] => {
    const stats: Record<string, TeamStats> = {};

    // Initialize stats for each team lead
    teamLeads.forEach((lead) => {
      stats[lead.name] = {
        name: lead.name,
        assigned: 0,
        inProgress: 0,
        completed: 0,
        totalTime: 0,
        avgCompletionTime: 0,
        performance: 0,
      };
    });

    // Filter tasks by selected time period
    const filteredTasks = filterTasksByTimePeriod(tasks);

    // Process tasks
    filteredTasks.forEach((task) => {
      // Find which team lead this task belongs to based on assignee
      const lead = teamLeads.find((l) => l.team.includes(task.assignee));

      if (lead) {
        const leadName = lead.name;

        // Update task counts
        if (task.status === "Assigned") {
          stats[leadName].assigned++;
        } else if (task.status === "In Progress") {
          stats[leadName].inProgress++;
        } else if (task.status === "Completed") {
          stats[leadName].completed++;

          // Calculate completion time (in hours) for completed tasks
          if (task.completedAt) {
            const startTime = new Date(task.createdAt).getTime();
            const endTime = new Date(task.completedAt).getTime();
            const hours = (endTime - startTime) / (1000 * 60 * 60);
            stats[leadName].totalTime += hours;
          }
        }
      }
    });

    // Calculate averages and performance metrics
    Object.keys(stats).forEach((lead) => {
      if (stats[lead].completed > 0) {
        stats[lead].avgCompletionTime =
          stats[lead].totalTime / stats[lead].completed;

        // Calculate performance score (lower is better)
        // This is a simple metric based on average completion time
        // A more sophisticated metric could include complexity, task type, etc.
        const baseScore = 24; // 24 hours as baseline
        stats[lead].performance = Math.min(
          100,
          Math.max(
            0,
            100 -
              ((stats[lead].avgCompletionTime - baseScore) / baseScore) * 100
          )
        );
      }
    });

    return Object.values(stats);
  };

  const filterTasksByTimePeriod = (tasksToFilter: Task[]): Task[] => {
    const now = new Date();
    let cutoffDate = new Date();

    switch (timePeriod) {
      case "day":
        cutoffDate.setDate(now.getDate() - 1);
        break;
      case "week":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "month":
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case "quarter":
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      default:
        cutoffDate = new Date(0); // All time
    }

    return tasksToFilter.filter(
      (task) => new Date(task.updatedAt) >= cutoffDate
    );
  };

  const teamStats = calculateTeamStats();

  // Prepare data for charts
  const taskStatusData = teamStats.map((team) => ({
    name: team.name,
    Assigned: team.assigned,
    "In Progress": team.inProgress,
    Completed: team.completed,
  }));

  const timeData = teamStats.map((team) => ({
    name: team.name,
    "Avg. Completion (Hours)": parseFloat(team.avgCompletionTime.toFixed(1)),
  }));

  const performanceData = teamStats.map((team) => ({
    name: team.name,
    value: parseFloat(team.performance.toFixed(1)),
  }));

  const formatHours = (hours: number) => {
    if (isNaN(hours)) return "N/A";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}:${minutes.toString().padStart(2, "0")}`;
  };

  const handleExportCSV = () => {
    if (tasks.length === 0) {
      toast.error("No tasks available to export.");
      return;
    }

    try {
      const csvData: any[] = [];

      tasks.forEach((task) => {
        task.items.forEach((item) => {
          csvData.push({
            "Area No": task.areaNumber || "N/A",
            "PID No": task.pidNumber || "N/A",
            "Line/Equipment/Instrument": item.name || "N/A",
            Type: item.type || "N/A",
            "Block Count": item.blocks || 0,
            Completed: item.completed ? "Yes" : "No",
            "Completed By": item.completed ? task.assignee : "N/A",
            "Task Type": task.type,
            Project: task.projectName || "Unknown",
            Status: task.status,
            "Assigned On": new Date(task.createdAt).toLocaleDateString("en-IN"),
            "Completed On": item.completedAt
              ? new Date(item.completedAt).toLocaleDateString("en-IN")
              : "Not Completed",
          });
        });
      });

      // Headers
      const headers = [
        "Area No",
        "PID No",
        "Line/Equipment/Instrument",
        "Type",
        "Block Count",
        "Completed",
        "Completed By",
        "Task Type",
        "Project",
        "Status",
        "Assigned On",
        "Completed On",
      ];

      // Convert to CSV
      const csvRows = csvData.map((row) =>
        headers.map((header) => {
          const value = String(row[header] || "");
          // Escape quotes and commas
          return value.includes(",") || value.includes('"')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
      );

      const csvContent = [headers, ...csvRows]
        .map((row) => row.join(","))
        .join("\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `task_details_${
        new Date().toISOString().split("T")[0]
      }.csv`;
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Team Performance</h2>
          <p className="text-gray-600">
            Analyzing team progress and efficiency metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="day">Last 24 Hours</SelectItem>
              <SelectItem value="week">Past Week</SelectItem>
              <SelectItem value="month">Past Month</SelectItem>
              <SelectItem value="quarter">Past Quarter</SelectItem>
            </SelectContent>
          </Select>

          <Tabs
            value={chartType}
            onValueChange={(value) => setChartType(value as "bar" | "pie")}
            className="w-auto"
          >
            <TabsList className="h-9">
              <TabsTrigger value="bar" className="px-2">
                <BarChart3 className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="pie" className="px-2">
                <PieChartIcon className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-1 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8 shadow-md hover:shadow-lg transition-all">
          <CardHeader>
            <CardTitle>Task Status by Team</CardTitle>
            <CardDescription>
              Distribution of tasks across teams for
              {timePeriod === "all"
                ? " all time"
                : timePeriod === "day"
                ? " the last 24 hours"
                : timePeriod === "week"
                ? " the past week"
                : timePeriod === "month"
                ? " the past month"
                : " the past quarter"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "bar" ? (
                  <BarChart
                    data={taskStatusData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => [`${value} tasks`, name]}
                      labelFormatter={(label) => `Team Lead: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="Assigned" stackId="a" fill="#8884d8" />
                    <Bar dataKey="In Progress" stackId="a" fill="#ffc658" />
                    <Bar dataKey="Completed" stackId="a" fill="#82ca9d" />
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={performanceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {performanceData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value}%`, "Performance Score"]}
                    />
                    <Legend />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 shadow-md hover:shadow-lg transition-all">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              <CardTitle>Team Metrics</CardTitle>
            </div>
            <CardDescription>Productivity and completion rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 pt-2">
              {teamStats.map((team, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">{team.name}</h4>
                    <Badge
                      variant={team.performance > 80 ? "outline" : "secondary"}
                      className={`${
                        team.performance > 80
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : team.performance > 50
                          ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      }`}
                    >
                      {team.performance.toFixed(1)}% Efficiency
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="p-2 bg-blue-50 rounded text-center">
                      <div className="text-blue-800 font-medium">
                        {team.assigned}
                      </div>
                      <div className="text-gray-500 text-xs">Assigned</div>
                    </div>
                    <div className="p-2 bg-orange-50 rounded text-center">
                      <div className="text-orange-800 font-medium">
                        {team.inProgress}
                      </div>
                      <div className="text-gray-500 text-xs">In Progress</div>
                    </div>
                    <div className="p-2 bg-green-50 rounded text-center">
                      <div className="text-green-800 font-medium">
                        {team.completed}
                      </div>
                      <div className="text-gray-500 text-xs">Completed</div>
                    </div>
                  </div>

                  <div className="text-sm flex justify-between">
                    <span className="text-gray-600">Avg. Completion Time:</span>
                    <span className="font-medium">
                      {formatHours(team.avgCompletionTime)}
                    </span>
                  </div>

                  <div className="h-1 bg-gray-100 rounded overflow-hidden">
                    <div
                      className={`h-1 ${
                        team.performance > 80
                          ? "bg-green-500"
                          : team.performance > 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${team.performance}%` }}
                    ></div>
                  </div>

                  {index < teamStats.length - 1 && (
                    <hr className="border-gray-100" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamPerformanceDashboard;
