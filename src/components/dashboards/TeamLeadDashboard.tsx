
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Task, TaskItem, TaskType } from "@/types";
import { toast } from "sonner";
import Navbar from "../shared/Navbar";
import TaskTable from "../shared/TaskTable";

// Mock data
const mockTeamMembers = [
  "Charlie Brown", "David Miller", "Eve Wilson"
];

const mockPIDs = [
  { id: "pid-1", name: "P-101" },
  { id: "pid-2", name: "P-102" },
  { id: "pid-3", name: "P-103" }
];

const mockLines = [
  { id: "line-1", name: "Line-101", pidId: "pid-1" },
  { id: "line-2", name: "Line-102", pidId: "pid-1" },
  { id: "line-3", name: "Line-103", pidId: "pid-2" },
  { id: "line-4", name: "Line-104", pidId: "pid-2" },
  { id: "line-5", name: "Line-105", pidId: "pid-3" }
];

const mockEquipment = [
  { id: "equip-1", name: "Pump-101", areaId: "area-1" },
  { id: "equip-2", name: "Valve-101", areaId: "area-1" },
  { id: "equip-3", name: "Tank-101", areaId: "area-2" }
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
  }
];

const TeamLeadDashboard = () => {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  
  // Form state
  const [taskType, setTaskType] = useState<TaskType | "">("");
  const [assignmentType, setAssignmentType] = useState<"PID" | "Line" | "Equipment" | "">("");
  const [selectedPIDs, setSelectedPIDs] = useState<string[]>([]);
  const [selectedPID, setSelectedPID] = useState<string>("");
  const [showPIDLines, setShowPIDLines] = useState<boolean>(false);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [isComplex, setIsComplex] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get all assigned items to filter them out from selection options
  const [assignedItems, setAssignedItems] = useState<{
    pids: string[],
    lines: string[],
    equipment: string[]
  }>({
    pids: [],
    lines: [],
    equipment: []
  });

  // Update assigned items when tasks change
  useEffect(() => {
    const assignedPids: string[] = [];
    const assignedLines: string[] = [];
    const assignedEquipment: string[] = [];

    tasks.forEach(task => {
      task.items.forEach(item => {
        if (item.type === "PID") assignedPids.push(item.id);
        if (item.type === "Line") assignedLines.push(item.id);
        if (item.type === "Equipment") assignedEquipment.push(item.id);
      });
    });

    setAssignedItems({
      pids: assignedPids,
      lines: assignedLines,
      equipment: assignedEquipment
    });
  }, [tasks]);
  
  // Reset form fields when task type changes
  const handleTaskTypeChange = (value: string) => {
    setTaskType(value as TaskType);
    setAssignmentType("");
    setSelectedPIDs([]);
    setSelectedPID("");
    setShowPIDLines(false);
    setSelectedLines([]);
    setSelectedEquipment([]);
  };
  
  // Handle assignment type change with proper type checking
  const handleAssignmentTypeChange = (value: string) => {
    if (value === "PID" || value === "Line" || value === "Equipment" || value === "") {
      setAssignmentType(value);
      
      // Reset selections when assignment type changes
      if (value === "PID") {
        setSelectedLines([]);
        setSelectedEquipment([]);
        setShowPIDLines(false);
      } else if (value === "Line") {
        setSelectedPIDs([]);
        setSelectedEquipment([]);
      } else if (value === "Equipment") {
        setSelectedPIDs([]);
        setSelectedLines([]);
        setShowPIDLines(false);
      }
    }
  };

  // Handle PID selection for showing lines
  const handlePIDSelection = (pidId: string, checked: boolean) => {
    if (taskType === "Redline") {
      // For Redline tasks, we just want to select the PID
      if (checked) {
        setSelectedPIDs([pidId]);
        setSelectedPID(pidId);
        setShowPIDLines(true);
      } else {
        setSelectedPIDs([]);
        setSelectedPID("");
        setShowPIDLines(false);
      }
    } else {
      // For other task types, handle multi-selection
      if (checked) {
        setSelectedPIDs([...selectedPIDs, pidId]);
      } else {
        setSelectedPIDs(selectedPIDs.filter(id => id !== pidId));
      }
    }
  };
  
  // Filter selectable items based on task type and what's already assigned
  const getSelectableItems = () => {
    const availablePIDs = mockPIDs.filter(pid => !assignedItems.pids.includes(pid.id));
    const availableLines = mockLines.filter(line => !assignedItems.lines.includes(line.id));
    const availableEquipment = mockEquipment.filter(equip => !assignedItems.equipment.includes(equip.id));

    switch (taskType) {
      case "Redline":
        return { pids: availablePIDs, lines: availableLines, equipment: [] };
      case "UPV":
        return { pids: [], lines: availableLines, equipment: availableEquipment };
      case "QC":
        return { pids: availablePIDs, lines: availableLines, equipment: availableEquipment };
      default:
        return { pids: [], lines: [], equipment: [] };
    }
  };
  
  const { pids, lines, equipment } = getSelectableItems();

  // Get lines for selected PID in Redline task
  const getSelectedPIDLines = () => {
    if (!selectedPID) return [];
    return mockLines
      .filter(line => line.pidId === selectedPID && !assignedItems.lines.includes(line.id));
  };

  const pidLines = getSelectedPIDLines();
  
  const handleRefresh = () => {
    toast.success("Tasks refreshed");
  };
  
  const handleAssign = () => {
    if (!taskType || !assignee) {
      toast.error("Please select task type and assignee");
      return;
    }
    
    // Validate selections based on task type
    let validSelection = false;
    let selectedItems: TaskItem[] = [];

    if (taskType === "Redline") {
      if (selectedPIDs.length > 0) {
        validSelection = true;
        // Include PID
        selectedItems = [
          ...selectedPIDs.map(pid => {
            const pidObj = mockPIDs.find(p => p.id === pid);
            return {
              id: pid,
              name: pidObj?.name || pid,
              type: "PID" as const,
              completed: false
            };
          })
        ];
        
        // If it's a Redline task and lines are shown, include selected lines
        if (showPIDLines && selectedLines.length > 0) {
          selectedItems = [
            ...selectedItems,
            ...selectedLines.map(line => {
              const lineObj = mockLines.find(l => l.id === line);
              return {
                id: line,
                name: lineObj?.name || line,
                type: "Line" as const,
                completed: false
              };
            })
          ];
        }
      }
    } else if (taskType === "UPV") {
      if (selectedLines.length > 0 || selectedEquipment.length > 0) {
        validSelection = true;
        selectedItems = [
          ...selectedLines.map(line => {
            const lineObj = mockLines.find(l => l.id === line);
            return {
              id: line,
              name: lineObj?.name || line,
              type: "Line" as const,
              completed: false
            };
          }),
          ...selectedEquipment.map(equip => {
            const equipObj = mockEquipment.find(e => e.id === equip);
            return {
              id: equip,
              name: equipObj?.name || equip,
              type: "Equipment" as const,
              completed: false
            };
          })
        ];
      }
    } else if (taskType === "QC") {
      if (selectedPIDs.length > 0 || selectedLines.length > 0 || selectedEquipment.length > 0) {
        validSelection = true;
        selectedItems = [
          ...selectedPIDs.map(pid => {
            const pidObj = mockPIDs.find(p => p.id === pid);
            return {
              id: pid,
              name: pidObj?.name || pid,
              type: "PID" as const,
              completed: false
            };
          }),
          ...selectedLines.map(line => {
            const lineObj = mockLines.find(l => l.id === line);
            return {
              id: line,
              name: lineObj?.name || line,
              type: "Line" as const,
              completed: false
            };
          }),
          ...selectedEquipment.map(equip => {
            const equipObj = mockEquipment.find(e => e.id === equip);
            return {
              id: equip,
              name: equipObj?.name || equip,
              type: "Equipment" as const,
              completed: false
            };
          })
        ];
      }
    }
    
    if (!validSelection) {
      toast.error("Please select at least one item to assign");
      return;
    }
    
    setIsSubmitting(true);
    
    // Create new task
    const newTask: Task = {
      id: `task-${Date.now()}`,
      type: taskType,
      assignee: assignee,
      assigneeId: `user-${assignee}`,
      status: "Assigned",
      isComplex: isComplex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      progress: 0,
      items: selectedItems
    };
    
    // Simulate API call
    setTimeout(() => {
      setTasks([newTask, ...tasks]);
      
      // Reset form
      setTaskType("");
      setAssignmentType("");
      setSelectedPIDs([]);
      setSelectedPID("");
      setShowPIDLines(false);
      setSelectedLines([]);
      setSelectedEquipment([]);
      setAssignee("");
      setIsComplex(false);
      
      toast.success(`Task assigned to ${assignee}`);
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onRefresh={handleRefresh} />
      
      <div className="container mx-auto p-4 sm:p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Team Lead Dashboard</h1>
          <p className="text-gray-500">
            Assign and manage tasks for your team
          </p>
        </header>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Task Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Task Type */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Task Type
                </label>
                <Select
                  value={taskType}
                  onValueChange={handleTaskTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Redline">Redline</SelectItem>
                    <SelectItem value="UPV">UPV</SelectItem>
                    <SelectItem value="QC">QC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Assignment Type */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Assignment Type
                </label>
                <Select
                  value={assignmentType}
                  onValueChange={handleAssignmentTypeChange}
                  disabled={!taskType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskType === "Redline" && (
                      <SelectItem value="PID">P&ID</SelectItem>
                    )}
                    {(taskType === "UPV" || taskType === "QC") && (
                      <SelectItem value="Line">Line</SelectItem>
                    )}
                    {(taskType === "UPV" || taskType === "QC") && (
                      <SelectItem value="Equipment">Equipment</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Assignee */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Assign To
                </label>
                <Select
                  value={assignee}
                  onValueChange={setAssignee}
                  disabled={!taskType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {mockTeamMembers.map((member) => (
                      <SelectItem key={member} value={member}>
                        {member}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Mark Complex */}
              <div className="flex items-end">
                <div className="flex items-center space-x-2 h-10">
                  <Checkbox 
                    id="complex" 
                    checked={isComplex}
                    onCheckedChange={(checked) => setIsComplex(!!checked)}
                    disabled={!taskType}
                  />
                  <label 
                    htmlFor="complex"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Mark as Complex
                  </label>
                </div>
              </div>
              
              {/* Assign Button */}
              <div className="flex items-end">
                <Button 
                  onClick={handleAssign}
                  disabled={
                    !taskType || 
                    !assignee || 
                    isSubmitting
                  }
                  className="w-full"
                >
                  {isSubmitting ? "Assigning..." : "Assign Task"}
                </Button>
              </div>
            </div>
            
            {/* Selection Area */}
            {taskType && assignmentType && (
              <div className="border p-4 rounded-md">
                <h3 className="font-medium mb-3">
                  Select {assignmentType === "PID" ? "P&IDs" : assignmentType === "Line" ? "Lines" : "Equipment"}
                </h3>
                
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {assignmentType === "PID" && pids.map((pid) => (
                    <div key={pid.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={pid.id}
                        checked={selectedPIDs.includes(pid.id)}
                        onCheckedChange={(checked) => {
                          handlePIDSelection(pid.id, !!checked);
                        }}
                      />
                      <label htmlFor={pid.id} className="text-sm">
                        {pid.name}
                      </label>
                    </div>
                  ))}
                  
                  {assignmentType === "Line" && lines.map((line) => (
                    <div key={line.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={line.id}
                        checked={selectedLines.includes(line.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedLines([...selectedLines, line.id]);
                          } else {
                            setSelectedLines(selectedLines.filter(id => id !== line.id));
                          }
                        }}
                      />
                      <label htmlFor={line.id} className="text-sm">
                        {line.name}
                      </label>
                    </div>
                  ))}
                  
                  {assignmentType === "Equipment" && equipment.map((equip) => (
                    <div key={equip.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={equip.id}
                        checked={selectedEquipment.includes(equip.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedEquipment([...selectedEquipment, equip.id]);
                          } else {
                            setSelectedEquipment(selectedEquipment.filter(id => id !== equip.id));
                          }
                        }}
                      />
                      <label htmlFor={equip.id} className="text-sm">
                        {equip.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Show Lines for Selected PID in Redline task */}
            {taskType === "Redline" && showPIDLines && (
              <div className="border p-4 rounded-md mt-4">
                <h3 className="font-medium mb-3">
                  Lines in Selected P&ID
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {pidLines.length > 0 ? (
                    pidLines.map((line) => (
                      <div key={line.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`line-${line.id}`}
                          checked={selectedLines.includes(line.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedLines([...selectedLines, line.id]);
                            } else {
                              setSelectedLines(selectedLines.filter(id => id !== line.id));
                            }
                          }}
                        />
                        <label htmlFor={`line-${line.id}`} className="text-sm">
                          {line.name}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No available lines found for this P&ID</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Task Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskTable 
              tasks={tasks}
              teamMembers={mockTeamMembers}
              showFilters={true}
              showProgress={true}
              showCurrentWork={true}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamLeadDashboard;
