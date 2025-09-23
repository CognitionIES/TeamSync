const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");
// Add this new route to your metrics.routes.js
// Add this new route to your metrics.routes.js file (place it before the existing routes)
// Replace the existing /individual/all route with this updated version
router.get("/individual/all", protect, async (req, res) => {
  console.log("Entered /individual/all route for:", req.url);
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const userId = req.query.userId;
    const date = req.query.date || new Date().toISOString().split("T")[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    console.log("Fetching all metrics for:", { userId, date });

    const metrics = { daily: [], weekly: [], monthly: [] };

    let dailyQuery = `
      SELECT user_id, date, item_type, task_type, 
             SUM(count) as count, SUM(blocks) as blocks
      FROM daily_metrics
      WHERE date = $1
    `;
    let dailyParams = [date];

    if (userId && userId !== "all") {
      dailyQuery += ` AND user_id = $2`;
      dailyParams.push(userId);
    }

    dailyQuery += ` GROUP BY user_id, date, item_type, task_type ORDER BY user_id`;

    const dailyResult = await db.query(dailyQuery, dailyParams);
    console.log("Daily query result:", dailyResult.rows);

    const dailyMetricsMap = {};
    dailyResult.rows.forEach((row) => {
      const userId = row.user_id.toString();
      if (!dailyMetricsMap[userId]) {
        dailyMetricsMap[userId] = {
          userId: userId,
          date: date,
          counts: {},
          totalBlocks: 0,
        };
      }

      if (!dailyMetricsMap[userId].counts[row.item_type]) {
        dailyMetricsMap[userId].counts[row.item_type] = {};
      }

      dailyMetricsMap[userId].counts[row.item_type][row.task_type] =
        parseInt(row.count) || 0;
      dailyMetricsMap[userId].totalBlocks += parseInt(row.blocks) || 0;
    });

    metrics.daily = Object.values(dailyMetricsMap);

    // Weekly and monthly logic (unchanged)
    const weekStartDate = new Date(date);
    weekStartDate.setDate(weekStartDate.getDate() - 6);

    let weeklyQuery = `
      SELECT user_id, item_type, task_type, 
             SUM(count) as count, SUM(blocks) as blocks,
             DATE_TRUNC('week', $1::date) as week_start
      FROM daily_metrics
      WHERE date >= $2 AND date <= $1
    `;
    let weeklyParams = [date, weekStartDate.toISOString().split("T")[0]];

    if (userId && userId !== "all") {
      weeklyQuery += ` AND user_id = $3`;
      weeklyParams.push(userId);
    }

    weeklyQuery += ` GROUP BY user_id, item_type, task_type ORDER BY user_id`;

    const weeklyResult = await db.query(weeklyQuery, weeklyParams);
    const weeklyMetricsMap = {};
    weeklyResult.rows.forEach((row) => {
      const userId = row.user_id.toString();
      if (!weeklyMetricsMap[userId]) {
        weeklyMetricsMap[userId] = {
          userId: userId,
          week_start: row.week_start,
          counts: {},
          totalBlocks: 0,
        };
      }
      if (!weeklyMetricsMap[userId].counts[row.item_type]) {
        weeklyMetricsMap[userId].counts[row.item_type] = {};
      }
      weeklyMetricsMap[userId].counts[row.item_type][row.task_type] =
        parseInt(row.count) || 0;
      weeklyMetricsMap[userId].totalBlocks += parseInt(row.blocks) || 0;
    });
    metrics.weekly = Object.values(weeklyMetricsMap);

    const monthStartDate = new Date(date);
    monthStartDate.setDate(monthStartDate.getDate() - 29);

    let monthlyQuery = `
      SELECT user_id, item_type, task_type, 
             SUM(count) as count, SUM(blocks) as blocks,
             DATE_TRUNC('month', $1::date) as month_start
      FROM daily_metrics
      WHERE date >= $2 AND date <= $1
    `;
    let monthlyParams = [date, monthStartDate.toISOString().split("T")[0]];

    if (userId && userId !== "all") {
      monthlyQuery += ` AND user_id = $3`;
      monthlyParams.push(userId);
    }

    monthlyQuery += ` GROUP BY user_id, item_type, task_type ORDER BY user_id`;

    const monthlyResult = await db.query(monthlyQuery, monthlyParams);
    const monthlyMetricsMap = {};
    monthlyResult.rows.forEach((row) => {
      const userId = row.user_id.toString();
      if (!monthlyMetricsMap[userId]) {
        monthlyMetricsMap[userId] = {
          userId: userId,
          month_start: row.month_start,
          counts: {},
          totalBlocks: 0,
        };
      }
      if (!monthlyMetricsMap[userId].counts[row.item_type]) {
        monthlyMetricsMap[userId].counts[row.item_type] = {};
      }
      monthlyMetricsMap[userId].counts[row.item_type][row.task_type] =
        parseInt(row.count) || 0;
      monthlyMetricsMap[userId].totalBlocks += parseInt(row.blocks) || 0;
    });
    metrics.monthly = Object.values(monthlyMetricsMap);

    console.log("Final metrics response:", {
      daily: metrics.daily.length,
      weekly: metrics.weekly.length,
      monthly: metrics.monthly.length,
    });

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Failed to fetch individual metrics:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      message: "Failed to fetch individual metrics",
      error: error.message,
    });
  }
});

router.get("/individual/:itemType", protect, async (req, res) => {
  // ... (existing /individual/:itemType logic unchanged)
});

// Other routes (blocks/totals, projects/progress, etc.) remain unchanged
module.exports = router;

router.get("/individual/:itemType", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { itemType } = req.params;
    const validItemTypes = [
      "lines",
      "equipment",
      "pids",
      "non_inline_instruments",
    ];
    if (!validItemTypes.includes(itemType.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid item type. Valid types: ${validItemTypes.join(", ")}`,
      });
    }
    const mappedItemType = {
      lines: "Line",
      equipment: "Equipment",
      pids: "PID",
      non_inline_instruments: "NonInlineInstrument",
    }[itemType.toLowerCase()];

    const userId = req.query.userId ? String(req.query.userId) : req.user.id;
    const date = req.query.date || new Date().toISOString().split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    console.log(
      JSON.stringify({
        level: "info",
        message: "Fetching metrics",
        userId,
        date,
        itemType,
      })
    );

    const metrics = { daily: [], weekly: [], monthly: [] };
    const query = `
      SELECT user_id, date, item_type, task_type, SUM(count) as count, SUM(blocks) as blocks,
             DATE_TRUNC('week', date) as week_start,
             DATE_TRUNC('month', date) as month_start
      FROM daily_metrics
      WHERE date = $1
        AND item_type = $2
        ${userId ? "AND user_id = $3" : ""}
      GROUP BY user_id, date, item_type, task_type, week_start, month_start
    `;
    const params = userId
      ? [date, mappedItemType, userId]
      : [date, mappedItemType];
    const result = await db.query(query, params);

    // Aggregate daily metrics
    const dailyMetrics = result.rows.filter(
      (r) => r.date.toISOString().split("T")[0] === date
    );
    if (dailyMetrics.length > 0) {
      const userMetric = dailyMetrics.reduce(
        (acc, r) => {
          if (!acc.counts[r.item_type]) acc.counts[r.item_type] = {};
          acc.counts[r.item_type][r.task_type] =
            (acc.counts[r.item_type][r.task_type] || 0) + (r.count || 0);
          acc.totalBlocks += r.blocks || 0;
          return acc;
        },
        { userId: userId.toString(), date: date, counts: {}, totalBlocks: 0 }
      );
      metrics.daily.push(userMetric);
    }

    // Weekly and monthly aggregation (simplified for now)
    metrics.weekly = result.rows
      .filter(
        (r) =>
          r.date >= new Date(new Date(date).getTime() - 7 * 24 * 60 * 60 * 1000)
      )
      .reduce((acc, r) => {
        const key = r.week_start.toISOString();
        if (!acc[key])
          acc[key] = {
            userId: r.user_id.toString(),
            week_start: r.week_start,
            counts: {},
            totalBlocks: 0,
          };
        if (!acc[key].counts[r.item_type]) acc[key].counts[r.item_type] = {};
        acc[key].counts[r.item_type][r.task_type] =
          (acc[key].counts[r.item_type][r.task_type] || 0) + (r.count || 0);
        acc[key].totalBlocks += r.blocks || 0;
        return acc;
      }, {});
    metrics.weekly = Object.values(metrics.weekly);

    metrics.monthly = result.rows.reduce((acc, r) => {
      const key = r.month_start.toISOString();
      if (!acc[key])
        acc[key] = {
          userId: r.user_id.toString(),
          month_start: r.month_start,
          counts: {},
          totalBlocks: 0,
        };
      if (!acc[key].counts[r.item_type]) acc[key].counts[r.item_type] = {};
      acc[key].counts[r.item_type][r.task_type] =
        (acc[key].counts[r.item_type][r.task_type] || 0) + (r.count || 0);
      acc[key].totalBlocks += r.blocks || 0;
      return acc;
    }, {});
    metrics.monthly = Object.values(metrics.monthly);

    console.log(
      JSON.stringify({
        level: "info",
        message: "Metrics fetched",
        itemType,
        rowCount: result.rows.length,
        daily: metrics.daily,
      })
    );

    res.status(200).json(metrics);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Failed to fetch individual metrics",
        error: error.message,
        code: error.code || "N/A",
        query: error.query || "N/A",
        params: userId
          ? [date, mappedItemType, userId]
          : [date, mappedItemType],
        pgError: error.detail || error.hint || "No PostgreSQL detail available",
      })
    );
    res.status(500).json({
      message: "Failed to fetch individual metrics",
      error: error.message,
    });
  }
});

router.get("/blocks/totals", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const date = req.query.date || new Date().toISOString().split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    console.log(
      JSON.stringify({ level: "info", message: "Fetching block totals", date })
    );

    const totalsQuery = `
      SELECT user_id,
        COALESCE(SUM(CASE WHEN date = $1 THEN blocks ELSE 0 END), 0) as daily,
        COALESCE(SUM(CASE WHEN date >= $1::date - INTERVAL '7 days' AND date <= $1 THEN blocks ELSE 0 END), 0) as weekly,
        COALESCE(SUM(CASE WHEN date >= $1::date - INTERVAL '30 days' AND date <= $1 THEN blocks ELSE 0 END), 0) as monthly
      FROM daily_metrics
      GROUP BY user_id
    `;
    const result = await db.query(totalsQuery, [date]);
    const totals = result.rows.reduce((acc, row) => {
      acc[row.user_id.toString()] = {
        daily: parseInt(row.daily),
        weekly: parseInt(row.weekly),
        monthly: parseInt(row.monthly),
      };
      return acc;
    }, {});

    console.log(
      JSON.stringify({
        level: "info",
        message: "Block totals fetched",
        date,
        userCount: Object.keys(totals).length,
      })
    );

    res.status(200).json(totals);
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Failed to fetch block totals",
        error: error.message,
        code: error.code || "N/A",
        query: error.query || "N/A",
        params: [date],
        pgError: error.detail || error.hint || "No PostgreSQL detail available",
      })
    );
    res
      .status(500)
      .json({ message: "Failed to fetch block totals", error: error.message });
  }
});

router.get("/projects/progress", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({ message: "Unauthorized access" });
    }
    const { itemType, taskType } = req.query;
    const validItemTypes = [
      "lines",
      "equipment",
      "pids",
      "non_inline_instruments",
    ];
    if (itemType && !validItemTypes.includes(itemType.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid item type. Valid types: ${validItemTypes.join(", ")}`,
      });
    }
    const mappedItemType = itemType
      ? {
          lines: "Line",
          equipment: "Equipment",
          pids: "PID",
          non_inline_instruments: "NonInlineInstrument",
        }[itemType.toLowerCase()]
      : null;
    const validTaskTypes = ["upv", "qc", "redline", "all"];
    if (taskType && !validTaskTypes.includes(taskType.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid task type. Valid types: ${validTaskTypes.join(", ")}`,
      });
    }
    const mappedTaskType = taskType
      ? { upv: "UPV", qc: "QC", redline: "Redline" }[taskType.toLowerCase()]
      : null;
    const query = `
      SELECT p.id AS project_id, p.name AS project_name,
       COALESCE(SUM(CASE WHEN dm.task_type = COALESCE($1, dm.task_type) AND dm.item_type = COALESCE($2, dm.item_type) THEN dm.count ELSE 0 END), 0) AS completed_items,
       COALESCE((SELECT COUNT(*) FROM lines l WHERE l.project_id = p.id AND l.type_id IN (SELECT id FROM line_types WHERE name = 'Line')), 0) AS target_items,
       CASE 
         WHEN COALESCE((SELECT COUNT(*) FROM lines l WHERE l.project_id = p.id AND l.type_id IN (SELECT id FROM line_types WHERE name = 'Line')), 0) = 0 THEN 0
         ELSE ROUND((COALESCE(SUM(CASE WHEN dm.task_type = COALESCE($1, dm.task_type) AND dm.item_type = COALESCE($2, dm.item_type) THEN dm.count ELSE 0 END), 0)::FLOAT /
                    NULLIF((SELECT COUNT(*) FROM lines l WHERE l.project_id = p.id AND l.type_id IN (SELECT id FROM line_types WHERE name = 'Line')), 0)) * 100, 2)
       END AS progress
      FROM projects p
      LEFT JOIN daily_metrics dm ON dm.entity_id IN (SELECT id FROM lines WHERE project_id = p.id)
      GROUP BY p.id, p.name
      HAVING COALESCE((SELECT COUNT(*) FROM lines l WHERE l.project_id = p.id), 0) > 0;
    `;
    const params = [mappedTaskType, mappedItemType].filter((p) => p !== null);
    const result = await db.query(query, params.length ? params : [null, null]);
    const progress = result.rows.map((row) => ({
      projectId: row.project_id.toString(),
      projectName: row.project_name,
      completedItems: parseInt(row.completed_items),
      targetItems: parseInt(row.target_items),
      progress: row.progress ? `${row.progress}%` : "0%",
    }));
    res.status(200).json({ data: progress });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Failed to fetch project progress",
        error: error.message,
        code: error.code || "N/A",
        query: error.query || "N/A",
        params: req.query,
        pgError: error.detail || error.hint || "No PostgreSQL detail available",
      })
    );
    res.status(500).json({
      message: "Failed to fetch project progress",
      error: error.message,
    });
  }
});

router.get("/area/progress", protect, async (req, res) => {
  try {
    if (req.user.role !== "Project Manager") {
      return res.status(403).json({ message: "Unauthorized access" });
    }
    const query = `
      SELECT a.id AS area_id, a.name AS area_name,
       COALESCE(SUM(CASE WHEN dm.task_type = 'QC' AND dm.item_type IN ('Line', 'Equipment') THEN dm.count ELSE 0 END), 0) AS completed_items,
       COALESCE((SELECT COUNT(*) FROM lines l JOIN projects p ON l.project_id = p.id WHERE p.id = a.project_id AND l.type_id IN (SELECT id FROM line_types WHERE name = 'Line')), 0) AS target_items,
       CASE 
         WHEN COALESCE((SELECT COUNT(*) FROM lines l JOIN projects p ON l.project_id = p.id WHERE p.id = a.project_id AND l.type_id IN (SELECT id FROM line_types WHERE name = 'Line')), 0) = 0 THEN 0
         ELSE ROUND((COALESCE(SUM(CASE WHEN dm.task_type = 'QC' AND dm.item_type IN ('Line', 'Equipment') THEN dm.count ELSE 0 END), 0)::FLOAT /
                    NULLIF((SELECT COUNT(*) FROM lines l JOIN projects p ON l.project_id = p.id WHERE p.id = a.project_id AND l.type_id IN (SELECT id FROM line_types WHERE name = 'Line')), 0)) * 100, 2)
       END AS progress
      FROM areas a
      LEFT JOIN projects p ON p.id = a.project_id
      LEFT JOIN daily_metrics dm ON dm.entity_id IN (SELECT id FROM lines WHERE project_id = p.id) AND dm.item_type IN ('Line', 'Equipment')
      GROUP BY a.id, a.name
      HAVING COALESCE((SELECT COUNT(*) FROM lines l JOIN projects p ON l.project_id = p.id WHERE p.id = a.project_id), 0) > 0;
    `;
    const result = await db.query(query);
    const progress = result.rows.map((row) => ({
      areaId: row.area_id.toString(),
      areaName: row.area_name,
      completedItems: parseInt(row.completed_items),
      targetItems: parseInt(row.target_items),
      progress: row.progress ? `${row.progress}%` : "0%",
    }));
    res.status(200).json({ data: progress });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Failed to fetch area progress",
        error: error.message,
        code: error.code || "N/A",
        query: error.query || "N/A",
        pgError: error.detail || error.hint || "No PostgreSQL detail available",
      })
    );
    res.status(500).json({
      message: "Failed to fetch area progress",
      error: error.message,
    });
  }
});

router.post("/individual/update", protect, async (req, res) => {
  try {
    const {
      userId,
      taskId,
      itemId,
      itemType,
      taskType,
      action,
      blocks = 0,
    } = req.body;
    console.log("Received Request:", {
      userId,
      taskId,
      itemId,
      itemType,
      taskType,
      action,
      blocks,
    });
    if (action !== "increment") {
      return res.status(400).json({ message: "Invalid action" });
    }
    const taskItemResult = await db.query(
      "SELECT line_id, item_id, item_type FROM task_items WHERE id = $1",
      [itemId]
    );
    console.log("Task Item Query Result:", taskItemResult.rows);
    if (taskItemResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: `Task item not found for id: ${itemId}` });
    }
    let effectiveEntityId = taskItemResult.rows[0].line_id;
    const { item_id, item_type } = taskItemResult.rows[0];

    if (!effectiveEntityId) {
      let projectId = null;
      if (item_type === "Equipment") {
        const equipResult = await db.query(
          "SELECT project_id FROM equipment WHERE id = $1",
          [item_id]
        );
        projectId = equipResult.rows[0]?.project_id;
      } else if (item_type === "NonInlineInstrument") {
        const instrResult = await db.query(
          "SELECT project_id FROM non_inline_instruments WHERE id = $1",
          [item_id]
        );
        projectId = instrResult.rows[0]?.project_id;
      } else if (item_type === "PID") {
        const pidResult = await db.query(
          "SELECT project_id FROM pids WHERE id = $1",
          [item_id]
        );
        projectId = pidResult.rows[0]?.project_id;
      } else if (item_type === "Line") {
        const lineResult = await db.query(
          "SELECT id FROM lines WHERE id = $1",
          [item_id]
        );
        effectiveEntityId = lineResult.rows[0]?.id;
      }
      if (projectId && !effectiveEntityId) {
        const lineMatch = await db.query(
          "SELECT id FROM lines WHERE project_id = $1 LIMIT 1",
          [projectId]
        );
        effectiveEntityId = lineMatch.rows[0]?.id;
      }
      if (!effectiveEntityId) {
        const taskResult = await db.query(
          "SELECT project_id FROM tasks WHERE id = $1",
          [taskId]
        );
        projectId = taskResult.rows[0]?.project_id;
        if (projectId) {
          const newLineResult = await db.query(
            "INSERT INTO lines (project_id, line_number, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id",
            [projectId, "Default Line"]
          );
          effectiveEntityId = newLineResult.rows[0].id;
          await db.query("UPDATE task_items SET line_id = $1 WHERE id = $2", [
            effectiveEntityId,
            itemId,
          ]);
          console.log("Created new line_id:", effectiveEntityId);
        }
      }
    }

    if (!effectiveEntityId) {
      return res
        .status(404)
        .json({ message: "No valid entity found for task item" });
    }

    const result = await db.query(
      `INSERT INTO daily_metrics (user_id, entity_id, item_type, task_type, count, date, blocks)
       VALUES ($1, $2, $3, $4, 1, CURRENT_DATE, $5)
       ON CONFLICT (user_id, date, item_type, task_type) 
       DO UPDATE SET count = daily_metrics.count + 1, blocks = daily_metrics.blocks + $5, entity_id = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, effectiveEntityId, itemType, taskType, blocks]
    );
    res.status(200).json({ message: "Metric updated", data: result.rows[0] });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        message: "Failed to update individual metrics",
        error: error.message,
        code: error.code || "N/A",
        body: req.body,
        pgError: error.detail || error.hint || "No PostgreSQL detail available",
      })
    );
    res.status(500).json({
      message: "Failed to update individual metrics",
      error: error.message,
      detail: error.detail || "Check backend logs",
    });
  }
});

module.exports = router;
