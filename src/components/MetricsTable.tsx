/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MessageSquare, Download } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface MetricCount {
  completed?: number;
  skipped?: number;
}

interface Metric {
  userId: string;
  date?: string;
  week_start?: string;
  month_start?: string;
  counts: {
    [itemType: string]:
      | {
          [taskType: string]: number | MetricCount;
        }
      | number;
  };
  totalBlocks: number;
  areaNo?: string;
  areaName?: string;
  comments?: string;
}

interface BlockTotals {
  [userId: string]: { daily: number; weekly: number; monthly: number };
}

interface User {
  id: number;
  name: string;
}

interface MetricsTableProps {
  period: "daily" | "weekly" | "monthly";
  metrics: Metric[];
  blockTotals: BlockTotals;
  users: User[];
  selectedDate?: Date; // Optional now
}

const CommentsCell: React.FC<{ comments?: string; userName: string }> = ({
  comments,
  userName,
}) => {
  const [showFull, setShowFull] = useState(false);

  if (!comments || comments.trim() === "") {
    return <span className="text-gray-400 italic text-xs">No comments</span>;
  }

  const isLong = comments.length > 100;
  const displayText =
    showFull || !isLong ? comments : `${comments.substring(0, 100)}...`;

  return (
    <div className="max-w-xs">
      <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">
        {displayText}
      </p>
      {isLong && (
        <button
          onClick={() => setShowFull(!showFull)}
          className="text-blue-600 hover:text-blue-800 text-xs mt-1 underline flex items-center gap-1"
        >
          <MessageSquare size={12} />
          {showFull ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
};

export const MetricsTable: React.FC<MetricsTableProps> = ({
  period,
  metrics,
  blockTotals,
  users,
  selectedDate,
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const columns = [
    { key: "Redline PIDs", itemType: "PID", taskType: "Redline" },
    { key: "UPV Equipment", itemType: "Equipment", taskType: "UPV" },
    { key: "QC Equipment", itemType: "Equipment", taskType: "QC" },
    { key: "UPV Lines", itemType: "Line", taskType: "UPV" },
    { key: "QC Lines", itemType: "Line", taskType: "QC" },
    { key: "UPV Non-Inline", itemType: "NonInlineInstrument", taskType: "UPV" },
    { key: "QC Non-Inline", itemType: "NonInlineInstrument", taskType: "QC" },
  ];

  const aggregatedMetrics = useMemo(() => {
    console.log("Raw metrics data:", JSON.stringify(metrics, null, 2));
    console.log("Users data:", users);
    console.log("Block totals:", blockTotals);

    return users.map((user) => {
      const userIdString = user.id.toString();
      const userMetrics = metrics.filter((m) => m.userId === userIdString);

      const aggregated: {
        userId: string;
        name: string;
        areaName?: string;
        comments?: string;
        [key: string]:
          | string
          | number
          | { completed: number; skipped: number }
          | undefined;
        blocks: number;
        totalBlocks: number;
      } = {
        userId: userIdString,
        name: user.name,
        areaName: undefined,
        comments: undefined,
        "Redline PIDs": { completed: 0, skipped: 0 },
        "UPV Equipment": { completed: 0, skipped: 0 },
        "QC Equipment": { completed: 0, skipped: 0 },
        "UPV Lines": { completed: 0, skipped: 0 },
        "QC Lines": { completed: 0, skipped: 0 },
        "UPV Non-Inline": { completed: 0, skipped: 0 },
        "QC Non-Inline": { completed: 0, skipped: 0 },
        blocks: 0,
        totalBlocks: 0,
      };

      let allComments: string[] = [];

      userMetrics.forEach((metric) => {
        console.log(
          `Processing metric for ${user.name}:`,
          JSON.stringify(metric, null, 2),
        );

        // Capture area name from the first metric that has it
        if (!aggregated.areaName && metric.areaName) {
          aggregated.areaName = metric.areaName;
        }

        // Collect comments
        if (metric.comments && metric.comments.trim() !== "") {
          allComments.push(metric.comments);
        }

        if (metric.counts && typeof metric.counts === "object") {
          columns.forEach((col) => {
            const itemCounts = metric.counts[col.itemType];
            if (
              itemCounts &&
              typeof itemCounts === "object" &&
              col.taskType in itemCounts
            ) {
              const countData = itemCounts[col.taskType];

              if (typeof countData === "number") {
                const currentVal = aggregated[col.key] as {
                  completed: number;
                  skipped: number;
                };
                currentVal.completed += countData;
                console.log(
                  `Added ${countData} to ${col.key} (completed) for ${user.name}`,
                );
              } else if (typeof countData === "object" && countData !== null) {
                const currentVal = aggregated[col.key] as {
                  completed: number;
                  skipped: number;
                };
                currentVal.completed +=
                  (countData as MetricCount).completed || 0;
                currentVal.skipped += (countData as MetricCount).skipped || 0;
                console.log(
                  `Added ${(countData as MetricCount).completed || 0} completed, ${(countData as MetricCount).skipped || 0} skipped to ${col.key} for ${user.name}`,
                );
              } else {
                console.warn(
                  `Invalid count for ${col.key} in ${user.name}:`,
                  countData,
                );
              }
            } else {
              console.log(
                `No valid count for ${col.key} in ${user.name}, itemCounts:`,
                itemCounts,
              );
            }
          });
          aggregated.blocks += metric.totalBlocks || 0;
        } else {
          console.warn(
            `Invalid counts structure for ${user.name}:`,
            metric.counts,
          );
        }
      });

      aggregated.comments =
        allComments.length > 0 ? allComments.join(" | ") : undefined;

      aggregated.totalBlocks =
        blockTotals[userIdString]?.[period] || aggregated.blocks;
      console.log(`Aggregated result for ${user.name}:`, aggregated);
      return aggregated;
    });
  }, [metrics, blockTotals, users, period]);

  const totals = useMemo(() => {
    const result: { [key: string]: { completed: number; skipped: number } } =
      {};

    columns.forEach((col) => {
      result[col.key] = aggregatedMetrics.reduce(
        (acc, row) => {
          const rowData = row[col.key];
          if (
            typeof rowData === "object" &&
            rowData !== null &&
            "completed" in rowData
          ) {
            acc.completed += rowData.completed || 0;
            acc.skipped += rowData.skipped || 0;
          }
          return acc;
        },
        { completed: 0, skipped: 0 },
      );
    });

    return result;
  }, [aggregatedMetrics, columns]);

  const totalBlocks = aggregatedMetrics.reduce(
    (sum, row) => sum + row.totalBlocks,
    0,
  );

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      const token = localStorage.getItem("teamsync_token");

      if (!token) {
        throw new Error("No authentication token found");
      }

      // FIX: Use current date if selectedDate is not provided
      const exportDate = selectedDate || new Date();
      const formattedDate = exportDate.toISOString().split("T")[0];

      console.log("Exporting with date:", formattedDate);

      // Fetch detailed work items data
      const response = await fetch(
        `${API_URL}/metrics/detailed-export?date=${formattedDate}&period=${period}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch detailed metrics data");
      }

      const detailedData = await response.json();

      console.log("Detailed data received:", detailedData);

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Prepare data for Excel
      const excelData = aggregatedMetrics.map((row) => {
        const rowData = row as {
          userId: string;
          name: string;
          areaName?: string;
          comments?: string;
          [key: string]:
            | string
            | number
            | { completed: number; skipped: number }
            | undefined;
          totalBlocks: number;
        };

        const userData = detailedData.data?.find(
          (d: any) => d.userId === rowData.userId,
        );

        return {
          Name: rowData.name || "Unknown",
          Area: rowData.areaName || "N/A",

          "Redline PIDs - Completed":
            typeof rowData["Redline PIDs"] === "object" &&
            rowData["Redline PIDs"] !== null &&
            "completed" in rowData["Redline PIDs"]
              ? rowData["Redline PIDs"].completed
              : 0,
          "Redline PIDs - Skipped":
            typeof rowData["Redline PIDs"] === "object" &&
            rowData["Redline PIDs"] !== null &&
            "skipped" in rowData["Redline PIDs"]
              ? rowData["Redline PIDs"].skipped
              : 0,
          "PIDs Worked On": userData?.pidNumbers?.join(", ") || "None",

          "UPV Equipment - Completed":
            typeof rowData["UPV Equipment"] === "object" &&
            rowData["UPV Equipment"] !== null &&
            "completed" in rowData["UPV Equipment"]
              ? rowData["UPV Equipment"].completed
              : 0,
          "UPV Equipment - Skipped":
            typeof rowData["UPV Equipment"] === "object" &&
            rowData["UPV Equipment"] !== null &&
            "skipped" in rowData["UPV Equipment"]
              ? rowData["UPV Equipment"].skipped
              : 0,

          "QC Equipment - Completed":
            typeof rowData["QC Equipment"] === "object" &&
            rowData["QC Equipment"] !== null &&
            "completed" in rowData["QC Equipment"]
              ? rowData["QC Equipment"].completed
              : 0,
          "QC Equipment - Skipped":
            typeof rowData["QC Equipment"] === "object" &&
            rowData["QC Equipment"] !== null &&
            "skipped" in rowData["QC Equipment"]
              ? rowData["QC Equipment"].skipped
              : 0,
          "Equipment Worked On":
            userData?.equipmentNumbers?.join(", ") || "None",

          "UPV Lines - Completed":
            typeof rowData["UPV Lines"] === "object" &&
            rowData["UPV Lines"] !== null &&
            "completed" in rowData["UPV Lines"]
              ? rowData["UPV Lines"].completed
              : 0,
          "UPV Lines - Skipped":
            typeof rowData["UPV Lines"] === "object" &&
            rowData["UPV Lines"] !== null &&
            "skipped" in rowData["UPV Lines"]
              ? rowData["UPV Lines"].skipped
              : 0,

          "QC Lines - Completed":
            typeof rowData["QC Lines"] === "object" &&
            rowData["QC Lines"] !== null &&
            "completed" in rowData["QC Lines"]
              ? rowData["QC Lines"].completed
              : 0,
          "QC Lines - Skipped":
            typeof rowData["QC Lines"] === "object" &&
            rowData["QC Lines"] !== null &&
            "skipped" in rowData["QC Lines"]
              ? rowData["QC Lines"].skipped
              : 0,
          "Lines Worked On": userData?.lineNumbers?.join(", ") || "None",

          "UPV Non-Inline - Completed":
            typeof rowData["UPV Non-Inline"] === "object" &&
            rowData["UPV Non-Inline"] !== null &&
            "completed" in rowData["UPV Non-Inline"]
              ? rowData["UPV Non-Inline"].completed
              : 0,
          "UPV Non-Inline - Skipped":
            typeof rowData["UPV Non-Inline"] === "object" &&
            rowData["UPV Non-Inline"] !== null &&
            "skipped" in rowData["UPV Non-Inline"]
              ? rowData["UPV Non-Inline"].skipped
              : 0,

          "QC Non-Inline - Completed":
            typeof rowData["QC Non-Inline"] === "object" &&
            rowData["QC Non-Inline"] !== null &&
            "completed" in rowData["QC Non-Inline"]
              ? rowData["QC Non-Inline"].completed
              : 0,
          "QC Non-Inline - Skipped":
            typeof rowData["QC Non-Inline"] === "object" &&
            rowData["QC Non-Inline"] !== null &&
            "skipped" in rowData["QC Non-Inline"]
              ? rowData["QC Non-Inline"].skipped
              : 0,

          "Total Blocks": rowData.totalBlocks,
          Comments: rowData.comments || "No comments",
        };
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 20 }, // Name
        { wch: 15 }, // Area
        { wch: 15 }, // Redline PIDs - Completed
        { wch: 15 }, // Redline PIDs - Skipped
        { wch: 30 }, // PIDs Worked On
        { wch: 15 }, // UPV Equipment - Completed
        { wch: 15 }, // UPV Equipment - Skipped
        { wch: 15 }, // QC Equipment - Completed
        { wch: 15 }, // QC Equipment - Skipped
        { wch: 30 }, // Equipment Worked On
        { wch: 15 }, // UPV Lines - Completed
        { wch: 15 }, // UPV Lines - Skipped
        { wch: 15 }, // QC Lines - Completed
        { wch: 15 }, // QC Lines - Skipped
        { wch: 30 }, // Lines Worked On
        { wch: 15 }, // UPV Non-Inline - Completed
        { wch: 15 }, // UPV Non-Inline - Skipped
        { wch: 15 }, // QC Non-Inline - Completed
        { wch: 15 }, // QC Non-Inline - Skipped
        { wch: 12 }, // Total Blocks
        { wch: 40 }, // Comments
      ];
      ws["!cols"] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, `Metrics_${period}`);

      // Generate filename
      const filename = `Metrics_${period}_${formattedDate}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);

      toast.success("Excel file exported successfully!");
    } catch (error: any) {
      console.error("Error exporting to Excel:", error);
      toast.error(`Failed to export: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={handleExportToExcel}
          disabled={isExporting || aggregatedMetrics.length === 0}
          className="flex items-center gap-2"
          variant="outline"
        >
          <Download size={16} />
          {isExporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[120px]">Name</TableHead>
              <TableHead className="min-w-[120px]">Area</TableHead>
              {columns.map((col) => (
                <TableHead key={col.key} className="text-center min-w-[100px]">
                  <div>{col.key}</div>
                  <div className="text-xs font-normal text-gray-500 mt-1">
                    Completed / Skipped
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center min-w-[100px]">
                Total Blocks
              </TableHead>
              <TableHead className="min-w-[200px]">Comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 4}
                  className="text-center text-gray-500"
                >
                  No users data available
                </TableCell>
              </TableRow>
            ) : aggregatedMetrics.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 4}
                  className="text-center text-gray-500"
                >
                  No metrics data available for the selected period
                </TableCell>
              </TableRow>
            ) : (
              <>
                {aggregatedMetrics.map((row) => {
                  const rowData = row as {
                    userId: string;
                    name: string;
                    areaName?: string;
                    comments?: string;
                    [key: string]:
                      | string
                      | number
                      | { completed: number; skipped: number }
                      | undefined;
                    totalBlocks: number;
                  };

                  return (
                    <TableRow
                      key={`${rowData.userId}-${period}`}
                      className="hover:bg-gray-50"
                    >
                      <TableCell className="font-medium">
                        {rowData.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {rowData.areaName || (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </TableCell>
                      {columns.map((col) => {
                        const cellData = rowData[col.key];
                        const completed =
                          typeof cellData === "object" &&
                          cellData !== null &&
                          "completed" in cellData
                            ? cellData.completed
                            : 0;
                        const skipped =
                          typeof cellData === "object" &&
                          cellData !== null &&
                          "skipped" in cellData
                            ? cellData.skipped
                            : 0;

                        return (
                          <TableCell key={col.key} className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="font-medium text-green-600">
                                {completed}
                              </span>
                              {skipped > 0 && (
                                <span className="text-xs text-gray-500">
                                  ({skipped} skipped)
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-medium">
                        {rowData.totalBlocks}
                      </TableCell>
                      <TableCell>
                        <CommentsCell
                          comments={rowData.comments}
                          userName={rowData.name}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <TableCell>
                    <strong>Total</strong>
                  </TableCell>
                  <TableCell className="text-gray-400 text-xs">
                    All Areas
                  </TableCell>
                  {columns.map((col) => {
                    const colTotal = totals[col.key];
                    return (
                      <TableCell key={col.key} className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <strong className="text-green-600">
                            {colTotal.completed || 0}
                          </strong>
                          {colTotal.skipped > 0 && (
                            <span className="text-xs text-gray-500 font-normal">
                              ({colTotal.skipped} skipped)
                            </span>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    <strong>{totalBlocks}</strong>
                  </TableCell>
                  <TableCell className="text-gray-400 text-xs">-</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
