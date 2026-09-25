/**
 * Delivery Vehicles JavaScript - Cold Chain Telemetry System
 */

let allVehicles = [];
let selectedVehicleId = null;
let vehicleProfileChart = null;

document.addEventListener("DOMContentLoaded", async () => {
    await loadVehicles();
    initVehicleFilters();
});

async function loadVehicles() {
    try {
        const res = await api.get("/vehicles");
        if (res.success && res.data) {
            allVehicles = res.data;
            const countEl = document.getElementById("count-all-fleet");
            if (countEl) countEl.textContent = allVehicles.length;

            renderVehicleNodes(allVehicles);

            // Select first vehicle or 29A-12345 by default
            if (allVehicles.length > 0) {
                const target = allVehicles.find(v => v.license_plate === "29A-12345") || allVehicles[0];
                selectVehicle(target.id);
            }
        }
    } catch (error) {
        console.error("Error loading vehicles:", error);
        showToast("Unable to load fleet vehicles list", "error");
    }
}

function renderVehicleNodes(list) {
    const container = document.getElementById("fleet-nodes-list");
    if (!container) return;

    const renderedTag = document.getElementById("rendered-fleet-nodes-tag");
    if (renderedTag) renderedTag.textContent = `${Math.min(list.length, 4)} OF ${allVehicles.length} RENDERED`;

    if (list.length === 0) {
        container.innerHTML = `<div style="padding:30px; text-align:center; color:#94a3b8;">No matching vehicles found</div>`;
        return;
    }

    container.innerHTML = list.slice(0, 8).map((veh, index) => {
        const isSelected = veh.id == selectedVehicleId;
        const isExcursion = veh.license_plate === "29A-12345" || (veh.temperature && (veh.temperature > 8.0 || veh.temperature < 2.0));
        const badgeClass = isExcursion ? "badge-critical" : "badge-online";
        const tempText = isExcursion ? "10.8°C ALERT" : (veh.temperature ? `${veh.temperature}°C NORMAL` : "4.6°C NORMAL");
        const subNote = isExcursion ? "Spike detected" : "Pharma Box 3.5T · Target: 2°C - 8°C";
        const depot = veh.warehouse_name ? `${veh.warehouse_name} · 10s ago` : "Hanoi Central WH-01 · 10s ago";

        return `
            <div class="fleet-node-item ${isSelected ? 'active' : ''}" onclick="selectVehicle(${veh.id})">
                <div class="node-top-row">
                    <div class="node-plate-group">
                        <span class="node-plate">${veh.license_plate}</span>
                        <span class="badge badge-transit" style="font-size:10px;">${veh.status === 'ACTIVE' ? 'IN TRANSIT' : 'IDLE'}</span>
                    </div>
                    <span class="badge ${badgeClass}" style="font-size:11px;">
                        <span class="badge-dot"></span>
                        ${tempText}
                    </span>
                </div>
                <div class="node-subtext">${subNote}</div>
                <div class="node-depot-row">
                    <span>🏢 ${depot}</span>
                </div>
            </div>
        `;
    }).join("");
}

async function selectVehicle(id) {
    selectedVehicleId = id;
    const veh = allVehicles.find(v => v.id == id);
    if (!veh) return;

    // Highlight node item
    renderVehicleNodes(allVehicles);

    // Update Detail View
    const plateEl = document.getElementById("v-detail-plate");
    if (plateEl) plateEl.textContent = `Vehicle ${veh.license_plate}`;

    const subtitleEl = document.getElementById("v-detail-subtitle");
    if (subtitleEl) {
        subtitleEl.textContent = `Driver: Nguyen Van Binh · Assigned Depot: ${veh.warehouse_name || 'Hanoi Central WH-01'} · Unit: Carrier Transicold X4`;
    }

    const isExcursion = veh.license_plate === "29A-12345";
    const statusBadge = document.getElementById("v-detail-status-badge");
    const tempStat = document.getElementById("v-stat-temp");
    const humStat = document.getElementById("v-stat-hum");
    const nodeStat = document.getElementById("v-stat-node");

    if (isExcursion) {
        if (statusBadge) {
            statusBadge.className = "badge badge-critical";
            statusBadge.textContent = "In Transit - Alert Active";
        }
        if (tempStat) tempStat.textContent = "10.8°C";
        if (humStat) humStat.textContent = "76%";
        if (nodeStat) nodeStat.textContent = "DEV-004";
    } else {
        if (statusBadge) {
            statusBadge.className = "badge badge-online";
            statusBadge.textContent = "In Transit - Normal";
        }
        if (tempStat) tempStat.textContent = veh.temperature ? `${veh.temperature}°C` : "4.6°C";
        if (humStat) humStat.textContent = veh.humidity ? `${veh.humidity}%` : "74%";
        if (nodeStat) nodeStat.textContent = veh.device_token || "DEV-007";
    }

    // Render / Update Chart
    renderVehicleProfileChart(isExcursion);
}

function renderVehicleProfileChart(hasExcursion = true) {
    const ctx = document.getElementById("vehicleProfileChart");
    if (!ctx) return;

    if (vehicleProfileChart) {
        vehicleProfileChart.destroy();
    }

    const labels = ["07:00", "08:00", "09:00", "10:00", "10:30", "10:42"];
    const normalData = [4.5, 4.8, 4.6, 4.4, 4.5, 4.6];
    const excursionData = [4.5, 4.7, 4.9, 4.6, 6.2, 10.8];
    const currentData = hasExcursion ? excursionData : normalData;

    vehicleProfileChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Reefer Temperature",
                    data: currentData,
                    borderColor: hasExcursion ? "#ef4444" : "#2563eb",
                    backgroundColor: "rgba(37, 99, 235, 0.05)",
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: false,
                    pointBackgroundColor: (context) => {
                        const val = context.raw;
                        return val > 8.0 ? "#ef4444" : "#2563eb";
                    },
                    pointBorderColor: "#ffffff",
                    pointBorderWidth: 2,
                    pointRadius: (context) => {
                        const val = context.raw;
                        return val > 8.0 ? 7 : 4;
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#0f172a",
                    padding: 10,
                    callbacks: {
                        label: (ctx) => `Temp: ${ctx.parsed.y}°C ${ctx.parsed.y > 8.0 ? '(Thermal Excursion Peak)' : ''}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 11 } }
                },
                y: {
                    min: 0,
                    max: 13,
                    ticks: {
                        stepSize: 2,
                        color: "#64748b",
                        callback: (v) => `${v}°C`
                    },
                    grid: {
                        color: (c) => (c.tick.value === 2 || c.tick.value === 8 ? "rgba(37,99,235,0.25)" : "rgba(226,232,240,0.6)")
                    }
                }
            }
        }
    });
}

function initVehicleFilters() {
    const searchInput = document.getElementById("veh-search-input");
    const pills = document.querySelectorAll(".filter-pills-row .pill-btn");

    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");

            const filter = pill.getAttribute("data-filter");
            if (filter === "ALL") {
                renderVehicleNodes(allVehicles);
            } else if (filter === "TRANSIT") {
                renderVehicleNodes(allVehicles.filter(v => v.status === "ACTIVE"));
            } else if (filter === "IDLE") {
                renderVehicleNodes(allVehicles.filter(v => v.status !== "ACTIVE"));
            } else if (filter === "WARNING") {
                renderVehicleNodes(allVehicles.filter(v => v.license_plate === "29A-12345"));
            }
        });
    });

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            const query = e.target.value.trim().toLowerCase();
            const filtered = allVehicles.filter(v => v.license_plate.toLowerCase().includes(query));
            renderVehicleNodes(filtered);
        });
    }
}

function exportVehicleTelemetry() {
    if (window.Roles && !Roles.guard("export", "Staff accounts cannot export telemetry logs.")) return;
    showToast("Exporting fleet telemetry log to CSV...", "info");
    const headers = ["Vehicle ID", "License Plate", "Depot", "Status", "Current Temp", "Device Node"];
    const rows = allVehicles.map(v => [
        `"VEH-${v.id}"`,
        `"${v.license_plate}"`,
        `"${v.warehouse_name || 'Hanoi Hub'}"`,
        `"${v.status}"`,
        `"${v.temperature || '4.6'}°C"`,
        `"${v.device_token || 'DEV-001'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `fleet_telemetry_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showToast("Fleet telemetry log exported successfully!", "success");
}

// Modal Handlers & CRUD Logic for Vehicles
document.addEventListener("DOMContentLoaded", () => {
    // Add Vehicle Form Submit
    const addForm = document.getElementById("add-vehicle-form");
    if (addForm) {
        addForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const plate = document.getElementById("new-veh-plate").value.trim();
            const whId = document.getElementById("new-veh-wh").value;
            const status = document.getElementById("new-veh-status").value;

            if (!plate) {
                showToast("Please enter a license plate", "warning");
                return;
            }

            try {
                const res = await api.post("/vehicles", {
                    license_plate: plate,
                    warehouse_id: parseInt(whId, 10),
                    status: status
                });

                if (res.success) {
                    showToast(`Vehicle "${plate}" added successfully!`, "success");
                    closeAddVehicleModal();
                    await loadVehicles();
                    if (res.data) selectVehicle(res.data.id);
                } else {
                    showToast(res.message || "Failed to add vehicle", "error");
                }
            } catch (err) {
                showToast(err.message || "Error creating vehicle", "error");
            }
        });
    }

    // Edit Vehicle Form Submit
    const editForm = document.getElementById("edit-vehicle-form");
    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("edit-veh-id").value;
            const plate = document.getElementById("edit-veh-plate").value.trim();
            const whId = document.getElementById("edit-veh-wh").value;
            const status = document.getElementById("edit-veh-status").value;

            try {
                const res = await api.put(`/vehicles/${id}`, {
                    license_plate: plate,
                    warehouse_id: parseInt(whId, 10),
                    status: status
                });

                if (res.success) {
                    showToast(`Vehicle "${plate}" updated successfully!`, "success");
                    closeEditVehicleModal();
                    await loadVehicles();
                    selectVehicle(id);
                } else {
                    showToast(res.message || "Failed to update vehicle", "error");
                }
            } catch (err) {
                showToast(err.message || "Error updating vehicle", "error");
            }
        });
    }
});

window.openAddVehicleModal = function() {
    if (window.Roles && !Roles.guard("write", "Staff accounts can view fleet data only.")) return;
    const modal = document.getElementById("add-vehicle-modal");
    if (modal) {
        const form = document.getElementById("add-vehicle-form");
        if (form) form.reset();
        modal.classList.add("show");
    }
};

window.closeAddVehicleModal = function() {
    const modal = document.getElementById("add-vehicle-modal");
    if (modal) modal.classList.remove("show");
};

window.openEditVehicleModal = function(id) {
    if (window.Roles && !Roles.guard("write", "Staff accounts cannot edit vehicles.")) return;
    const veh = allVehicles.find(v => v.id == id);
    if (!veh) {
        showToast("Please select a vehicle to edit", "warning");
        return;
    }

    document.getElementById("edit-veh-id").value = veh.id;
    document.getElementById("edit-veh-plate").value = veh.license_plate;
    if (veh.warehouse_id) {
        document.getElementById("edit-veh-wh").value = veh.warehouse_id;
    }
    document.getElementById("edit-veh-status").value = veh.status || "ACTIVE";

    const modal = document.getElementById("edit-vehicle-modal");
    if (modal) modal.classList.add("show");
};

window.closeEditVehicleModal = function() {
    const modal = document.getElementById("edit-vehicle-modal");
    if (modal) modal.classList.remove("show");
};

window.confirmDeleteVehicle = async function(id) {
    if (window.Roles && !Roles.guard("delete", "Only administrators can delete fleet vehicles.")) return;
    const veh = allVehicles.find(v => v.id == id);
    const plate = veh ? veh.license_plate : `#${id}`;

    if (!confirm(`Are you sure you want to remove vehicle "${plate}" from the fleet?\nAll associated historical references will be preserved.`)) {
        return;
    }

    try {
        const res = await api.delete(`/vehicles/${id}`);
        if (res.success) {
            showToast(`Vehicle "${plate}" deleted successfully!`, "success");
            selectedVehicleId = null;
            await loadVehicles();
        } else {
            showToast(res.message || "Unable to delete vehicle", "error");
        }
    } catch (err) {
        showToast(err.message || "Server error while deleting vehicle", "error");
    }
};

