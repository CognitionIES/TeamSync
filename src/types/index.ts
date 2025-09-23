/* eslint-disable @typescript-eslint/no-explicit-any */
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
export type TaskStatus = "Assigned" | "In Progress" | "Completed";

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  comment: string;
  createdAt: string;
}

// @/types.ts
export enum TaskType {
  UPV = "UPV",
  QC = "QC",
  Redline = "Redline",
  Misc = "Misc",
}

export enum ItemType {
  PID = "PID",
  Line = "Line",
  Equipment = "Equipment",
  NonInlineInstrument = "NonInlineInstrument",
}

export interface Task {
  lines: any;
  id: string;
  type: TaskType; // Use enum
  assignee: string;
  assigneeId: string;
  status: TaskStatus;
  isComplex: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  progress: number;
  items: Array<{
    item_id: string;
    blocks: number;
    id: string;
    name: string;
    type: ItemType; // Use enum
    completed: boolean;
  }>;
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    userRole: UserRole;
    comment: string;
    createdAt: string;
  }>;
  projectId: string;
  pidNumber: string;
  projectName: string;
  areaNumber: string;
  description: string;
}
export interface TaskItem {
  blocks: any;
  id: string;
  name: string;
  type: "PID" | "Line" | "Equipment" | "NonInlineInstrument";
  completed: boolean;
  completedAt?: string | null;
}
// Mock data interfaces for development
export interface MockData {
  users: Record<UserRole, string[]>;
  projects: Project[];
  tasks: Task[];
}
