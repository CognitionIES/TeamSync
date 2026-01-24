import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Clock, CheckCircle } from "lucide-react";
import { MetricCard } from "./MetricCard";
import TaskTable from "@/components/shared/TaskTable";
import { Task } from "@/types";

interface OverviewTabProps {
  tasks: Task[];
  teamMembers: string[];
  isLoading: boolean;
  selectedDate: Date;
  onViewCurrentWork: (taskId: string, userId: string) => void;
  onViewComments: (taskId: string) => void;
  onUpdateItemCompletion?: (taskId: string, itemId: string, completed: boolean) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  tasks,
  teamMembers,
  isLoading,
  selectedDate,
  onViewCurrentWork,
  onViewComments,
  onUpdateItemCompletion,
}) => {
  const today = selectedDate.setHours(0, 0, 0, 0);
  
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
  const completedCount = tasks.filter((task) => task.status === "Completed").length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

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

  return (
    <div className="space-y-6 animate-fade-in">
      {isLoading ? (
        <MetricsSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            title="Progress Overview"
            value={`${completionRate}%`}
            subtitle="Completion"
            icon={TrendingUp}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-100"
            gradientFrom="from-blue-50"
          />
          <MetricCard
            title="Assigned Today"
            value={assignedToday}
            subtitle="New Tasks"
            icon={Clock}
            iconColor="text-indigo-600"
            iconBgColor="bg-indigo-100"
            gradientFrom="from-indigo-50"
          />
          <MetricCard
            title="Started Today"
            value={startedToday}
            subtitle="Tasks in Progress"
            icon={Clock}
            iconColor="text-orange-600"
            iconBgColor="bg-orange-100"
            gradientFrom="from-orange-50"
          />
          <MetricCard
            title="Completed Today"
            value={completedToday}
            subtitle="Tasks Finished"
            icon={CheckCircle}
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
            gradientFrom="from-green-50"
          />
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
            showComments={true}
            loading={isLoading}
            onViewCurrentWork={onViewCurrentWork}
            onViewComments={onViewComments}
            onUpdateItemCompletion={onUpdateItemCompletion}
          />
        </CardContent>
      </Card>
    </div>
  );
};