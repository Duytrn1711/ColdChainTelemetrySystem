const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/device.controller");

// Lấy danh sách thiết bị
router.get("/", deviceController.getAllDevices);

// Lấy chi tiết thiết bị
router.get("/:id", deviceController.getDeviceById);

// Đăng ký thiết bị mới
router.post("/", deviceController.createDevice);

// Sửa thông tin thiết bị
router.put("/:id", deviceController.updateDevice);

// Xóa thiết bị
router.delete("/:id", deviceController.deleteDevice);

module.exports = router;
