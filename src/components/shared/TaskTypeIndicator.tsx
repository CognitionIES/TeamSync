// In TaskTypeIndicator.tsx

import React from "react";
import { TaskType } from "@/types";
import { SquareKanban, Check, FileText, Clipboard } from "lucide-react"; // Add Clipboard icon for Misc
import { cn } from "@/lib/utils";

interface TaskTypeIndicatorProps {
  type: TaskType;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const TaskTypeIndicator: React.FC<TaskTypeIndicatorProps> = ({
  type,
  size = "md",
  showLabel = true,
  className,
}) => {
  const getIconSize = () => {
    switch (size) {
      case "sm":
        return 14;
      case "lg":
        return 20;
      default:
        return 16;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "sm":
        return "text-xs";
      case "lg":
        return "text-base";
      default:
        return "text-sm";
    }
  };

  const getTypeInfo = () => {
    switch (type) {
      case "Redline":
        return {
          icon: FileText,
          color: "text-red-600 bg-red-50 border border-red-200",
          label: "Redline",
        };
      case "UPV":
        return {
          icon: SquareKanban,
          color: "text-blue-600 bg-blue-50 border border-blue-200",
          label: "UPV",
        };
      case "QC":
        return {
          icon: Check,
          color: "text-green-600 bg-green-50 border border-green-200",
          label: "QC",
        };
      case "Misc":
        return {
          icon: Clipboard, // Use Clipboard icon for Misc tasks
          color: "text-purple-600 bg-purple-50 border border-purple-200",
          label: "Misc",
        };
      default:
        return {
          icon: SquareKanban,
          color: "text-gray-600 bg-gray-50 border border-gray-200",
          label: type,
        };
    }
  };

  const { icon: Icon, color, label } = getTypeInfo();
  const iconSize = getIconSize();
  const fontSize = getFontSize();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 shadow-sm",
        color,
        className
      )}
    >
      <Icon size={iconSize} />
      {showLabel && (
        <span className={cn("font-medium", fontSize)}>{label}</span>
      )}
    </div>
  );
};

export default TaskTypeIndicator;
