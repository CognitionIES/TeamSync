const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

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

      // Get all users first
      const usersQuery = `SELECT id, name FROM users ORDER BY name`;
      const usersResult = await db.query(usersQuery);
      const allUsers = usersResult.rows;

      console.log(
        `Found ${allUsers.length} users:`,
        allUsers.map((u) => `${u.name}(${u.id})`),
      );

      // ========== DAILY METRICS ==========
      console.log(" Fetching daily metrics for date:", date);

      const dailyMetricsMap = {};

      allUsers.forEach((user) => {
        const uid = user.id.toString();
        dailyMetricsMap[uid] = {
          userId: uid,
          date: date,
          areaName: null,
          comments: null,
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

      // Fetch completed counts with area info from daily_metrics
      let dailyQuery = `
        SELECT 
          dm.user_id, 
          dm.date, 
          dm.item_type, 
          dm.task_type, 
          SUM(dm.count) as count, 
          SUM(dm.blocks) as blocks,
          a.name as area_name
        FROM daily_metrics dm
        LEFT JOIN (
          SELECT DISTINCT ON (dm2.user_id, dm2.date, dm2.item_type, dm2.task_type)
            dm2.user_id,
            dm2.date,
            dm2.item_type,
            dm2.task_type,
            t.area_id
          FROM daily_metrics dm2
          INNER JOIN tasks t ON t.assignee_id = dm2.user_id 
            AND DATE(t.created_at) <= dm2.date
            AND (t.completed_at IS NULL OR DATE(t.completed_at) >= dm2.date)
          WHERE dm2.date = $1
        ) task_areas ON 
          dm.user_id = task_areas.user_id 
          AND dm.date = task_areas.date
          AND dm.item_type = task_areas.item_type
          AND dm.task_type = task_areas.task_type
        LEFT JOIN areas a ON task_areas.area_id = a.id
        WHERE dm.date = $1
      `;
      let dailyParams = [date];

      if (userId && userId !== "all") {
        dailyQuery += ` AND dm.user_id = $2`;
        dailyParams.push(userId);
      }

      dailyQuery += ` 
        GROUP BY dm.user_id, dm.date, dm.item_type, dm.task_type, a.name
        ORDER BY dm.user_id
      `;

      const dailyResult = await db.query(dailyQuery, dailyParams);
      console.log(
        ` Daily metrics query returned ${dailyResult.rows.length} rows`,
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

            // Capture area name
            if (!dailyMetricsMap[uid].areaName && row.area_name) {
              dailyMetricsMap[uid].areaName = row.area_name;
              console.log(`  Set area "${row.area_name}" for user ${uid}`);
            }
          }
        }
      });

      // Fallback: If area name is still null, try alternative query
      for (const uid in dailyMetricsMap) {
        if (!dailyMetricsMap[uid].areaName) {
          const altAreaQuery = `
            SELECT DISTINCT a.name as area_name
            FROM tasks t
            INNER JOIN areas a ON t.area_id = a.id
            WHERE t.assignee_id = $1
              AND DATE(t.created_at) <= $2
              AND (t.completed_at IS NULL OR DATE(t.completed_at) >= $2)
            LIMIT 1
          `;
          const altAreaResult = await db.query(altAreaQuery, [
            parseInt(uid),
            date,
          ]);
          if (altAreaResult.rows.length > 0) {
            dailyMetricsMap[uid].areaName = altAreaResult.rows[0].area_name;
            console.log(
              `  ✅ Set area (fallback) "${altAreaResult.rows[0].area_name}" for user ${uid}`,
            );
          }
        }
      }

      // Fetch skipped counts from skipped_items_tracking
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
        skippedDailyParams,
      );
      console.log(
        ` Skipped items query returned ${skippedDailyResult.rows.length} rows`,
      );

      skippedDailyResult.rows.forEach((row) => {
        const uid = row.user_id.toString();

        if (dailyMetricsMap[uid] && row.item_type && row.task_type) {
          const itemType = row.item_type;
          const taskType = row.task_type;

          if (
            dailyMetricsMap[uid].counts[itemType] &&
            dailyMetricsMap[uid].counts[itemType][taskType]
          ) {
            dailyMetricsMap[uid].counts[itemType][taskType].skipped =
              parseInt(row.skipped) || 0;
          }
        }
      });

      // Fetch comments from task_comments for the date
      let commentsQuery = `
        SELECT 
          t.assignee_id as user_id,
          STRING_AGG(
            CONCAT(
              TO_CHAR(tc.created_at, 'HH24:MI'), 
              ': ', 
              tc.comment
            ), 
            ' | ' 
            ORDER BY tc.created_at DESC
          ) as comments
        FROM task_comments tc
        INNER JOIN tasks t ON tc.task_id = t.id
        WHERE DATE(tc.created_at) = $1
      `;
      let commentsParams = [date];

      if (userId && userId !== "all") {
        commentsQuery += ` AND t.assignee_id = $2`;
        commentsParams.push(userId);
      }

      commentsQuery += ` GROUP BY t.assignee_id`;

      const commentsResult = await db.query(commentsQuery, commentsParams);
      console.log(
        ` Comments query returned ${commentsResult.rows.length} rows`,
      );

      commentsResult.rows.forEach((row) => {
        const uid = row.user_id?.toString();
        if (uid && dailyMetricsMap[uid]) {
          dailyMetricsMap[uid].comments = row.comments;
        }
      });

      // Filter out users with no activity
      metrics.daily = Object.values(dailyMetricsMap).filter((user) => {
        const hasActivity =
          Object.values(user.counts).some((itemType) =>
            Object.values(itemType).some(
              (taskType) => taskType.completed > 0 || taskType.skipped > 0,
            ),
          ) || user.totalBlocks > 0;
        return hasActivity;
      });

      console.log(
        `  Final daily metrics: ${metrics.daily.length} users with activity`,
      );

      // ========== WEEKLY METRICS ==========
      const weekStartDate = new Date(date);
      weekStartDate.setDate(weekStartDate.getDate() - 6);
      const weekStartStr = weekStartDate.toISOString().split("T")[0];

      console.log("  Fetching weekly metrics:", weekStartStr, "to", date);

      const weeklyMetricsMap = {};
      allUsers.forEach((user) => {
        const uid = user.id.toString();
        weeklyMetricsMap[uid] = {
          userId: uid,
          week_start: weekStartStr,
          areaName: null,
          comments: null,
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

      // Weekly completed with area
      let weeklyQuery = `
        SELECT 
          dm.user_id, 
          dm.item_type, 
          dm.task_type, 
          SUM(dm.count) as count, 
          SUM(dm.blocks) as blocks,
          a.name as area_name
        FROM daily_metrics dm
        LEFT JOIN (
          SELECT DISTINCT ON (dm2.user_id, dm2.item_type, dm2.task_type)
            dm2.user_id,
            dm2.item_type,
            dm2.task_type,
            t.area_id
          FROM daily_metrics dm2
          INNER JOIN tasks t ON t.assignee_id = dm2.user_id 
            AND DATE(t.created_at) <= dm2.date
            AND (t.completed_at IS NULL OR DATE(t.completed_at) >= dm2.date)
          WHERE dm2.date >= $1 AND dm2.date <= $2
        ) task_areas ON 
          dm.user_id = task_areas.user_id 
          AND dm.item_type = task_areas.item_type
          AND dm.task_type = task_areas.task_type
        LEFT JOIN areas a ON task_areas.area_id = a.id
        WHERE dm.date >= $1 AND dm.date <= $2
      `;
      let weeklyParams = [weekStartStr, date];

      if (userId && userId !== "all") {
        weeklyQuery += ` AND dm.user_id = $3`;
        weeklyParams.push(userId);
      }

      weeklyQuery += ` 
        GROUP BY dm.user_id, dm.item_type, dm.task_type, a.name
        ORDER BY dm.user_id
      `;

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

            if (!weeklyMetricsMap[uid].areaName && row.area_name) {
              weeklyMetricsMap[uid].areaName = row.area_name;
            }
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
        skippedWeeklyParams,
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

      // Weekly comments
      let weeklyCommentsQuery = `
        SELECT 
          t.assignee_id as user_id,
          STRING_AGG(
            CONCAT(
              TO_CHAR(tc.created_at, 'MM/DD HH24:MI'), 
              ': ', 
              tc.comment
            ), 
            ' | ' 
            ORDER BY tc.created_at DESC
          ) as comments
        FROM task_comments tc
        INNER JOIN tasks t ON tc.task_id = t.id
        WHERE tc.created_at >= $1::date AND tc.created_at <= $2::date
      `;
      let weeklyCommentsParams = [weekStartStr, date];

      if (userId && userId !== "all") {
        weeklyCommentsQuery += ` AND t.assignee_id = $3`;
        weeklyCommentsParams.push(userId);
      }

      weeklyCommentsQuery += ` GROUP BY t.assignee_id`;

      const weeklyCommentsResult = await db.query(
        weeklyCommentsQuery,
        weeklyCommentsParams,
      );
      weeklyCommentsResult.rows.forEach((row) => {
        const uid = row.user_id?.toString();
        if (uid && weeklyMetricsMap[uid]) {
          weeklyMetricsMap[uid].comments = row.comments;
        }
      });

      metrics.weekly = Object.values(weeklyMetricsMap).filter((user) => {
        const hasActivity =
          Object.values(user.counts).some((itemType) =>
            Object.values(itemType).some(
              (taskType) => taskType.completed > 0 || taskType.skipped > 0,
            ),
          ) || user.totalBlocks > 0;
        return hasActivity;
      });

      // ========== MONTHLY METRICS ==========
      const monthStartDate = new Date(date);
      monthStartDate.setDate(monthStartDate.getDate() - 29);
      const monthStartStr = monthStartDate.toISOString().split("T")[0];

      console.log("  Fetching monthly metrics:", monthStartStr, "to", date);

      const monthlyMetricsMap = {};
      allUsers.forEach((user) => {
        const uid = user.id.toString();
        monthlyMetricsMap[uid] = {
          userId: uid,
          month_start: monthStartStr,
          areaName: null,
          comments: null,
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

      // Monthly completed with area
      let monthlyQuery = `
        SELECT 
          dm.user_id, 
          dm.item_type, 
          dm.task_type, 
          SUM(dm.count) as count, 
          SUM(dm.blocks) as blocks,
          a.name as area_name
        FROM daily_metrics dm
        LEFT JOIN (
          SELECT DISTINCT ON (dm2.user_id, dm2.item_type, dm2.task_type)
            dm2.user_id,
            dm2.item_type,
            dm2.task_type,
            t.area_id
          FROM daily_metrics dm2
          INNER JOIN tasks t ON t.assignee_id = dm2.user_id 
            AND DATE(t.created_at) <= dm2.date
            AND (t.completed_at IS NULL OR DATE(t.completed_at) >= dm2.date)
          WHERE dm2.date >= $1 AND dm2.date <= $2
        ) task_areas ON 
          dm.user_id = task_areas.user_id 
          AND dm.item_type = task_areas.item_type
          AND dm.task_type = task_areas.task_type
        LEFT JOIN areas a ON task_areas.area_id = a.id
        WHERE dm.date >= $1 AND dm.date <= $2
      `;
      let monthlyParams = [monthStartStr, date];

      if (userId && userId !== "all") {
        monthlyQuery += ` AND dm.user_id = $3`;
        monthlyParams.push(userId);
      }

      monthlyQuery += ` 
        GROUP BY dm.user_id, dm.item_type, dm.task_type, a.name
        ORDER BY dm.user_id
      `;

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

            if (!monthlyMetricsMap[uid].areaName && row.area_name) {
              monthlyMetricsMap[uid].areaName = row.area_name;
            }
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
        skippedMonthlyParams,
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

      // Monthly comments
      let monthlyCommentsQuery = `
        SELECT 
          t.assignee_id as user_id,
          STRING_AGG(
            CONCAT(
              TO_CHAR(tc.created_at, 'MM/DD'), 
              ': ', 
              SUBSTRING(tc.comment, 1, 50)
            ), 
            ' | ' 
            ORDER BY tc.created_at DESC
          ) as comments
        FROM task_comments tc
        INNER JOIN tasks t ON tc.task_id = t.id
        WHERE tc.created_at >= $1::date AND tc.created_at <= $2::date
      `;
      let monthlyCommentsParams = [monthStartStr, date];

      if (userId && userId !== "all") {
        monthlyCommentsQuery += ` AND t.assignee_id = $3`;
        monthlyCommentsParams.push(userId);
      }

      monthlyCommentsQuery += ` GROUP BY t.assignee_id`;

      const monthlyCommentsResult = await db.query(
        monthlyCommentsQuery,
        monthlyCommentsParams,
      );
      monthlyCommentsResult.rows.forEach((row) => {
        const uid = row.user_id?.toString();
        if (uid && monthlyMetricsMap[uid]) {
          monthlyMetricsMap[uid].comments = row.comments;
        }
      });

      metrics.monthly = Object.values(monthlyMetricsMap).filter((user) => {
        const hasActivity =
          Object.values(user.counts).some((itemType) =>
            Object.values(itemType).some(
              (taskType) => taskType.completed > 0 || taskType.skipped > 0,
            ),
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
    console.error(" Failed to fetch individual metrics:", {
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
      }),
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
      (r) => r.date.toISOString().split("T")[0] === date,
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
        { userId: userId.toString(), date: date, counts: {}, totalBlocks: 0 },
      );
      metrics.daily.push(userMetric);
    }

    // Weekly and monthly aggregation (simplified for now)
    metrics.weekly = result.rows
      .filter(
        (r) =>
          r.date >=
          new Date(new Date(date).getTime() - 7 * 24 * 60 * 60 * 1000),
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
      }),
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
      }),
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
      JSON.stringify({ level: "info", message: "Fetching block totals", date }),
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
      }),
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
      }),
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
      [itemId],
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
          [item_id],
        );
        projectId = equipResult.rows[0]?.project_id;
      } else if (item_type === "NonInlineInstrument") {
        const instrResult = await db.query(
          "SELECT project_id FROM non_inline_instruments WHERE id = $1",
          [item_id],
        );
        projectId = instrResult.rows[0]?.project_id;
      } else if (item_type === "PID") {
        const pidResult = await db.query(
          "SELECT project_id FROM pids WHERE id = $1",
          [item_id],
        );
        projectId = pidResult.rows[0]?.project_id;
      } else if (item_type === "Line") {
        const lineResult = await db.query(
          "SELECT id FROM lines WHERE id = $1",
          [item_id],
        );
        effectiveEntityId = lineResult.rows[0]?.id;
      }
      if (projectId && !effectiveEntityId) {
        const lineMatch = await db.query(
          "SELECT id FROM lines WHERE project_id = $1 LIMIT 1",
          [projectId],
        );
        effectiveEntityId = lineMatch.rows[0]?.id;
      }
      if (!effectiveEntityId) {
        const taskResult = await db.query(
          "SELECT project_id FROM tasks WHERE id = $1",
          [taskId],
        );
        projectId = taskResult.rows[0]?.project_id;
        if (projectId) {
          const newLineResult = await db.query(
            "INSERT INTO lines (project_id, line_number, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING id",
            [projectId, "Default Line"],
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
      [userId, effectiveEntityId, itemType, taskType, blocks],
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
      }),
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
    if (req.user.role !== "Team Lead" && req.user.role !== "Project Manager") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view team metrics`,
      });
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
      throw dailyError;
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

router.get("/detailed", protect, async (req, res) => {
  try {
    if (!["Project Manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const {
      taskType,
      dateStart,
      dateEnd,
      projectId,
      areaId,
      userId,
      limit = 100,
      offset = 0,
    } = req.query;

    // Validation
    const validTaskTypes = ["UPV", "Redline", "QC", "Rework"];
    if (taskType && !validTaskTypes.includes(taskType)) {
      return res.status(400).json({
        message: `Invalid taskType. Valid: ${validTaskTypes.join(", ")}`,
      });
    }
    if (dateStart && !/^\d{4}-\d{2}-\d{2}$/.test(dateStart)) {
      return res
        .status(400)
        .json({ message: "Invalid dateStart format. Use YYYY-MM-DD" });
    }
    if (dateEnd && !/^\d{4}-\d{2}-\d{2}$/.test(dateEnd)) {
      return res
        .status(400)
        .json({ message: "Invalid dateEnd format. Use YYYY-MM-DD" });
    }

    let query = `
      SELECT 
        a.name AS area_no,
        p.pid_number AS pid,
        l.line_number AS line_no,
        u.name AS assigned_to,
        COALESCE(pwi.blocks, 0) AS block_count,
        pwi.completed_at,
        COALESCE(tc.comment, '') AS comments,
        pwi.status,
        pwi.task_type,
        pwi.id AS work_item_id
      FROM pid_work_items pwi
      LEFT JOIN pids p ON pwi.pid_id = p.id
      LEFT JOIN lines l ON pwi.line_id = l.id
      LEFT JOIN areas a ON p.id = a.id  -- Assuming pid has area_id; adjust if needed
      LEFT JOIN users u ON pwi.user_id = u.id
      LEFT JOIN task_comments tc ON pwi.task_id = tc.task_id AND tc.user_id = pwi.user_id  -- Latest comment per task/user
      WHERE 1=1
    `;
    let params = [];

    if (taskType) {
      query += ` AND pwi.task_type = $${params.length + 1}`;
      params.push(taskType);
    }
    if (dateStart) {
      query += ` AND pwi.completed_at >= $${params.length + 1}`;
      params.push(new Date(dateStart));
    }
    if (dateEnd) {
      query += ` AND pwi.completed_at <= $${params.length + 1}`;
      params.push(new Date(dateEnd));
    }
    if (projectId) {
      query += ` AND p.project_id = $${params.length + 1}`;
      params.push(projectId);
    }
    if (areaId) {
      query += ` AND a.id = $${params.length + 1}`;
      params.push(areaId);
    }
    if (userId) {
      query += ` AND pwi.user_id = $${params.length + 1}`;
      params.push(userId);
    }

    query += ` ORDER BY pwi.completed_at DESC NULLS LAST`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    console.log(`Detailed query: ${query}`, params); // For debugging

    const result = await db.query(query, params);
    const countQuery =
      query.replace(/ORDER BY.*$/i, "").replace(/LIMIT .* OFFSET .*$/i, "") +
      " SELECT COUNT(*) FROM (" +
      query.replace(/ORDER BY.*$/i, "") +
      ") AS count_sub";
    // Wait, better: Separate count query
    const countParams = params.slice(0, -2); // Remove limit/offset
    const countResult = await db.query(
      `SELECT COUNT(*) FROM (${query.replace(/ ORDER BY .* LIMIT .* OFFSET .*/i, "")}) AS sub`,
      countParams,
    );

    const records = result.rows.map((row) => ({
      areaNo: row.area_no || "N/A",
      pid: row.pid || "N/A",
      lineNo: row.line_no || "N/A",
      assignedTo: row.assigned_to || "Unassigned",
      blockCount: row.block_count,
      completedAt: row.completed_at
        ? new Date(row.completed_at).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })
        : "Pending",
      comments: row.comments,
      status: row.status,
      taskType: row.task_type,
      workItemId: row.work_item_id,
      auditLink: `/audit?entityId=${row.work_item_id}&taskType=${row.task_type}`, // For frontend navigation to audit
    }));

    res.status(200).json({
      data: records,
      totalCount: parseInt(countResult.rows[0].count),
      filtersApplied: {
        taskType,
        dateStart,
        dateEnd,
        projectId,
        areaId,
        userId,
      },
    });
  } catch (error) {
    console.error("Detailed metrics error:", error);
    res.status(500).json({
      message: "Failed to fetch detailed metrics",
      error: error.message,
    });
  }
});

router.get("/detailed-export", protect, async (req, res) => {
  try {
    if (!["Project Manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    const { date, period = "daily" } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "Invalid date format. Use YYYY-MM-DD" });
    }

    console.log("Fetching detailed export data for:", { date, period });

    // Calculate date range based on period
    let startDate = date;
    let endDate = date;

    if (period === "weekly") {
      const weekStart = new Date(date);
      weekStart.setDate(weekStart.getDate() - 6);
      startDate = weekStart.toISOString().split("T")[0];
    } else if (period === "monthly") {
      const monthStart = new Date(date);
      monthStart.setDate(monthStart.getDate() - 29);
      startDate = monthStart.toISOString().split("T")[0];
    }

    // Get all users
    const usersQuery = `SELECT id, name FROM users ORDER BY name`;
    const usersResult = await db.query(usersQuery);
    const allUsers = usersResult.rows;

    const detailedData = [];

    for (const user of allUsers) {
      const userId = user.id;

      // Fetch PIDs worked on
      const pidsQuery = `
        SELECT DISTINCT p.pid_number
        FROM daily_metrics dm
        INNER JOIN pids p ON dm.entity_id = p.id
        WHERE dm.user_id = $1
          AND dm.date >= $2 
          AND dm.date <= $3
          AND dm.item_type = 'PID'
        ORDER BY p.pid_number
      `;
      const pidsResult = await db.query(pidsQuery, [
        userId,
        startDate,
        endDate,
      ]);
      const pidNumbers = pidsResult.rows.map((row) => row.pid_number);

      // Fetch Lines worked on
      const linesQuery = `
        SELECT DISTINCT l.line_number
        FROM daily_metrics dm
        INNER JOIN lines l ON dm.entity_id = l.id
        WHERE dm.user_id = $1
          AND dm.date >= $2 
          AND dm.date <= $3
          AND dm.item_type = 'Line'
        ORDER BY l.line_number
      `;
      const linesResult = await db.query(linesQuery, [
        userId,
        startDate,
        endDate,
      ]);
      const lineNumbers = linesResult.rows.map((row) => row.line_number);

      // Fetch Equipment worked on
      const equipmentQuery = `
        SELECT DISTINCT e.tag_number
        FROM daily_metrics dm
        INNER JOIN equipment e ON dm.entity_id = e.id
        WHERE dm.user_id = $1
          AND dm.date >= $2 
          AND dm.date <= $3
          AND dm.item_type = 'Equipment'
        ORDER BY e.tag_number
      `;
      const equipmentResult = await db.query(equipmentQuery, [
        userId,
        startDate,
        endDate,
      ]);
      const equipmentNumbers = equipmentResult.rows.map(
        (row) => row.tag_number,
      );

      // Only include users who have worked on something
      if (
        pidNumbers.length > 0 ||
        lineNumbers.length > 0 ||
        equipmentNumbers.length > 0
      ) {
        detailedData.push({
          userId: userId.toString(),
          userName: user.name,
          pidNumbers,
          lineNumbers,
          equipmentNumbers,
        });
      }
    }

    console.log(
      `Detailed export data prepared for ${detailedData.length} users`,
    );

    res.status(200).json({
      success: true,
      data: detailedData,
      period,
      dateRange: { startDate, endDate },
    });
  } catch (error) {
    console.error("Failed to fetch detailed export data:", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      message: "Failed to fetch detailed export data",
      error: error.message,
    });
  }
});

module.exports = router;
