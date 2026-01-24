import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TaskTable from "./TaskTable";
import { Task } from "@/types";

interface TasksTabProps {
  tasks: Task[];
  teamMembers: string[];
  isLoading: boolean;
  onViewCurrentWork: (taskId: string, userId: string) => void;
  onViewComments: (taskId: string) => void;
  onUpdateItemCompletion?: (taskId: string, itemId: string, completed: boolean) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  teamMembers,
  isLoading,
  onViewCurrentWork,
  onViewComments,
  onUpdateItemCompletion,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
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