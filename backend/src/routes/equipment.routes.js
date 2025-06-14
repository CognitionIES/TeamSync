const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { protect } = require("../middleware/auth");

// @desc    Get all equipment
// @route   GET /api/equipment
// @access  Private
router.get("/", protect, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM equipment");
    res.status(200).json({ data: rows });
  } catch (error) {
    console.error("Error fetching equipment:", error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create a new equipment
// @route   POST /api/equipment
// @access  Private
router.post("/", protect, async (req, res) => {
  console.log("Hit POST /api/equipment route");
  try {
    console.log("Creating equipment with body:", req.body);
    const { equipmentNumber, description, typeId, areaId, projectId } =
      req.body;

    // Validate required fields
    if (!equipmentNumber || !projectId) {
      return res
        .status(400)
        .json({ message: "Equipment number and project ID are required" });
    }

    // Verify projectId exists
    const projectCheck = await db.query(
      "SELECT id FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectCheck.rows.length === 0) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    // Verify areaId if provided
    if (areaId) {
      const areaCheck = await db.query(
        "SELECT id FROM areas WHERE id = $1 AND project_id = $2",
        [areaId, projectId]
      );
      if (areaCheck.rows.length === 0) {
        return res
          .status(400)
          .json({ message: "Invalid area ID for this project" });
      }
    }

    // Insert the equipment
    console.log("Inserting equipment into database...");
    const { rows } = await db.query(
      "INSERT INTO equipment (equipment_number, description, type_id, area_id, project_id, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [
        equipmentNumber,
        description,
        typeId || null,
        areaId || null,
        projectId,
        "Assigned",
        new Date(),
      ]
    );
    console.log("Equipment inserted successfully:", rows[0]);

    // Log the action in audit logs
    if (req.user && req.user.userId) {
      console.log("Logging audit for user:", req.user.userId);
      await db.query(
        "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
        [
          "Equipment Creation",
          equipmentNumber,
          req.user.userId,
          `Equipment ${equipmentNumber}`,
          new Date(),
        ]
      );
      console.log("Audit log entry created successfully");
    } else {
      console.warn("Skipping audit log due to missing user information");
    }

    res.status(201).json({ data: rows[0] });
  } catch (error) {
    console.error("Error creating equipment:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
    });
    if (
      error.code === "23505" &&
      error.constraint === "equipment_number_unique"
    ) {
      return res
        .status(400)
        .json({ message: "Equipment number already exists" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @desc    Create multiple equipment entries in batch
// @route   POST /api/equipment/batch
// @access  Private
// @desc    Create multiple equipment entries in batch
// @route   POST /api/equipment/batch
// @access  Private
router.post("/batch", protect, async (req, res) => {
  console.log("Received POST request to /api/equipment/batch");
  try {
    if (req.user.role !== "Data Entry") {
      return res.status(403).json({
        message: `User role ${req.user.role} is not authorized to add equipment`,
      });
    }

    const { equipment } = req.body;

    if (!equipment || !Array.isArray(equipment) || equipment.length === 0) {
      return res
        .status(400)
        .json({ message: "Equipment array is required and must not be empty" });
    }

    const createdEquipment = [];
    await db.query("BEGIN");

    for (const equip of equipment) {
      const { equipmentNumber, description, areaId, projectId } = equip;

      if (!equipmentNumber || !areaId || !projectId) {
        await db.query("ROLLBACK");
        return res
          .status(400)
          .json({
            message:
              "equipmentNumber, areaId, and projectId are required for each equipment",
          });
      }

      const { rows: projectRows } = await db.query(
        "SELECT id FROM projects WHERE id = $1",
        [parseInt(projectId)]
      );
      if (projectRows.length === 0) {
        await db.query("ROLLBACK");
        return res
          .status(404)
          .json({ message: `Project with ID ${projectId} not found` });
      }

      const { rows: areaRows } = await db.query(
        "SELECT id FROM areas WHERE id = $1 AND project_id = $2",
        [parseInt(areaId), parseInt(projectId)]
      );
      if (areaRows.length === 0) {
        await db.query("ROLLBACK");
        return res
          .status(404)
          .json({
            message: `Area with ID ${areaId} not found in project ${projectId}`,
          });
      }

      const { rows: existingEquipment } = await db.query(
        "SELECT id FROM equipment WHERE equipment_number = $1 AND project_id = $2",
        [equipmentNumber, parseInt(projectId)]
      );
      if (existingEquipment.length > 0) {
        await db.query("ROLLBACK");
        return res
          .status(400)
          .json({
            message: `Equipment number ${equipmentNumber} already exists in project ${projectId}`,
          });
      }

      const { rows: newEquipmentRows } = await db.query(
        `
        INSERT INTO equipment (equipment_number, description, area_id, project_id, status, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        RETURNING *
        `,
        [
          equipmentNumber,
          description || "",
          parseInt(areaId),
          parseInt(projectId),
          "Assigned",
        ]
      );

      const newEquipment = newEquipmentRows[0];
      createdEquipment.push(newEquipment);

      if (req.user && req.user.userId) {
        await db.query(
          "INSERT INTO audit_logs (type, name, created_by_id, current_work, timestamp) VALUES ($1, $2, $3, $4, $5)",
          [
            "Equipment Creation",
            equipmentNumber,
            req.user.userId,
            `Equipment ${equipmentNumber}`,
            new Date(),
          ]
        );
      }
    }

    await db.query("COMMIT");
    res.status(201).json({ data: createdEquipment });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Error adding equipment batch:", error.message, error.stack);
    if (
      error.code === "23505" &&
      error.constraint === "equipment_number_unique"
    ) {
      return res
        .status(400)
        .json({ message: "One or more equipment numbers already exist" });
    }
    res
      .status(500)
      .json({ message: "Failed to add equipment", error: error.message });
  }
});

module.exports = router;
