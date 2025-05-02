import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar } from "lucide-react";
import { Task } from "@/types";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';

interface TeamMember {
  id: string;
  name: string;
  role?: string;
  team?: string;
}

interface TeamLead {
  name: string;
  team: string[];
}

interface TeamPerformanceProps {
  tasks: Task[];
  teamLeads: TeamLead[];
}

interface TeamPerformanceData {
  team: string;
  assigned: number;
  inProgress: number;
  completed: number;
  avgCompletionTime: number;
  totalTimeSpentMinutes: number;
}

// Format minutes as HH:MM
const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Calculate time difference between two dates in minutes
const getTimeDifferenceInMinutes = (startDate: string, endDate: string): number => {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return Math.round((end - start) / (1000 * 60));
};

const TeamPerformanceView: React.FC<TeamPerformanceProps> = ({ tasks, teamLeads }) => {
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [isExporting, setIsExporting] = useState(false);

  // Apply time filters to tasks
  const getFilteredTasks = () => {
    const currentTime = new Date();
    const weekAgo = new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(currentTime.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (timeFilter) {
      case "week":
        return tasks.filter(task => new Date(task.createdAt) >= weekAgo);
      case "month":
        return tasks.filter(task => new Date(task.createdAt) >= monthAgo);
      case "all":
      default:
        return tasks;
    }
  };

  const filteredTasks = getFilteredTasks();

  // Calculate team performance metrics
  const calculateTeamPerformance = (): TeamPerformanceData[] => {
    const teamPerformance: { [team: string]: TeamPerformanceData } = {};
    
    // Initialize team data
    teamLeads.forEach(lead => {
      teamPerformance[lead.name] = {
        team: lead.name,
        assigned: 0,
        inProgress: 0,
        completed: 0,
        avgCompletionTime: 0,
        totalTimeSpentMinutes: 0
      };
    });
    
    // Calculate completed counts and completion times
    filteredTasks.forEach(task => {
      // Find which team this task belongs to
      let taskTeam = "";
      for (const lead of teamLeads) {
        if (lead.team.includes(task.assignee)) {
          taskTeam = lead.name;
          break;
        }
      }
      
      if (!taskTeam) return; // Skip if task doesn't belong to a team
      
      // Increment task count by status
      if (task.status === "Assigned") {
        teamPerformance[taskTeam].assigned++;
      } else if (task.status === "In Progress") {
        teamPerformance[taskTeam].inProgress++;
      } else if (task.status === "Completed" && task.completedAt) {
        teamPerformance[taskTeam].completed++;
        
        // Calculate completion time
        const completionTime = getTimeDifferenceInMinutes(task.createdAt, task.completedAt);
        teamPerformance[taskTeam].totalTimeSpentMinutes += completionTime;
      }
    });
    
    // Calculate average completion time
    Object.keys(teamPerformance).forEach(team => {
      if (teamPerformance[team].completed > 0) {
        teamPerformance[team].avgCompletionTime = Math.round(
          teamPerformance[team].totalTimeSpentMinutes / teamPerformance[team].completed
        );
      }
    });
    
    return Object.values(teamPerformance);
  };

  const teamPerformance = calculateTeamPerformance();

  const handleExport = () => {
    setIsExporting(true);
    
    try {
      // Format data for CSV
      const headers = ["Team", "Assigned Tasks", "In Progress Tasks", "Completed Tasks", "Total Time Spent", "Avg Completion Time"];
      const rows = teamPerformance.map(team => [
        team.team,
        team.assigned,
        team.inProgress,
        team.completed,
        formatMinutes(team.totalTimeSpentMinutes),
        formatMinutes(team.avgCompletionTime)
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create download link
      const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `team_performance_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      
      // Trigger download
      link.click();
      document.body.removeChild(link);
      
      toast.success("Team performance data exported successfully");
    } catch (error) {
      toast.error("Failed to export data");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  // Prepare chart data
  const chartData = teamPerformance.map(team => ({
    name: team.team,
    assigned: team.assigned,
    inProgress: team.inProgress,
    completed: team.completed,
    avgTime: team.avgCompletionTime / 60 // Convert to hours for better visualization
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">Team Performance</h2>
          <p className="text-gray-500">Performance metrics across teams</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download size={16} />
            Export
          </Button>
        </div>
      </div>
      
      {/* Task Count by Team */}
      <Card>
        <CardHeader>
          <CardTitle>Task Distribution</CardTitle>
          <CardDescription>Number of assigned, in progress, and completed tasks per team</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 30,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Tasks']} />
                <Legend />
                <Bar dataKey="assigned" name="Assigned" fill="#3b82f6" stackId="a">
                  <LabelList dataKey="assigned" position="top" />
                </Bar>
                <Bar dataKey="inProgress" name="In Progress" fill="#f97316" stackId="a">
                  <LabelList dataKey="inProgress" position="top" />
                </Bar>
                <Bar dataKey="completed" name="Completed" fill="#16a34a" stackId="a">
                  <LabelList dataKey="completed" position="top" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Average Completion Time */}
      <Card>
        <CardHeader>
          <CardTitle>Team Time Metrics</CardTitle>
          <CardDescription>Average task completion time in hours</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 30,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`${typeof value === 'number' ? value.toFixed(2) : value} hrs`, 'Avg Time']} />
                <Legend />
                <Bar dataKey="avgTime" name="Avg Completion Time (hours)" fill="#8b5cf6">
                  <LabelList dataKey="avgTime" position="top" formatter={(value: number) => value.toFixed(1)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      {/* Detailed Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Team Metrics</CardTitle>
          <CardDescription>Complete breakdown of team performance</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>In Progress</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Total Tasks</TableHead>
                <TableHead>Total Time Spent</TableHead>
                <TableHead>Avg Completion Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamPerformance.map((team, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{team.team}</TableCell>
                  <TableCell>{team.assigned}</TableCell>
                  <TableCell>{team.inProgress}</TableCell>
                  <TableCell>{team.completed}</TableCell>
                  <TableCell>{team.assigned + team.inProgress + team.completed}</TableCell>
                  <TableCell>{formatMinutes(team.totalTimeSpentMinutes)}</TableCell>
                  <TableCell>
                    {team.completed > 0 ? formatMinutes(team.avgCompletionTime) : "N/A"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            className="ml-auto flex items-center gap-2"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download size={16} />
            Export Metrics
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default TeamPerformanceView;
