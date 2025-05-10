const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// GET /api/teams - Fetch teams (team leads and their data)
router.get("/", protect, async (req, res) => {
  try {
    console.log("User role:", req.user.role);
    console.log("User ID:", req.user.id);

    if (!["Project Manager", "Admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to view teams`,
      });
    }

    const { project, team } = req.query;

    let query = `
      SELECT u.id, u.name as team_lead, 
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', tm.id,
                 'member_id', tm.member_id,
                 'member_name', m.name
               ))
               FROM team_members tm
               LEFT JOIN users m ON tm.member_id = m.id
               WHERE tm.lead_id = u.id
             ), '[]') as team_members,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', t.id,
                 'type', t.type,
                 'assignee', u2.name,
                 'assignee_id', t.assignee_id,
                 'status', t.status,
                 'items', (
                   SELECT json_agg(json_build_object(
                     'id', ti.id,
                     'name', ti.item_name,
                     'item_type', ti.item_type,
                     'completed', ti.completed
                   ))
                   FROM task_items ti
                   WHERE ti.task_id = t.id
                 )
               ))
               FROM tasks t
               LEFT JOIN users u2 ON t.assignee_id = u2.id
               WHERE t.assignee_id IN (
                 SELECT member_id FROM team_members WHERE lead_id = u.id
               )
             ), '[]') as tasks
      FROM users u
      WHERE u.role = 'Team Lead'
    `;
    const values = [];
    const conditions = [];

    if (project && project !== "all") {
      query += `
        AND EXISTS (
          SELECT 1
          FROM tasks t
          WHERE t.assignee_id IN (SELECT member_id FROM team_members WHERE lead_id = u.id)
          AND t.project_name = $${values.length + 1}
        )
      `;
      values.push(project);
    }

    if (team && team !== "all") {
      conditions.push(`u.name = $${values.length + 1}`);
      values.push(team);
    }

    if (conditions.length > 0) {
      query += ` AND ${conditions.join(" AND ")}`;
    }

    query += ` GROUP BY u.id, u.name`;

    const { rows } = await db.query(query, values);
    console.log("Teams fetched:", rows);
    const response = { data: rows };
    console.log("Teams API response:", response);
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching teams:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to fetch teams", error: error.message });
  }
});

module.exports = router;
