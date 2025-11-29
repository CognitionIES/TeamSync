require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDB } = require("./config/db");

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

let equipmentRoutes;
try {
  equipmentRoutes = require("./routes/equipment.routes");
} catch (error) {
  console.error("Failed to load equipment.routes.js:", error.message);
}

let metricsRoutes;
try {
  metricsRoutes = require("./routes/metrics.routes");
} catch (error) {
  console.error("Failed to load metrics.routes.js:", error.message);
}

let pidWorkRoutes;
try {
  pidWorkRoutes = require("./routes/pid-work.js");
} catch (error) {
  console.error("Failed to load pid-work.js:", error.message);
}

//   CRITICAL FIX: Mount PID work routes with correct paths
if (pidWorkRoutes) {
  // Mount for /api/tasks/pid-work-items/mark-complete
  app.use("/api/tasks/pid-work-items", pidWorkRoutes);

  // Mount for /api/tasks/assign-pid (this route is defined in pid-work.js)
  app.use("/api/tasks", pidWorkRoutes);

  console.log("  Mounted PID work routes:");
  console.log("   - /api/tasks/pid-work-items/mark-complete");
  console.log("   - /api/tasks/assign-pid");
} else {
  console.error("❌ PID work routes not mounted due to loading error");
}

// Routes (order matters - specific routes before general ones!)
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/projects", require("./routes/projects.routes"));
app.use("/api/tasks", require("./routes/tasks.routes"));
app.use("/api/users", require("./routes/users.routes"));
app.use("/api/teams", require("./routes/teams.routes"));
app.use("/api/audit-logs", require("./routes/auditLogs.routes"));
app.use("/api/areas", require("./routes/areas.routes"));
app.use("/api/pids", require("./routes/pids.routes"));
app.use("/api/lines", require("./routes/lines.routes"));
app.use("/api/project-stats", require("./routes/projectStats.routes"));
app.use("/api/task-status", require("./routes/taskStatus.routes"));
app.use("/api/block-counts", require("./routes/block-counts.routes"));
app.use(
  "/api/non-inline-instruments",
  require("./routes/non-inline-instruments.routes")
);

if (equipmentRoutes) {
  app.use("/api/equipment", equipmentRoutes);
  console.log("  Mounted /api/equipment route");
} else {
  console.error("❌ Equipment routes not mounted due to loading error");
}

if (metricsRoutes) {
  app.use("/api/metrics", metricsRoutes);
  console.log("  Mounted /api/metrics route");
} else {
  console.error("❌ Metrics routes not mounted due to loading error");
}

console.log("📋 Routes Status:", {
  equipment: !!equipmentRoutes,
  metrics: !!metricsRoutes,
  pidWork: !!pidWorkRoutes,
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// 404 handler for debugging
app.use((req, res, next) => {
  console.log(`❌ 404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong!", error: err.message });
});

// Start server only after database connection
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`\n📍 Available PID Work Routes:`);
      console.log(`   POST /api/tasks/pid-work-items/mark-complete`);
      console.log(`   POST /api/tasks/assign-pid`);
      console.log(`   GET  /api/tasks/pid-work-items/users/:user_id/assigned-pids`);
      console.log(`   GET  /api/tasks/pid-work-items/hierarchy/:taskId`);
      console.log(`   GET  /api/tasks/pid-work-items/summary`);
    });
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
};

startServer();