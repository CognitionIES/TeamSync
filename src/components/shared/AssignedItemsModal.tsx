import Modal from "react-modal";
import { Button } from "@/components/ui/button";
import { getRandomMessage } from "@/components/shared/messages";

// Define the shape of assigned items
interface AssignedItems {
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

// Define props for the modal component
interface AssignedItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignedItems: AssignedItems | null;
  loadingItems: boolean;
  userName: string;
  taskType: string;
  itemType: string;
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
  // Extract project name from the first non-empty category
  const projectName = assignedItems
    ? assignedItems.upvLines.items.length > 0
      ? assignedItems.upvLines.items[0].project_name
      : assignedItems.qcLines.items.length > 0
      ? assignedItems.qcLines.items[0].project_name
      : assignedItems.redlinePIDs.items.length > 0
      ? assignedItems.redlinePIDs.items[0].project_name
      : assignedItems.upvEquipment.items.length > 0
      ? assignedItems.upvEquipment.items[0].project_name
      : assignedItems.qcEquipment.items.length > 0
      ? assignedItems.qcEquipment.items[0].project_name
      : "Unknown"
    : "Unknown";
  // Extract area number based on taskType
  const areaNumber = assignedItems
    ? taskType === "UPV" && assignedItems.upvLines.items.length > 0
      ? assignedItems.upvLines.items[0].area_number ?? "Not Assigned"
      : taskType === "QC" && assignedItems.qcLines.items.length > 0
      ? assignedItems.qcLines.items[0].area_number ?? "Not Assigned"
      : taskType === "Redline" && assignedItems.redlinePIDs.items.length > 0
      ? assignedItems.redlinePIDs.items[0].area_number ?? "Not Assigned"
      : taskType === "UPV" && assignedItems.upvEquipment.items.length > 0
      ? assignedItems.upvEquipment.items[0].area_number ?? "Not Assigned"
      : taskType === "QC" && assignedItems.qcEquipment.items.length > 0
      ? assignedItems.qcEquipment.items[0].area_number ?? "Not Assigned"
      : "Not Assigned"
    : "Not Assigned";

  console.log("Extracted areaNumber:", areaNumber); // Debug log
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
          maxWidth: "600px",
          maxHeight: "600px",
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
          <p className=" text-base font-semibold text-red-800 mt-1">
            Project: {projectName || "Still Searching..."}{" "}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Area No.: {areaNumber || "Still Searching..."}
          </p>{" "}
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
            xmlns="http://www.w3.org/2000/svg"
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
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-gray-600">{getRandomMessage("loading")}</p>
        </div>
      ) : assignedItems ? (
        <div className=" space-y-8">
          {taskType === "UPV" && itemType === "Line" && (
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                UPV Lines ({assignedItems.upvLines.count})
              </h3>
              {assignedItems.upvLines.count > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <ul className="space-y-2">
                    {assignedItems.upvLines.items.map((line) => (
                      <li
                        key={line.id}
                        className="text-sm text-gray-600 flex justify-between items-center"
                      >
                        <span>
                          <strong>Line:</strong> {line.line_number}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No UPV lines assigned.
                </p>
              )}
            </div>
          )}

          {taskType === "QC" && itemType === "Line" && (
            <div className="border-b  border-gray-200 pb-4">
              <h3 className="text-lg  font-semibold text-gray-700 mb-2">
                QC Lines ({assignedItems.qcLines.count})
              </h3>
              {assignedItems.qcLines.count > 0 ? (
                <div className="bg-gray-50  rounded-lg p-4 max-h-40 overflow-y-auto">
                  <ul className="space-y-2">
                    {assignedItems.qcLines.items.map((line) => (
                      <li
                        key={line.id}
                        className="text-sm text-gray-600 flex justify-between items-center"
                      >
                        <span>
                          <strong>Line:</strong> {line.line_number}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No QC lines assigned.
                </p>
              )}
            </div>
          )}

          {taskType === "Redline" && itemType === "PID" && (
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                Redline P&IDs ({assignedItems.redlinePIDs.count})
              </h3>
              {assignedItems.redlinePIDs.count > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <ul className="space-y-2">
                    {assignedItems.redlinePIDs.items.map((pid) => (
                      <li
                        key={pid.id}
                        className="text-sm text-gray-600 flex justify-between items-center"
                      >
                        <span>
                          <strong>P&ID:</strong> {pid.pid_number}
                        </span>
                        <span className="text-gray-500">
                          Project: {pid.project_name || "Unknown"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No Redline P&IDs assigned.
                </p>
              )}
            </div>
          )}

          {taskType === "UPV" && itemType === "Equipment" && (
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                UPV Equipment ({assignedItems.upvEquipment.count})
              </h3>
              {assignedItems.upvEquipment.count > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <ul className="space-y-2">
                    {assignedItems.upvEquipment.items.map((equip) => (
                      <li
                        key={equip.id}
                        className="text-sm text-gray-600 flex justify-between items-center"
                      >
                        <span>
                          <strong>Equipment:</strong> {equip.equipment_name}
                        </span>
                        <span className="text-gray-500">
                          Project: {equip.project_name || "Unknown"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No UPV equipment assigned.
                </p>
              )}
            </div>
          )}

          {taskType === "QC" && itemType === "Equipment" && (
            <div className="pb-4">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                QC Equipment ({assignedItems.qcEquipment.count})
              </h3>
              {assignedItems.qcEquipment.count > 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  <ul className="space-y-2">
                    {assignedItems.qcEquipment.items.map((equip) => (
                      <li
                        key={equip.id}
                        className="text-sm text-gray-600 flex justify-between items-center"
                      >
                        <span>
                          <strong>Equipment:</strong> {equip.equipment_name}
                        </span>
                        <span className="text-gray-500">
                          Project: {equip.project_name || "Unknown"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No QC equipment assigned.
                </p>
              )}
            </div>
          )}

          {!(
            (taskType === "UPV" && itemType === "Line") ||
            (taskType === "QC" && itemType === "Line") ||
            (taskType === "Redline" && itemType === "PID") ||
            (taskType === "UPV" && itemType === "Equipment") ||
            (taskType === "QC" && itemType === "Equipment")
          ) && (
            <div className="text-center py-4">
              <p className="text-gray-500">
                No items to display for the selected task type and item type.
              </p>
            </div>
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
