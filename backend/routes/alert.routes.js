const express = require("express");
const router = express.Router();
const alertController = require("../controllers/alert.controller");

// Lấy danh sách cảnh báo
router.get("/", alertController.getAllAlerts);

// Lấy chi tiết cảnh báo
router.get("/:id", alertController.getAlertById);

// Tạo mới cảnh báo
router.post("/", alertController.createAlert);

// Xử lý / xóa cảnh báo
router.delete("/:id", alertController.deleteAlert);

module.exports = router;
