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

interface Metric {
  userId: string;
  date?: string;
  week_start?: string;
  month_start?: string;
  counts: { [key: string]: { [key: string]: number } | number };
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

      const aggregated = {
        userId: userIdString,
        name: user.name,
        "Redline PIDs": 0,
        "UPV Equipment": 0,
        "QC Equipment": 0,
        "UPV Lines": 0,
        "QC Lines": 0,
        "UPV Non-Inline": 0,
        "QC Non-Inline": 0,
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
              const count = itemCounts[col.taskType];
              if (typeof count === "number") {
                aggregated[col.key] += count;
                console.log(`Added ${count} to ${col.key} for ${user.name}`);
              } else {
                console.warn(
                  `Invalid count for ${col.key} in ${user.name}:`,
                  count
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
    return columns.reduce((acc, col) => {
      acc[col.key] = aggregatedMetrics.reduce(
        (sum, row) => sum + (row[col.key] || 0),
        0
      );
      return acc;
    }, {} as { [key: string]: number });
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
            <TableHead key={col.key}>{col.key}</TableHead>
          ))}
          <TableHead>Total Blocks</TableHead>
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
            {aggregatedMetrics.map((row) => (
              <TableRow key={`${row.userId}-${period}`}>
                <TableCell className="font-medium">
                  {row.name || "Unknown"}
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.key} className="text-center">
                    {row[col.key] || 0}
                  </TableCell>
                ))}
                <TableCell className="text-center font-medium">
                  {row.totalBlocks}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <TableCell>
                <strong>Total</strong>
              </TableCell>
              {columns.map((col) => (
                <TableCell key={col.key} className="text-center">
                  <strong>{totals[col.key] || 0}</strong>
                </TableCell>
              ))}
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
