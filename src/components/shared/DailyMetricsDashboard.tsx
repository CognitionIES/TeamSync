import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  TrendingUp,
  CheckCircle,
  Settings,
  Zap,
  RefreshCw,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Custom date formatting function
const formatDate = (date) => {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateISO = (date) => {
  return date.toISOString().split("T")[0];
};

const DailyMetricsDashboard = ({
  users,
  onRefresh,
  isLoading: externalLoading,
}) => {
  const [metrics, setMetrics] = useState({
    daily: [],
    weekly: [],
    monthly: [],
  });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedUser, setSelectedUser] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

  // Fetch metrics from your existing API endpoint
  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("teamsync_token");
      if (!token) throw new Error("No authentication token found");

      const formattedDate = formatDateISO(selectedDate);

      // Use your existing /individual/all endpoint
      const response = await fetch(
        `${API_URL}/metrics/individual/all?date=${formattedDate}&userId=${selectedUser}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      setError(error.message);
      setMetrics({ daily: [], weekly: [], monthly: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [selectedDate, selectedUser]);

  // Process metrics for display using the same structure as your MetricsTable
  const processedMetrics = useMemo(() => {
    if (!metrics.daily || metrics.daily.length === 0) {
      return {
        "Redline PIDs": 0,
        "UPV Equipment": 0,
        "QC Equipment": 0,
        "UPV Lines": 0,
        "QC Lines": 0,
        "UPV Non-Inline": 0,
        "QC Non-Inline": 0,
        totalBlocks: 0,
      };
    }

    // Aggregate all users' metrics
    const aggregated = {
      "Redline PIDs": 0,
      "UPV Equipment": 0,
      "QC Equipment": 0,
      "UPV Lines": 0,
      "QC Lines": 0,
      "UPV Non-Inline": 0,
      "QC Non-Inline": 0,
      totalBlocks: 0,
    };

    metrics.daily.forEach((userMetric) => {
      if (userMetric.counts) {
        // PID Redline
        if (userMetric.counts.PID?.Redline) {
          aggregated["Redline PIDs"] += userMetric.counts.PID.Redline;
        }

        // Equipment
        if (userMetric.counts.Equipment) {
          aggregated["UPV Equipment"] += userMetric.counts.Equipment.UPV || 0;
          aggregated["QC Equipment"] += userMetric.counts.Equipment.QC || 0;
        }

        // Lines
        if (userMetric.counts.Line) {
          aggregated["UPV Lines"] += userMetric.counts.Line.UPV || 0;
          aggregated["QC Lines"] += userMetric.counts.Line.QC || 0;
        }

        // Non-Inline Instruments
        if (userMetric.counts.NonInlineInstrument) {
          aggregated["UPV Non-Inline"] +=
            userMetric.counts.NonInlineInstrument.UPV || 0;
          aggregated["QC Non-Inline"] +=
            userMetric.counts.NonInlineInstrument.QC || 0;
        }
      }

      aggregated.totalBlocks += userMetric.totalBlocks || 0;
    });

    return aggregated;
  }, [metrics.daily]);

  // User-specific metrics for individual view
  const userSpecificMetrics = useMemo(() => {
    if (selectedUser === "all" || !metrics.daily) return [];

    return users.map((user) => {
      const userMetric = metrics.daily.find(
        (m) => m.userId === user.id.toString()
      );
      if (!userMetric) {
        return {
          userId: user.id.toString(),
          name: user.name,
          "Redline PIDs": 0,
          "UPV Equipment": 0,
          "QC Equipment": 0,
          "UPV Lines": 0,
          "QC Lines": 0,
          "UPV Non-Inline": 0,
          "QC Non-Inline": 0,
          totalBlocks: 0,
        };
      }

      return {
        userId: user.id.toString(),
        name: user.name,
        "Redline PIDs": userMetric.counts?.PID?.Redline || 0,
        "UPV Equipment": userMetric.counts?.Equipment?.UPV || 0,
        "QC Equipment": userMetric.counts?.Equipment?.QC || 0,
        "UPV Lines": userMetric.counts?.Line?.UPV || 0,
        "QC Lines": userMetric.counts?.Line?.QC || 0,
        "UPV Non-Inline": userMetric.counts?.NonInlineInstrument?.UPV || 0,
        "QC Non-Inline": userMetric.counts?.NonInlineInstrument?.QC || 0,
        totalBlocks: userMetric.totalBlocks || 0,
      };
    });
  }, [metrics.daily, users, selectedUser]);

  const getMetricIcon = (metricName) => {
    if (metricName.includes("Redline"))
      return <Settings className="w-5 h-5 text-red-500" />;
    if (metricName.includes("UPV"))
      return <Zap className="w-5 h-5 text-blue-500" />;
    if (metricName.includes("QC"))
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    return <TrendingUp className="w-5 h-5 text-gray-500" />;
  };

  const getMetricColor = (metricName) => {
    if (metricName.includes("Redline"))
      return "bg-red-50 border-red-200 hover:bg-red-100";
    if (metricName.includes("UPV"))
      return "bg-blue-50 border-blue-200 hover:bg-blue-100";
    if (metricName.includes("QC"))
      return "bg-green-50 border-green-200 hover:bg-green-100";
    return "bg-gray-50 border-gray-200 hover:bg-gray-100";
  };

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    fetchMetrics();
  };

  const isCurrentlyLoading = loading || externalLoading;

  if (error) {
    return (
      <Card className="shadow-md border-red-200">
        <CardHeader className="bg-red-50">
          <CardTitle className="text-red-800">Error Loading Metrics</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Daily Metrics Dashboard
          </h2>
          <p className="text-gray-600">
            Track daily progress across all item types and task types
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isCurrentlyLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isCurrentlyLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">Date:</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {formatDate(selectedDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              <label className="text-sm font-medium text-gray-700">User:</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      {isCurrentlyLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(7)].map((_, index) => (
            <Card key={index} className="shadow-md animate-pulse">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-5 w-5 bg-gray-200 rounded"></div>
                  <div className="h-8 w-12 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Object.entries(processedMetrics)
            .filter(([key]) => key !== "totalBlocks")
            .map(([metricName, count]) => (
              <Card
                key={metricName}
                className={`rounded-lg border-2 transition-all duration-200 hover:shadow-md ${getMetricColor(
                  metricName
                )}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    {getMetricIcon(metricName)}
                    <span className="text-3xl font-bold text-gray-900">
                      {count}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-800 text-sm mb-1">
                    {metricName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {metricName.includes("Redline") &&
                      "Items marked for revision"}
                    {metricName.includes("UPV") &&
                      "Items under project validation"}
                    {metricName.includes("QC") && "Items in quality control"}
                  </p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Summary Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-xl text-gray-900">Daily Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Object.entries(processedMetrics)
                  .filter(([key]) => key !== "totalBlocks")
                  .reduce((sum, [_, count]) => sum + count, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {(processedMetrics["QC Lines"] || 0) +
                  (processedMetrics["QC Equipment"] || 0) +
                  (processedMetrics["QC Non-Inline"] || 0)}
              </div>
              <div className="text-sm text-gray-600">QC Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {(processedMetrics["UPV Lines"] || 0) +
                  (processedMetrics["UPV Equipment"] || 0) +
                  (processedMetrics["UPV Non-Inline"] || 0)}
              </div>
              <div className="text-sm text-gray-600">UPV Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {processedMetrics["Redline PIDs"] || 0}
              </div>
              <div className="text-sm text-gray-600">Redline Items</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual User Metrics (when "All Users" is selected) */}
      {selectedUser === "all" && userSpecificMetrics.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Individual User Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Redline PIDs
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      UPV Equip
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      QC Equip
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      UPV Lines
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      QC Lines
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      UPV Non-Inline
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      QC Non-Inline
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Blocks
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userSpecificMetrics.map((user) => (
                    <tr key={user.userId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {user["Redline PIDs"]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {user["UPV Equipment"]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {user["QC Equipment"]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {user["UPV Lines"]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {user["QC Lines"]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {user["UPV Non-Inline"]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {user["QC Non-Inline"]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center font-medium">
                        {user.totalBlocks}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyMetricsDashboard;
