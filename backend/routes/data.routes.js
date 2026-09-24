const express = require("express");
const router = express.Router();
const dataController = require("../controllers/data.controller");
const authController = require("../controllers/auth.controller");

// Lấy thống kê tổng hợp (summary)
router.get("/summary", dataController.getSummary);

// Lấy danh sách telemetry có filter & phân trang
router.get("/", dataController.getAllData);

// Lấy telemetry time-series của một thiết bị cụ thể
router.get("/device/:deviceId", dataController.getDeviceData);

// Nhận dữ liệu telemetry mới (tự động tạo alert nếu vượt ngưỡng)
router.post("/", dataController.createData);

// Mô phỏng dữ liệu telemetry IoT từ cảm biến thời gian thực
router.post("/simulate", dataController.simulateTelemetry);

module.exports = router;

