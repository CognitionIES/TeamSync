require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDB } = require("./config/db");

// Load environment variables
require("dotenv").config({ path: "./.env" });

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

// Routes
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
app.use("/api/non-inline-instruments", require("./routes/non-inline-instruments.routes"));
if (equipmentRoutes) {
  app.use("/api/equipment", equipmentRoutes);
  console.log("Mounted /api/equipment route");
} else {
  console.error("Equipment routes not mounted due to loading error");
}

console.log("Routes loaded:", {
  equipment: !!equipmentRoutes,
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

// Error handling middleware (for uncaught errors)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong!", error: err.message });
});

// Start server only after database connection is established
const startServer = async () => {
  try {
    await connectDB(); // DB connection is successful before starting the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1); // Exit the process if DB connection fails
  }
};

// Start the server
startServer();