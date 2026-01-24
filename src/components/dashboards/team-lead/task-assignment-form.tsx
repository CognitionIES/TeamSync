
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { TaskType } from "@/types";
import { ItemSelector } from "./item-selector";

interface Project {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  name: string;
}

interface TaskAssignmentFormProps {
  projects: Project[];
  teamMembers: TeamMember[];
  isTeamMembersLoading: boolean;
  isSubmitting: boolean;
  submissionProgress: number;
  onAssign: (formData: TaskFormData) => Promise<void>;
  onProjectChange: (projectId: string) => void;
}

export interface TaskFormData {
  taskType: TaskType | "Misc" | "";
  assignmentType: "PID" | "Line" | "Equipment" | "NonInlineInstrument" | "";
  selectedPIDs: string[];
  selectedLines: string[];
  selectedEquipment: string[];
  selectedNonInlineInstruments: string[];
  assignee: string;
  isComplex: boolean;
  description: string;
  usePIDBasedAssignment: boolean;
  selectedProject: string;
}

export const TaskAssignmentForm: React.FC<TaskAssignmentFormProps> = ({
  projects,
  teamMembers,
  isTeamMembersLoading,
  isSubmitting,
  submissionProgress,
  onAssign,
  onProjectChange,
}) => {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [taskType, setTaskType] = useState<TaskType | "Misc" | "">("");
  const [assignmentType, setAssignmentType] = useState<
    "PID" | "Line" | "Equipment" | "NonInlineInstrument" | ""
  >("");
  const [selectedPIDs, setSelectedPIDs] = useState<string[]>([]);
  const [selectedLines, setSelectedLines] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [selectedNonInlineInstruments, setSelectedNonInlineInstruments] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [isComplex, setIsComplex] = useState(false);
  const [description, setDescription] = useState("");
  const [usePIDBasedAssignment, setUsePIDBasedAssignment] = useState(false);

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    onProjectChange(value);
    // Reset other fields
    setTaskType("");
    setAssignmentType("");
    setSelectedPIDs([]);
    setSelectedLines([]);
    setSelectedEquipment([]);
    setSelectedNonInlineInstruments([]);
  };

  const handleTaskTypeChange = (value: string) => {
    setTaskType(value as TaskType | "Misc");
    setAssignmentType("");
    setSelectedPIDs([]);
    setSelectedLines([]);
    setSelectedEquipment([]);
    setSelectedNonInlineInstruments([]);
  };

  const handleAssignmentTypeChange = (value: string) => {
    setAssignmentType(value as "PID" | "Line" | "Equipment" | "NonInlineInstrument" | "");
    setSelectedPIDs([]);
    setSelectedLines([]);
    setSelectedEquipment([]);
    setSelectedNonInlineInstruments([]);
  };

  const handleSubmit = async () => {
    const formData: TaskFormData = {
      taskType,
      assignmentType,
      selectedPIDs,
      selectedLines,
      selectedEquipment,
      selectedNonInlineInstruments,
      assignee,
      isComplex,
      description,
      usePIDBasedAssignment,
      selectedProject,
    };

    await onAssign(formData);

    // Reset form
    setTaskType("");
    setAssignmentType("");
    setSelectedPIDs([]);
    setSelectedLines([]);
    setSelectedEquipment([]);
    setSelectedNonInlineInstruments([]);
    setAssignee("");
    setIsComplex(false);
    setDescription("");
    setUsePIDBasedAssignment(false);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Task Assignment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Project Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Project</label>
            <Select value={selectedProject} onValueChange={handleProjectChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Task Type</label>
            <Select value={taskType} onValueChange={handleTaskTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Redline">Redline</SelectItem>
                <SelectItem value="UPV">UPV</SelectItem>
                <SelectItem value="QC">QC</SelectItem>
                <SelectItem value="Misc">Miscellaneous</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assignment Type (if not Misc) */}
          {taskType && taskType !== "Misc" && (
            <div>
              <label className="block text-sm font-medium mb-1">Assignment Type</label>
              <Select value={assignmentType} onValueChange={handleAssignmentTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {taskType === "Redline" && <SelectItem value="PID">P&ID</SelectItem>}
                  {(taskType === "UPV" || taskType === "QC") && (
                    <>
                      <SelectItem value="Line">Line</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                      <SelectItem value="NonInlineInstrument">Non-inline Instrument</SelectItem>
                      <SelectItem value="PID">P&ID</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assignee Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Assign To</label>
            <Select
              value={assignee}
              onValueChange={setAssignee}
              disabled={!taskType || teamMembers.length === 0 || isTeamMembersLoading}
            >
              <SelectTrigger>
                {isTeamMembersLoading ? (
                  <span className="text-gray-500">Loading team members...</span>
                ) : (
                  <SelectValue placeholder="Select member" />
                )}
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <div className="flex items-end">
            <Button
              onClick={handleSubmit}
              disabled={!taskType || !assignee || isSubmitting || !selectedProject}
              className="w-full"
            >
              {isSubmitting ? "Assigning..." : "Assign Task"}
            </Button>
          </div>
        </div>

        {/* PID-Based Assignment Option for UPV */}
        {taskType === "UPV" && assignmentType === "PID" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              UPV Assignment Method
            </h3>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={usePIDBasedAssignment}
                  onChange={() => setUsePIDBasedAssignment(true)}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-sm text-gray-900">
                    🆕 PID-Based Assignment (Recommended)
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Assign entire P&IDs to users. System auto-populates all lines/equipment in each PID.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={!usePIDBasedAssignment}
                  onChange={() => setUsePIDBasedAssignment(false)}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-sm text-gray-700">
                    Line-Based Assignment (Legacy)
                  </span>
                  <p className="text-xs text-gray-600 mt-1">
                    Traditional method: Assign individual lines/equipment.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Description for Misc tasks */}
        {taskType === "Misc" && (
          <div className="border p-4 rounded-md">
            <h3 className="font-medium mb-3">Task Description</h3>
            <textarea
              className="w-full p-2 border rounded-md"
              rows={4}
              placeholder="Enter the task description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        )}

        {/* Item Selector */}
        {taskType && taskType !== "Misc" && assignmentType && (
          <ItemSelector
            assignmentType={assignmentType}
            selectedPIDs={selectedPIDs}
            selectedLines={selectedLines}
            selectedEquipment={selectedEquipment}
            selectedNonInlineInstruments={selectedNonInlineInstruments}
            onPIDsChange={setSelectedPIDs}
            onLinesChange={setSelectedLines}
            onEquipmentChange={setSelectedEquipment}
            onNonInlineInstrumentsChange={setSelectedNonInlineInstruments}
            taskType={taskType}
            selectedProject={selectedProject}
          />
        )}

        {/* Progress Bar */}
        {isSubmitting && (
          <div className="mt-4">
            <Progress value={submissionProgress} className="h-2" />
            <p className="text-sm text-gray-500 mt-2">
              {submissionProgress < 50
                ? "Creating task..."
                : submissionProgress < 100
                  ? "Assigning items..."
                  : "Finalizing..."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};