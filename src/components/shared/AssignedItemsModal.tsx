// In AssignedItemsModal.tsx, add PID-based support

import { useState, useEffect } from "react";
import Modal from "react-modal";
import { Button } from "@/components/ui/button";
import { getRandomMessage } from "@/components/shared/messages";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

interface PIDWorkItem {
  id: string;
  pid_id: string;
  pid_number: string;
  line_id?: string;
  line_number?: string;
  equipment_id?: string;
  equipment_number?: string;
  status: string;
  completed_at?: string;
  remarks?: string;
  blocks: number;
  project_id: string;
  project_name: string;
  area_number: string;
}

interface AssignedItems {
  isPIDBased?: boolean;
  pidWorkItems?: PIDWorkItem[];
  upvLines: {
    count: number;
    items: {
      area_number: string;
      id: string;
      line_number: string;
      project_id: string;
      project_name: string;
    }[];
  };
  qcLines: {
    count: number;
    items: {
      area_number: string;
      id: string;
      line_number: string;
      project_id: string;
      project_name: string;
    }[];
  };
  redlinePIDs: {
    count: number;
    items: {
      area_number: string;
      id: string;
      pid_number: string;
      project_id: string;
      project_name: string;
    }[];
  };
  upvEquipment: {
    count: number;
    items: {
      area_number: string;
      id: string;
      equipment_name: string;
      project_id: string;
      project_name: string;
    }[];
  };
  qcEquipment: {
    count: number;
    items: {
      area_number: string;
      id: string;
      equipment_name: string;
      project_id: string;
      project_name: string;
    }[];
  };
}

interface BlockCountData {
  blocks: number;
  completed: boolean;
  completed_by_name: string | null;
  completed_at: string | null;
}

interface AssignedItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignedItems: AssignedItems | null;
  loadingItems: boolean;
  userName: string;
  taskType: string;
  itemType: string;
  onUpdateItem: (itemId: string, completed: boolean, blocks: number) => void;
}

const AssignedItemsModal: React.FC<AssignedItemsModalProps> = ({
  isOpen,
  onClose,
  assignedItems,
  loadingItems,
  userName,
  taskType,
  itemType,
}) => {
  const [blockCounts, setBlockCounts] = useState<
    Record<string, BlockCountData>
  >({});
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem("teamsync_token");
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // Fetch block counts when modal opens
  useEffect(() => {
    const fetchBlockCounts = async () => {
      if (!isOpen || !assignedItems) return;

      setLoadingBlocks(true);
      const counts: Record<string, BlockCountData> = {};

      try {
        const fetchForItems = async (items: any[], itemType: string) => {
          for (const item of items) {
            try {
              const response = await axios.get(
                `${API_URL}/block-counts/${itemType}/${item.id}`,
                getAuthHeaders()
              );
              counts[item.id] = response.data.data;
            } catch (error) {
              console.error(
                `Error fetching block count for ${itemType} ${item.id}:`,
                error
              );
              counts[item.id] = {
                blocks: 0,
                completed: false,
                completed_by_name: null,
                completed_at: null,
              };
            }
          }
        };

        await Promise.all([
          fetchForItems(assignedItems.upvLines.items, "Line"),
          fetchForItems(assignedItems.qcLines.items, "Line"),
          fetchForItems(assignedItems.redlinePIDs.items, "PID"),
          fetchForItems(assignedItems.upvEquipment.items, "Equipment"),
          fetchForItems(assignedItems.qcEquipment.items, "Equipment"),
        ]);

        setBlockCounts(counts);
      } catch (error) {
        console.error("Error fetching block counts:", error);
      } finally {
        setLoadingBlocks(false);
      }
    };

    fetchBlockCounts();
  }, [isOpen, assignedItems]);

  //   Get project/area info from CORRECT source
  let projectName = "Unknown";
  let areaNumber = "N/A";

  if (assignedItems) {
    if (assignedItems.isPIDBased && assignedItems.pidWorkItems && assignedItems.pidWorkItems.length > 0) {
      // PID-based task
      projectName = assignedItems.pidWorkItems[0].project_name;
      areaNumber = assignedItems.pidWorkItems[0].area_number || "N/A";
    } else {
      // Legacy task
      projectName = assignedItems.upvLines.items.length > 0
        ? assignedItems.upvLines.items[0].project_name
        : assignedItems.qcLines.items.length > 0
        ? assignedItems.qcLines.items[0].project_name
        : assignedItems.redlinePIDs.items.length > 0
        ? assignedItems.redlinePIDs.items[0].project_name
        : assignedItems.upvEquipment.items.length > 0
        ? assignedItems.upvEquipment.items[0].project_name
        : assignedItems.qcEquipment.items.length > 0
        ? assignedItems.qcEquipment.items[0].project_name
        : "Unknown";

      areaNumber = taskType === "UPV" && assignedItems.upvLines.items.length > 0
        ? assignedItems.upvLines.items[0].area_number ?? "Not Assigned"
        : taskType === "QC" && assignedItems.qcLines.items.length > 0
        ? assignedItems.qcLines.items[0].area_number ?? "Not Assigned"
        : taskType === "Redline" && assignedItems.redlinePIDs.items.length > 0
        ? assignedItems.redlinePIDs.items[0].area_number ?? "Not Assigned"
        : taskType === "UPV" && assignedItems.upvEquipment.items.length > 0
        ? assignedItems.upvEquipment.items[0].area_number ?? "Not Assigned"
        : taskType === "QC" && assignedItems.qcEquipment.items.length > 0
        ? assignedItems.qcEquipment.items[0].area_number ?? "Not Assigned"
        : "Not Assigned";
    }
  }

  const renderItemWithBlockCount = (item: any, label: string) => {
    const blockData = blockCounts[item.id] || { blocks: 0, completed: false };

    return (
      <li
        key={item.id}
        className="text-sm text-gray-600 flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
      >
        <div className="flex-1">
          <span className="font-medium">{label}</span>
        </div>
        <span
          className={`text-sm px-3 py-1 rounded-full ${
            blockData.completed
              ? "bg-green-100 text-green-700 font-semibold"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {blockData.blocks} {blockData.blocks === 1 ? "block" : "blocks"}
        </span>
      </li>
    );
  };

  //   NEW: Render PID-based items
  const renderPIDBasedItems = () => {
    if (!assignedItems?.pidWorkItems || assignedItems.pidWorkItems.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">No PID-based items to display.</p>
        </div>
      );
    }

    // Group by PID
    const pidGroups = assignedItems.pidWorkItems.reduce((acc, item) => {
      if (!acc[item.pid_id]) {
        acc[item.pid_id] = {
          pidNumber: item.pid_number,
          items: [],
        };
      }
      acc[item.pid_id].items.push(item);
      return acc;
    }, {} as Record<string, { pidNumber: string; items: PIDWorkItem[] }>);

    return (
      <div className="space-y-4">
        {Object.entries(pidGroups).map(([pidId, group]) => (
          <div key={pidId} className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-purple-900 mb-3">
              📋 PID: {group.pidNumber}
            </h3>
            <div className="bg-purple-50 rounded-lg p-4">
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="text-sm text-gray-600 flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex-1">
                      <span className="font-medium">
                        {item.line_number
                          ? `Line: ${item.line_number}`
                          : `Equipment: ${item.equipment_number}`}
                      </span>
                    </div>
                    <span
                      className={`text-sm px-3 py-1 rounded-full ${
                        item.status === "Completed" || item.status === "Skipped"
                          ? "bg-green-100 text-green-700 font-semibold"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {item.blocks} {item.blocks === 1 ? "block" : "blocks"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      style={{
        content: {
          top: "50%",
          left: "50%",
          right: "auto",
          bottom: "auto",
          marginRight: "-50%",
          transform: "translate(-50%, -50%)",
          width: "90%",
          maxWidth: "700px",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "24px",
          borderRadius: "12px",
          backgroundColor: "#fff",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
        },
        overlay: {
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          zIndex: 1000,
        },
      }}
      contentLabel="Assigned Items Modal"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Assigned Items {userName ? `for ${userName}` : ""}
          </h2>
          <p className="text-base font-semibold text-red-800 mt-1">
            Project: {projectName}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Area No.: {areaNumber}
          </p>
          {assignedItems?.isPIDBased && (
            <p className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full inline-block mt-2">
              📋 PID-Based Assignment
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 focus:outline-none transition-colors duration-200"
          aria-label="Close modal"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

  {loadingItems ? (
    <div className="text-center py-8">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
      <p className="mt-2 text-gray-600">{getRandomMessage("loading")}</p>
    </div>
  ) : assignedItems ? (
    <div className="space-y-6">
      {loadingBlocks && (
        <div className="text-center py-2">
          <span className="text-sm text-gray-500">
            Loading block counts...
          </span>
        </div>
      )}

    {/* Debug info */}
    {/* {process.env.NODE_ENV === 'development' && (
      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs">
        <p><strong>Debug Info:</strong></p>
        <p>isPIDBased: {String(assignedItems.isPIDBased)}</p>
        <p>pidWorkItems count: {assignedItems.pidWorkItems?.length || 0}</p>
        <p>taskType: {taskType}</p>
        <p>itemType: {itemType}</p>
        <p>upvLines count: {assignedItems.upvLines?.count || 0}</p>
        <p>qcLines count: {assignedItems.qcLines?.count || 0}</p>
        <p>redlinePIDs count: {assignedItems.redlinePIDs?.count || 0}</p>
        <p>upvEquipment count: {assignedItems.upvEquipment?.count || 0}</p>
        <p>qcEquipment count: {assignedItems.qcEquipment?.count || 0}</p>
      </div>
    )} */}

    {/*   PID-based rendering */}
      {assignedItems.isPIDBased === true ? (
        <>
          {assignedItems.pidWorkItems && assignedItems.pidWorkItems.length > 0 ? (
            renderPIDBasedItems()
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No PID-based work items found for this task.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Legacy task rendering */}
          {taskType === "UPV" &&
            itemType === "Line" &&
            assignedItems.upvLines &&
            assignedItems.upvLines.count > 0 && (
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  UPV Lines ({assignedItems.upvLines.count})
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <ul className="space-y-1">
                    {assignedItems.upvLines.items.map((line) =>
                      renderItemWithBlockCount(
                        line,
                        `Line: ${line.line_number}`
                      )
                    )}
                  </ul>
                </div>
              </div>
            )}
  
          {taskType === "QC" &&
            itemType === "Line" &&
            assignedItems.qcLines &&
            assignedItems.qcLines.count > 0 && (
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  QC Lines ({assignedItems.qcLines.count})
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <ul className="space-y-1">
                    {assignedItems.qcLines.items.map((line) =>
                      renderItemWithBlockCount(
                        line,
                        `Line: ${line.line_number}`
                      )
                    )}
                  </ul>
                </div>
              </div>
            )}
  
          {taskType === "Redline" &&
            itemType === "PID" &&
            assignedItems.redlinePIDs &&
            assignedItems.redlinePIDs.count > 0 && (
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  Redline P&IDs ({assignedItems.redlinePIDs.count})
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <ul className="space-y-1">
                    {assignedItems.redlinePIDs.items.map((pid) =>
                      renderItemWithBlockCount(pid, `P&ID: ${pid.pid_number}`)
                    )}
                  </ul>
                </div>
              </div>
            )}
  
          {taskType === "UPV" &&
            itemType === "Equipment" &&
            assignedItems.upvEquipment &&
            assignedItems.upvEquipment.count > 0 && (
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  UPV Equipment ({assignedItems.upvEquipment.count})
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <ul className="space-y-1">
                    {assignedItems.upvEquipment.items.map((equip) =>
                      renderItemWithBlockCount(
                        equip,
                        `Equipment: ${equip.equipment_name}`
                      )
                    )}
                  </ul>
                </div>
              </div>
            )}
  
          {taskType === "QC" &&
            itemType === "Equipment" &&
            assignedItems.qcEquipment &&
            assignedItems.qcEquipment.count > 0 && (
              <div className="pb-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">
                  QC Equipment ({assignedItems.qcEquipment.count})
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <ul className="space-y-1">
                    {assignedItems.qcEquipment.items.map((equip) =>
                      renderItemWithBlockCount(
                        equip,
                        `Equipment: ${equip.equipment_name}`
                      )
                    )}
                  </ul>
                </div>
              </div>
            )}
  
          {/* No items fallback for legacy tasks */}
          {!assignedItems.isPIDBased &&
          !(
            (taskType === "UPV" &&
              itemType === "Line" &&
              assignedItems.upvLines &&
              assignedItems.upvLines.count > 0) ||
            (taskType === "QC" &&
              itemType === "Line" &&
              assignedItems.qcLines &&
              assignedItems.qcLines.count > 0) ||
            (taskType === "Redline" &&
              itemType === "PID" &&
              assignedItems.redlinePIDs &&
              assignedItems.redlinePIDs.count > 0) ||
            (taskType === "UPV" &&
              itemType === "Equipment" &&
              assignedItems.upvEquipment &&
              assignedItems.upvEquipment.count > 0) ||
            (taskType === "QC" &&
              itemType === "Equipment" &&
              assignedItems.qcEquipment &&
              assignedItems.qcEquipment.count > 0)
          ) && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No items to display for the selected task type and item type.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Task Type: {taskType || "Unknown"}, Item Type: {itemType || "Unknown"}
              </p>
            </div>
                )}
            </>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-red-600 font-medium">
            {getRandomMessage("error")}
          </p>
          <p className="text-gray-500 mt-2">
            Please try again or contact support if the issue persists.
          </p>
        </div>
      )}
      {!loadingItems && (
        <div className="mt-6 flex justify-end">
          <Button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors duration-200"
          >
            Close
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default AssignedItemsModal;