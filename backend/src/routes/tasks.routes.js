const express = require("express");
const {
  getTasks,
  createTask,
  updateTaskStatus,
  updateTaskItem,
  addTaskComment,
} = require("../controllers/tasks.controller");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, getTasks);
router.get("/user/:userId", protect, getTasks);
router.post(
  "/",
  protect,
  authorize(["Team Lead", "Project Manager", "Admin"]),
  createTask
);
router.put("/:id/status", protect, updateTaskStatus);
router.put("/:taskId/items/:itemId", protect, updateTaskItem);
router.post("/:taskId/comments", protect, addTaskComment);

module.exports = router;
