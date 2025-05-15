require("dotenv").config({ path: "./.env" });
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { connectDB } = require("./config/db");

const app = express();

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
  })
);
app.use(express.json());
app.use(morgan("dev"));

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

let equipmentRoutes;
try {
  equipmentRoutes = require("./routes/equipment.routes");
  app.use("/api/equipment", equipmentRoutes);
  console.log("Mounted /api/equipment route");
} catch (error) {
  console.error("Failed to load equipment.routes.js:", error.message);
}

console.log("Routes loaded:", {
  equipment: !!equipmentRoutes,
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ message: "Something went wrong!", error: err.message });
});

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  const startServer = async () => {
    try {
      await connectDB();
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } catch (error) {
      console.error("Database connection failed:", error.message);
      process.exit(1);
    }
  };
  startServer();
}

// Export for Vercel serverless function
module.exports = async (req, res) => {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res
      .status(500)
      .json({ message: "Database connection failed", error: error.message });
  }
};
