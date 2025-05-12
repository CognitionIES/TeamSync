// User roles
export type UserRole =
  | "Data Entry"
  | "Team Member"
  | "Team Lead"
  | "Project Manager"
  | "Admin";

// User
export interface User {
  id: string;
  name: string;
  role: UserRole;
}

// Auth context
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (role: UserRole, name: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

// Project hierarchy
export interface Project {
  id: string;
  name: string;
  areas: Area[];
}

export interface Area {
  id: string;
  name: string;
  projectId: string;
  pids: PID[];
  equipment: Equipment[];
}

export interface PID {
  id: string;
  name: string;
  areaId: string;
  lines: Line[];
}

export interface Line {
  id: string;
  name: string;
  pidId: string;
  status: TaskStatus;
}

export interface Equipment {
  id: string;
  name: string;
  areaId: string;
  status: TaskStatus;
}

// Task types
export type TaskType = "Redline" | "UPV" | "QC";
export type TaskStatus = "Assigned" | "In Progress" | "Completed";

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  comment: string;
  createdAt: string;
}

export interface Task {
  id: string;
  type: TaskType;
  assignee: string;
  assigneeId: string;
  status: string;
  isComplex: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  progress: number;
  projectId: string | null; // Add projectId
  items: TaskItem[];
  comments: TaskComment[];
}

export interface TaskItem {
  id: string;
  name: string;
  type: "PID" | "Line" | "Equipment";
  completed: boolean;
}

// Mock data interfaces for development
export interface MockData {
  users: Record<UserRole, string[]>;
  projects: Project[];
  tasks: Task[];
}
