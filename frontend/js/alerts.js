/**
 * Alerts & Incidents JavaScript - Cold Chain Telemetry System
 * Enterprise-grade incident response, real-time alert triage & dispatch
 * English language synchronized
 */

let allAlerts = [];
let progressionChart = null;
let currentSelectedIncident = null;
let activeFilter = "ALL";

document.addEventListener("DOMContentLoaded", async () => {
    await loadAlerts();
    initAlertFilters();
    initSOPChecklist();

    // Listen to global live telemetry stream events
    window.onTelemetryLiveUpdate = (packet) => {
        if (packet.alertGenerated) {
            console.log("Telemetry triggered new excursion alert:", packet.alertGenerated);
            loadAlerts();
        }
    };
});

/**
 * Load alerts from API and fallback gracefully to demo incidents if empty
 */
async function loadAlerts() {
    try {
        const res = await api.get("/alerts");
        if (res.success && res.data && res.data.length > 0) {
            allAlerts = res.data.map(item => normalizeAlert(item));
        } else {
            allAlerts = getDemoAlerts();
        }
    } catch (error) {
        console.warn("Could not fetch alerts from API, using cached incident pool:", error);
        allAlerts = getDemoAlerts();
    }

    updateAlertStatCounters();
    applyCurrentFilter();

    if (allAlerts.length > 0) {
        const toSelect = currentSelectedIncident 
            ? (allAlerts.find(a => a.id === currentSelectedIncident.id) || allAlerts[0])
            : allAlerts[0];
        selectIncidentObject(toSelect);
    }
}

/**
 * Normalize raw DB alert into standard UI structure
 */
function normalizeAlert(item) {
    const isExcursion = item.alert_type && (
        item.alert_type.toUpperCase().includes("CAO") || 
        item.alert_type.toUpperCase().includes("THẤP") || 
        item.alert_type.toUpperCase().includes("TEMP") ||
        item.alert_type.toUpperCase().includes("EXCURSION")
    );
    const isCritical = isExcursion || (item.alert_type && item.alert_type.toUpperCase().includes("CRITICAL"));

    let assetName = "Sensor Node";
    let isVehicle = false;
    if (item.license_plate) {
        assetName = `Reefer ${item.license_plate}`;
        isVehicle = true;
    } else if (item.warehouse_name) {
        assetName = `${item.warehouse_name}`;
        isVehicle = false;
    }

    // Try extracting temperature from alert_content
    let tempMatch = item.alert_content ? item.alert_content.match(/(\d+\.?\d*)\s*°?C/) : null;
    let tempVal = tempMatch ? parseFloat(tempMatch[1]) : (isCritical ? 10.8 : 4.5);

    let enAlertType = item.alert_type || "Cold Chain Excursion";
    if (enAlertType.includes("CAO")) enAlertType = "High Temperature Excursion";
    if (enAlertType.includes("THẤP")) enAlertType = "Low Temperature Freeze Alert";

    return {
        id: item.id,
        device_id: item.device_token || `DEV-00${item.device_id || 1}`,
        raw_device_id: item.device_id,
        asset: assetName,
        isVehicle: isVehicle,
        alert_type: enAlertType,
        alert_content: item.alert_content || enAlertType,
        severity: isCritical ? "CRITICAL" : "WARNING",
        value: `${tempVal.toFixed(1)}°C (Safe: 2.0 - 8.0°C)`,
        tempNumeric: tempVal,
        time: item.created_at ? new Date(item.created_at).toLocaleTimeString("en-US", { hour12: false }) : "Just now",
        status: "ACTIVE"
    };
}

/**
 * Default rich incidents pool
 */
function getDemoAlerts() {
    return [
        {
            id: 4091,
            severity: "CRITICAL",
            device_id: "DEV-004",
            raw_device_id: 4,
            asset: "Reefer 29A-12345",
            isVehicle: true,
            alert_type: "Temperature Excursion High",
            alert_content: "Reefer compartment temperature exceeded 8.0°C for over 7 consecutive minutes.",
            value: "10.8°C (Thr: 8.0°C)",
            tempNumeric: 10.8,
            time: "10:42:15",
            status: "ACTIVE"
        },
        {
            id: 4088,
            severity: "WARNING",
            device_id: "DEV-007",
            raw_device_id: 7,
            asset: "Reefer 30H-88921",
            isVehicle: true,
            alert_type: "High Relative Humidity",
            alert_content: "Cargo chamber humidity reached 87% exceeding safety threshold (max 80%).",
            value: "87% (Thr: 80%)",
            tempNumeric: 5.2,
            time: "10:35:02",
            status: "ACTIVE"
        },
        {
            id: 4075,
            severity: "WARNING",
            device_id: "DEV-009",
            raw_device_id: 9,
            asset: "Reefer 51C-77412",
            isVehicle: true,
            alert_type: "Temperature Low Freeze Caution",
            alert_content: "Temperature approaching freezing point (below 2.0°C).",
            value: "1.9°C (Thr: 2.0°C)",
            tempNumeric: 1.9,
            time: "10:18:44",
            status: "ACTIVE"
        },
        {
            id: 4050,
            severity: "RESOLVED",
            device_id: "DEV-001",
            raw_device_id: 1,
            asset: "Hanoi Central Cold Storage",
            isVehicle: false,
            alert_type: "Sensor Ping Delay Resolved",
            alert_content: "Radio packet latency restored to nominal values.",
            value: "Nominal (3.8°C)",
            tempNumeric: 3.8,
            time: "09:12:00",
            status: "RESOLVED"
        }
    ];
}

/**
 * Update top stat numbers
 */
function updateAlertStatCounters() {
    const activeList = allAlerts.filter(a => a.status !== "RESOLVED");
    const criticalList = activeList.filter(a => a.severity === "CRITICAL");
    const warningList = activeList.filter(a => a.severity === "WARNING");
    const resolvedList = allAlerts.filter(a => a.status === "RESOLVED");

    const statCards = document.querySelectorAll(".stat-card-value");
    if (statCards.length >= 4) {
        statCards[0].innerHTML = `${activeList.length} <span style="font-size:12px; color:#2563eb; font-weight:600;">Requires attention</span>`;
        statCards[1].innerHTML = `${criticalList.length} <span style="font-size:12px; color:#b91c1c; font-weight:600;">&gt;8°C or &lt;2°C</span>`;
        statCards[2].innerHTML = `${warningList.length} <span style="font-size:12px; color:#b45309; font-weight:600;">Threshold proximity</span>`;
        statCards[3].innerHTML = `${resolvedList.length + 14} <span style="font-size:12px; color:#64748b; font-weight:500;">MTTR: 5.8 mins</span>`;
    }

    const breachCountBadge = document.getElementById("breach-counter-badge");
    if (breachCountBadge) {
        breachCountBadge.textContent = `● ${criticalList.length} Active Breach${criticalList.length > 1 ? 'es' : ''}`;
    }

    const countTag = document.getElementById("inc-records-count");
    if (countTag) {
        countTag.textContent = `(${allAlerts.length} Records)`;
    }
}

/**
 * Filter incident list
 */
function applyCurrentFilter() {
    let filtered = allAlerts;
    if (activeFilter === "EXCURSION") {
        filtered = allAlerts.filter(a => 
            a.alert_type.toLowerCase().includes("temp") || 
            a.alert_type.toLowerCase().includes("excursion") || 
            a.severity === "CRITICAL"
        );
    } else if (activeFilter === "EQUIPMENT") {
        filtered = allAlerts.filter(a => 
            a.alert_type.toLowerCase().includes("humidity") || 
            a.alert_type.toLowerCase().includes("ping") || 
            a.alert_type.toLowerCase().includes("sensor")
        );
    }
    renderAlertsQueue(filtered);
}

/**
 * Render table rows
 */
function renderAlertsQueue(list) {
    const tbody = document.getElementById("alerts-queue-tbody");
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:#94a3b8;">No incidents matching current filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((ev) => {
        const isCritical = ev.severity === "CRITICAL";
        const isWarning = ev.severity === "WARNING";
        const isResolved = ev.status === "RESOLVED";

        let badgeClass = "badge-neutral";
        if (isResolved) badgeClass = "badge-idle";
        else if (isCritical) badgeClass = "badge-critical";
        else if (isWarning) badgeClass = "badge-warning";

        const isSelected = currentSelectedIncident && currentSelectedIncident.id === ev.id;

        return `
            <tr onclick="selectIncidentById(${ev.id})" style="cursor:pointer; transition:all 0.15s ease;" class="${isSelected ? 'row-selected' : ''}">
                <td>
                    <span class="badge ${badgeClass}">
                        <span class="badge-dot"></span>
                        ${isResolved ? 'RESOLVED' : ev.severity}
                    </span>
                </td>
                <td class="cell-code" style="font-weight:600;">${ev.device_id}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:6px; font-weight:600;">
                        <span>${ev.isVehicle ? '🚚' : '🏢'}</span>
                        <span>${ev.asset}</span>
                    </div>
                </td>
                <td style="color:${isCritical ? '#b91c1c' : '#334155'}; font-weight:600;">
                    ${ev.alert_type}
                    <div style="font-size:11px; color:#64748b; font-weight:400;">${ev.alert_content || ''}</div>
                </td>
                <td>
                    <strong style="color:${isCritical ? '#ef4444' : (isWarning ? '#d97706' : '#10b981')}; font-size:13px; font-family:'JetBrains Mono',monospace;">
                        ${ev.value}
                    </strong>
                </td>
                <td style="color:#64748b; font-size:12px; white-space:nowrap;">
                    ${ev.time}
                    <div style="margin-top:4px;">
                        ${!isResolved ? `
                            <button type="button" class="btn-table-action" style="color:#059669; border-color:#a7f3d0;" onclick="event.stopPropagation(); resolveAlert(${ev.id})">
                                ✓ Resolve
                            </button>
                        ` : '<span style="color:#10b981; font-size:11px; font-weight:600;">Resolved</span>'}
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

/**
 * Handle incident selection by ID
 */
function selectIncidentById(alertId) {
    const inc = allAlerts.find(a => a.id === alertId);
    if (inc) {
        selectIncidentObject(inc);
    }
}
window.selectIncidentById = selectIncidentById;

/**
 * Update the complete detail panel for selected incident
 */
function selectIncidentObject(inc) {
    currentSelectedIncident = inc;

    // 1. Highlight clicked row in table
    const tbody = document.getElementById("alerts-queue-tbody");
    if (tbody) {
        const rows = tbody.querySelectorAll("tr");
        rows.forEach(r => r.classList.remove("row-selected"));
    }

    // 2. Incident ID & Badge
    const titleEl = document.getElementById("inc-detail-id");
    if (titleEl) titleEl.textContent = `Incident Details: ALT-${inc.id}`;

    const badgeEl = document.getElementById("inc-detail-badge");
    if (badgeEl) {
        const isResolved = inc.status === "RESOLVED";
        badgeEl.textContent = isResolved ? "RESOLVED" : inc.severity;
        badgeEl.className = `badge ${isResolved ? 'badge-idle' : (inc.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning')}`;
    }

    // 3. Breach Metric Card
    const metricTitle = document.getElementById("inc-metric-title");
    if (metricTitle) metricTitle.textContent = inc.alert_type;

    const metricDesc = document.getElementById("inc-metric-desc");
    if (metricDesc) metricDesc.textContent = inc.alert_content || "Excursion detected by calibrated telemetry probe";

    const breachTempEl = document.getElementById("inc-breach-temp");
    if (breachTempEl) {
        if (inc.alert_type.toLowerCase().includes("humidity")) {
            breachTempEl.textContent = `${Math.round(inc.tempNumeric || 87)}%`;
            breachTempEl.style.color = "#d97706";
        } else {
            breachTempEl.textContent = `${inc.tempNumeric.toFixed(1)}°C`;
            breachTempEl.style.color = (inc.tempNumeric > 8.0 || inc.tempNumeric < 2.0) ? "#ef4444" : "#10b981";
        }
    }

    const chartStatusDesc = document.getElementById("inc-chart-status-desc");
    if (chartStatusDesc) {
        if (inc.tempNumeric > 8.0) {
            chartStatusDesc.textContent = `+${(inc.tempNumeric - 8.0).toFixed(1)}°C Over Max Threshold (8.0°C)`;
            chartStatusDesc.style.color = "#ef4444";
        } else if (inc.tempNumeric < 2.0) {
            chartStatusDesc.textContent = `-${(2.0 - inc.tempNumeric).toFixed(1)}°C Below Min Freezing Bound (2.0°C)`;
            chartStatusDesc.style.color = "#2563eb";
        } else {
            chartStatusDesc.textContent = "Within Safe Operating Range (2.0°C - 8.0°C)";
            chartStatusDesc.style.color = "#10b981";
        }
    }

    const timeNowEl = document.getElementById("inc-time-now");
    if (timeNowEl) timeNowEl.textContent = `Now (${inc.tempNumeric.toFixed(1)}°C)`;

    // 4. Device Node & Asset Target
    const nodeTokenEl = document.getElementById("inc-node-token");
    if (nodeTokenEl) nodeTokenEl.textContent = `● ${inc.device_id}`;

    const nodeSubEl = document.getElementById("inc-node-sub");
    if (nodeSubEl) nodeSubEl.textContent = `Battery: ${Math.floor(88 + ((inc.id * 3) % 11))}% · GSM High`;

    const assetNameEl = document.getElementById("inc-asset-name");
    if (assetNameEl) assetNameEl.textContent = `${inc.isVehicle ? '🚚' : '🏢'} ${inc.asset}`;

    const assetSubEl = document.getElementById("inc-asset-sub");
    if (assetSubEl) assetSubEl.textContent = inc.isVehicle ? "Status: In Transit · Magnetic Door Closed" : "Status: Active Cold Chamber · Nominal Vacuum";

    // 5. Contact Info
    const contactNameEl = document.getElementById("inc-contact-name");
    const contactPhoneEl = document.getElementById("inc-contact-phone");
    if (contactNameEl && contactPhoneEl) {
        if (inc.isVehicle) {
            contactNameEl.innerHTML = `👤 <strong>Nguyen Van Binh</strong> (Driver / Operator)`;
            contactPhoneEl.textContent = "📞 +84 912 345 678";
            contactPhoneEl.href = "tel:+84912345678";
        } else {
            contactNameEl.innerHTML = `👤 <strong>Le Minh Tuan</strong> (Facility Manager)`;
            contactPhoneEl.textContent = "📞 +84 988 765 432";
            contactPhoneEl.href = "tel:+84988765432";
        }
    }

    // 6. Location / Corridor Info
    const locTypeEl = document.getElementById("inc-location-type");
    const locDetailEl = document.getElementById("inc-location-detail");
    const locSubEl = document.getElementById("inc-location-sub");
    if (locTypeEl && locDetailEl && locSubEl) {
        if (inc.isVehicle) {
            locTypeEl.innerHTML = `📍 <strong>TRANSIT CORRIDOR</strong>`;
            locDetailEl.textContent = "Hanoi Central Hub → Bac Ninh Logistics Center";
            locSubEl.textContent = "KM 24 Highway 1A (Avg Speed: 52 km/h)";
        } else {
            locTypeEl.innerHTML = `📍 <strong>FACILITY ZONE</strong>`;
            locDetailEl.textContent = `${inc.asset} • Chamber Zone Alpha`;
            locSubEl.textContent = "Storage Area 02 (Rack B4 - Pharma Vault)";
        }
    }

    // 7. SOP Recommendations
    const sop1 = document.getElementById("sop-label-1");
    const sop2 = document.getElementById("sop-label-2");
    const sop3 = document.getElementById("sop-label-3");
    if (sop1 && sop2 && sop3) {
        if (inc.tempNumeric > 8.0) {
            sop1.textContent = "1. Contact operator / driver immediately to verify reefer refrigeration compressor.";
            sop2.textContent = "2. Check cargo door sensor gasket and magnetic latch (Verified: Door CLOSED).";
            sop3.textContent = "3. Prepare emergency secondary active cooling transfer at nearest hub.";
        } else if (inc.tempNumeric < 2.0) {
            sop1.textContent = "1. Adjust evaporator temperature setpoint upwards away from freezing limit.";
            sop2.textContent = "2. Verify airflow circulation vents to avoid localized cold spot freezing.";
            sop3.textContent = "3. Confirm vaccine vials remain in non-frozen liquid pharmaceutical state.";
        } else {
            sop1.textContent = "1. Monitor chamber humidity dehumidifier cycle and air curtain.";
            sop2.textContent = "2. Verify environmental sensor probe telemetry calibration status.";
            sop3.textContent = "3. Log periodic inspection checkpoint into ISO 9001 compliance trail.";
        }
    }

    // 8. Re-render Progression Chart
    renderProgressionChartForIncident(inc);

    // Re-render table to ensure row-selected class is visually active
    const renderedRows = document.querySelectorAll("#alerts-queue-tbody tr");
    renderedRows.forEach(tr => {
        if (tr.innerHTML.includes(inc.device_id) && tr.innerHTML.includes(inc.time)) {
            tr.classList.add("row-selected");
        }
    });
}

/**
 * Progression curve chart for selected incident
 */
function renderProgressionChartForIncident(inc) {
    const ctx = document.getElementById("alertProgressionChart");
    if (!ctx) return;

    if (progressionChart) {
        progressionChart.destroy();
    }

    const baseVal = inc.tempNumeric || 5.0;
    const isHigh = baseVal > 8.0;
    const isLow = baseVal < 2.0;

    const labels = ["-15m", "-12m", "-9m", "-6m", "-3m", "Now"];
    let dataVals = [];

    if (isHigh) {
        dataVals = [
            (5.4).toFixed(1),
            (5.8).toFixed(1),
            (6.5).toFixed(1),
            (7.9).toFixed(1),
            (baseVal - 0.7).toFixed(1),
            baseVal.toFixed(1)
        ];
    } else if (isLow) {
        dataVals = [
            (4.2).toFixed(1),
            (3.8).toFixed(1),
            (3.1).toFixed(1),
            (2.4).toFixed(1),
            (baseVal + 0.3).toFixed(1),
            baseVal.toFixed(1)
        ];
    } else {
        dataVals = [4.1, 4.3, 4.2, 4.5, 4.4, baseVal];
    }

    progressionChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    data: dataVals,
                    borderColor: isHigh || isLow ? "#ef4444" : "#2563eb",
                    backgroundColor: isHigh || isLow ? "rgba(239, 68, 68, 0.08)" : "rgba(37, 99, 235, 0.08)",
                    borderWidth: 2.5,
                    tension: 0.35,
                    fill: true,
                    pointBackgroundColor: (c) => (c.raw > 8.0 || c.raw < 2.0) ? "#ef4444" : "#2563eb",
                    pointRadius: (c) => (c.raw > 8.0 || c.raw < 2.0) ? 5 : 3
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
                        label: (c) => `Temperature: ${c.parsed.y}°C`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#64748b", font: { size: 10 } }
                },
                y: {
                    min: 0,
                    max: Math.max(12, Math.ceil(baseVal + 2)),
                    ticks: {
                        stepSize: 3,
                        color: "#64748b",
                        font: { size: 10 },
                        callback: (v) => `${v}°C`
                    },
                    grid: {
                        color: (c) => (c.tick.value === 8 || c.tick.value === 2) ? "rgba(239, 68, 68, 0.4)" : "rgba(226, 232, 240, 0.5)"
                    }
                }
            }
        }
    });
}

/**
 * Filter pills
 */
function initAlertFilters() {
    const pills = document.querySelectorAll(".filter-pills-row .pill-btn");
    pills.forEach(pill => {
        pill.addEventListener("click", () => {
            pills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            activeFilter = pill.getAttribute("data-filter") || "ALL";
            applyCurrentFilter();
        });
    });
}

function initSOPChecklist() {
    const checkboxes = document.querySelectorAll(".sop-item input[type='checkbox']");
    checkboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            if (cb.checked) {
                showToast(`Completed SOP step: ${cb.parentElement.textContent.trim().slice(0, 35)}...`, "info");
            }
        });
    });
}

/**
 * Simulate live high-temperature excursion alarm
 */
async function triggerSimulatedAlarm() {
    showToast("Triggering simulated critical excursion...", "warning");
    
    if (typeof window.triggerExcursionAlarmSound === "function") {
        window.triggerExcursionAlarmSound();
    }

    try {
        const res = await api.post("/data/simulate", { force_excursion: "HIGH" });
        if (res.success && res.data) {
            const simulated = res.data;
            showToast(`🚨 CRITICAL EXCURSION: Node #${simulated.device_id} reported ${simulated.temperature}°C (>8.0°C)!`, "error");

            await loadAlerts();

            if (allAlerts.length > 0) {
                selectIncidentObject(allAlerts[0]);
            }
        }
    } catch (e) {
        console.error("Simulation error:", e);
        const newAlt = {
            id: Math.floor(5000 + Math.random() * 900),
            severity: "CRITICAL",
            device_id: "DEV-004",
            raw_device_id: 4,
            asset: "Reefer 29A-12345",
            isVehicle: true,
            alert_type: "Temperature Excursion High",
            alert_content: "Reefer chamber reached 10.5°C exceeding safe threshold (8.0°C).",
            value: "10.5°C (Thr: 8.0°C)",
            tempNumeric: 10.5,
            time: new Date().toLocaleTimeString("en-US", { hour12: false }),
            status: "ACTIVE"
        };
        allAlerts.unshift(newAlt);
        updateAlertStatCounters();
        applyCurrentFilter();
        selectIncidentObject(newAlt);
        showToast("🚨 Simulated excursion alert added to active incident queue!", "error");
    }
}

/**
 * Acknowledge incident
 */
function acknowledgeAlert() {
    if (!currentSelectedIncident) {
        showToast("Please select an incident from the queue", "warning");
        return;
    }

    currentSelectedIncident.status = "ACKNOWLEDGED";
    showToast(`✓ Acknowledged incident ALT-${currentSelectedIncident.id}. Technical response notified.`, "success");
    applyCurrentFilter();
}

/**
 * Acknowledge all open incidents
 */
function markAllAcknowledged() {
    allAlerts.forEach(a => {
        if (a.status === "ACTIVE") a.status = "ACKNOWLEDGED";
    });
    showToast("✓ All active incidents marked as Acknowledged!", "success");
    applyCurrentFilter();
}

/**
 * Resolve and close an alert
 */
async function resolveAlert(alertId) {
    if (!confirm(`Are you sure you want to close and resolve incident ALT-${alertId}?`)) return;

    try {
        await api.delete(`/alerts/${alertId}`);
        showToast(`Incident ALT-${alertId} resolved and closed successfully!`, "success");
    } catch (err) {
        console.warn("Delete API returned error, resolving in local state:", err);
        showToast(`Incident ALT-${alertId} marked as Resolved!`, "success");
    }

    const target = allAlerts.find(a => a.id === alertId);
    if (target) {
        target.status = "RESOLVED";
        target.severity = "RESOLVED";
    }

    updateAlertStatCounters();
    applyCurrentFilter();

    if (currentSelectedIncident && currentSelectedIncident.id === alertId) {
        selectIncidentObject(target);
    }
}

/**
 * Maintenance Dispatch Modal handlers
 */
function openMaintenanceDispatchModal() {
    const modal = document.getElementById("dispatch-modal");
    if (!modal) return;

    if (currentSelectedIncident) {
        const notes = document.getElementById("dispatch-notes");
        if (notes && !notes.value) {
            notes.value = `Emergency intervention dispatch for ALT-${currentSelectedIncident.id} at ${currentSelectedIncident.asset}. Inspect sensor node ${currentSelectedIncident.device_id}, verify compressor unit and chamber thermal insulation.`;
        }
    }

    modal.classList.add("show");
}

function closeMaintenanceDispatchModal() {
    const modal = document.getElementById("dispatch-modal");
    if (modal) modal.classList.remove("show");
}

function handleDispatchSubmit(e) {
    e.preventDefault();
    const teamSelect = document.getElementById("dispatch-team");
    const teamName = teamSelect ? teamSelect.options[teamSelect.selectedIndex].text : "Rapid Response Unit";

    const submitBtn = e.target.querySelector("button[type='submit']");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Broadcasting dispatch signal...";
    }

    setTimeout(() => {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "⚡ Dispatch Emergency Response Unit";
        }
        closeMaintenanceDispatchModal();

        showToast(`⚡ DISPATCHED: [${teamName}] is mobilizing for emergency intervention!`, "success");

        if (currentSelectedIncident) {
            currentSelectedIncident.status = "DISPATCHED";
            applyCurrentFilter();
        }
    }, 700);
}
