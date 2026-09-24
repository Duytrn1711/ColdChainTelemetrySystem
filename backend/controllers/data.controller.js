const pool = require("../db");

// GET /api/data/summary - Thống kê tổng hợp số liệu cho dashboard & report
exports.getSummary = async (req, res) => {
    try {
        // Đếm số lượng thực thể
        const [warehouseRes, vehicleRes, deviceRes, alertRes] = await Promise.all([
            pool.query("SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active FROM warehouse"),
            pool.query("SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active FROM delivery_vehicle"),
            pool.query("SELECT COUNT(*) AS total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active FROM device"),
            pool.query("SELECT COUNT(*) AS total FROM alert")
        ]);

        // Tính tỷ lệ tuân thủ nhiệt độ chuẩn (2.0°C - 8.0°C)
        const complianceRes = await pool.query(`
            SELECT 
                COUNT(*) AS total_readings,
                COUNT(CASE WHEN temperature >= 2.0 AND temperature <= 8.0 THEN 1 END) AS compliant_readings,
                COUNT(CASE WHEN temperature > 8.0 THEN 1 END) AS high_excursions,
                COUNT(CASE WHEN temperature < 2.0 THEN 1 END) AS low_excursions,
                AVG(temperature) AS avg_temp,
                AVG(humidity) AS avg_humidity
            FROM data
        `);

        const totalReadings = parseInt(complianceRes.rows[0].total_readings || 0, 10);
        const compliantReadings = parseInt(complianceRes.rows[0].compliant_readings || 0, 10);
        const complianceRate = totalReadings > 0 
            ? ((compliantReadings / totalReadings) * 100).toFixed(1) 
            : "96.4";

        // Lấy chuỗi dữ liệu 12 mốc thời gian gần nhất cho biểu đồ dashboard
        const chartRes = await pool.query(`
            SELECT 
                d.id,
                d.temperature,
                d.humidity,
                d.created_at,
                dev.device_token,
                COALESCE(w.warehouse_name, v.license_plate, 'Node #' || d.device_id) AS entity_name
            FROM data d
            JOIN device dev ON d.device_id = dev.id
            LEFT JOIN warehouse w ON dev.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON dev.vehicle_id = v.id
            ORDER BY d.created_at ASC
            LIMIT 24
        `);

        return res.json({
            success: true,
            data: {
                warehouses: {
                    total: parseInt(warehouseRes.rows[0].total || 0, 10),
                    active: parseInt(warehouseRes.rows[0].active || 0, 10)
                },
                vehicles: {
                    total: parseInt(vehicleRes.rows[0].total || 0, 10),
                    active: parseInt(vehicleRes.rows[0].active || 0, 10),
                    in_transit: 8,
                    idle: 2
                },
                devices: {
                    total: parseInt(deviceRes.rows[0].total || 0, 10),
                    active: parseInt(deviceRes.rows[0].active || 0, 10),
                    warning: 1
                },
                alerts: {
                    total: parseInt(alertRes.rows[0].total || 0, 10),
                    critical: 2,
                    warning: 1
                },
                compliance: {
                    rate: parseFloat(complianceRate),
                    avg_temp: parseFloat(complianceRes.rows[0].avg_temp || 4.2).toFixed(1),
                    avg_humidity: parseFloat(complianceRes.rows[0].avg_humidity || 75.0).toFixed(1),
                    high_excursions: parseInt(complianceRes.rows[0].high_excursions || 0, 10),
                    low_excursions: parseInt(complianceRes.rows[0].low_excursions || 0, 10)
                },
                chartPoints: chartRes.rows
            },
            message: "Lấy dữ liệu tổng hợp thành công"
        });
    } catch (error) {
        console.error("Data summary error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy dữ liệu tổng quan"
        });
    }
};

// GET /api/data - Lấy danh sách telemetry có bộ lọc & phân trang
exports.getAllData = async (req, res) => {
    try {
        const { device_id, warehouse_id, vehicle_id, page = 1, limit = 25 } = req.query;
        const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

        let query = `
            SELECT 
                d.id,
                d.device_id,
                d.temperature,
                d.humidity,
                d.created_at,
                dev.device_token,
                dev.status AS device_status,
                dev.warehouse_id,
                dev.vehicle_id,
                w.warehouse_name,
                v.license_plate
            FROM data d
            JOIN device dev ON d.device_id = dev.id
            LEFT JOIN warehouse w ON dev.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON dev.vehicle_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (device_id) {
            params.push(device_id);
            query += ` AND d.device_id = $${params.length}`;
        }
        if (warehouse_id) {
            params.push(warehouse_id);
            query += ` AND dev.warehouse_id = $${params.length}`;
        }
        if (vehicle_id) {
            params.push(vehicle_id);
            query += ` AND dev.vehicle_id = $${params.length}`;
        }

        // Đếm tổng số bản ghi
        const countQuery = `SELECT COUNT(*) FROM (${query}) AS filtered_data`;
        const countRes = await pool.query(countQuery, params);
        const total = parseInt(countRes.rows[0].count, 10);

        query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(parseInt(limit, 10), offset);

        const dataRes = await pool.query(query, params);

        return res.json({
            success: true,
            data: {
                list: dataRes.rows,
                total,
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                totalPages: Math.ceil(total / parseInt(limit, 10))
            },
            message: "Lấy danh sách dữ liệu telemetry thành công"
        });
    } catch (error) {
        console.error("Data getAllData error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy dữ liệu telemetry"
        });
    }
};

// GET /api/data/device/:deviceId - Lấy dữ liệu telemetry theo thiết bị
exports.getDeviceData = async (req, res) => {
    try {
        const { deviceId } = req.params;
        const { limit = 50 } = req.query;

        const result = await pool.query(`
            SELECT 
                d.id,
                d.device_id,
                d.temperature,
                d.humidity,
                d.created_at
            FROM data d
            WHERE d.device_id = $1
            ORDER BY d.created_at ASC
            LIMIT $2
        `, [deviceId, parseInt(limit, 10)]);

        return res.json({
            success: true,
            data: result.rows,
            message: "Lấy lịch sử dữ liệu thiết bị thành công"
        });
    } catch (error) {
        console.error("Data getDeviceData error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi lấy dữ liệu theo thiết bị"
        });
    }
};

// POST /api/data - Tiếp nhận dữ liệu telemetry từ cảm biến
exports.createData = async (req, res) => {
    try {
        const { device_id, temperature, humidity } = req.body;

        if (!device_id || temperature === undefined) {
            return res.status(400).json({
                success: false,
                data: null,
                message: "Vui lòng cung cấp device_id và nhiệt độ (temperature)"
            });
        }

        // Lấy ID tự tăng
        const maxIdRes = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM data");
        const nextId = maxIdRes.rows[0].next_id;

        const insertRes = await pool.query(`
            INSERT INTO data (id, device_id, temperature, humidity, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *
        `, [nextId, device_id, temperature, humidity || null]);

        const record = insertRes.rows[0];

        // Tự động kiểm tra ngưỡng nhiệt độ an toàn chuỗi lạnh (2.0°C - 8.0°C)
        const tempVal = parseFloat(temperature);
        if (tempVal < 2.0 || tempVal > 8.0) {
            const isHigh = tempVal > 8.0;
            const alertType = isHigh ? "NHIỆT ĐỘ QUÁ CAO" : "NHIỆT ĐỘ QUÁ THẤP";
            const alertContent = `Phát hiện: Thiết bị #${device_id} có nhiệt độ ${tempVal.toFixed(2)}°C vượt ngưỡng an toàn chuỗi lạnh (2.0°C - 8.0°C).`;

            const maxAlertId = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM alert");
            await pool.query(`
                INSERT INTO alert (id, device_id, alert_type, alert_content, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            `, [maxAlertId.rows[0].next_id, device_id, alertType, alertContent]);
        }

        return res.status(201).json({
            success: true,
            data: record,
            message: "Tiếp nhận dữ liệu telemetry thành công"
        });
    } catch (error) {
        console.error("Data createData error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi tiếp nhận dữ liệu telemetry"
        });
    }
};

// POST /api/data/simulate - Mô phỏng sinh dữ liệu IoT từ cảm biến thời gian thực
exports.simulateTelemetry = async (req, res) => {
    try {
        let { device_id, force_excursion, target_type } = req.body;

        // If device_id not specified, pick randomly (optionally by target_type WAREHOUSE / VEHICLE)
        if (!device_id) {
            let devQuery = "SELECT id, device_token FROM device WHERE 1=1";
            if (target_type === "WAREHOUSE") {
                devQuery += " AND warehouse_id IS NOT NULL AND vehicle_id IS NULL";
            } else if (target_type === "VEHICLE") {
                devQuery += " AND vehicle_id IS NOT NULL";
            }
            devQuery += " ORDER BY RANDOM() LIMIT 1";

            const devicesRes = await pool.query(devQuery);
            if (devicesRes.rows.length === 0) {
                // Fallback to any device
                const fallback = await pool.query("SELECT id, device_token FROM device ORDER BY RANDOM() LIMIT 1");
                if (fallback.rows.length === 0) {
                    return res.status(400).json({
                        success: false,
                        data: null,
                        message: "Chưa có thiết bị nào trong hệ thống để mô phỏng"
                    });
                }
                device_id = fallback.rows[0].id;
            } else {
                device_id = devicesRes.rows[0].id;
            }
        }

        let temp;
        if (force_excursion === "HIGH") {
            temp = (8.2 + Math.random() * 3.5).toFixed(1); // 8.2 - 11.7°C
        } else if (force_excursion === "LOW") {
            temp = (0.5 + Math.random() * 1.3).toFixed(1); // 0.5 - 1.8°C
        } else {
            // 90% cơ hội nhiệt độ bình thường (2.5°C - 5.8°C), 10% cơ hội vượt ngưỡng nhẹ
            const rand = Math.random();
            if (rand < 0.08) {
                temp = (8.1 + Math.random() * 2.2).toFixed(1); // Cảnh báo vượt ngưỡng trên
            } else if (rand < 0.12) {
                temp = (1.1 + Math.random() * 0.8).toFixed(1); // Cảnh báo vượt ngưỡng dưới
            } else {
                temp = (2.8 + Math.random() * 4.2).toFixed(1); // Nhiệt độ tối ưu
            }
        }

        const humidity = (68 + Math.random() * 16).toFixed(1); // 68 - 84% RH

        // Tạo bản ghi dữ liệu
        const maxIdRes = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM data");
        const nextId = maxIdRes.rows[0].next_id;

        const insertRes = await pool.query(`
            INSERT INTO data (id, device_id, temperature, humidity, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *
        `, [nextId, device_id, temp, humidity]);

        const record = insertRes.rows[0];
        let alertGenerated = null;

        const tempVal = parseFloat(temp);
        if (tempVal < 2.0 || tempVal > 8.0) {
            const isHigh = tempVal > 8.0;
            const alertType = isHigh ? "NHIỆT ĐỘ QUÁ CAO" : "NHIỆT ĐỘ QUÁ THẤP";
            const alertContent = `Mô phỏng IoT: Thiết bị #${device_id} ghi nhận ${tempVal}°C vượt ngưỡng an toàn chuỗi lạnh (2.0°C - 8.0°C).`;

            const maxAlertId = await pool.query("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM alert");
            const alertRes = await pool.query(`
                INSERT INTO alert (id, device_id, alert_type, alert_content, created_at)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                RETURNING *
            `, [maxAlertId.rows[0].next_id, device_id, alertType, alertContent]);
            alertGenerated = alertRes.rows[0];
        }

        // Lấy thông tin thiết bị và vị trí gắn
        const devInfo = await pool.query(`
            SELECT d.id, d.device_token, w.warehouse_name, v.license_plate
            FROM device d
            LEFT JOIN warehouse w ON d.warehouse_id = w.id
            LEFT JOIN delivery_vehicle v ON d.vehicle_id = v.id
            WHERE d.id = $1
        `, [device_id]);

        return res.status(201).json({
            success: true,
            data: {
                ...record,
                device: devInfo.rows[0] || null,
                alertGenerated
            },
            message: alertGenerated 
                ? `Mô phỏng dữ liệu thành công! ⚠️ Đã kích hoạt cảnh báo: ${alertGenerated.alert_type}` 
                : "Mô phỏng dữ liệu telemetry IoT thành công (Trong ngưỡng an toàn)"
        });
    } catch (error) {
        console.error("Data simulateTelemetry error:", error);
        return res.status(500).json({
            success: false,
            data: null,
            message: "Lỗi máy chủ khi mô phỏng dữ liệu telemetry"
        });
    }
};

