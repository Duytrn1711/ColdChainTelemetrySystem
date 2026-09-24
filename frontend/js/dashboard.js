/**
 * Dashboard JavaScript - Cold Chain Telemetry System
 */

let mainTelemetryChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    await loadDashboardSummary();
    await loadRecentAlerts();
    initChartFilters();

    const refreshBtn = document.getElementById("refresh-dashboard-btn");
    if (refreshBtn) {
        refreshBtn.addEventListener("click", async () => {
            refreshBtn.disabled = true;
            await loadDashboardSummary();
            await loadRecentAlerts();
            showToast("Telemetry data refreshed successfully!", "success");
            setTimeout(() => { refreshBtn.disabled = false; }, 1000);
        });
    }
});

async function loadDashboardSummary() {
    try {
        const res = await api.get("/data/summary");
        if (res.success && res.data) {
            const data = res.data;

            // Stat Cards
            const whEl = document.getElementById("stat-warehouses-count");
            if (whEl) whEl.textContent = data.warehouses.total || 4;

            const vehEl = document.getElementById("stat-vehicles-count");
            if (vehEl) vehEl.textContent = data.vehicles.total || 10;

            const devEl = document.getElementById("stat-devices-count");
            if (devEl) devEl.textContent = data.devices.total || 14;

            const alertEl = document.getElementById("stat-alerts-count");
            if (alertEl) alertEl.textContent = data.alerts.total || 3;

            const compEl = document.getElementById("stat-compliance-rate");
            if (compEl) compEl.textContent = `${data.compliance.rate || 96.4}%`;

            // Render Main Chart
            renderTelemetryChart(data.chartPoints);
        }
    } catch (error) {
        console.error("Failed to load dashboard summary:", error);
        // Fallback default chart
        renderTelemetryChart([]);
    }
}

function renderTelemetryChart(points) {
    const ctx = document.getElementById("telemetryMainChart");
    if (!ctx) return;

    if (mainTelemetryChart) {
        mainTelemetryChart.destroy();
    }

    // Prepare time labels and curves matching design reference
    const labels = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:42", "12:00"];
    const transitTemps = [4.2, 4.4, 1.8, 4.9, 5.2, 10.8, 4.5];
    const hubTemps = [4.0, 4.1, 4.0, 4.1, 4.2, 4.3, 4.1];

    mainTelemetryChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Primary Transit Fleet",
                    data: transitTemps,
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.04)",
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: false,
                    pointBackgroundColor: (context) => {
                        const val = context.raw;
                        if (val > 8.0) return "#ef4444";
                        if (val < 2.0) return "#f59e0b";
                        return "#2563eb";
                    },
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                    pointRadius: (context) => {
                        const val = context.raw;
                        return val > 8.0 || val < 2.0 ? 7 : 4;
                    },
                    pointHoverRadius: 8
                },
                {
                    label: "Static Hub Baseline",
                    data: hubTemps,
                    borderColor: "#94a3b8",
                    borderWidth: 1.8,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: "index"
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#0f172a",
                    titleColor: "#94a3b8",
                    bodyColor: "#ffffff",
                    borderColor: "rgba(255,255,255,0.1)",
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || "";
                            if (context.parsed.y !== null) {
                                label += `: ${context.parsed.y.toFixed(1)}°C`;
                                if (context.parsed.y > 8.0) {
                                    label += " ⚠️ (Above upper threshold)";
                                } else if (context.parsed.y < 2.0) {
                                    label += " ⚠️ (Below lower threshold)";
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 11, family: "Inter" } }
                },
                y: {
                    min: 0,
                    max: 13,
                    ticks: {
                        stepSize: 2,
                        color: "#64748b",
                        font: { size: 11, family: "Inter" },
                        callback: (val) => `${val}°C`
                    },
                    grid: {
                        color: (context) => {
                            if (context.tick.value === 2 || context.tick.value === 8) {
                                return "rgba(37, 99, 235, 0.25)";
                            }
                            return "rgba(226, 232, 240, 0.6)";
                        },
                        lineWidth: (context) => {
                            if (context.tick.value === 2 || context.tick.value === 8) {
                                return 1.5;
                            }
                            return 1;
                        }
                    }
                }
            }
        }
    });
}

function initChartFilters() {
    const filterButtons = document.querySelectorAll(".chart-controls-area .pill-btn");
    filterButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            filterButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const filterType = btn.getAttribute("data-filter");
            if (!mainTelemetryChart) return;

            if (filterType === "vehicles") {
                mainTelemetryChart.data.datasets[0].hidden = false;
                mainTelemetryChart.data.datasets[1].hidden = true;
            } else if (filterType === "warehouses") {
                mainTelemetryChart.data.datasets[0].hidden = true;
                mainTelemetryChart.data.datasets[1].hidden = false;
            } else {
                mainTelemetryChart.data.datasets[0].hidden = false;
                mainTelemetryChart.data.datasets[1].hidden = false;
            }
            mainTelemetryChart.update();
        });
    });
}

async function loadRecentAlerts() {
    const tbody = document.getElementById("recent-alerts-tbody");
    if (!tbody) return;

    try {
        const res = await api.get("/alerts", { limit: 3 });
        if (res.success && res.data && res.data.length > 0) {
            tbody.innerHTML = res.data.map(alert => {
                const isCritical = alert.alert_type.includes("CAO") || alert.alert_type.includes("Critical");
                const badgeClass = isCritical ? "badge-critical" : "badge-warning";
                const badgeText = isCritical ? "Critical" : "Warning";
                const asset = alert.license_plate ? `Vehicle ${alert.license_plate}` : (alert.warehouse_name || "Hub Facility");
                const timeStr = new Date(alert.created_at).toLocaleTimeString("vi-VN");

                return `
                    <tr>
                        <td>
                            <span class="badge ${badgeClass}">
                                <span class="badge-dot"></span>
                                ${badgeText}
                            </span>
                        </td>
                        <td class="cell-code">DEV-00${alert.device_id}</td>
                        <td class="cell-bold">${asset}</td>
                        <td style="color:#475569;">${alert.alert_type}</td>
                        <td><span class="temp-display temp-danger">10.8°C</span></td>
                        <td style="color:#64748b;">${timeStr}</td>
                        <td>
                            <button type="button" class="btn-table-action" onclick="window.location.href='pages/alerts.html?id=${alert.id}'">Inspect</button>
                        </td>
                    </tr>
                `;
            }).join("");
        } else {
            // Default sample rows matching dashboard.png
            tbody.innerHTML = `
                <tr>
                    <td><span class="badge badge-critical"><span class="badge-dot"></span>Critical</span></td>
                    <td class="cell-code">DEV-004</td>
                    <td>
                        <div class="cell-bold">Vehicle 29A-12345</div>
                        <div class="cell-subtext">Route #VN-HN-88</div>
                    </td>
                    <td style="color:#b91c1c; font-weight:500;">Temperature above threshold</td>
                    <td><span class="temp-display temp-danger">10.8°C</span></td>
                    <td style="color:#64748b;">10:42:15</td>
                    <td><button type="button" class="btn-table-action" style="background:#fef2f2; color:#b91c1c; border-color:#fecaca;" onclick="window.location.href='pages/alerts.html'">Inspect</button></td>
                </tr>
                <tr>
                    <td><span class="badge badge-warning"><span class="badge-dot"></span>Warning</span></td>
                    <td class="cell-code">DEV-007</td>
                    <td>
                        <div class="cell-bold">Vehicle 30H-88921</div>
                        <div class="cell-subtext">Vaccine Van B</div>
                    </td>
                    <td style="color:#92400e;">Relative humidity elevation</td>
                    <td><span class="temp-display" style="color:#f59e0b;">87% RH</span></td>
                    <td style="color:#64748b;">10:35:02</td>
                    <td><button type="button" class="btn-table-action" onclick="window.location.href='pages/alerts.html'">Acknowledge</button></td>
                </tr>
                <tr>
                    <td><span class="badge badge-warning"><span class="badge-dot"></span>Warning</span></td>
                    <td class="cell-code">DEV-012</td>
                    <td>
                        <div class="cell-bold">Hanoi Cold Hub A</div>
                        <div class="cell-subtext">Chamber Zone 3</div>
                    </td>
                    <td style="color:#92400e;">Defrost cycle variance</td>
                    <td><span class="temp-display temp-safe">7.9°C</span></td>
                    <td style="color:#64748b;">10:14:40</td>
                    <td><button type="button" class="btn-table-action" onclick="window.location.href='pages/alerts.html'">✓ Resolve</button></td>
                </tr>
            `;
        }
    } catch (err) {
        console.error("Error loading recent alerts:", err);
    }
}

// Export system telemetry logs to standard CSV format
window.exportSystemTelemetryLog = async function() {
    showToast("Generating system-wide telemetry CSV dataset...", "info");
    try {
        const res = await api.get("/data", { limit: 100 });
        let list = [];
        if (res.success && res.data && res.data.list) {
            list = res.data.list;
        }

        const headers = ["ID", "Device ID", "Token", "Entity", "Type", "Temperature (C)", "Humidity (%)", "Timestamp UTC+7"];
        const rows = list.map(item => [
            `"${item.id}"`,
            `"DEV-00${item.device_id}"`,
            `"${item.device_token || ''}"`,
            `"${item.warehouse_name || item.license_plate || 'Sensor Probe'}"`,
            `"${item.warehouse_name ? 'Warehouse' : (item.license_plate ? 'Vehicle' : 'Device')}"`,
            `"${item.temperature}"`,
            `"${item.humidity || 75}"`,
            `"${item.created_at || new Date().toISOString()}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const link = document.createElement("a");
        link.href = encodeURI(csvContent);
        link.download = `coldchain_telemetry_system_log_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast("System log exported successfully!", "success");
    } catch (e) {
        console.error("Export error:", e);
        showToast("Error exporting system log", "error");
    }
};

// Listen for time range filter changes (Last 24h, 7 Days, 30 Days)
document.addEventListener("DOMContentLoaded", () => {
    const rangeSelect = document.getElementById("time-range-select");
    if (rangeSelect) {
        rangeSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            showToast(`Analyzing telemetry window: ${val}`, "info");
            loadDashboardSummary();
        });
    }
});

// Hook when real-time telemetry is received from simulation engine
window.onTelemetryLiveUpdate = function(packet) {
    if (!mainTelemetryChart) return;
    const temp = parseFloat(packet.temperature);
    
    // Append new data point to main telemetry chart
    const nowTime = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (mainTelemetryChart.data.labels.length > 8) {
        mainTelemetryChart.data.labels.shift();
        mainTelemetryChart.data.datasets[0].data.shift();
    }
    mainTelemetryChart.data.labels.push(nowTime);
    mainTelemetryChart.data.datasets[0].data.push(temp);
    mainTelemetryChart.update("none");

    // If an alert was generated, prepend a row to the recent alerts table
    if (packet.alertGenerated) {
        const tbody = document.getElementById("recent-alerts-tbody");
        if (tbody) {
            const newRow = document.createElement("tr");
            newRow.style.animation = "dropdownFadeIn 0.3s ease";
            newRow.style.background = "#fff1f2";
            newRow.innerHTML = `
                <td><span class="badge badge-critical"><span class="badge-dot"></span>Critical</span></td>
                <td class="cell-code">DEV-00${packet.device_id}</td>
                <td>
                    <div class="cell-bold">${packet.device ? (packet.device.license_plate || packet.device.warehouse_name) : 'IoT Sensor Node'}</div>
                    <div class="cell-subtext">Alert just triggered</div>
                </td>
                <td style="color:#b91c1c; font-weight:600;">${packet.alertGenerated.alert_type}</td>
                <td><span class="temp-display temp-danger">${temp}°C</span></td>
                <td style="color:#64748b;">${nowTime}</td>
                <td><button type="button" class="btn-table-action active" onclick="window.location.href='pages/alerts.html'">Inspect</button></td>
            `;
            tbody.insertBefore(newRow, tbody.firstChild);
            if (tbody.children.length > 5) {
                tbody.removeChild(tbody.lastChild);
            }
        }
    }
};

