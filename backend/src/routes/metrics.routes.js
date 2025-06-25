const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// Helper function to build time-based queries
const buildTimeQuery = (baseQuery, params, timeInterval, groupBy, orderBy) => {
  return `
    ${baseQuery}
    AND a.timestamp >= NOW() - INTERVAL '${timeInterval}'
    GROUP BY ${groupBy}
    ORDER BY ${orderBy} DESC;
  `;
};

// Validate input parameters
const validateParams = (itemType, taskType) => {
  const validItemTypes = ["lines", "equipment", "non_line_instruments", "pids"];
  const validTaskTypes = ["upv", "redline", "qc"];

  if (!validItemTypes.includes(itemType)) {
    throw new Error("Invalid itemType");
  }
  if (taskType && !validTaskTypes.includes(taskType.toLowerCase())) {
    throw new Error("Invalid taskType");
  }
};

// Fetch metrics for a given query configuration
const fetchMetrics = async (baseQuery, params, res) => {
  try {
    const { rows } = await db.query(baseQuery, params);
    console.log(
      `Query executed: ${baseQuery}, Params: ${JSON.stringify(params)}, Rows: ${
        rows.length
      }`
    );
    return rows;
  } catch (error) {
    console.error(`FetchMetrics error: ${error.message}`, error.stack, {
      query: baseQuery,
      params,
    });
    throw new Error(`Database error: ${error.message}`);
  }
};

// Aggregate metrics across all item types and task types
const aggregateMetrics = (rows, periodKey) => {
  const aggregated = {};
  if (!rows || rows.length === 0) {
    console.log(`No rows to aggregate for period ${periodKey}`);
    return [];
  }
  rows.forEach((row) => {
    const key = row[periodKey];
    const itemType = row.item_type || "unknown";
    const taskType = row.task_type || "misc";
    const count = parseInt(row.count) || 0;
    if (!key) {
      console.log(`Skipping row with invalid ${periodKey}:`, row);
      return;
    }
    if (!aggregated[key]) {
      aggregated[key] = { counts: {} };
    }
    if (!aggregated[key].counts[itemType]) {
      aggregated[key].counts[itemType] = {};
    }
    aggregated[key].counts[itemType][taskType] =
      (aggregated[key].counts[itemType][taskType] || 0) + count;
  });
  const result = Object.values(aggregated);
  console.log(`Aggregated result for ${periodKey}: ${JSON.stringify(result)}`);
  return result;
};

// @desc    Get lines completed by an individual (daily, weekly, monthly)
// @route   GET /api/metrics/individual/lines
// @access  Private (Project Manager)
router.get("/individual/lines", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access metrics`,
      });
    }

    const userId = req.query.userId || req.user.id;
    const metrics = { daily: [], weekly: [], monthly: [] };

    let dailyBaseQuery = `
      SELECT 
        DATE(t.completed_at) as date,
        CASE 
          WHEN t.type IN ('upv', 'qc', 'redline') THEN 
            CASE 
              WHEN t.items @> '[{"type": "lines"}]'::jsonb THEN 'lines'
              WHEN t.items @> '[{"type": "pids"}]'::jsonb THEN 'pids'
              WHEN t.items @> '[{"type": "non_line_instruments"}]'::jsonb THEN 'non_line_instruments'
              ELSE NULL
            END
          ELSE NULL
        END as item_type,
        t.type as task_type,
        COUNT(*) as count
      FROM tasks t
      WHERE t.assignee_id = $1 
      AND t.status = 'Completed' 
      AND t.completed_at IS NOT NULL
      AND t.items IS NOT NULL -- Add check to avoid JSONB errors
      AND CASE 
        WHEN t.type IN ('upv', 'qc', 'redline') THEN 
          CASE 
            WHEN t.items @> '[{"type": "lines"}]'::jsonb THEN 'lines'
            WHEN t.items @> '[{"type": "pids"}]'::jsonb THEN 'pids'
            WHEN t.items @> '[{"type": "non_line_instruments"}]'::jsonb THEN 'non_line_instruments'
            ELSE NULL
          END
        ELSE NULL
      END IS NOT NULL
    `;
    const dailyParams = [userId];
    let dailyQuery = buildTimeQuery(
      dailyBaseQuery,
      dailyParams,
      "7 days",
      "DATE(t.completed_at), item_type, t.type",
      "date"
    );
    const dailyRows = await fetchMetrics(dailyQuery, dailyParams, res);
    console.log("Daily Rows:", JSON.stringify(dailyRows));
    metrics.daily = aggregateMetrics(dailyRows, "date");

    let weeklyBaseQuery = `
      SELECT 
        DATE_TRUNC('week', t.completed_at) as week_start,
        CASE 
          WHEN t.type IN ('upv', 'qc', 'redline') THEN 
            CASE 
              WHEN t.items @> '[{"type": "lines"}]'::jsonb THEN 'lines'
              WHEN t.items @> '[{"type": "pids"}]'::jsonb THEN 'pids'
              WHEN t.items @> '[{"type": "non_line_instruments"}]'::jsonb THEN 'non_line_instruments'
              ELSE NULL
            END
          ELSE NULL
        END as item_type,
        t.type as task_type,
        COUNT(*) as count
      FROM tasks t
      WHERE t.assignee_id = $1 
      AND t.status = 'Completed' 
      AND t.completed_at IS NOT NULL
      AND t.items IS NOT NULL
      AND CASE 
        WHEN t.type IN ('upv', 'qc', 'redline') THEN 
          CASE 
            WHEN t.items @> '[{"type": "lines"}]'::jsonb THEN 'lines'
            WHEN t.items @> '[{"type": "pids"}]'::jsonb THEN 'pids'
            WHEN t.items @> '[{"type": "non_line_instruments"}]'::jsonb THEN 'non_line_instruments'
            ELSE NULL
          END
        ELSE NULL
      END IS NOT NULL
    `;
    const weeklyParams = [userId];
    let weeklyQuery = buildTimeQuery(
      weeklyBaseQuery,
      weeklyParams,
      "4 weeks",
      "DATE_TRUNC('week', t.completed_at), item_type, t.type",
      "week_start"
    );
    const weeklyRows = await fetchMetrics(weeklyQuery, weeklyParams, res);
    console.log("Weekly Rows:", JSON.stringify(weeklyRows));
    metrics.weekly = aggregateMetrics(weeklyRows, "week_start");

    let monthlyBaseQuery = `
      SELECT 
        DATE_TRUNC('month', t.completed_at) as month_start,
        CASE 
          WHEN t.type IN ('upv', 'qc', 'redline') THEN 
            CASE 
              WHEN t.items @> '[{"type": "lines"}]'::jsonb THEN 'lines'
              WHEN t.items @> '[{"type": "pids"}]'::jsonb THEN 'pids'
              WHEN t.items @> '[{"type": "non_line_instruments"}]'::jsonb THEN 'non_line_instruments'
              ELSE NULL
            END
          ELSE NULL
        END as item_type,
        t.type as task_type,
        COUNT(*) as count
      FROM tasks t
      WHERE t.assignee_id = $1 
      AND t.status = 'Completed' 
      AND t.completed_at IS NOT NULL
      AND t.items IS NOT NULL
      AND CASE 
        WHEN t.type IN ('upv', 'qc', 'redline') THEN 
          CASE 
            WHEN t.items @> '[{"type": "lines"}]'::jsonb THEN 'lines'
            WHEN t.items @> '[{"type": "pids"}]'::jsonb THEN 'pids'
            WHEN t.items @> '[{"type": "non_line_instruments"}]'::jsonb THEN 'non_line_instruments'
            ELSE NULL
          END
        ELSE NULL
      END IS NOT NULL
    `;
    const monthlyParams = [userId];
    let monthlyQuery = buildTimeQuery(
      monthlyBaseQuery,
      monthlyParams,
      "6 months",
      "DATE_TRUNC('month', t.completed_at), item_type, t.type",
      "month_start"
    );
    const monthlyRows = await fetchMetrics(monthlyQuery, monthlyParams, res);
    console.log("Monthly Rows:", JSON.stringify(monthlyRows));
    metrics.monthly = aggregateMetrics(monthlyRows, "month_start");

    res.status(200).json(metrics);
    console.log("Individual Metrics:", { userId, metrics });
  } catch (error) {
    console.error(
      "Error fetching individual metrics:",
      error.message,
      error.stack,
      { itemType: req.query.itemType, taskType: req.query.taskType },
      { query: dailyQuery, params: dailyParams } // Add query details to log
    );
    res.status(500).json({
      message: "Failed to fetch individual metrics",
      error: error.message,
    });
  }
});
// Team metrics endpoint

router.get("/team/lines", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access metrics`,
      });
    }

    const teamId = req.query.teamId;
    if (!teamId) {
      return res.status(400).json({
        message: "teamId is required",
      });
    }

    const metrics = { daily: [], weekly: [], monthly: [] };

    let dailyBaseQuery = `
      SELECT DATE(a.timestamp) as date, a.type as item_type, COALESCE(t.type, 'misc') as task_type, COUNT(*) as count
      FROM audit_logs a
      LEFT JOIN tasks t ON a.task_id = t.id
      LEFT JOIN team_members tm ON a.created_by_id = tm.member_id AND tm.team_name = $1
      WHERE tm.team_name IS NOT NULL AND a.timestamp IS NOT NULL AND a.type IS NOT NULL
    `;
    const dailyParams = [teamId];
    let dailyQuery = buildTimeQuery(
      dailyBaseQuery,
      dailyParams,
      "7 days",
      "DATE(a.timestamp), a.type, COALESCE(t.type, 'misc')",
      "date"
    );
    const dailyRows = await fetchMetrics(dailyQuery, dailyParams, res);
    metrics.daily = aggregateMetrics(dailyRows, "date");

    // Similar fixes for weekly and monthly
    // ...

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Error fetching team metrics:", error.message, error.stack, {
      itemType: req.query.itemType,
      taskType: req.query.taskType,
    });
    res.status(500).json({
      message: "Failed to fetch team metrics",
      error: error.message,
    });
  }
});
// @desc    Get project performance/progress
// @route   GET /api/metrics/projects/progress
// @access  Private (Project Manager)
router.get("/projects/progress", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access metrics`,
      });
    }

    const itemType = req.query.itemType || "lines";
    const taskType = req.query.taskType || null;

    validateParams(itemType, taskType);
    const tableName = {
      lines: "lines",
      equipment: "equipment",
      non_line_instruments: "non_line_instruments",
      pids: "pids",
    }[itemType];

    const projectsQuery = `
      SELECT id, name
      FROM projects
      ORDER BY created_at DESC;
    `;
    const { rows: projects } = await db.query(projectsQuery);

    const projectTargets = {
      lines: { 1: 1000, 2: 1500, 3: 1200 },
      equipment: { 1: 500, 2: 700, 3: 600 },
      non_line_instruments: { 1: 300, 2: 400, 3: 350 },
      pids: { 1: 100, 2: 150, 3: 120 },
    };

    const projectProgress = [];
    for (const project of projects) {
      let itemsQuery = `
        SELECT COUNT(*) as completed_items
        FROM ${tableName}
        WHERE project_id = $1 AND completed = TRUE
      `;
      const queryParams = [project.id];
      if (taskType) {
        itemsQuery += " AND task_id IN (SELECT id FROM tasks WHERE type = $2)";
        queryParams.push(taskType.toUpperCase());
      }

      const { rows: itemsRows } = await db.query(itemsQuery, queryParams);
      const completedItems = parseInt(itemsRows[0].completed_items) || 0;
      const targetItems = projectTargets[itemType][project.id] || 1000;
      const progress = (completedItems / targetItems) * 100;

      projectProgress.push({
        projectId: project.id.toString(), // Ensure string for frontend consistency
        projectName: project.name,
        completedItems,
        targetItems,
        progress: progress.toFixed(2),
      });
    }

    res.status(200).json({ data: projectProgress });
  } catch (error) {
    console.error(
      "Error fetching project progress:",
      error.message,
      error.stack
    );
    res.status(500).json({
      message: "Failed to fetch project progress",
      error: error.message,
    });
  }
});

router.get("/individual/lines/daily", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access metrics`,
      });
    }

    const userId = req.query.userId || req.user.id;
    const metrics = [];

    let baseQuery = `
      SELECT 
        DATE(t.completed_at) as date,
        COUNT(*) as line_count
      FROM tasks t
      WHERE t.assignee_id = $1 
      AND t.status = 'Completed' 
      AND t.completed_at IS NOT NULL
      AND t.type = 'upv' -- Assuming 'upv' tasks represent line completions
      GROUP BY DATE(t.completed_at)
      ORDER BY date DESC
      LIMIT 7; -- Last 7 days
    `;

    const params = [userId];
    const { rows } = await db.query(baseQuery, params);
    console.log("Daily Lines Rows:", JSON.stringify(rows));

    if (rows.length > 0) {
      metrics.push(
        ...rows.map((row) => ({
          date: row.date,
          line_count: parseInt(row.line_count) || 0,
        }))
      );
    } else {
      console.log(
        `No completed 'upv' tasks found for userId ${userId} in the last 7 days`
      );
    }

    res.status(200).json({ daily_lines: metrics });
  } catch (error) {
    console.error("Error fetching daily lines:", error.message, error.stack);
    res.status(500).json({
      message: "Failed to fetch daily lines",
      error: error.message,
    });
  }
});
module.exports = router;
