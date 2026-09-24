const express = require("express");
const router = express.Router();
const vehicleController = require("../controllers/vehicle.controller");

// Lấy danh sách xe tải lạnh
router.get("/", vehicleController.getAllVehicles);

// Lấy chi tiết một xe tải
router.get("/:id", vehicleController.getVehicleById);

// Thêm mới xe tải
router.post("/", vehicleController.createVehicle);

// Sửa thông tin xe tải
router.put("/:id", vehicleController.updateVehicle);

// Xóa xe tải
router.delete("/:id", vehicleController.deleteVehicle);

module.exports = router;
