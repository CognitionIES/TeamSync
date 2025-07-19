const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// Helper function to build time-based queries
const buildTimeQuery = (baseQuery, params, timeInterval, groupBy, orderBy) => {
  const hasWhere = baseQuery.toLowerCase().includes("where");
  const whereClause = hasWhere ? "AND" : "WHERE";
  const fullQuery = `
    ${baseQuery.replace(/\s+GROUP BY.*$/m, "")} -- Remove any existing GROUP BY
    ${whereClause} date >= NOW() - INTERVAL '${timeInterval}'
    GROUP BY ${groupBy}
    ORDER BY ${orderBy} DESC
  `;
  console.log("Built Query:", fullQuery, "Params:", params);
  return fullQuery;
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
  console.log("Aggregating rows for", periodKey, "Raw rows:", rows);
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
  return result.length > 0 ? result : [];
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

    // Daily
    let dailyBaseQuery = `
  SELECT DATE(date) as date, COALESCE(dlc.item_type, 'Line') as item_type, COALESCE(dlc.task_type, 'misc') as task_type, SUM(dlc.count) as count
  FROM daily_line_counts dlc
  LEFT JOIN team_members tm ON dlc.user_id = tm.member_id AND tm.team_id = $1::text
  WHERE (dlc.item_type = 'Line' OR dlc.item_type IS NULL)
  GROUP BY DATE(date), COALESCE(dlc.item_type, 'Line'), COALESCE(dlc.task_type, 'misc')
`;
    const dailyParams = [userId];
    let dailyQuery = ""; // Initialize to avoid undefined
    try {
      dailyQuery = buildTimeQuery(
        dailyBaseQuery,
        dailyParams,
        "7 days",
        "DATE(date), COALESCE(item_type, 'Line'), COALESCE(task_type, 'misc')",
        "date"
      );
      const dailyRows = await fetchMetrics(dailyQuery, dailyParams, res);
      metrics.daily = aggregateMetrics(dailyRows, "date") || [];
    } catch (queryError) {
      console.error(
        "Query build/execution error:",
        queryError.message,
        queryError.stack
      );
      // Proceed with empty metrics if query fails
    }

    // Weekly and Monthly (similarly adjusted)
    let weeklyBaseQuery = `
      SELECT DATE_TRUNC('week', date) as week_start, COALESCE(item_type, 'Line') as item_type, COALESCE(task_type, 'misc') as task_type, SUM(count) as count
      FROM daily_line_counts
      WHERE user_id = $1::text AND (item_type = 'Line' OR item_type IS NULL)
    `;
    const weeklyParams = [userId];
    let weeklyQuery = "";
    try {
      weeklyQuery = buildTimeQuery(
        weeklyBaseQuery,
        weeklyParams,
        "1 week",
        "DATE_TRUNC('week', date), COALESCE(item_type, 'Line'), COALESCE(task_type, 'misc')",
        "week_start"
      );
      const weeklyRows = await fetchMetrics(weeklyQuery, weeklyParams, res);
      metrics.weekly = aggregateMetrics(weeklyRows, "week_start") || [];
    } catch (queryError) {
      console.error(
        "Query build/execution error:",
        queryError.message,
        queryError.stack
      );
    }

    let monthlyBaseQuery = `
      SELECT DATE_TRUNC('month', date) as month_start, COALESCE(item_type, 'Line') as item_type, COALESCE(task_type, 'misc') as task_type, SUM(count) as count
      FROM daily_line_counts
      WHERE user_id = $1::text AND (item_type = 'Line' OR item_type IS NULL)
    `;
    const monthlyParams = [userId];
    let monthlyQuery = "";
    try {
      monthlyQuery = buildTimeQuery(
        monthlyBaseQuery,
        monthlyParams,
        "1 month",
        "DATE_TRUNC('month', date), COALESCE(item_type, 'Line'), COALESCE(task_type, 'misc')",
        "month_start"
      );
      const monthlyRows = await fetchMetrics(monthlyQuery, monthlyParams, res);
      metrics.monthly = aggregateMetrics(monthlyRows, "month_start") || [];
    } catch (queryError) {
      console.error(
        "Query build/execution error:",
        queryError.message,
        queryError.stack
      );
    }

    res.status(200).json(metrics);
  } catch (error) {
    let query = "Query not built due to error";
    if (dailyQuery || weeklyQuery || monthlyQuery) {
      query = dailyQuery || weeklyQuery || monthlyQuery;
    }
    console.error(
      "Error fetching individual metrics:",
      error.message,
      error.stack,
      { userId, query, params: dailyParams || weeklyParams || monthlyParams }
    );
    res.status(500).json({
      message: "Failed to fetch individual metrics",
      error: error.message,
    });
  }
});

// Add GET /api/metrics/individual/lines/daily endpoint
router.get("/individual/lines/daily", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to access metrics`,
      });
    }

    const userId = req.query.userId || req.user.id;
    const date = new Date().toISOString().split("T")[0];

    let dailyBaseQuery = `
    SELECT date, user_id, count FROM daily_line_counts WHERE user_id = $1 AND date = $2
    `;
    const dailyParams = [userId, date];
    const dailyRows = await fetchMetrics(dailyBaseQuery, dailyParams, res);
    const metrics = {
      daily: dailyRows.length
        ? [{ counts: { lines: dailyRows[0].count } }]
        : [{ counts: { lines: 0 } }],
    };

    res.status(200).json(metrics);
  } catch (error) {
    console.error(
      "Error fetching daily individual metrics:",
      error.message,
      error.stack
    );
    res.status(500).json({
      message: "Failed to fetch daily individual metrics",
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
      return res.status(400).json({ message: "teamId is required" });
    }

    const metrics = { daily: [], weekly: [], monthly: [] };

    let dailyBaseQuery = `
      SELECT DATE(date) as date, COALESCE(dlc.item_type, 'Line') as item_type, COALESCE(dlc.task_type, 'misc') as task_type, SUM(dlc.count) as count
      FROM daily_line_counts dlc
      LEFT JOIN team_members tm ON dlc.user_id = tm.member_id AND tm.team_id = $1::text
      WHERE (dlc.item_type = 'Line' OR dlc.item_type IS NULL)
      GROUP BY DATE(date), COALESCE(dlc.item_type, 'Line'), COALESCE(dlc.task_type, 'misc')
    `;
    const dailyParams = [teamId.toString()];
    let dailyQuery = ""; // Initialize to avoid undefined
    try {
      dailyQuery = buildTimeQuery(
        dailyBaseQuery,
        dailyParams,
        "7 days",
        "DATE(date), COALESCE(dlc.item_type, 'Line'), COALESCE(dlc.task_type, 'misc')",
        "date"
      );
      const dailyRows = await fetchMetrics(dailyQuery, dailyParams, res);
      metrics.daily = aggregateMetrics(dailyRows, "date") || [];
    } catch (queryError) {
      console.error(
        "Query build/execution error:",
        queryError.message,
        queryError.stack
      );
      // Proceed with empty metrics if query fails
    }

    res.status(200).json(metrics);
  } catch (error) {
    const query = dailyQuery || "Query not built due to error";
    console.error("Error fetching team metrics:", error.message, error.stack, {
      teamId: req.query.teamId,
      query: query,
      params: dailyParams,
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
        projectId: project.id.toString(),
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

router.post("/individual/lines/daily", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    if (!["Project Manager", "Team Member"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const userId = req.body.userId || req.user.id;
    const taskId = req.body.taskId;
    const itemId = req.body.itemId;
    const date = new Date().toISOString().split("T")[0];

    if (taskId && itemId) {
      const updateItemQuery = `
        UPDATE task_items SET completed = TRUE, completed_at = CURRENT_TIMESTAMP
        WHERE task_id = $1 AND id = $2 AND completed = FALSE;
      `;
      await db.query(updateItemQuery, [taskId, itemId]);
    }

    const checkQuery =
      "SELECT count FROM daily_line_counts WHERE user_id = $1 AND date = $2";
    const { rows } = await db.query(checkQuery, [userId, date]);

    if (rows.length > 0) {
      const newCount = rows[0].count + 1;
      const updateQuery =
        "UPDATE daily_line_counts SET count = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND date = $3";
      await db.query(updateQuery, [newCount, userId, date]);
    } else {
      const insertQuery =
        "INSERT INTO daily_line_counts (user_id, count, date) VALUES ($1, $2, $3)";
      await db.query(insertQuery, [userId, 1, date]);
    }

    const fetchQuery = `
      SELECT t.type as task_type, SUM(CASE WHEN ti.item_type = 'Line' THEN 1 ELSE 0 END) as lines_count
      FROM tasks t
      JOIN task_items ti ON t.id = ti.task_id
      WHERE t.assignee_id = $1 AND t.status = 'Completed' AND ti.completed = TRUE
      AND ti.completed_at >= $2 AND ti.completed_at < $3
      GROUP BY t.type;
    `;
    const { rows: updatedRows } = await db.query(fetchQuery, [
      userId,
      `${date} 00:00:00`,
      `${date} 23:59:59`,
    ]);
    const metrics = {
      daily: [
        {
          counts: updatedRows.reduce(
            (acc, row) => ({ ...acc, [row.task_type]: row.lines_count || 0 }),
            {}
          ),
        },
      ],
    };
    res.status(200).json(metrics);
  } catch (error) {
    console.error("Error updating daily lines:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to update daily lines", error: error.message });
  }
});

router.post("/metrics/task/count", protect, async (req, res) => {
  try {
    const { teamId, taskType } = req.body;
    if (!teamId || !taskType) {
      return res
        .status(400)
        .json({ message: "teamId and taskType are required" });
    }

    const query = `
      INSERT INTO task_counts (team_id, task_type, count)
      VALUES ($1, $2, 1)
      ON CONFLICT (team_id, task_type) 
      DO UPDATE SET count = task_counts.count + 1, updated_at = NOW()
      RETURNING count;
    `;
    const params = [teamId.toString(), taskType];
    console.log("Increment Counter Query Params:", params);
    const result = await fetchMetrics(query, params, res);
    console.log("Increment Counter Result:", result);

    res.status(200).json({ count: result[0].count });
  } catch (error) {
    console.error(
      "Error incrementing task count:",
      error.message,
      error.stack,
      {
        teamId: req.body.teamId,
        taskType: req.body.taskType,
      }
    );
    res.status(500).json({
      message: "Failed to increment task count",
      error: error.message,
    });
  }
});

router.get("/metrics/team/lines", protect, async (req, res) => {
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

    const query = `
      SELECT task_type, count
      FROM task_counts
      WHERE team_id = $1
    `;
    const params = [teamId.toString()];
    console.log("Team Metrics Query Params:", params);
    const result = await fetchMetrics(query, params, res);
    console.log("Team Metrics Raw Rows:", result);

    const metrics = {
      "Lines UPV QC": 0,
      "Equipment UPV QC": 0,
      "PIDS Redline": 0,
      QC: 0,
    };
    result.forEach((row) => {
      metrics[row.task_type] = row.count || 0;
    });

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Error fetching team metrics:", error.message, error.stack, {
      teamId: req.query.teamId,
    });
    res.status(500).json({
      message: "Failed to fetch team metrics",
      error: error.message,
    });
  }
});

module.exports = router;
