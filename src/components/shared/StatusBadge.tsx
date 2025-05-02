
import { cn } from "@/lib/utils";
import { TaskStatus } from "@/types";

interface StatusBadgeProps {
  status: TaskStatus;
  isComplex?: boolean;
  className?: string;
}

const StatusBadge = ({ status, isComplex = false, className }: StatusBadgeProps) => {
  let baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
  
  // Determine background and text colors based on status
  const statusClasses = {
    "Assigned": "bg-blue-100 text-teamsync-assigned",
    "In Progress": "bg-orange-100 text-teamsync-inProgress",
    "Completed": "bg-green-100 text-teamsync-completed"
  };

  // If task is complex, use red styling or add a border
  if (isComplex) {
    baseClasses += " ring-2 ring-teamsync-complex";
  }

  return (
    <span 
      className={cn(
        baseClasses,
        statusClasses[status],
        className
      )}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
