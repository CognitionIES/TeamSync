
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Task } from "@/types";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import { 
  Download, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  Users, 
  RefreshCw,
  BarChart3 
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TaskTable from "../shared/TaskTable";
import TeamPerformanceView from "../shared/TeamPerformanceView";

// Mock data
const mockTeamMembers = [
  "Charlie Brown", "David Miller", "Eve Wilson"
];

const mockTeamLeads = [
  { name: "Frank Thomas", team: ["Charlie Brown", "David Miller"] },
  { name: "Grace Lee", team: ["Eve Wilson"] }
];

const mockTasks: Task[] = [
  {
    id: "task-1",
    type: "Redline",
    assignee: "Charlie Brown",
    assigneeId: "user-3",
    status: "Assigned",
    isComplex: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: null,
    progress: 0,
    items: [
      {
        id: "pid-1",
        name: "P-101",
        type: "PID",
        completed: false,
      }
    ]
  },
  {
    id: "task-2",
    type: "UPV",
    assignee: "David Miller",
    assigneeId: "user-4",
    status: "In Progress",
    isComplex: true,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: null,
    progress: 60,
    items: [
      {
        id: "line-1",
        name: "Line-101",
        type: "Line",
        completed: true
      },
      {
        id: "line-2",
        name: "Line-102",
        type: "Line",
        completed: true
      },
      {
        id: "line-3",
        name: "Line-103",
        type: "Line",
        completed: false
      }
    ]
  },
  {
    id: "task-3",
    type: "QC",
    assignee: "Eve Wilson",
    assigneeId: "user-5", 
    status: "Completed",
    isComplex: false,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    progress: 100,
    items: [
      {
        id: "equip-1",
        name: "Pump-101",
        type: "Equipment",
        completed: true
      }
    ]
  },
  {
    id: "task-4",
    type: "Redline",
    assignee: "Charlie Brown",
    assigneeId: "user-3",
    status: "In Progress",
    isComplex: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
    completedAt: null,
    progress: 50,
    items: [
      {
        id: "pid-2",
        name: "P-102",
        type: "PID",
        completed: false,
      }
    ]
  },
  {
    id: "task-5",
    type: "UPV",
    assignee: "Eve Wilson",
    assigneeId: "user-5",
    status: "Completed",
    isComplex: false,
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
    completedAt: new Date(Date.now() - 172800000).toISOString(),
    progress: 100,
    items: [
      {
        id: "line-4",
        name: "Line-104",
        type: "Line",
        completed: true
      },
      {
        id: "line-5",
        name: "Line-105",
        type: "Line",
        completed: true
      }
    ]
  }
];

// Format time in HH:MM 24-hour format
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

const ProjectManagerDashboard = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Get tasks assigned today
  const today = new Date().setHours(0, 0, 0, 0);
  const assignedToday = tasks.filter(
    task => new Date(task.createdAt).setHours(0, 0, 0, 0) === today
  ).length;
  
  // Get tasks marked in progress today
  const startedToday = tasks.filter(
    task => 
      task.status === "In Progress" && 
      new Date(task.updatedAt).setHours(0, 0, 0, 0) === today
  ).length;
  
  // Get tasks completed today
  const completedToday = tasks.filter(
    task => 
      task.status === "Completed" && 
      task.completedAt &&
      new Date(task.completedAt).setHours(0, 0, 0, 0) === today
  ).length;
  
  // Calculate task progress metrics
  const totalTasks = tasks.length;
  const completedCount = tasks.filter(task => task.status === "Completed").length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  
  const handleRefresh = () => {
    toast.success("Data refreshed");
  };
  
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Convert tasks to CSV
      const headers = ["Type", "Assignee", "Status", "Progress", "Created", "Completed", "Is Complex", "Current Work"];
      const rows = tasks.map(task => {
        // Get current work
        let currentWork = "";
        if (task.status === "Completed") {
          currentWork = "Completed";
        } else {
          const pidItem = task.items.find(item => item.type === "PID");
          if (pidItem) currentWork = `P&ID ${pidItem.name}`;
          
          const lineItem = task.items.find(item => item.type === "Line");
          if (lineItem) currentWork = `Line ${lineItem.name}`;
          
          const equipmentItem = task.items.find(item => item.type === "Equipment");
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
          currentWork
        ];
      });
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create download link
      const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `teamsync_tasks_${new Date().toISOString().split('T')[0]}.csv`);
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
              <h1 className="text-3xl font-bold text-gray-800">Project Manager Dashboard</h1>
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
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handleExport}
                disabled={isExporting}
              >
                <Download size={16} />
                Export CSV
              </Button>
            </div>
          </div>
        </header>

        <Tabs defaultValue="overview" className="space-y-6" onValueChange={setActiveTab}>
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
                    <p className="text-4xl font-bold text-blue-600">{completionRate}%</p>
                    <p className="text-sm text-gray-500 mb-1">completion</p>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{completedCount} of {totalTasks} tasks completed</p>
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
                  <p className="text-4xl font-bold text-indigo-600">{assignedToday}</p>
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
                  <p className="text-4xl font-bold text-orange-600">{startedToday}</p>
                  <p className="text-sm text-gray-500 mt-1">tasks in progress</p>
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
                  <p className="text-4xl font-bold text-green-600">{completedToday}</p>
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
                  teamMembers={mockTeamMembers}
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
                    <CardDescription>Organization of team members and leads</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {mockTeamLeads.map((lead) => (
                    <Card key={lead.name} className="border border-gray-200 bg-white shadow-sm">
                      <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-transparent">
                        <CardTitle className="text-base">{lead.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">Team Lead</p>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <h4 className="text-sm font-medium mb-2">Team Members:</h4>
                        <ul className="space-y-1 ml-1">
                          {lead.team.map((member) => (
                            <li key={member} className="text-sm flex items-center gap-2 text-gray-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                              {member}
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
                  teamMembers={mockTeamMembers}
                  showFilters={true}
                  showProgress={true}
                  showCurrentWork={true}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="performance" className="animate-fade-in">
            <TeamPerformanceView
              tasks={tasks}
              teamLeads={mockTeamLeads}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectManagerDashboard;
