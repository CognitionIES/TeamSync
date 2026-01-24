import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface PID {
  id: string;
  name: string;
}

interface Line {
  id: string;
  name: string;
  pidId: string;
}

interface Equipment {
  id: string;
  name: string;
  areaId: string;
}

interface NonInlineInstrument {
  id: string;
  instrumentTag: string;
  description: string;
}

interface ItemSelectorProps {
  assignmentType: "PID" | "Line" | "Equipment" | "NonInlineInstrument";
  selectedPIDs: string[];
  selectedLines: string[];
  selectedEquipment: string[];
  selectedNonInlineInstruments: string[];
  onPIDsChange: (pids: string[]) => void;
  onLinesChange: (lines: string[]) => void;
  onEquipmentChange: (equipment: string[]) => void;
  onNonInlineInstrumentsChange: (instruments: string[]) => void;
  taskType: string;
  selectedProject: string;
}

export const ItemSelector: React.FC<ItemSelectorProps> = ({
  assignmentType,
  selectedPIDs,
  selectedLines,
  selectedEquipment,
  selectedNonInlineInstruments,
  onPIDsChange,
  onLinesChange,
  onEquipmentChange,
  onNonInlineInstrumentsChange,
  taskType,
  selectedProject,
}) => {
  const [pids, setPIDs] = useState<PID[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [nonInlineInstruments, setNonInlineInstruments] = useState<NonInlineInstrument[]>([]);
  const [groupSelectCount, setGroupSelectCount] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("teamsync_token");
    if (!token) throw new Error("No authentication token found");
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  useEffect(() => {
    if (!selectedProject || !taskType) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (assignmentType === "PID") {
          const response = await axios.get(
            `${API_URL}/pids?projectId=${selectedProject}`,
            getAuthHeaders()
          );
          setPIDs(response.data.data.map((pid: any) => ({
            id: pid.id.toString(),
            name: pid.pid_number,
          })));
        } else if (assignmentType === "Line") {
          const taskTypeParam = taskType === "QC" ? "?taskType=QC" : "";
          const response = await axios.get(
            `${API_URL}/lines/unassigned/${selectedProject}${taskTypeParam}`,
            getAuthHeaders()
          );
          setLines(response.data.data.map((line: any) => ({
            id: line.id.toString(),
            name: line.line_number,
            pidId: line.pid_id.toString(),
          })));
        } else if (assignmentType === "Equipment") {
          const taskTypeParam = taskType === "QC" ? "?taskType=QC" : "";
          const response = await axios.get(
            `${API_URL}/equipment/unassigned/${selectedProject}${taskTypeParam}`,
            getAuthHeaders()
          );
          setEquipment(response.data.data.map((equip: any) => ({
            id: equip.id.toString(),
            name: equip.equipment_number,
            areaId: equip.area_id?.toString() || "",
          })));
        } else if (assignmentType === "NonInlineInstrument") {
          const taskTypeParam = taskType === "QC" ? "?taskType=QC" : "";
          const response = await axios.get(
            `${API_URL}/non-inline-instruments/unassigned/${selectedProject}${taskTypeParam}`,
            getAuthHeaders()
          );
          setNonInlineInstruments(response.data.data.map((instrument: any) => ({
            id: instrument.id.toString(),
            instrumentTag: instrument.instrument_tag,
            description: instrument.description,
          })));
        }
      } catch (error: any) {
        toast.error(error.response?.data?.message || "Failed to fetch items");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [assignmentType, selectedProject, taskType]);

  const handleCheckboxChange = (
    itemId: string,
    index: number,
    checked: boolean,
    type: "PID" | "Line" | "Equipment" | "NonInlineInstrument"
  ) => {
    let items: any[] = [];
    let selected: string[] = [];
    let onChange: (items: string[]) => void;

    if (type === "PID") {
      items = pids;
      selected = selectedPIDs;
      onChange = onPIDsChange;
    } else if (type === "Line") {
      items = lines;
      selected = selectedLines;
      onChange = onLinesChange;
    } else if (type === "Equipment") {
      items = equipment;
      selected = selectedEquipment;
      onChange = onEquipmentChange;
    } else {
      items = nonInlineInstruments;
      selected = selectedNonInlineInstruments;
      onChange = onNonInlineInstrumentsChange;
    }

    if (groupSelectCount > 1) {
      const endIndex = Math.min(index + groupSelectCount, items.length);
      const itemsToSelect = items.slice(index, endIndex).map((item) => item.id);

      if (checked) {
        onChange([...new Set([...selected, ...itemsToSelect])]);
        toast.success(`Selected ${itemsToSelect.length} items`);
      } else {
        onChange(selected.filter((id) => !itemsToSelect.includes(id)));
        toast.success(`Deselected ${itemsToSelect.length} items`);
      }
    } else {
      if (checked) {
        onChange([...selected, itemId]);
      } else {
        onChange(selected.filter((id) => id !== itemId));
      }
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading items...</div>;
  }

  return (
    <div className="border p-4 rounded-md">
      <h3 className="font-medium mb-3">
        Select{" "}
        {assignmentType === "PID"
          ? "P&IDs"
          : assignmentType === "Line"
            ? "Lines"
            : assignmentType === "Equipment"
              ? "Equipment"
              : "Non-inline Instruments"}
      </h3>

      {/* Group Select Control */}
      <div className="mb-4 flex items-center">
        <label htmlFor="groupSelectCount" className="mr-2 font-medium">
          Select how many at once:
        </label>
        <input
          type="number"
          id="groupSelectCount"
          value={groupSelectCount}
          onChange={(e) => setGroupSelectCount(Math.max(1, parseInt(e.target.value) || 1))}
          min="1"
          className="border rounded px-2 py-1 w-20"
        />
        <span className="ml-2 text-gray-600">
          (Click a checkbox to select the next {groupSelectCount} items)
        </span>
      </div>

      <div className="max-h-60 overflow-y-auto space-y-2">
        {assignmentType === "PID" &&
          pids.map((pid, index) => (
            <div key={pid.id} className="flex items-center space-x-2">
              <Checkbox
                id={pid.id}
                checked={selectedPIDs.includes(pid.id)}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(pid.id, index, checked as boolean, "PID")
                }
              />
              <label htmlFor={pid.id} className="text-sm">
                {pid.name}
              </label>
            </div>
          ))}

        {assignmentType === "Line" &&
          lines.map((line, index) => (
            <div key={line.id} className="flex items-center space-x-2">
              <Checkbox
                id={line.id}
                checked={selectedLines.includes(line.id)}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(line.id, index, checked as boolean, "Line")
                }
              />
              <label htmlFor={line.id} className="text-sm">
                {line.name}
              </label>
            </div>
          ))}

        {assignmentType === "Equipment" &&
          equipment.map((equip, index) => (
            <div key={equip.id} className="flex items-center space-x-2">
              <Checkbox
                id={equip.id}
                checked={selectedEquipment.includes(equip.id)}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(equip.id, index, checked as boolean, "Equipment")
                }
              />
              <label htmlFor={equip.id} className="text-sm">
                {equip.name}
              </label>
            </div>
          ))}

        {assignmentType === "NonInlineInstrument" &&
          nonInlineInstruments.map((instrument, index) => (
            <div key={instrument.id} className="flex items-center space-x-2">
              <Checkbox
                id={instrument.id}
                checked={selectedNonInlineInstruments.includes(instrument.id)}
                onCheckedChange={(checked) =>
                  handleCheckboxChange(instrument.id, index, checked as boolean, "NonInlineInstrument")
                }
              />
              <label htmlFor={instrument.id} className="text-sm">
                {instrument.instrumentTag} - {instrument.description}
              </label>
            </div>
          ))}
      </div>

      {/* Selection count */}
      <p className="text-sm text-gray-600 mt-2">
        Selected{" "}
        {assignmentType === "PID"
          ? "P&IDs"
          : assignmentType === "Line"
            ? "Lines"
            : assignmentType === "Equipment"
              ? "Equipment"
              : "Instruments"}
        :{" "}
        {assignmentType === "PID"
          ? selectedPIDs.length
          : assignmentType === "Line"
            ? selectedLines.length
            : assignmentType === "Equipment"
              ? selectedEquipment.length
              : selectedNonInlineInstruments.length}
      </p>
    </div>
  );
};