import { PIDWorkItem } from "@/types";

export interface User {
    role: string;
    id: string;
    name: string;
}
export interface TeamMember {
    id: string;
    name: string;
}
export interface Project {
    id: string;
    name: string;
}
export interface PID {
    id: string;
    name: string;
}
export interface Line {
    id: string;
    name: string;
    pidId: string;
}
export interface Equipment {
    id: string;
    name: string;
    areaId: string;
}
export interface AssignedItems {
    upvLines: string[];
    upvEquipment: string[];
    qcLines: string[];
    qcEquipment: string[];
    redlinePIDs: string[];
}
export interface FetchedAssignedItems {
    isPIDBased?: boolean;
    pidWorkItems?: PIDWorkItem[];
    pids: any;
    lines: any;
    equipment: any;
    upvLines: {
        count: number;
        items: {
            id: string;
            line_number: string;
            project_id: string;
            project_name: string;
            area_number: string | null;
        }[];
    };
    qcLines: {
        count: number;
        items: {
            id: string;
            line_number: string;
            project_id: string;
            project_name: string;
            area_number: string | null;
        }[];
    };
    redlinePIDs: {
        count: number;
        items: {
            id: string;
            pid_number: string;
            project_id: string;
            project_name: string;
            area_number: string | null;
        }[];
    };
    upvEquipment: {
        count: number;
        items: {
            id: string;
            equipment_name: string;
            project_id: string;
            project_name: string;
            area_number: string | null;
        }[];
    };
    qcEquipment: {
        count: number;
        items: {
            id: string;
            equipment_name: string;
            project_id: string;
            project_name: string;
            area_number: string | null;
        }[];
    };
}
// Add these new interfaces to your existing types.ts

export interface DetailedWorkLogItem {
    areaNo: string;
    pid: string;
    lineNo: string;
    assignedTo: string;
    blockCount: number;
    completedAt: string; // Already formatted as locale string from backend
    comments: string;
    status: string;
    taskType: 'UPV' | 'Redline' | 'QC' | 'Rework';
    workItemId: number;
    auditLink: string;
}

export interface DetailedWorkLogResponse {
    data: DetailedWorkLogItem[];
    totalCount: number;
    filtersApplied: {
        taskType?: string;
        dateStart?: string;
        dateEnd?: string;
        projectId?: string;
        areaId?: string;
        userId?: string;
    };
}

export type TaskTypeFilter = 'All' | 'UPV' | 'Redline' | 'QC' | 'Rework';