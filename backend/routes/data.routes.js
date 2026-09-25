const express = require("express");
const router = express.Router();
const dataController = require("../controllers/data.controller");
const authController = require("../controllers/auth.controller");
const { verifyToken, requireMinRole } = authController;

router.get("/summary", dataController.getSummary);
router.get("/", dataController.getAllData);
router.get("/device/:deviceId", dataController.getDeviceData);
router.post("/", verifyToken, requireMinRole("MANAGER"), dataController.createData);
router.post("/simulate", verifyToken, requireMinRole("ADMIN"), dataController.simulateTelemetry);

module.exports = router;
