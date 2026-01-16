const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// Replace the existing /individual/all route with this updated version
router.get("/individual/all", protect, async (req, res) => {
  console.log("Entered /individual/all route for:", req.url);
  try {
    if (!["Project Manager", "Team Member"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    let userId = req.query.userId || req.user.id;
    if (req.user.role === "Team Member") {
      userId = req.user.id;
    }

    const date = req.query.date || new Date().toISOString().split("T")[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    console.log("Fetching all metrics for:", { userId, date });

    if (req.user.role === "Team Member") {
      const dailyQuery = `
        SELECT item_type, SUM(count) as count, SUM(blocks) as blocks
        FROM daily_metrics
        WHERE date = $1 AND user_id = $2
        GROUP BY item_type
      `;
      const dailyResult = await db.query(dailyQuery, [date, userId]);
      const data = dailyResult.rows.map((row) => ({
        item_type: row.item_type,
        count: parseInt(row.count) || 0,
        blocks: parseInt(row.blocks) || 0,
      }));
      return res.status(200).json({ data });
    } else {
      const metrics = { daily: [], weekly: [], monthly: [] };

      // ========== DAILY METRICS ==========
      console.log(" Fetching daily metrics for date:", date);

      // Get all users first
      const usersQuery = `SELECT id, name FROM users ORDER BY name`;
      const usersResult = await db.query(usersQuery);
      const allUsers = usersResult.rows;

      console.log(
        `Found ${allUsers.length} users:`,
        allUsers.map((u) => `${u.name}(${u.id})`)
      );

      // Build daily metrics map for ALL users
      const dailyMetricsMap = {};

      allUsers.forEach((user) => {
        const uid = user.id.toString();
        dailyMetricsMap[uid] = {
          userId: uid,
          date: date,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
            PID: {
              Redline: { completed: 0, skipped: 0 },
            },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
          },
          totalBlocks: 0,
        };
      });

      // Fetch completed counts from daily_metrics
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
      console.log(
        ` Daily metrics query returned ${dailyResult.rows.length} rows`
      );

      dailyResult.rows.forEach((row) => {
        const uid = row.user_id.toString();
        if (dailyMetricsMap[uid] && row.item_type && row.task_type) {
          const itemType = row.item_type;
          const taskType = row.task_type;

          if (
            dailyMetricsMap[uid].counts[itemType] &&
            dailyMetricsMap[uid].counts[itemType][taskType]
          ) {
            dailyMetricsMap[uid].counts[itemType][taskType].completed =
              parseInt(row.count) || 0;
            dailyMetricsMap[uid].totalBlocks += parseInt(row.blocks) || 0;
          }
        }
      });

      //   CRITICAL FIX: Fetch skipped counts from skipped_items_tracking
      let skippedDailyQuery = `
        SELECT 
          user_id,
          item_type,
          task_type,
          COUNT(*) AS skipped
        FROM skipped_items_tracking
        WHERE date = $1
      `;
      let skippedDailyParams = [date];

      if (userId && userId !== "all") {
        skippedDailyQuery += ` AND user_id = $2`;
        skippedDailyParams.push(userId);
      }

      skippedDailyQuery += ` GROUP BY user_id, item_type, task_type ORDER BY user_id`;

      const skippedDailyResult = await db.query(
        skippedDailyQuery,
        skippedDailyParams
      );
      console.log(
        ` Skipped items query returned ${skippedDailyResult.rows.length} rows`
      );

      skippedDailyResult.rows.forEach((row) => {
        const uid = row.user_id.toString();
        console.log(`Processing skipped for user ${uid}:`, row);

        if (dailyMetricsMap[uid] && row.item_type && row.task_type) {
          const itemType = row.item_type;
          const taskType = row.task_type;

          if (
            dailyMetricsMap[uid].counts[itemType] &&
            dailyMetricsMap[uid].counts[itemType][taskType]
          ) {
            dailyMetricsMap[uid].counts[itemType][taskType].skipped =
              parseInt(row.skipped) || 0;
            console.log(
              `  Set skipped=${row.skipped} for user ${uid}, ${itemType}, ${taskType}`
            );
          }
        }
      });

      // Filter out users with no activity
      metrics.daily = Object.values(dailyMetricsMap).filter((user) => {
        const hasActivity =
          Object.values(user.counts).some((itemType) =>
            Object.values(itemType).some(
              (taskType) => taskType.completed > 0 || taskType.skipped > 0
            )
          ) || user.totalBlocks > 0;
        return hasActivity;
      });

      console.log(
        `  Final daily metrics: ${metrics.daily.length} users with activity`
      );

      // ========== WEEKLY METRICS (Similar logic) ==========
      const weekStartDate = new Date(date);
      weekStartDate.setDate(weekStartDate.getDate() - 6);
      const weekStartStr = weekStartDate.toISOString().split("T")[0];

      const weeklyMetricsMap = {};
      allUsers.forEach((user) => {
        const uid = user.id.toString();
        weeklyMetricsMap[uid] = {
          userId: uid,
          week_start: weekStartStr,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
            PID: { Redline: { completed: 0, skipped: 0 } },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
          },
          totalBlocks: 0,
        };
      });

      // Weekly completed
      let weeklyQuery = `
        SELECT user_id, item_type, task_type, 
               SUM(count) as count, SUM(blocks) as blocks
        FROM daily_metrics
        WHERE date >= $1 AND date <= $2
      `;
      let weeklyParams = [weekStartStr, date];

      if (userId && userId !== "all") {
        weeklyQuery += ` AND user_id = $3`;
        weeklyParams.push(userId);
      }

      weeklyQuery += ` GROUP BY user_id, item_type, task_type ORDER BY user_id`;

      const weeklyResult = await db.query(weeklyQuery, weeklyParams);
      weeklyResult.rows.forEach((row) => {
        const uid = row.user_id.toString();
        if (weeklyMetricsMap[uid] && row.item_type && row.task_type) {
          const itemType = row.item_type;
          const taskType = row.task_type;
          if (weeklyMetricsMap[uid].counts[itemType]?.[taskType]) {
            weeklyMetricsMap[uid].counts[itemType][taskType].completed =
              parseInt(row.count) || 0;
            weeklyMetricsMap[uid].totalBlocks += parseInt(row.blocks) || 0;
          }
        }
      });

      // Weekly skipped
      let skippedWeeklyQuery = `
        SELECT user_id, item_type, task_type, COUNT(*) AS skipped
        FROM skipped_items_tracking
        WHERE date >= $1 AND date <= $2
      `;
      let skippedWeeklyParams = [weekStartStr, date];

      if (userId && userId !== "all") {
        skippedWeeklyQuery += ` AND user_id = $3`;
        skippedWeeklyParams.push(userId);
      }

      skippedWeeklyQuery += ` GROUP BY user_id, item_type, task_type ORDER BY user_id`;

      const skippedWeeklyResult = await db.query(
        skippedWeeklyQuery,
        skippedWeeklyParams
      );
      skippedWeeklyResult.rows.forEach((row) => {
        const uid = row.user_id.toString();
        if (weeklyMetricsMap[uid] && row.item_type && row.task_type) {
          const itemType = row.item_type;
          const taskType = row.task_type;
          if (weeklyMetricsMap[uid].counts[itemType]?.[taskType]) {
            weeklyMetricsMap[uid].counts[itemType][taskType].skipped =
              parseInt(row.skipped) || 0;
          }
        }
      });

      metrics.weekly = Object.values(weeklyMetricsMap).filter((user) => {
        const hasActivity =
          Object.values(user.counts).some((itemType) =>
            Object.values(itemType).some(
              (taskType) => taskType.completed > 0 || taskType.skipped > 0
            )
          ) || user.totalBlocks > 0;
        return hasActivity;
      });

      // ========== MONTHLY METRICS (Similar logic) ==========
      const monthStartDate = new Date(date);
      monthStartDate.setDate(monthStartDate.getDate() - 29);
      const monthStartStr = monthStartDate.toISOString().split("T")[0];

      const monthlyMetricsMap = {};
      allUsers.forEach((user) => {
        const uid = user.id.toString();
        monthlyMetricsMap[uid] = {
          userId: uid,
          month_start: monthStartStr,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
            PID: { Redline: { completed: 0, skipped: 0 } },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0 },
              QC: { completed: 0, skipped: 0 },
              Redline: { completed: 0, skipped: 0 },
            },
          },
          totalBlocks: 0,
        };
      });

      // Monthly completed
      let monthlyQuery = `
        SELECT user_id, item_type, task_type, 
               SUM(count) as count, SUM(blocks) as blocks
        FROM daily_metrics
        WHERE date >= $1 AND date <= $2
      `;
      let monthlyParams = [monthStartStr, date];

      if (userId && userId !== "all") {
        monthlyQuery += ` AND user_id = $3`;
        monthlyParams.push(userId);
      }

      monthlyQuery += ` GROUP BY user_id, item_type, task_type ORDER BY user_id`;

      const monthlyResult = await db.query(monthlyQuery, monthlyParams);
      monthlyResult.rows.forEach((row) => {
        const uid = row.user_id.toString();
        if (monthlyMetricsMap[uid] && row.item_type && row.task_type) {
          const itemType = row.item_type;
          const taskType = row.task_type;
          if (monthlyMetricsMap[uid].counts[itemType]?.[taskType]) {
            monthlyMetricsMap[uid].counts[itemType][taskType].completed =
              parseInt(row.count) || 0;
            monthlyMetricsMap[uid].totalBlocks += parseInt(row.blocks) || 0;
          }
        }
      });

      // Monthly skipped
      let skippedMonthlyQuery = `
        SELECT user_id, item_type, task_type, COUNT(*) AS skipped
        FROM skipped_items_tracking
        WHERE date >= $1 AND date <= $2
      `;
      let skippedMonthlyParams = [monthStartStr, date];

      if (userId && userId !== "all") {
        skippedMonthlyQuery += ` AND user_id = $3`;
        skippedMonthlyParams.push(userId);
      }

      skippedMonthlyQuery += ` GROUP BY user_id, item_type, task_type ORDER BY user_id`;

      const skippedMonthlyResult = await db.query(
        skippedMonthlyQuery,
        skippedMonthlyParams
      );
      skippedMonthlyResult.rows.forEach((row) => {
        const uid = row.user_id.toString();
        if (monthlyMetricsMap[uid] && row.item_type && row.task_type) {
          const itemType = row.item_type;
          const taskType = row.task_type;
          if (monthlyMetricsMap[uid].counts[itemType]?.[taskType]) {
            monthlyMetricsMap[uid].counts[itemType][taskType].skipped =
              parseInt(row.skipped) || 0;
          }
        }
      });

      metrics.monthly = Object.values(monthlyMetricsMap).filter((user) => {
        const hasActivity =
          Object.values(user.counts).some((itemType) =>
            Object.values(itemType).some(
              (taskType) => taskType.completed > 0 || taskType.skipped > 0
            )
          ) || user.totalBlocks > 0;
        return hasActivity;
      });

      console.log("Final metrics response:", {
        daily: metrics.daily.length,
        weekly: metrics.weekly.length,
        monthly: metrics.monthly.length,
      });

      res.status(200).json(metrics);
    }
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
          if (!acc.counts[r.item_type][r.task_type]) {
            acc.counts[r.item_type][r.task_type] = {
              completed: 0,
              blocks: 0,
              skipped: 0,
            };
          }
          acc.counts[r.item_type][r.task_type].completed += r.count || 0;
          acc.counts[r.item_type][r.task_type].blocks += r.blocks || 0;
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
        if (!acc[key].counts[r.item_type][r.task_type]) {
          acc[key].counts[r.item_type][r.task_type] = {
            completed: 0,
            blocks: 0,
            skipped: 0,
          };
        }
        acc[key].counts[r.item_type][r.task_type].completed += r.count || 0;
        acc[key].counts[r.item_type][r.task_type].blocks += r.blocks || 0;
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
      if (!acc[key].counts[r.item_type][r.task_type]) {
        acc[key].counts[r.item_type][r.task_type] = {
          completed: 0,
          blocks: 0,
          skipped: 0,
        };
      }
      acc[key].counts[r.item_type][r.task_type].completed += r.count || 0;
      acc[key].counts[r.item_type][r.task_type].blocks += r.blocks || 0;
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

    console.log("Projects/progress request:", { itemType, taskType });

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

    const validTaskTypes = ["upv", "qc", "redline", "all"];
    if (taskType && !validTaskTypes.includes(taskType.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid task type. Valid types: ${validTaskTypes.join(", ")}`,
      });
    }

    const mappedItemType = itemType
      ? {
        lines: "Line",
        equipment: "Equipment",
        pids: "PID",
        non_inline_instruments: "NonInlineInstrument",
      }[itemType.toLowerCase()]
      : "Line";

    const mappedTaskType = taskType
      ? { upv: "UPV", qc: "QC", redline: "Redline", all: null }[
      taskType.toLowerCase()
      ]
      : null;

    let query = "";
    let params = [];

    if (mappedItemType === "Line") {
      query = `
        SELECT 
          p.id AS project_id,
          p.name AS project_name,
          COALESCE(SUM(dm.count), 0) AS completed_items,
          COALESCE(COUNT(DISTINCT l.id), 0) AS target_items
        FROM projects p
        LEFT JOIN lines l ON l.project_id = p.id
        LEFT JOIN daily_metrics dm ON dm.entity_id = l.id 
          AND dm.item_type = 'Line'
          ${mappedTaskType ? "AND dm.task_type = $1" : ""}
        GROUP BY p.id, p.name
        HAVING COUNT(DISTINCT l.id) > 0
        ORDER BY p.name
      `;
      if (mappedTaskType) params.push(mappedTaskType);
    } else if (mappedItemType === "Equipment") {
      query = `
        SELECT 
          p.id AS project_id,
          p.name AS project_name,
          COALESCE(SUM(CASE WHEN e.status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed_items,
          COALESCE(COUNT(DISTINCT e.id), 0) AS target_items
        FROM projects p
        LEFT JOIN equipment e ON e.project_id = p.id
        GROUP BY p.id, p.name
        HAVING COUNT(DISTINCT e.id) > 0
        ORDER BY p.name
      `;
    } else if (mappedItemType === "PID") {
      query = `
        SELECT 
          p.id AS project_id,
          p.name AS project_name,
          COALESCE(SUM(CASE WHEN pid.assigned_to_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS completed_items,
          COALESCE(COUNT(DISTINCT pid.id), 0) AS target_items
        FROM projects p
        LEFT JOIN pids pid ON pid.project_id = p.id
        GROUP BY p.id, p.name
        HAVING COUNT(DISTINCT pid.id) > 0
        ORDER BY p.name
      `;
    } else if (mappedItemType === "NonInlineInstrument") {
      query = `
        SELECT 
          p.id AS project_id,
          p.name AS project_name,
          COALESCE(SUM(CASE WHEN nli.assigned_to IS NOT NULL THEN 1 ELSE 0 END), 0) AS completed_items,
          COALESCE(COUNT(DISTINCT nli.id), 0) AS target_items
        FROM projects p
        LEFT JOIN non_inline_instruments nli ON nli.project_id = p.id
        GROUP BY p.id, p.name
        HAVING COUNT(DISTINCT nli.id) > 0
        ORDER BY p.name
      `;
    }

    console.log("Executing query:", query);
    console.log("With params:", params);

    const result = await db.query(query, params);

    console.log("Query result rows:", result.rows.length);

    const progress = result.rows.map((row) => {
      const completed = parseInt(row.completed_items) || 0;
      const target = parseInt(row.target_items) || 0;
      const progressPercent =
        target > 0 ? parseFloat(((completed / target) * 100).toFixed(2)) : 0;

      return {
        projectId: row.project_id.toString(),
        projectName: row.project_name,
        completedItems: completed,
        targetItems: target,
        progress: `${progressPercent}%`,
      };
    });

    console.log("Final response:", progress);

    res.status(200).json({ data: progress });
  } catch (error) {
    console.error("Error fetching project progress:", {
      message: error.message,
      query: error.query,
      params: error.params,
      detail: error.detail,
      hint: error.hint,
    });
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
      SELECT 
        a.id AS area_id,
        a.name AS area_name,
        COALESCE(SUM(dm.count), 0) AS completed_items,
        COALESCE(COUNT(DISTINCT l.id), 0) AS target_items
      FROM areas a
      LEFT JOIN lines l ON l.area_id = a.id
      LEFT JOIN daily_metrics dm ON dm.entity_id = l.id 
        AND dm.item_type = 'Line'
        AND dm.task_type IN ('UPV', 'QC')
      GROUP BY a.id, a.name
      HAVING COUNT(DISTINCT l.id) > 0
      ORDER BY a.name
    `;

    console.log("Executing area query");

    const result = await db.query(query);

    console.log("Area query result rows:", result.rows.length);

    const progress = result.rows.map((row) => {
      const completed = parseInt(row.completed_items) || 0;
      const target = parseInt(row.target_items) || 0;
      const progressPercent =
        target > 0 ? parseFloat(((completed / target) * 100).toFixed(2)) : 0;

      return {
        areaId: row.area_id.toString(),
        areaName: row.area_name,
        completedItems: completed,
        targetItems: target,
        progress: `${progressPercent}%`,
      };
    });

    console.log("Final area response:", progress);

    res.status(200).json({ data: progress });
  } catch (error) {
    console.error("Error fetching area progress:", {
      message: error.message,
      query: error.query,
      detail: error.detail,
      hint: error.hint,
    });
    res.status(500).json({
      message: "Failed to fetch area progress",
      error: error.message,
    });
  }
});

router.get("/team/progress", protect, async (req, res) => {
  try {
    if (!["Project Manager", "Team Lead"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const query = `
      SELECT 
        tl.id AS team_id,
        tl.name AS team_name,
        COALESCE(COUNT(DISTINCT CASE WHEN dm.count > 0 THEN l.id END), 0) AS completed_items,
        COALESCE(COUNT(DISTINCT l.id), 0) AS target_items
      FROM (
        SELECT DISTINCT ON (team_lead_id) team_lead_id, name 
        FROM teams 
        WHERE team_lead_id IS NOT NULL
      ) tl
      LEFT JOIN teams t ON t.team_lead_id = tl.team_lead_id
      LEFT JOIN users u ON u.id = t.team_lead_id
      LEFT JOIN lines l ON l.assigned_to_id IN (
        SELECT user_id FROM teams WHERE team_lead_id = tl.team_lead_id
      )
      LEFT JOIN daily_metrics dm ON dm.entity_id = l.id 
        AND dm.item_type = 'Line'
      GROUP BY tl.id, tl.name
      ORDER BY tl.name
    `;

    const result = await db.query(query);

    const progress = result.rows.map((row) => {
      const completed = parseInt(row.completed_items) || 0;
      const target = parseInt(row.target_items) || 0;
      const progressPercent =
        target > 0 ? Math.round((completed / target) * 100) : 0;

      return {
        teamId: row.team_id.toString(),
        teamName: row.team_name,
        completedItems: completed,
        targetItems: target,
        progress: `${progressPercent}%`,
      };
    });

    res.status(200).json({ data: progress });
  } catch (error) {
    console.error("Error fetching team progress:", {
      message: error.message,
      pgError: error.detail || error.hint || "No detail available",
    });
    res.status(500).json({
      message: "Failed to fetch team progress",
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

router.get("/team/all", protect, async (req, res) => {
  try {
    if (!["Project Manager", "Team Lead"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }
    const date = req.query.date || new Date().toISOString().split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }
    console.log("Fetching team metrics for date:", date);

    // Daily metrics
    let dailyResult;
    try {
      dailyResult = await db.query(dailyQuery, [date]);
      console.log("Daily query result rows:", dailyResult.rows.length);
    } catch (dailyError) {
      console.error("Daily query failed:", dailyError);
      throw dailyError; // Will go to outer catch
    }

    const dailyMetricsMap = {};
    dailyResult.rows.forEach((row) => {
      const teamId = row.team_id ? row.team_id.toString() : null;
      if (!teamId) return; // Skip if null team_id
      if (!dailyMetricsMap[teamId]) {
        dailyMetricsMap[teamId] = {
          teamId: teamId,
          teamName: row.team_name || "Unknown Team",
          date: date,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            PID: { Redline: { completed: 0, skipped: 0, blocks: 0 } },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
          },
          totalBlocks: 0,
        };
      }
      if (row.item_type && row.task_type) {
        const itemType = row.item_type;
        const taskType = row.task_type;
        const count = parseInt(row.count) || 0;
        if (
          dailyMetricsMap[teamId].counts[itemType] &&
          dailyMetricsMap[teamId].counts[itemType][taskType]
        ) {
          dailyMetricsMap[teamId].counts[itemType][taskType].completed += count;
          dailyMetricsMap[teamId].counts[itemType][taskType].blocks +=
            parseInt(row.blocks) || 0;
        }
        dailyMetricsMap[teamId].totalBlocks += parseInt(row.blocks) || 0;
      }
    });
    // ---------- ADD SKIPPED FOR TEAM DAILY ----------
    const skippedDailyQuery = `
      SELECT 
        tl.id AS team_id,
        tl.name AS team_name,
        s.item_type,
        s.task_type,
        COUNT(*) AS skipped
      FROM users tl
      LEFT JOIN (
        SELECT lead_id, member_id FROM team_members
        UNION
        SELECT id as lead_id, id as member_id FROM users WHERE role = 'Team Lead'
      ) tm ON tl.id = tm.lead_id
      LEFT JOIN skipped_items_tracking s ON s.user_id = tm.member_id AND s.date = $1
      WHERE tl.role = 'Team Lead'
      GROUP BY tl.id, tl.name, s.item_type, s.task_type
      ORDER BY tl.id, s.item_type, s.task_type
    `;

    const skippedDailyResult = await db.query(skippedDailyQuery, [date]);
    skippedDailyResult.rows.forEach((row) => {
      const teamId = row.team_id.toString();

      if (!dailyMetricsMap[teamId]) {
        dailyMetricsMap[teamId] = {
          teamId: teamId,
          teamName: row.team_name || "Unknown Team",
          date: date,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            PID: { Redline: { completed: 0, skipped: 0, blocks: 0 } },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
          },
          totalBlocks: 0,
        };
      }

      if (row.item_type && row.task_type) {
        const itemType = row.item_type;
        const taskType = row.task_type;
        const skipped = parseInt(row.skipped) || 0;

        if (dailyMetricsMap[teamId].counts[itemType]) {
          dailyMetricsMap[teamId].counts[itemType][taskType].skipped += skipped;
        }
      }
    });

    // Weekly metrics
    const weekStartDate = new Date(date);
    weekStartDate.setDate(weekStartDate.getDate() - 6);
    const weekStartStr = weekStartDate.toISOString().split("T")[0];

    const weeklyQuery = `
      SELECT 
        tl.id AS team_id,
        tl.name AS team_name,
        dm.item_type,
        dm.task_type,
        SUM(dm.count) AS count,
        SUM(dm.blocks) AS blocks
      FROM users tl
      LEFT JOIN (
        SELECT lead_id, member_id FROM team_members
        UNION
        SELECT id as lead_id, id as member_id FROM users WHERE role = 'Team Lead'
      ) tm ON tl.id = tm.lead_id
      LEFT JOIN daily_metrics dm ON dm.user_id = tm.member_id AND dm.date >= $1 AND dm.date <= $2
      WHERE tl.role = 'Team Lead'
      GROUP BY tl.id, tl.name, dm.item_type, dm.task_type
      ORDER BY tl.id, dm.item_type, dm.task_type
    `;

    const weeklyResult = await db.query(weeklyQuery, [weekStartStr, date]);
    const weeklyMetricsMap = {};

    weeklyResult.rows.forEach((row) => {
      const teamId = row.team_id.toString();

      if (!weeklyMetricsMap[teamId]) {
        weeklyMetricsMap[teamId] = {
          teamId: teamId,
          teamName: row.team_name || "Unknown Team",
          week_start: weekStartStr,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            PID: { Redline: { completed: 0, skipped: 0, blocks: 0 } },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
          },
          totalBlocks: 0,
        };
      }

      if (row.item_type && row.task_type) {
        const itemType = row.item_type;
        const taskType = row.task_type;
        const count = parseInt(row.count) || 0;

        if (weeklyMetricsMap[teamId].counts[itemType]) {
          weeklyMetricsMap[teamId].counts[itemType][taskType].completed +=
            count;
          weeklyMetricsMap[teamId].counts[itemType][taskType].blocks +=
            parseInt(row.blocks) || 0;
        }

        weeklyMetricsMap[teamId].totalBlocks += parseInt(row.blocks) || 0;
      }
    });

    // ---------- ADD SKIPPED FOR TEAM WEEKLY ----------
    const skippedWeeklyQuery = `
      SELECT 
        tl.id AS team_id,
        tl.name AS team_name,
        s.item_type,
        s.task_type,
        COUNT(*) AS skipped
      FROM users tl
      LEFT JOIN (
        SELECT lead_id, member_id FROM team_members
        UNION
        SELECT id as lead_id, id as member_id FROM users WHERE role = 'Team Lead'
      ) tm ON tl.id = tm.lead_id
      LEFT JOIN skipped_items_tracking s ON s.user_id = tm.member_id AND s.date >= $1 AND s.date <= $2
      WHERE tl.role = 'Team Lead'
      GROUP BY tl.id, tl.name, s.item_type, s.task_type
      ORDER BY tl.id, s.item_type, s.task_type
    `;

    const skippedWeeklyResult = await db.query(skippedWeeklyQuery, [
      weekStartStr,
      date,
    ]);
    skippedWeeklyResult.rows.forEach((row) => {
      const teamId = row.team_id.toString();

      if (!weeklyMetricsMap[teamId]) {
        weeklyMetricsMap[teamId] = {
          teamId: teamId,
          teamName: row.team_name || "Unknown Team",
          week_start: weekStartStr,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            PID: { Redline: { completed: 0, skipped: 0, blocks: 0 } },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
          },
          totalBlocks: 0,
        };
      }

      if (row.item_type && row.task_type) {
        const itemType = row.item_type;
        const taskType = row.task_type;
        const skipped = parseInt(row.skipped) || 0;

        if (weeklyMetricsMap[teamId].counts[itemType]) {
          weeklyMetricsMap[teamId].counts[itemType][taskType].skipped +=
            skipped;
        }
      }
    });

    // Monthly metrics
    const monthStartDate = new Date(date);
    monthStartDate.setDate(monthStartDate.getDate() - 29);
    const monthStartStr = monthStartDate.toISOString().split("T")[0];

    const monthlyQuery = `
      SELECT 
        tl.id AS team_id,
        tl.name AS team_name,
        dm.item_type,
        dm.task_type,
        SUM(dm.count) AS count,
        SUM(dm.blocks) AS blocks
      FROM users tl
      LEFT JOIN (
        SELECT lead_id, member_id FROM team_members
        UNION
        SELECT id as lead_id, id as member_id FROM users WHERE role = 'Team Lead'
      ) tm ON tl.id = tm.lead_id
      LEFT JOIN daily_metrics dm ON dm.user_id = tm.member_id AND dm.date >= $1 AND dm.date <= $2
      WHERE tl.role = 'Team Lead'
      GROUP BY tl.id, tl.name, dm.item_type, dm.task_type
      ORDER BY tl.id, dm.item_type, dm.task_type
    `;

    const monthlyResult = await db.query(monthlyQuery, [monthStartStr, date]);
    const monthlyMetricsMap = {};

    monthlyResult.rows.forEach((row) => {
      const teamId = row.team_id.toString();

      if (!monthlyMetricsMap[teamId]) {
        monthlyMetricsMap[teamId] = {
          teamId: teamId,
          teamName: row.team_name || "Unknown Team",
          month_start: monthStartStr,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            PID: { Redline: { completed: 0, skipped: 0, blocks: 0 } },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
          },
          totalBlocks: 0,
        };
      }

      if (row.item_type && row.task_type) {
        const itemType = row.item_type;
        const taskType = row.task_type;
        const count = parseInt(row.count) || 0;

        if (monthlyMetricsMap[teamId].counts[itemType]) {
          monthlyMetricsMap[teamId].counts[itemType][taskType].completed +=
            count;
          monthlyMetricsMap[teamId].counts[itemType][taskType].blocks +=
            parseInt(row.blocks) || 0;
        }

        monthlyMetricsMap[teamId].totalBlocks += parseInt(row.blocks) || 0;
      }
    });

    // ---------- ADD SKIPPED FOR TEAM MONTHLY ----------
    const skippedMonthlyQuery = `
      SELECT 
        tl.id AS team_id,
        tl.name AS team_name,
        s.item_type,
        s.task_type,
        COUNT(*) AS skipped
      FROM users tl
      LEFT JOIN (
        SELECT lead_id, member_id FROM team_members
        UNION
        SELECT id as lead_id, id as member_id FROM users WHERE role = 'Team Lead'
      ) tm ON tl.id = tm.lead_id
      LEFT JOIN skipped_items_tracking s ON s.user_id = tm.member_id AND s.date >= $1 AND s.date <= $2
      WHERE tl.role = 'Team Lead'
      GROUP BY tl.id, tl.name, s.item_type, s.task_type
      ORDER BY tl.id, s.item_type, s.task_type
    `;

    const skippedMonthlyResult = await db.query(skippedMonthlyQuery, [
      monthStartStr,
      date,
    ]);
    skippedMonthlyResult.rows.forEach((row) => {
      const teamId = row.team_id.toString();

      if (!monthlyMetricsMap[teamId]) {
        monthlyMetricsMap[teamId] = {
          teamId: teamId,
          teamName: row.team_name || "Unknown Team",
          month_start: monthStartStr,
          counts: {
            Line: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            Equipment: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
            PID: { Redline: { completed: 0, skipped: 0, blocks: 0 } },
            NonInlineInstrument: {
              UPV: { completed: 0, skipped: 0, blocks: 0 },
              QC: { completed: 0, skipped: 0, blocks: 0 },
              Redline: { completed: 0, skipped: 0, blocks: 0 },
            },
          },
          totalBlocks: 0,
        };
      }

      if (row.item_type && row.task_type) {
        const itemType = row.item_type;
        const taskType = row.task_type;
        const skipped = parseInt(row.skipped) || 0;

        if (monthlyMetricsMap[teamId].counts[itemType]) {
          monthlyMetricsMap[teamId].counts[itemType][taskType].skipped +=
            skipped;
        }
      }
    });

    const metrics = {
      daily: Object.values(dailyMetricsMap),
      weekly: Object.values(weeklyMetricsMap),
      monthly: Object.values(monthlyMetricsMap),
    };

    console.log("Final team metrics response:", {
      daily: metrics.daily.length,
      weekly: metrics.weekly.length,
      monthly: metrics.monthly.length,
    });

    res.status(200).json(metrics);
  } catch (error) {
    console.error("Failed to fetch team metrics:", {
      message: error.message,
      stack: error.stack,
      query: error.query,
      pgError: error.detail || error.hint || "No detail available",
    });
    res.status(500).json({
      message: "Failed to fetch team metrics",
      error: error.message,
    });
  }
});

module.exports = router;
