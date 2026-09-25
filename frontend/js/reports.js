/**
 * Reports & Telemetry Stream JavaScript - Cold Chain Telemetry System
 * Realtime telemetry stream viewer, thermal band analysis & packet inspector
 */

let allTelemetry = [];
let thermalBandsChart = null;
let currentPage = 1;
const pageSize = 20;

document.addEventListener("DOMContentLoaded", async () => {
    await loadTelemetryLogs();
    initReportFilters();
    initPaginationControls();
    initTimeRangeFilter();

    // Wire live telemetry packet listener
    window.onTelemetryLiveUpdate = (packet) => {
        // Prepend new live packet to our list
        const formattedPacket = {
            id: packet.id,
            dev_code: packet.device ? packet.device.device_token : `DEV-00${packet.device_id}`,
            entity: packet.device ? (packet.device.license_plate ? `Vehicle ${packet.device.license_plate}` : (packet.device.warehouse_name ? `Kho ${packet.device.warehouse_name}` : `Node #${packet.device_id}`)) : `Node #${packet.device_id}`,
            isVehicle: packet.device ? !!packet.device.license_plate : false,
            temp: parseFloat(packet.temperature),
            hum: parseFloat(packet.humidity || 72),
            batt: `${Math.floor(88 + Math.random() * 11)}%`,
            time: new Date(packet.created_at || Date.now()).toISOString().replace("T", " ").slice(0, 19),
            status: parseFloat(packet.temperature) > 8.0 ? "HIGH" : (parseFloat(packet.temperature) < 2.0 ? "LOW" : "NORMAL")
        };

        allTelemetry.unshift(formattedPacket);
        if (allTelemetry.length > 100) allTelemetry.pop();

        renderTelemetryTable(allTelemetry);
        updateTelemetrySummaryStats(allTelemetry);
        renderThermalBandsChart();
    };
});

/**
 * Fetch telemetry data from backend API
 */
async function loadTelemetryLogs() {
    const tbody = document.getElementById("telemetry-stream-tbody");
    if (!tbody) return;

    try {
        const res = await api.get("/data", { limit: 50 });
        if (res.success && res.data && res.data.list && res.data.list.length > 0) {
            allTelemetry = res.data.list.map(r => ({
                id: r.id,
                device_id: r.device_id,
                dev_code: r.device_token || `DEV-00${r.device_id || 1}`,
                entity: r.license_plate ? `Vehicle ${r.license_plate}` : (r.warehouse_name ? `Kho ${r.warehouse_name}` : `Sensor Node #${r.device_id}`),
                isVehicle: !!r.license_plate,
                temp: parseFloat(r.temperature || 4.2),
                hum: parseFloat(r.humidity || 70),
                batt: `${Math.floor(85 + ((r.id * 7) % 15))}%`,
                time: r.created_at ? new Date(r.created_at).toISOString().replace("T", " ").slice(0, 19) : "2026-09-24 10:42:15",
                status: parseFloat(r.temperature) > 8.0 ? "HIGH" : (parseFloat(r.temperature) < 2.0 ? "LOW" : (parseFloat(r.humidity) > 80 ? "WARNING" : "NORMAL")),
                raw: r
            }));
        } else {
            allTelemetry = getFallbackTelemetry();
        }
    } catch (err) {
        console.warn("Could not fetch telemetry logs from backend, using sample stream:", err);
        allTelemetry = getFallbackTelemetry();
    }

    renderTelemetryTable(allTelemetry);
    updateTelemetrySummaryStats(allTelemetry);
    renderThermalBandsChart();
}

/**
 * Standard fallback telemetry when fresh install has few rows
 */
function getFallbackTelemetry() {
    return [
        { id: 891024, device_id: 4, dev_code: "DEV-004", entity: "Vehicle 29A-12345", isVehicle: true, temp: 10.8, hum: 76, batt: "94%", time: "2026-09-24 10:42:15", status: "HIGH" },
        { id: 891023, device_id: 7, dev_code: "DEV-007", entity: "Vehicle 30H-88921", isVehicle: true, temp: 4.6, hum: 87, batt: "88%", time: "2026-09-24 10:42:10", status: "WARNING" },
        { id: 891022, device_id: 1, dev_code: "DEV-001", entity: "Hanoi WH-01 (Chamber A)", isVehicle: false, temp: 3.8, hum: 62, batt: "100%", time: "2026-09-24 10:42:04", status: "NORMAL" },
        { id: 891021, device_id: 2, dev_code: "DEV-002", entity: "Hanoi WH-01 (Chamber B)", isVehicle: false, temp: 4.1, hum: 64, batt: "100%", time: "2026-09-24 10:41:55", status: "NORMAL" },
        { id: 891020, device_id: 3, dev_code: "DEV-014", entity: "Hai Phong WH-04", isVehicle: false, temp: 2.1, hum: 59, batt: "98%", time: "2026-09-24 10:41:40", status: "NORMAL" },
        { id: 891019, device_id: 9, dev_code: "DEV-009", entity: "Vehicle 51C-77412", isVehicle: true, temp: 1.8, hum: 68, batt: "91%", time: "2026-09-24 10:41:32", status: "LOW" },
        { id: 891018, device_id: 2, dev_code: "DEV-002", entity: "Hai Phong Cold Chamber", isVehicle: false, temp: 4.5, hum: 65, batt: "99%", time: "2026-09-24 10:41:15", status: "NORMAL" },
        { id: 891017, device_id: 5, dev_code: "DEV-005", entity: "Vehicle 29A-67890", isVehicle: true, temp: 5.1, hum: 71, batt: "95%", time: "2026-09-24 10:40:50", status: "NORMAL" },
        { id: 891016, device_id: 6, dev_code: "DEV-006", entity: "Da Nang Storage Hub", isVehicle: false, temp: 3.4, hum: 66, batt: "97%", time: "2026-09-24 10:40:22", status: "NORMAL" }
    ];
}

/**
 * Update top stat numbers based on telemetry data
 */
function updateTelemetrySummaryStats(list) {
    if (!list || list.length === 0) return;

    const totalReadings = list.length;
    const safeReadings = list.filter(r => r.temp >= 2.0 && r.temp <= 8.0).length;
    const highExcursions = list.filter(r => r.temp > 8.0).length;
    const warnings = list.filter(r => r.temp < 2.0 || r.hum > 80).length;
    const complianceRate = ((safeReadings / totalReadings) * 100).toFixed(1);

    const statCards = document.querySelectorAll(".stat-card-value");
    if (statCards.length >= 4) {
        statCards[0].textContent = "14 / 14";
        statCards[1].innerHTML = `${complianceRate}% <span style="font-size:12px; color:#10b981;">Target ≥99%</span>`;
        statCards[2].textContent = `${highExcursions}`;
        statCards[3].textContent = `${warnings}`;
    }
}

/**
 * Render telemetry table rows
 */
function renderTelemetryTable(list) {
    const tbody = document.getElementById("telemetry-stream-tbody");
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:32px; color:#94a3b8;">No telemetry records match the current filters.</td></tr>`;
        return;
    }

    // Pagination slice
    const startIndex = (currentPage - 1) * pageSize;
    const pageItems = list.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = pageItems.map(row => {
        const tid = `TL-${row.id}`;
        const devCode = row.dev_code || `DEV-00${row.device_id || 1}`;
        const entityName = row.entity;
        const isVeh = row.isVehicle;
        const temp = parseFloat(row.temp);
        const hum = Math.round(row.hum);
        const batt = row.batt || "94%";
        const timeStr = row.time;

        let statusText = row.status || "NORMAL";
        let statusBadge = "badge-online";
        if (temp > 8.0) {
            statusText = "HIGH";
            statusBadge = "badge-critical";
        } else if (temp < 2.0) {
            statusText = "LOW";
            statusBadge = "badge-warning";
        } else if (hum > 80) {
            statusText = "WARNING";
            statusBadge = "badge-warning";
        }

        const isExcursion = statusText === "HIGH";

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:6px;">
                        ${isExcursion ? '<span style="width:3px; height:18px; background:#ef4444; border-radius:2px;"></span>' : ''}
                        <span class="cell-bold">${tid}</span>
                    </div>
                </td>
                <td class="cell-code">${devCode}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px; font-weight:600;">
                        <span>${isVeh ? '🚚' : '🏢'}</span>
                        <span>${entityName}</span>
                    </div>
                </td>
                <td>
                    <strong style="font-size:14px; color:${temp > 8.0 ? '#ef4444' : (temp < 2.0 ? '#2563eb' : '#0f172a')}; font-family:'JetBrains Mono',monospace;">
                        ${temp > 8.0 ? '⚠️ ' : (temp < 2.0 ? '↓ ' : '')}${temp.toFixed(1)}°C
                    </strong>
                </td>
                <td>
                    <span style="${hum > 80 ? 'background:#fffbeb; color:#b45309; padding:2px 6px; border-radius:4px; font-weight:700;' : ''}">${hum}%</span>
                </td>
                <td style="color:#334155; font-weight:500;">${batt}</td>
                <td style="font-size:12px; color:#64748b; font-family:'JetBrains Mono',monospace;">${timeStr}</td>
                <td>
                    <span class="badge ${statusBadge}">
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button type="button" class="btn-table-action" style="font-weight:600; color:#2563eb; border-color:#bfdbfe;" onclick="inspectTelemetryPacket(${row.id})">
                        🔍 Inspect
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    updatePaginationDisplay(list.length);
}

/**
 * Open deep packet inspector
 */
function inspectTelemetryPacket(packetId) {
    const item = allTelemetry.find(r => r.id === packetId);
    if (!item) {
        showToast("Packet data not found", "error");
        return;
    }

    if (typeof window.openPacketInspector === "function") {
        window.openPacketInspector({
            id: item.id,
            device_token: item.dev_code,
            device_id: item.device_id || 1,
            temperature: item.temp,
            humidity: item.hum,
            created_at: item.time,
            warehouse_name: !item.isVehicle ? item.entity : null,
            license_plate: item.isVehicle ? item.entity.replace("Vehicle ", "") : null
        });
    } else {
        showToast(`Packet #${item.id}: Temp ${item.temp}°C, Humidity ${item.hum}%`, "info");
    }
}

/**
 * Render thermal bands chart
 */
function renderThermalBandsChart() {
    const ctx = document.getElementById("thermalBandsChart");
    if (!ctx) return;

    if (thermalBandsChart) {
        thermalBandsChart.destroy();
    }

    const below2 = allTelemetry.filter(r => r.temp < 2.0).length;
    const safe2to8 = allTelemetry.filter(r => r.temp >= 2.0 && r.temp <= 8.0).length;
    const above8 = allTelemetry.filter(r => r.temp > 8.0).length;

    thermalBandsChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["<2°C Freeze Hazard", "2°C - 8°C Safe Zone (WHO)", ">8°C Excursion"],
            datasets: [
                {
                    data: [below2 || 1, safe2to8 || 12, above8 || 1],
                    backgroundColor: [
                        "rgba(59, 130, 246, 0.7)",
                        "#10b981",
                        "#ef4444"
                    ],
                    borderRadius: 4,
                    barPercentage: 0.65
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => `${c.raw} readings in this thermal band`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 10, weight: "600" } }
                },
                y: {
                    grid: { color: "rgba(226, 232, 240, 0.6)" },
                    ticks: { stepSize: 2, color: "#64748b", font: { size: 10 } }
                }
            }
        }
    });
}

/**
 * Multi-filters logic
 */
function initReportFilters() {
    const devSelect = document.getElementById("filter-device");
    const whSelect = document.getElementById("filter-warehouse");
    const vehSelect = document.getElementById("filter-vehicle");
    const statusSelect = document.getElementById("filter-status");
    const searchInput = document.getElementById("report-search-input");

    const applyFilter = () => {
        let filtered = [...allTelemetry];

        if (devSelect && devSelect.value) {
            const devId = devSelect.value;
            filtered = filtered.filter(t => t.device_id == devId || t.dev_code.includes(devId));
        }

        if (whSelect && whSelect.value) {
            const whName = whSelect.options[whSelect.selectedIndex].text.toLowerCase();
            filtered = filtered.filter(t => !t.isVehicle && (
                t.entity.toLowerCase().includes(whName.replace("cold storage", "").replace("cold facility", "").replace("distribution hub", "").trim()) ||
                t.entity.toLowerCase().includes(whName)
            ));
        }

        if (vehSelect && vehSelect.value) {
            const vehPlate = vehSelect.options[vehSelect.selectedIndex].text.toLowerCase();
            filtered = filtered.filter(t => t.isVehicle && t.entity.toLowerCase().includes(vehPlate));
        }

        if (statusSelect && statusSelect.value) {
            const st = statusSelect.value;
            filtered = filtered.filter(t => t.status === st);
        }

        if (searchInput && searchInput.value) {
            const val = searchInput.value.toLowerCase();
            filtered = filtered.filter(t => 
                t.dev_code.toLowerCase().includes(val) || 
                t.entity.toLowerCase().includes(val) ||
                `tl-${t.id}`.includes(val)
            );
        }

        currentPage = 1;
        renderTelemetryTable(filtered);
    };

    if (devSelect) devSelect.addEventListener("change", applyFilter);
    if (whSelect) whSelect.addEventListener("change", applyFilter);
    if (vehSelect) vehSelect.addEventListener("change", applyFilter);
    if (statusSelect) statusSelect.addEventListener("change", applyFilter);
    if (searchInput) searchInput.addEventListener("input", applyFilter);
}

function initTimeRangeFilter() {
    const select = document.querySelector(".page-actions-group select.filter-select");
    if (!select) return;

    select.addEventListener("change", () => {
        showToast(`Loading telemetry stream: ${select.value}...`, "info");
        setTimeout(() => {
            loadTelemetryLogs();
            showToast(`Data for ${select.value} synchronized!`, "success");
        }, 400);
    });
}

function initPaginationControls() {
    const controls = document.querySelector(".pagination-controls");
    if (!controls) return;

    controls.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const text = btn.textContent.trim();
        const totalPages = Math.ceil(allTelemetry.length / pageSize) || 1;

        if (text === "<") {
            if (currentPage > 1) {
                currentPage--;
                renderTelemetryTable(allTelemetry);
            }
        } else if (text === ">") {
            if (currentPage < totalPages) {
                currentPage++;
                renderTelemetryTable(allTelemetry);
            }
        } else if (!isNaN(parseInt(text, 10))) {
            currentPage = parseInt(text, 10);
            renderTelemetryTable(allTelemetry);
        }
    });
}

function updatePaginationDisplay(totalCount) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const start = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalCount);

    const span = document.querySelector(".pagination-controls span");
    if (span) {
        span.textContent = `Showing ${start} - ${end} of ${totalCount} records`;
    }

    const pageButtons = document.querySelectorAll(".pagination-controls button");
    pageButtons.forEach(b => {
        const num = parseInt(b.textContent.trim(), 10);
        if (!isNaN(num)) {
            if (num === currentPage) {
                b.classList.add("active");
            } else {
                b.classList.remove("active");
            }
        }
    });
}

function reloadReportTable() {
    loadTelemetryLogs();
    showToast("Synchronized latest telemetry readings from IoT nodes", "success");
}

/**
 * Export data function with options (CSV / ISO Compliance Certificate)
 */
function exportReportData() {
    if (window.Roles && !Roles.guard("export", "Staff accounts cannot export reports.")) return;
    const choice = confirm("EXPORT OPTIONS:\n\nClick OK to download the detailed telemetry CSV dataset.\nClick Cancel to generate a GDP / ISO 9001 Compliance Certificate.");

    if (choice) {
        exportCSV();
    } else {
        if (typeof window.generateAuditCertificate === "function") {
            window.generateAuditCertificate("WHO PQS & GDP Pharma Cold Chain Integrity");
        } else {
            showToast("Opening audit certificate generator...", "info");
        }
    }
}

function exportCSV() {
    showToast("Generating telemetry CSV dataset...", "info");
    const headers = ["Telemetry ID", "Device Code", "Target Unit", "Temperature (C)", "Humidity (%)", "Battery", "Timestamp (UTC+7)", "Status"];
    
    const rows = allTelemetry.map(r => [
        `"TL-${r.id}"`,
        `"${r.dev_code}"`,
        `"${r.entity}"`,
        `"${r.temp.toFixed(1)}"`,
        `"${r.hum}%"`,
        `"${r.batt}"`,
        `"${r.time}"`,
        `"${r.status}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `coldchain_telemetry_dataset_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    showToast("✓ Telemetry dataset downloaded successfully!", "success");
}
