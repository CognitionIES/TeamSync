import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Navbar from "../shared/Navbar";
import TaskCard from "../shared/TaskCard";
import { Button } from "@/components/ui/button";
import { Task, TaskItem, TaskComment } from "@/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import TaskComments from "../shared/TaskComments";
import TaskTypeIndicator from "../shared/TaskTypeIndicator";
import { InfoIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Mock comments data
const mockComments: TaskComment[] = [
  {
    id: "comment-1",
    userId: "user-1",
    userName: "John Smith",
    userRole: "Team Lead",
    comment: "Please check line 103 carefully, it's connecting to a critical system.",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "comment-2",
    userId: "user-3",
    userName: "Charlie Brown",
    userRole: "Team Member",
    comment: "I've verified line 103. All connections look correct.",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  }
];

// Mock data for lines in PIDs
const mockLines = [
  { id: "line-1", name: "Line-101", pidId: "pid-1" },
  { id: "line-2", name: "Line-102", pidId: "pid-1" },
  { id: "line-3", name: "Line-103", pidId: "pid-2" },
  { id: "line-4", name: "Line-104", pidId: "pid-2" },
  { id: "line-5", name: "Line-105", pidId: "pid-3" }
];

// Mock data for tasks
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
    ],
    comments: [mockComments[0]]
  },
  {
    id: "task-2",
    type: "UPV",
    assignee: "Charlie Brown",
    assigneeId: "user-3",
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
    ],
    comments: [mockComments[0], mockComments[1]]
  },
  {
    id: "task-3",
    type: "QC",
    assignee: "Charlie Brown",
    assigneeId: "user-3", 
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

// Extended TaskCard component to show lines for Redline tasks
const RedlineTaskCard = ({ 
  task, 
  onStatusChange,
  onItemToggle, 
  onLineToggle,
  onOpenComments
}: { 
  task: Task, 
  onStatusChange?: (taskId: string, newStatus: "Assigned" | "In Progress" | "Completed") => void,
  onItemToggle?: (taskId: string, itemId: string, isCompleted: boolean) => void,
  onLineToggle?: (taskId: string, lineId: string, isCompleted: boolean) => void,
  onOpenComments?: (task: Task) => void
}) => {
  const [pidLines, setPidLines] = useState<{id: string, name: string, completed: boolean}[]>([]);
  
  useEffect(() => {
    if (task.type === "Redline") {
      // Find the PID item in the task
      const pidItem = task.items.find(item => item.type === "PID");
      
      if (pidItem) {
        // Get all lines for this PID
        const pidId = pidItem.id;
        const linesForPid = mockLines
          .filter(line => line.pidId === pidId)
          .map(line => {
            // Check if this line is already in items and completed
            const lineInItems = task.items.find(item => item.id === line.id);
            return {
              id: line.id,
              name: line.name,
              completed: lineInItems?.completed || false
            };
          });
        
        setPidLines(linesForPid);
      }
    }
  }, [task]);
  
  const handleLineToggle = (lineId: string, checked: boolean) => {
    // Check if task is in progress
    if (task.status !== 'In Progress' && checked) {
      toast.error("You must start the task before marking lines as completed");
      return;
    }
    
    // Cannot uncheck items once checked
    const lineCompleted = pidLines.find(line => line.id === lineId)?.completed || false;
    if (!checked && lineCompleted) {
      toast.error("Lines cannot be unchecked once completed");
      return;
    }
    
    if (onLineToggle) {
      onLineToggle(task.id, lineId, checked);
      
      // Update local state
      setPidLines(prevLines =>
        prevLines.map(line => 
          line.id === lineId ? { ...line, completed: checked } : line
        )
      );
    }
  };
  
  // Count PID and lines
  const pidItem = task.items.find(item => item.type === "PID");
  const pidCount = pidItem ? 1 : 0;
  const lineCount = pidLines.length;
  
  // If this is not a Redline task, use the regular TaskCard
  if (task.type !== "Redline") {
    return (
      <TaskCard 
        task={task}
        onStatusChange={onStatusChange}
        onItemToggle={onItemToggle}
        onOpenComments={onOpenComments}
      />
    );
  }
  
  return (
    <Card className="shadow-md hover:shadow-lg transition-all duration-300">
      <CardHeader className={`
        pb-2 
        ${task.status === "Completed" ? 'bg-green-50' : 
          task.status === "In Progress" ? 'bg-orange-50' : 'bg-blue-50'}`
      }>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <TaskTypeIndicator type={task.type} />
            <h3 className="text-lg font-semibold">
              Redline Task
            </h3>
          </div>
          <div className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-800">
            {task.status}
          </div>
        </div>
        <div className="text-center mt-2 py-1 px-3 bg-blue-100 rounded-md inline-block">
          <p className="text-base font-medium text-blue-800">
            P&ID: {pidCount}, Lines: {lineCount}
          </p>
          {pidItem && (
            <p className="text-sm text-blue-700 mt-1">
              {pidItem.name}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-col gap-2 text-sm text-gray-600 mb-4">
          <div>
            Assigned at: {formatTime(task.createdAt)}
          </div>
          <div>
            {task.completedAt ? 
              `Completed at: ${formatTime(task.completedAt)}` : 
              "Not completed"
            }
          </div>
        </div>
        
        <h4 className="text-sm font-medium mb-2">Lines to Review:</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {pidLines.length > 0 ? (
            pidLines.map(line => (
              <div key={line.id} className="flex items-center space-x-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center space-x-2 flex-grow">
                        <Checkbox
                          id={`line-${line.id}`}
                          checked={line.completed}
                          disabled={task.status === "Completed" || (task.status !== "In Progress" && !line.completed) || line.completed}
                          onCheckedChange={(checked) => handleLineToggle(line.id, !!checked)}
                        />
                        <label htmlFor={`line-${line.id}`} className="text-sm">
                          {line.name}
                        </label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {task.status !== 'In Progress' && !line.completed ? 
                        "Start task to enable this checkbox" : 
                        line.completed ? 
                          "This item cannot be unchecked" : 
                          "Mark as completed"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No lines found for this P&ID</p>
          )}
        </div>
        <div className="mt-4">
          <div className="flex justify-between space-x-2">
            {onOpenComments && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenComments(task)}
                className="text-sm"
              >
                Comments {task.comments?.length ? `(${task.comments.length})` : ''}
              </Button>
            )}
            
            <div className="flex space-x-2">
              {task.status === "Assigned" && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onStatusChange?.(task.id, "In Progress")}
                  className="bg-orange-50 text-orange-600 hover:bg-orange-100"
                >
                  Start Task
                </Button>
              )}
              
              {task.status === "In Progress" && (
                <Button 
                  size="sm"
                  onClick={() => onStatusChange?.(task.id, "Completed")}
                  disabled={pidLines.some(line => !line.completed)}
                  className="bg-green-500 text-white hover:bg-green-600"
                >
                  Complete Task
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const TeamMemberDashboard = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  
  // Load tasks on initial render
  useEffect(() => {
    // Simulate API call to fetch tasks
    setTimeout(() => {
      setTasks(mockTasks);
      setIsLoading(false);
    }, 1000);
  }, []);
  
  const handleRefresh = () => {
    setIsLoading(true);
    
    // Simulate API call to refresh tasks
    setTimeout(() => {
      setTasks(mockTasks);
      setIsLoading(false);
      toast.success("Tasks refreshed");
    }, 500);
  };
  
  const handleStatusChange = async (
    taskId: string, 
    newStatus: "Assigned" | "In Progress" | "Completed"
  ) => {
    // Simulate API call to update task status
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        setTasks(prevTasks =>
          prevTasks.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                status: newStatus,
                updatedAt: new Date().toISOString(),
                completedAt: newStatus === "Completed" ? new Date().toISOString() : task.completedAt,
                progress: newStatus === "Completed" ? 100 : task.progress
              };
            }
            return task;
          })
        );
        
        if (newStatus === "In Progress") {
          toast.success("Task started successfully");
        } else if (newStatus === "Completed") {
          toast.success("Task completed successfully");
        }
        
        resolve();
      }, 500);
    });
  };
  
  const handleItemToggle = async (taskId: string, itemId: string, isCompleted: boolean) => {
    // Get the task
    const task = tasks.find(t => t.id === taskId);
    
    // Check if task is in progress
    if (task && task.status !== 'In Progress' && isCompleted) {
      toast.error("You must start the task before marking items as completed");
      return Promise.reject("Task not started");
    }
    
    // Check if item is already completed
    const item = task?.items.find(i => i.id === itemId);
    if (item?.completed && !isCompleted) {
      toast.error("Items cannot be unchecked once completed");
      return Promise.reject("Item cannot be unchecked");
    }
    
    // Simulate API call to update item status
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        setTasks(prevTasks =>
          prevTasks.map(task => {
            if (task.id === taskId) {
              const updatedItems = task.items.map(item =>
                item.id === itemId ? { ...item, completed: isCompleted } : item
              );
              
              // Calculate new progress
              const completedCount = updatedItems.filter(item => item.completed).length;
              const progress = Math.round((completedCount / updatedItems.length) * 100);
              
              return {
                ...task,
                items: updatedItems,
                progress,
                updatedAt: new Date().toISOString()
              };
            }
            return task;
          })
        );
        resolve();
      }, 200);
    });
  };
  
  const handleLineToggle = async (taskId: string, lineId: string, isCompleted: boolean) => {
    // Get the task
    const task = tasks.find(t => t.id === taskId);
    
    // Check if task is in progress
    if (task && task.status !== 'In Progress' && isCompleted) {
      toast.error("You must start the task before marking lines as completed");
      return Promise.reject("Task not started");
    }
    
    // Check if line is already in items and completed
    const lineItem = task?.items.find(item => item.id === lineId);
    if (lineItem?.completed && !isCompleted) {
      toast.error("Lines cannot be unchecked once completed");
      return Promise.reject("Line cannot be unchecked");
    }
    
    // Simulate API call to update line status for redline tasks
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        setTasks(prevTasks =>
          prevTasks.map(task => {
            if (task.id === taskId && task.type === "Redline") {
              // Check if line is already in items
              const lineExists = task.items.some(item => item.id === lineId);
              
              let updatedItems;
              
              if (lineExists) {
                // Update existing line
                updatedItems = task.items.map(item =>
                  item.id === lineId ? { ...item, completed: isCompleted } : item
                );
              } else {
                // Add new line to items
                const lineInfo = mockLines.find(line => line.id === lineId);
                if (lineInfo) {
                  const newLine: TaskItem = {
                    id: lineId,
                    name: lineInfo.name,
                    type: "Line",
                    completed: isCompleted
                  };
                  updatedItems = [...task.items, newLine];
                } else {
                  updatedItems = task.items;
                }
              }
              
              // Calculate new progress based on PID and line items
              const pidCount = updatedItems.filter(item => item.type === "PID").length;
              const lineItems = updatedItems.filter(item => item.type === "Line");
              const lineCount = lineItems.length;
              const completedLineCount = lineItems.filter(item => item.completed).length;
              
              // Progress is based on completed lines if there are lines, otherwise it's 0
              const progress = lineCount > 0 ? Math.round((completedLineCount / lineCount) * 100) : 0;
              
              return {
                ...task,
                items: updatedItems,
                progress,
                updatedAt: new Date().toISOString()
              };
            }
            return task;
          })
        );
        
        if (isCompleted) {
          toast.success("Line marked as completed");
        }
        
        resolve();
      }, 200);
    });
  };
  
  const handleOpenComments = (task: Task) => {
    setSelectedTask(task);
    setIsCommentsOpen(true);
  };
  
  const handleAddComment = async (taskId: string, comment: string) => {
    // Simulate API call to add comment
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        const newComment: TaskComment = {
          id: `comment-${Date.now()}`,
          userId: "user-3",
          userName: "Charlie Brown",
          userRole: "Team Member",
          comment,
          createdAt: new Date().toISOString()
        };
        
        setTasks(prevTasks =>
          prevTasks.map(task => {
            if (task.id === taskId) {
              return {
                ...task,
                comments: [newComment, ...(task.comments || [])]
              };
            }
            return task;
          })
        );
        
        // Also update selectedTask if it's the one we're commenting on
        if (selectedTask?.id === taskId) {
          setSelectedTask({
            ...selectedTask,
            comments: [newComment, ...(selectedTask.comments || [])]
          });
        }
        
        resolve();
      }, 500);
    });
  };
  
  // Filter tasks by status
  const assignedTasks = tasks.filter(task => task.status === "Assigned");
  const inProgressTasks = tasks.filter(task => task.status === "In Progress");
  const completedTasks = tasks.filter(task => task.status === "Completed");
  
  // Task counts for stats
  const taskCounts = {
    assigned: assignedTasks.length,
    inProgress: inProgressTasks.length,
    completed: completedTasks.length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onRefresh={handleRefresh} />
      
      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Team Member Dashboard</h1>
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="px-3 py-1 bg-blue-100 text-teamsync-assigned rounded-full text-sm">
              {taskCounts.assigned} Assigned
            </div>
            <div className="px-3 py-1 bg-orange-100 text-teamsync-inProgress rounded-full text-sm">
              {taskCounts.inProgress} In Progress
            </div>
            <div className="px-3 py-1 bg-green-100 text-teamsync-completed rounded-full text-sm">
              {taskCounts.completed} Completed
            </div>
          </div>
        </header>

        {assignedTasks.length > 0 && (
          <Alert className="mb-6 bg-blue-50 border-blue-200">
            <InfoIcon className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Task Workflow Reminder</AlertTitle>
            <AlertDescription className="text-blue-700">
              Remember to click "Start Task" before you can mark items as completed. Once marked complete, items cannot be unchecked.
            </AlertDescription>
          </Alert>
        )}

        <div className="block md:hidden mb-6">
          <Tabs defaultValue="assigned">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="assigned">Assigned</TabsTrigger>
              <TabsTrigger value="inProgress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
            
            <TabsContent value="assigned" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : assignedTasks.length > 0 ? (
                assignedTasks.map(task => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onItemToggle={handleItemToggle}
                    onLineToggle={handleLineToggle}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No assigned tasks</div>
              )}
            </TabsContent>
            
            <TabsContent value="inProgress" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : inProgressTasks.length > 0 ? (
                inProgressTasks.map(task => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onItemToggle={handleItemToggle}
                    onLineToggle={handleLineToggle}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No in-progress tasks</div>
              )}
            </TabsContent>
            
            <TabsContent value="completed" className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : completedTasks.length > 0 ? (
                completedTasks.map(task => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No completed tasks</div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden md:grid md:grid-cols-3 gap-6">
          {/* Assigned Column */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 bg-teamsync-assigned rounded-full mr-2"></div>
              Assigned
            </h2>
            
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : assignedTasks.length > 0 ? (
                assignedTasks.map(task => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onItemToggle={handleItemToggle}
                    onLineToggle={handleLineToggle}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No assigned tasks</div>
              )}
            </div>
          </div>
          
          {/* In Progress Column */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 bg-teamsync-inProgress rounded-full mr-2"></div>
              In Progress
            </h2>
            
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : inProgressTasks.length > 0 ? (
                inProgressTasks.map(task => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onItemToggle={handleItemToggle}
                    onLineToggle={handleLineToggle}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No in-progress tasks</div>
              )}
            </div>
          </div>
          
          {/* Completed Column */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <div className="w-3 h-3 bg-teamsync-completed rounded-full mr-2"></div>
              Completed
            </h2>
            
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8">Loading tasks...</div>
              ) : completedTasks.length > 0 ? (
                completedTasks.map(task => (
                  <RedlineTaskCard
                    key={task.id}
                    task={task}
                    onOpenComments={handleOpenComments}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No completed tasks</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Comments Dialog */}
        <Dialog open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Task Comments</DialogTitle>
            </DialogHeader>
            {selectedTask && (
              <TaskComments
                taskId={selectedTask.id}
                comments={selectedTask.comments}
                onAddComment={handleAddComment}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TeamMemberDashboard;
