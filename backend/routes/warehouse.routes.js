const express = require("express");
const router = express.Router();
const warehouseController = require("../controllers/warehouse.controller");

// Lấy danh sách kho
router.get("/", warehouseController.getAllWarehouses);

// Lấy chi tiết kho
router.get("/:id", warehouseController.getWarehouseById);

// Thêm mới kho
router.post("/", warehouseController.createWarehouse);

// Cập nhật kho
router.put("/:id", warehouseController.updateWarehouse);

// Xóa kho
router.delete("/:id", warehouseController.deleteWarehouse);

module.exports = router;
