/* eslint-disable react-hooks/exhaustive-deps */
import React, { useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    [itemType: string]: {
      [taskType: string]: number | MetricCount
    } | number
  };
  totalBlocks: number;
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
}

export const MetricsTable: React.FC<MetricsTableProps> = ({
  period,
  metrics,
  blockTotals,
  users,
}) => {
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
      const userMetrics = metrics.filter(
        (m) => m.userId === userIdString
      );

      const aggregated: {
        userId: string;
        name: string;
        [key: string]: string | number | { completed: number; skipped: number };
        blocks: number;
        totalBlocks: number;
      } = {
        userId: userIdString,
        name: user.name,
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

      userMetrics.forEach((metric) => {
        console.log(
          `Processing metric for ${user.name}:`,
          JSON.stringify(metric, null, 2)
        );
        if (metric.counts && typeof metric.counts === "object") {
          columns.forEach((col) => {
            const itemCounts = metric.counts[col.itemType];
            if (
              itemCounts &&
              typeof itemCounts === "object" &&
              col.taskType in itemCounts
            ) {
              const countData = itemCounts[col.taskType];

              // Handle both old format (number) and new format (object with completed/skipped)
              if (typeof countData === "number") {
                const currentVal = aggregated[col.key] as { completed: number; skipped: number };
                currentVal.completed += countData;
                console.log(`Added ${countData} to ${col.key} (completed) for ${user.name}`);
              } else if (typeof countData === "object" && countData !== null) {
                const currentVal = aggregated[col.key] as { completed: number; skipped: number };
                currentVal.completed += (countData as MetricCount).completed || 0;
                currentVal.skipped += (countData as MetricCount).skipped || 0;
                console.log(
                  `Added ${(countData as MetricCount).completed || 0} completed, ${(countData as MetricCount).skipped || 0} skipped to ${col.key} for ${user.name}`
                );
              } else {
                console.warn(
                  `Invalid count for ${col.key} in ${user.name}:`,
                  countData
                );
              }
            } else {
              console.log(
                `No valid count for ${col.key} in ${user.name}, itemCounts:`,
                itemCounts
              );
            }
          });
          aggregated.blocks += metric.totalBlocks || 0;
        } else {
          console.warn(
            `Invalid counts structure for ${user.name}:`,
            metric.counts
          );
        }
      });

      aggregated.totalBlocks =
        blockTotals[userIdString]?.[period] || aggregated.blocks;
      console.log(`Aggregated result for ${user.name}:`, aggregated);
      return aggregated;
    });
  }, [metrics, blockTotals, users, period]);

  const totals = useMemo(() => {
    const result: { [key: string]: { completed: number; skipped: number } } = {};

    columns.forEach((col) => {
      result[col.key] = aggregatedMetrics.reduce(
        (acc, row) => {
          const rowData = row[col.key];
          if (typeof rowData === "object" && rowData !== null && "completed" in rowData) {
            acc.completed += rowData.completed || 0;
            acc.skipped += rowData.skipped || 0;
          }
          return acc;
        },
        { completed: 0, skipped: 0 }
      );
    });

    return result;
  }, [aggregatedMetrics, columns]);

  const totalBlocks = aggregatedMetrics.reduce(
    (sum, row) => sum + row.totalBlocks,
    0
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          {columns.map((col) => (
            <TableHead key={col.key} className="text-center">
              <div>{col.key}</div>
              <div className="text-xs font-normal text-gray-500 mt-1">
                Completed / Skipped
              </div>
            </TableHead>
          ))}
          <TableHead className="text-center">Total Blocks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length + 2}
              className="text-center text-gray-500"
            >
              No users data available
            </TableCell>
          </TableRow>
        ) : aggregatedMetrics.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length + 2}
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
                [key: string]: string | number | { completed: number; skipped: number };
                totalBlocks: number;
              };

              return (
                <TableRow key={`${rowData.userId}-${period}`}>
                  <TableCell className="font-medium">
                    {rowData.name || "Unknown"}
                  </TableCell>
                  {columns.map((col) => {
                    const cellData = rowData[col.key];
                    const completed = typeof cellData === "object" && cellData !== null && "completed" in cellData
                      ? cellData.completed
                      : 0;
                    const skipped = typeof cellData === "object" && cellData !== null && "skipped" in cellData
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
                </TableRow>
              );
            })}
            <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <TableCell>
                <strong>Total</strong>
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
            </TableRow>
          </>
        )}
      </TableBody>
    </Table>
  );
};
