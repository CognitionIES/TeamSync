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
    const blocks = parseInt(row.counts?.blocks) || 0;
    if (!key) {
      console.log(`Skipping row with invalid ${periodKey}:`, row);
      return;
    }
    if (!aggregated[key]) {
      aggregated[key] = { counts: {}, userId: row.user_id };
    }
    if (!aggregated[key].counts[itemType]) {
      aggregated[key].counts[itemType] = {};
    }
    aggregated[key].counts[itemType][taskType] =
      (aggregated[key].counts[itemType][taskType] || 0) + count;
    aggregated[key].counts.blocks =
      (aggregated[key].counts.blocks || 0) + blocks;
  });
  const result = Object.values(aggregated).map((entry) => ({
    ...entry,
    [periodKey]: key, // Ensure the period key is included
    date: periodKey === "date" ? key : undefined,
    week_start: periodKey === "week_start" ? key : undefined,
    month_start: periodKey === "month_start" ? key : undefined,
  }));
  console.log(`Aggregated result for ${periodKey}: ${JSON.stringify(result)}`);
  return result.length > 0 ? result : [];
};

// @desc    Get lines completed by an individual (daily, weekly, monthly)
// @route   GET /api/metrics/individual/lines
// @access  Private (Project Manager)
router.get("/individual/lines", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({ message: `Unauthorized access` });
    }

    const userId = req.query.userId;
    const metrics = { daily: [], weekly: [], monthly: [] };

    // Daily metrics
    const dailyQuery = `
      SELECT user_id, date, item_type, task_type, category, count, counts
      FROM daily_line_counts
      WHERE date >= NOW() - INTERVAL '30 days'
      ${userId ? "AND user_id = $1" : ""}
      ORDER BY date DESC
    `;
    const dailyParams = userId ? [userId] : [];
    const dailyResult = await db.query(dailyQuery, dailyParams);
    metrics.daily = dailyResult.rows.map((row) => {
      // Derive item_type and task_type from category if not present
      const itemType =
        row.item_type ||
        (row.category && row.category.split(" ")[0]) ||
        "unknown";
      const taskType =
        row.task_type ||
        (row.category && row.category.split(" ").pop()) ||
        "misc";
      return {
        userId: row.user_id,
        date: row.date,
        counts: {
          [itemType]: {
            [taskType]: row.count || 0,
          },
          blocks: row.counts?.blocks || 0,
        },
      };
    });

    // Weekly metrics
    const weeklyQuery = `
      SELECT user_id, DATE_TRUNC('week', date) as week_start, item_type, task_type, category, SUM(count) as total_count, jsonb_object_agg(task_type, count) as counts
      FROM daily_line_counts
      WHERE date >= NOW() - INTERVAL '4 weeks'
      ${userId ? "AND user_id = $1" : ""}
      GROUP BY user_id, DATE_TRUNC('week', date), item_type, task_type, category
      ORDER BY week_start DESC
    `;
    const weeklyParams = userId ? [userId] : [];
    const weeklyResult = await db.query(weeklyQuery, weeklyParams);
    metrics.weekly = weeklyResult.rows.map((row) => {
      const itemType =
        row.item_type ||
        (row.category && row.category.split(" ")[0]) ||
        "unknown";
      const taskType =
        row.task_type ||
        (row.category && row.category.split(" ").pop()) ||
        "misc";
      return {
        userId: row.user_id,
        week_start: row.week_start,
        counts: {
          [itemType]: {
            [taskType]: row.total_count || 0,
          },
          blocks: (row.counts && row.counts.blocks) || 0,
        },
      };
    });

    // Monthly metrics
    const monthlyQuery = `
      SELECT user_id, DATE_TRUNC('month', date) as month_start, item_type, task_type, category, SUM(count) as total_count, jsonb_object_agg(task_type, count) as counts
      FROM daily_line_counts
      WHERE date >= NOW() - INTERVAL '12 months'
      ${userId ? "AND user_id = $1" : ""}
      GROUP BY user_id, DATE_TRUNC('month', date), item_type, task_type, category
      ORDER BY month_start DESC
    `;
    const monthlyParams = userId ? [userId] : [];
    const monthlyResult = await db.query(monthlyQuery, monthlyParams);
    metrics.monthly = monthlyResult.rows.map((row) => {
      const itemType =
        row.item_type ||
        (row.category && row.category.split(" ")[0]) ||
        "unknown";
      const taskType =
        row.task_type ||
        (row.category && row.category.split(" ").pop()) ||
        "misc";
      return {
        userId: row.user_id,
        month_start: row.month_start,
        counts: {
          [itemType]: {
            [taskType]: row.total_count || 0,
          },
          blocks: (row.counts && row.counts.blocks) || 0,
        },
      };
    });

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Error fetching individual metrics:", {
      message: error.message,
      stack: error.stack,
    });
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

    const dailyQuery = `
      SELECT user_id, date, counts
      FROM daily_line_counts
      WHERE user_id = $1 AND date = $2
      ORDER BY date DESC
    `;
    const dailyParams = [userId, date];
    const dailyRows = await db.query(dailyQuery, dailyParams);

    const metrics = dailyRows.rows.map((row) => ({
      userId: row.user_id,
      date: row.date,
      counts: row.counts || {},
    }));

    res
      .status(200)
      .json(metrics.length > 0 ? metrics[0] : { userId, date, counts: {} });
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

    let dailyBaseQuery = `
      SELECT DATE(date) as date, COALESCE(dlc.item_type, 'Line') as item_type, COALESCE(dlc.task_type, 'misc') as task_type, SUM(dlc.count) as count
      FROM daily_line_counts dlc
      LEFT JOIN team_members tm ON dlc.user_id = tm.member_id AND tm.team_id = $1::text
      WHERE (dlc.item_type = 'Line' OR dlc.item_type IS NULL)
      GROUP BY DATE(date), COALESCE(dlc.item_type, 'Line'), COALESCE(dlc.task_type, 'misc')
    `;
    const dailyParams = [teamId.toString()];
    let dailyQuery = buildTimeQuery(
      dailyBaseQuery,
      dailyParams,
      "7 days",
      "DATE(date), COALESCE(dlc.item_type, 'Line'), COALESCE(dlc.task_type, 'misc')",
      "date"
    );
    const dailyRows = await fetchMetrics(dailyQuery, dailyParams, res);
    const metrics = { daily: aggregateMetrics(dailyRows, "date") || [] };

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

    // Fetch task and item details to determine category
    const taskQuery = `
      SELECT t.type as task_type, ti.item_type
      FROM tasks t
      JOIN task_items ti ON ti.task_id = t.id
      WHERE t.id = $1 AND ti.id = $2
    `;
    const taskResult = await db.query(taskQuery, [taskId, itemId]);
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: "Task or item not found" });
    }
    const { task_type, item_type } = taskResult.rows[0];

    // Determine category based on task and item type
    let category = "Unknown";
    if (item_type === "Line" && task_type === "QC") category = "Line QC";
    else if (item_type === "Equipment" && task_type === "QC")
      category = "Equipment QC";
    else if (item_type === "Line") category = "Line";
    else if (item_type === "Equipment") category = "Equipment";
    else if (item_type === "PID" && task_type === "Redline") category = "PID";
    else if (item_type === "PID" && task_type === "QC") category = "PID QC";

    if (taskId && itemId) {
      const updateItemQuery = `
        UPDATE task_items SET completed = TRUE, completed_at = CURRENT_TIMESTAMP
        WHERE task_id = $1 AND id = $2 AND completed = FALSE;
      `;
      await db.query(updateItemQuery, [taskId, itemId]);
    }

    const checkQuery = `
      SELECT count FROM daily_line_counts 
      WHERE user_id = $1 AND date = $2 AND category = $3
    `;
    const checkParams = [userId, date, category];
    const { rows } = await db.query(checkQuery, checkParams);

    if (rows.length > 0) {
      const newCount = rows[0].count + 1;
      const updateQuery = `
        UPDATE daily_line_counts 
        SET count = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = $2 AND date = $3 AND category = $4
      `;
      await db.query(updateQuery, [newCount, userId, date, category]);
    } else {
      const insertQuery = `
        INSERT INTO daily_line_counts (user_id, count, date, category)
        VALUES ($1, $2, $3, $4)
      `;
      await db.query(insertQuery, [userId, 1, date, category]);
    }

    // Fetch updated metrics with categorized counts
    const fetchQuery = `
      SELECT category, SUM(count) as count
      FROM daily_line_counts
      WHERE user_id = $1 AND date = $2
      GROUP BY category
    `;
    const { rows: updatedRows } = await db.query(fetchQuery, [userId, date]);
    const metrics = {
      daily: [
        {
          counts: updatedRows.reduce(
            (acc, row) => ({ ...acc, [row.category]: row.count || 0 }),
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

// @desc    Update individual metrics counter
// @route   POST /api/metrics/individual/update
// @access  Private (Project Manager, Team Member)
// @desc    Update individual metrics counter
// @route   POST /api/metrics/individual/update
// @access  Private (Project Manager, Team Member)
router.post("/individual/update", protect, async (req, res) => {
  try {
    const {
      userId,
      taskId,
      itemId,
      itemType,
      taskType,
      category,
      action,
      blocks = 1,
    } = req.body;

    // Validate required fields
    if (
      !userId ||
      !taskId ||
      !itemId ||
      !itemType ||
      !taskType ||
      !category ||
      !action
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const date = new Date().toISOString().split("T")[0]; // e.g., "2025-08-23"
    console.log("Received request:", {
      userId,
      date,
      category,
      action,
      itemType,
      taskType,
      blocks,
    });

    // Validate category length
    if (category.length > 50) {
      return res
        .status(400)
        .json({ message: "Category exceeds 50 characters" });
    }

    // Validate action
    if (action !== "increment" && action !== "decrement") {
      return res
        .status(400)
        .json({ message: "Invalid action. Use 'increment' or 'decrement'" });
    }

    const change = action === "increment" ? 1 : -1;
    console.log("Calculated change:", change);

    // Check if task and item exist
    const taskCheckQuery = `
      SELECT t.assignee_id, ti.completed, ti.blocks
      FROM tasks t
      JOIN task_items ti ON ti.task_id = t.id
      WHERE t.id = $1 AND ti.id = $2;
    `;
    const taskCheckResult = await db.query(taskCheckQuery, [taskId, itemId]);
    if (taskCheckResult.rows.length === 0) {
      return res.status(404).json({ message: "Task or item not found" });
    }
    if (taskCheckResult.rows[0].assignee_id !== userId) {
      return res
        .status(403)
        .json({ message: "User not authorized for this task" });
    }
    if (taskCheckResult.rows[0].completed && action === "increment") {
      return res.status(400).json({ message: "Item already completed" });
    }
    const itemBlocks = taskCheckResult.rows[0].blocks || blocks; // Use item-specific blocks or default

    // Update or insert metric with blocks
    const checkQuery = `
      SELECT count, counts
      FROM daily_line_counts
      WHERE user_id = $1 AND date = $2 AND category = $3
      FOR UPDATE;
    `;
    const checkParams = [userId, date, category];
    const checkResult = await db.query(checkQuery, checkParams);

    if (checkResult.rows.length > 0) {
      const currentCount = checkResult.rows[0].count || 0;
      const currentBlocks =
        (checkResult.rows[0].counts?.blocks || 0) +
        (action === "increment" ? itemBlocks : -itemBlocks);
      const newCount = Math.max(0, currentCount + change);
      const updateQuery = `
        UPDATE daily_line_counts
        SET count = $4, updated_at = CURRENT_TIMESTAMP, item_type = $5, task_type = $6, counts = jsonb_build_object('blocks', $7)
        WHERE user_id = $1 AND date = $2 AND category = $3
        RETURNING *;
      `;
      const updateParams = [
        userId,
        date,
        category,
        newCount,
        itemType,
        taskType,
        currentBlocks,
      ];
      const updateResult = await db.query(updateQuery, updateParams);

      if (updateResult.rowCount === 0) {
        throw new Error("Failed to update existing metric record");
      }
      console.log("Update successful:", updateResult.rows[0]);
    } else {
      const insertQuery = `
        INSERT INTO daily_line_counts (user_id, date, item_type, task_type, category, count, counts)
        VALUES ($1, $2, $3, $4, $5, $6, jsonb_build_object('blocks', $7))
        ON CONFLICT (user_id, date, category) DO UPDATE
        SET count = daily_line_counts.count + $6, updated_at = CURRENT_TIMESTAMP, counts = jsonb_build_object('blocks', daily_line_counts.counts->'blocks' + $7)
        RETURNING *;
      `;
      const insertParams = [
        userId,
        date,
        itemType,
        taskType,
        category,
        change,
        itemBlocks,
      ];
      const insertResult = await db.query(insertQuery, insertParams);

      if (insertResult.rowCount === 0) {
        throw new Error("Failed to insert new metric record");
      }
      console.log("Insert successful:", insertResult.rows[0]);
    }

    res.status(200).json({ message: "Metrics updated successfully" });
  } catch (error) {
    console.error(
      "Error updating individual metrics:",
      error.message,
      error.stack
    );
    res.status(500).json({
      message: "Failed to update individual metrics",
      error: error.message,
    });
  }
});
module.exports = router;
