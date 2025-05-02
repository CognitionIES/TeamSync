
import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Mock Data
const mockProjects = ["Project Alpha", "Project Beta"];
const mockTeams = ["Team 1", "Team 2"];

const mockProjectStats = {
  pidCount: 42,
  lineCount: 156,
  equipmentCount: 78
};

const mockStatusData = [
  { name: "Assigned", value: 12, color: "#1E40AF" },
  { name: "In Progress", value: 18, color: "#F97316" },
  { name: "Completed", value: 30, color: "#16A34A" }
];

const mockAuditLogs = [
  { 
    id: "log-1", 
    type: "P&ID Creation",
    name: "P-101",
    createdBy: "Alice Smith",
    currentWork: "P&ID P-101",
    timestamp: new Date(Date.now() - 1000000).toISOString()
  },
  { 
    id: "log-2", 
    type: "Task Assignment",
    name: "Redline P-101",
    createdBy: "Frank Thomas",
    currentWork: "Redline Task P-101",
    timestamp: new Date(Date.now() - 900000).toISOString()
  },
  { 
    id: "log-3", 
    type: "Task Completion",
    name: "UPV Line-104, Line-105",
    createdBy: "Eve Wilson",
    currentWork: "Line Line-104",
    timestamp: new Date(Date.now() - 800000).toISOString()
  },
  { 
    id: "log-4", 
    type: "Equipment Creation",
    name: "Pump-101",
    createdBy: "Bob Johnson",
    currentWork: "Equipment Pump-101",
    timestamp: new Date(Date.now() - 700000).toISOString()
  },
  { 
    id: "log-5", 
    type: "Line Creation",
    name: "Line-103",
    createdBy: "Alice Smith",
    currentWork: "Line Line-103 with additional specifications for the testing of new material types",
    timestamp: new Date(Date.now() - 600000).toISOString()
  }
];

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 20) => {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
};

// Format time in HH:MM 24-hour format
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

const AdminDashboard = () => {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);
  
  const handleRefresh = () => {
    toast.success("Data refreshed");
  };
  
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Format audit logs for CSV
      const headers = ["ID", "Type", "Name", "Created By", "Current Work", "Timestamp"];
      const rows = mockAuditLogs.map(log => [
        log.id,
        log.type,
        log.name,
        log.createdBy,
        log.currentWork,
        formatTime(log.timestamp)
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create download link
      const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `project_audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
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
    <div className="min-h-screen bg-gray-50">
      <Navbar onRefresh={handleRefresh} />
      
      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-500">
              Project statistics and audit trails
            </p>
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
                    {mockProjects.map((project) => (
                      <SelectItem key={project} value={project.toLowerCase().replace(/\s+/g, '-')}>
                        {project}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">
                  Filter by Team
                </label>
                <Select
                  value={selectedTeam}
                  onValueChange={setSelectedTeam}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {mockTeams.map((team) => (
                      <SelectItem key={team} value={team.toLowerCase().replace(/\s+/g, '-')}>
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
          {/* Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Project Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total P&IDs:</span>
                <span className="text-lg font-bold">{mockProjectStats.pidCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Lines:</span>
                <span className="text-lg font-bold">{mockProjectStats.lineCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Equipment:</span>
                <span className="text-lg font-bold">{mockProjectStats.equipmentCount}</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Status Chart */}
          <Card className="col-span-1 md:col-span-2">
            <CardHeader>
              <CardTitle>Task Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mockStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {mockStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} tasks`, 'Count']} />
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
                  {mockAuditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.type}</TableCell>
                      <TableCell>{log.name}</TableCell>
                      <TableCell>{log.createdBy}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <UITooltip>
                            <TooltipTrigger className="cursor-help text-left">
                              <span className="text-sm">
                                {truncateText(log.currentWork)}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
