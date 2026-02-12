const skuCatalog = [
  {
    id: "SKU-RT-100",
    name: "Retail Coffee Beans 1kg",
    supplier: "Sierra Trading Pte Ltd",
    currency: "USD",
    baselineUnitPrice: 18.4,
    historicalMonthlyDemand: [620, 610, 660, 680, 700, 735, 770, 730, 710, 745, 760, 790],
    leadTimeDays: 10
  },
  {
    id: "SKU-MF-220",
    name: "Industrial Fastener Pack",
    supplier: "Atlas Components",
    currency: "EUR",
    baselineUnitPrice: 12.2,
    historicalMonthlyDemand: [330, 340, 325, 348, 360, 380, 395, 401, 390, 385, 370, 402],
    leadTimeDays: 14
  },
  {
    id: "SKU-PH-018",
    name: "Pharmacy Packaging Roll",
    supplier: "NimblePak",
    currency: "SGD",
    baselineUnitPrice: 4.6,
    historicalMonthlyDemand: [950, 910, 890, 920, 940, 970, 1010, 990, 980, 975, 1005, 1020],
    leadTimeDays: 8
  }
];

const fxRates = {
  USD: 1,
  EUR: 1.09,
  SGD: 0.74
};

const kpiState = {
  onTimeRate: 89,
  leadTime: 11.8,
  cycleTime: 2.2,
  approvalBottlenecks: 1,
  inventoryTurnover: 6.3,
  cashflowImpact: -4.5,
  costSavings: 8.2,
  automationRate: 0
};

const state = {
  forecast: null,
  pr: null,
  approval: null,
  mail: [],
  delivery: {
    expectedDate: null,
    actualDate: null,
    partialDelivered: 0,
    grnIssued: false,
    discrepancyFlag: false
  },
  payment: {
    invoiceAmount: null,
    matchPassed: false,
    paid: false,
    anomalyFlag: false
  },
  workflowStage: "Forecast",
  supplierScore: {
    onTime: 88,
    priceCompetitiveness: 74,
    orderAccuracy: 91,
    responseTime: 70,
    qualityIssues: 95
  },
  audit: [],
  artifacts: [],
  activeArtifactKey: null,
  pendingApprovals: [],
  selectedPendingApprovalId: null,
  demoMode: false,
  demoRunning: false
};

const dom = {
  kpiGrid: document.getElementById("kpiGrid"),
  automationRate: document.getElementById("automationRate"),
  workflowStage: document.getElementById("workflowStage"),
  skuSelect: document.getElementById("skuSelect"),
  monthSelect: document.getElementById("monthSelect"),
  forecastForm: document.getElementById("forecastForm"),
  budgetInput: document.getElementById("budgetInput"),
  forecastResults: document.getElementById("forecastResults"),
  prSummary: document.getElementById("prSummary"),
  createPrBtn: document.getElementById("createPrBtn"),
  requestPriceBtn: document.getElementById("requestPriceBtn"),
  humanSignoffBtn: document.getElementById("humanSignoffBtn"),
  roleSelect: document.getElementById("roleSelect"),
  thresholdInput: document.getElementById("thresholdInput"),
  approvalSummary: document.getElementById("approvalSummary"),
  pendingApprovalSelect: document.getElementById("pendingApprovalSelect"),
  routeApprovalBtn: document.getElementById("routeApprovalBtn"),
  approveBtn: document.getElementById("approveBtn"),
  delegateBtn: document.getElementById("delegateBtn"),
  mailbox: document.getElementById("mailbox"),
  sendPoBtn: document.getElementById("sendPoBtn"),
  reminderBtn: document.getElementById("reminderBtn"),
  handoffBtn: document.getElementById("handoffBtn"),
  deliverySummary: document.getElementById("deliverySummary"),
  syncDeliveryBtn: document.getElementById("syncDeliveryBtn"),
  partialDeliveryBtn: document.getElementById("partialDeliveryBtn"),
  grnBtn: document.getElementById("grnBtn"),
  paymentSummary: document.getElementById("paymentSummary"),
  invoiceBtn: document.getElementById("invoiceBtn"),
  matchBtn: document.getElementById("matchBtn"),
  executePaymentBtn: document.getElementById("executePaymentBtn"),
  scoreTable: document.getElementById("scoreTable"),
  supplierScoreSummary: document.getElementById("supplierScoreSummary"),
  auditLog: document.getElementById("auditLog"),
  forecastArtifacts: document.getElementById("forecastArtifacts"),
  prArtifacts: document.getElementById("prArtifacts"),
  approvalArtifacts: document.getElementById("approvalArtifacts"),
  commsArtifacts: document.getElementById("commsArtifacts"),
  deliveryArtifacts: document.getElementById("deliveryArtifacts"),
  paymentArtifacts: document.getElementById("paymentArtifacts"),
  scoreArtifacts: document.getElementById("scoreArtifacts"),
  artifactViewer: document.getElementById("artifactViewer"),
  runDemoBtn: document.getElementById("runDemoBtn"),
  downloadArtifactPdfBtn: document.getElementById("downloadArtifactPdfBtn")
};

function nowStamp() {
  return new Date().toLocaleString();
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function getActiveArtifact() {
  return state.artifacts.find((artifact) => artifact.stepKey === state.activeArtifactKey) || null;
}

function wrapLines(text, maxLen = 90) {
  const normalized = String(text).replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");
  const output = [];

  for (const line of rawLines) {
    const sanitized = line.replace(/[^\x20-\x7E]/g, "?");
    if (sanitized.length <= maxLen) {
      output.push(sanitized);
      continue;
    }

    let current = "";
    for (const word of sanitized.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxLen) {
        if (current) output.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) output.push(current);
  }

  return output.slice(0, 75);
}

function pdfEscape(line) {
  return line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function buildPdfBlob(artifact) {
  const lines = [
    `OrderPilot Artifact: ${artifact.title}`,
    `Generated: ${artifact.time}`,
    `File: ${artifact.filename}`,
    "",
    ...wrapLines(artifact.content, 94)
  ];

  const contentStream = [
    "BT",
    "/F1 9 Tf",
    "11 TL",
    "50 760 Td",
    ...lines.flatMap((line, idx) => (idx === 0 ? [`(${pdfEscape(line)}) Tj`] : ["T*", `(${pdfEscape(line)}) Tj`])),
    "ET"
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function downloadArtifactPdf(artifact) {
  if (!artifact) return;
  const blob = buildPdfBlob(artifact);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = artifact.filename.replace(/\.[^.]+$/, ".pdf");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function upsertArtifact(stepKey, title, content, mime = "application/json", ext = "json") {
  const time = nowStamp();
  const filename = `${stepKey}-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`;
  const artifact = {
    stepKey: safeName(stepKey),
    title,
    content: typeof content === "string" ? content : JSON.stringify(content, null, 2),
    mime,
    filename,
    time
  };

  state.artifacts = [artifact, ...state.artifacts.filter((a) => a.stepKey !== artifact.stepKey)].slice(0, 30);
  state.activeArtifactKey = artifact.stepKey;
  renderArtifacts();
}

function logAudit(message) {
  state.audit.unshift({ time: nowStamp(), message });
  state.audit = state.audit.slice(0, 40);
  renderAudit();
}

function updateStage(stage) {
  state.workflowStage = stage;
  dom.workflowStage.textContent = stage;
}

function adjustAutomation(points) {
  kpiState.automationRate = Math.min(100, kpiState.automationRate + points);
  dom.automationRate.textContent = `${kpiState.automationRate}%`;
}

function getSelectedSku() {
  const id = dom.skuSelect.value;
  return skuCatalog.find((sku) => sku.id === id);
}

function computeForecast(sku, budget) {
  const months = sku.historicalMonthlyDemand;
  const movingAvg = (months.slice(-3).reduce((a, b) => a + b, 0)) / 3;
  const yearlyAvg = months.reduce((a, b) => a + b, 0) / months.length;
  const seasonalFactor = months[months.length - 1] / yearlyAvg;
  const predictedDemand = Math.round(movingAvg * (0.78 + seasonalFactor * 0.22));

  const leadTimeMonths = sku.leadTimeDays / 30;
  const reorderPoint = Math.round(predictedDemand * leadTimeMonths + predictedDemand * 0.2);
  const safetyStock = Math.round(predictedDemand * 0.18);

  const unitUsd = sku.baselineUnitPrice * fxRates[sku.currency];
  const recommendedQty = Math.max(40, predictedDemand + safetyStock - Math.round(predictedDemand * 0.4));
  const estimatedCost = recommendedQty * unitUsd;
  const cashflowImpact = ((estimatedCost / budget) * 100).toFixed(1);

  return {
    predictedDemand,
    reorderPoint,
    safetyStock,
    recommendedQty,
    unitUsd,
    estimatedCost,
    cashflowImpact
  };
}

function populateSkuList() {
  dom.skuSelect.innerHTML = skuCatalog
    .map((sku) => `<option value="${sku.id}">${sku.id} - ${sku.name}</option>`)
    .join("");
}

function renderKpis() {
  const cards = [
    ["On-Time Delivery", `${kpiState.onTimeRate}%`],
    ["Avg Supplier Lead Time", `${kpiState.leadTime.toFixed(1)} days`],
    ["Procurement Cycle", `${kpiState.cycleTime.toFixed(1)} days`],
    ["Approval Bottlenecks", String(kpiState.approvalBottlenecks)],
    ["Inventory Turnover", `${kpiState.inventoryTurnover.toFixed(1)}x`],
    ["Cashflow Impact", `${kpiState.cashflowImpact}%`],
    ["Cost Savings vs Budget", `${kpiState.costSavings}%`],
    ["AI Task Handling", `${kpiState.automationRate}%`]
  ];

  dom.kpiGrid.innerHTML = cards
    .map(([label, value]) => `<div class="card kpi"><p class="label">${label}</p><p class="value">${value}</p></div>`)
    .join("");
}

function renderForecast() {
  const forecast = state.forecast;
  if (!forecast) {
    dom.forecastResults.innerHTML = "<div class='info-line'><p>No forecast yet. Generate one to start procurement flow.</p></div>";
    return;
  }

  dom.forecastResults.innerHTML = `
    <div class="info-line">
      <p><strong>Predicted Demand:</strong> ${forecast.predictedDemand} units</p>
      <p class="meta">Reorder Point: ${forecast.reorderPoint} | Safety Stock: ${forecast.safetyStock}</p>
    </div>
    <div class="info-line">
      <p><strong>Recommended Order:</strong> ${forecast.recommendedQty} units</p>
      <p class="meta">Estimated Cost: ${money(forecast.estimatedCost)} | Budget Impact: ${forecast.cashflowImpact}%</p>
    </div>`;
}

function renderPr() {
  if (!state.pr) {
    dom.prSummary.innerHTML = "<span class='pill'>No draft PR</span>";
    return;
  }

  const pr = state.pr;
  dom.prSummary.innerHTML = `
    <span class="pill">PR ${pr.id}</span>
    <span class="pill ${pr.humanSignoff ? "good" : "warn"}">Pricing Sign-off: ${pr.humanSignoff ? "Complete" : "Required"}</span>
    <span class="pill">Supplier: ${pr.supplier}</span>
    <span class="pill">Qty: ${pr.qty} | Unit: ${pr.currency} ${pr.unitPrice.toFixed(2)}</span>
    <span class="pill">Total (USD): ${money(pr.totalUsd)}</span>
    <span class="pill ${pr.priceRequested ? "good" : "warn"}">Supplier Price Request: ${pr.priceRequested ? "Sent" : "Pending"}</span>
  `;
}

function renderApproval() {
  const pendingCount = state.pendingApprovals.filter((item) => item.status === "pending").length;

  if (!state.approval) {
    dom.approvalSummary.innerHTML = `
      <span class='pill'>Awaiting PR routing</span>
      <span class='pill ${pendingCount ? "warn" : "good"}">Pending Queue: ${pendingCount}</span>
    `;
    renderPendingApprovalItems();
    return;
  }

  const a = state.approval;
  dom.approvalSummary.innerHTML = `
    <span class="pill">Role: ${a.roleLabel}</span>
    <span class="pill">Threshold: ${a.threshold}%</span>
    <span class="pill ${a.requiresApproval ? "warn" : "good"}">Variance: ${a.variance}%</span>
    <span class="pill ${a.approved ? "good" : "warn"}">Status: ${a.approved ? "Approved" : a.requiresApproval ? "Awaiting Decision" : "Auto-convert Eligible"}</span>
    <span class="pill ${pendingCount ? "warn" : "good"}">Pending Queue: ${pendingCount}</span>
  `;
  renderPendingApprovalItems();
}

function renderPendingApprovalItems() {
  const pendingItems = state.pendingApprovals.filter((item) => item.status === "pending");
  if (!pendingItems.length) {
    dom.pendingApprovalSelect.innerHTML = "<option>No pending items</option>";
    dom.pendingApprovalSelect.disabled = true;
    return;
  }

  dom.pendingApprovalSelect.disabled = false;
  dom.pendingApprovalSelect.innerHTML = pendingItems
    .map((item) => `<option value="${item.id}">${item.prId} | ${item.supplier} | ${item.variance}% variance</option>`)
    .join("");

  const selectedId = state.selectedPendingApprovalId;
  if (selectedId && pendingItems.some((item) => item.id === selectedId)) {
    dom.pendingApprovalSelect.value = selectedId;
  } else {
    state.selectedPendingApprovalId = pendingItems[0].id;
    dom.pendingApprovalSelect.value = state.selectedPendingApprovalId;
  }
}

function seedMockPendingApprovals() {
  if (state.pendingApprovals.length) return;

  state.pendingApprovals = [
    {
      id: "APR-900101",
      prId: "PR-241901",
      supplier: "Atlas Components",
      variance: 6.8,
      role: "manager",
      roleLabel: "Purchase Manager (max 5%)",
      threshold: 4.5,
      status: "pending",
      createdAt: nowStamp()
    },
    {
      id: "APR-900102",
      prId: "PR-241902",
      supplier: "NimblePak",
      variance: 8.2,
      role: "director",
      roleLabel: "Company Director (max 20%)",
      threshold: 5,
      status: "pending",
      createdAt: nowStamp()
    }
  ];
  state.selectedPendingApprovalId = state.pendingApprovals[0].id;
}

function renderMailbox() {
  if (!state.mail.length) {
    dom.mailbox.innerHTML = "<div class='mail-entry'><p>No supplier emails yet.</p></div>";
    return;
  }

  dom.mailbox.innerHTML = state.mail
    .slice(0, 14)
    .map((entry) => `
      <div class="mail-entry">
        <p><strong>${entry.subject}</strong></p>
        <p>${entry.body}</p>
        <p class="meta">${entry.time}</p>
      </div>
    `)
    .join("");
}

function renderDelivery() {
  dom.deliverySummary.innerHTML = `
    <span class="pill">Expected Delivery: ${state.delivery.expectedDate || "Not set"}</span>
    <span class="pill ${state.delivery.actualDate ? "good" : "warn"}">Actual Delivery: ${state.delivery.actualDate || "Pending"}</span>
    <span class="pill">Partial Delivered: ${state.delivery.partialDelivered} units</span>
    <span class="pill ${state.delivery.grnIssued ? "good" : "warn"}">GRN: ${state.delivery.grnIssued ? "Issued" : "Pending"}</span>
    <span class="pill ${state.delivery.discrepancyFlag ? "warn" : "good"}">Discrepancy: ${state.delivery.discrepancyFlag ? "Flagged" : "None"}</span>
  `;
}

function renderPayment() {
  dom.paymentSummary.innerHTML = `
    <span class="pill">Invoice: ${state.payment.invoiceAmount ? money(state.payment.invoiceAmount) : "Not imported"}</span>
    <span class="pill ${state.payment.matchPassed ? "good" : "warn"}">3-Way Match: ${state.payment.matchPassed ? "Passed" : "Not Passed"}</span>
    <span class="pill ${state.payment.paid ? "good" : "warn"}">Payment: ${state.payment.paid ? "Executed" : "Pending"}</span>
    <span class="pill ${state.payment.anomalyFlag ? "warn" : "good"}">Fraud Anomaly: ${state.payment.anomalyFlag ? "Review Required" : "None"}</span>
  `;
}

function scoreTotal() {
  const s = state.supplierScore;
  return (
    s.onTime * 0.4 +
    s.priceCompetitiveness * 0.25 +
    s.orderAccuracy * 0.2 +
    s.responseTime * 0.1 +
    s.qualityIssues * 0.05
  );
}

function scoreLabel(total) {
  if (total >= 90) return "Excellent";
  if (total >= 75) return "Good";
  if (total >= 60) return "Satisfactory";
  return "Needs Improvement";
}

function renderScorecard() {
  const s = state.supplierScore;
  dom.scoreTable.innerHTML = `
    <tr><td>On-Time Delivery Rate</td><td>40%</td><td>${s.onTime}</td></tr>
    <tr><td>Price Competitiveness</td><td>25%</td><td>${s.priceCompetitiveness}</td></tr>
    <tr><td>Order Accuracy</td><td>20%</td><td>${s.orderAccuracy}</td></tr>
    <tr><td>Response Time</td><td>10%</td><td>${s.responseTime}</td></tr>
    <tr><td>Quality Issues</td><td>5%</td><td>${s.qualityIssues}</td></tr>
  `;

  const total = scoreTotal();
  const label = scoreLabel(total);
  const alert = total < 60 ? "Alert: Supplier dropped below 60. Suggest alternate supplier shortlist." : "Monthly report scheduled.";

  dom.supplierScoreSummary.innerHTML = `
    <span class="pill">Weighted Score: ${total.toFixed(1)} / 100</span>
    <span class="pill ${total < 60 ? "warn" : "good"}">Category: ${label}</span>
    <span class="pill">Trend: ${Math.random() > 0.5 ? "Improving" : "Stable"}</span>
    <span class="pill">${alert}</span>
  `;

  upsertArtifact("15-supplier-scorecard", "Supplier Performance Scorecard", {
    weightedScore: Number(total.toFixed(1)),
    category: label,
    metrics: s,
    reportFrequency: "Monthly",
    alert
  });
}

function renderAudit() {
  if (!state.audit.length) {
    dom.auditLog.innerHTML = "<div class='log-entry'><p>No events yet.</p></div>";
    return;
  }

  dom.auditLog.innerHTML = state.audit
    .map((entry) => `
      <div class="log-entry">
        <p>${entry.message}</p>
        <p class="meta">${entry.time}</p>
      </div>
    `)
    .join("");
}

function renderArtifacts() {
  const containers = {
    forecastArtifacts: [],
    prArtifacts: [],
    approvalArtifacts: [],
    commsArtifacts: [],
    deliveryArtifacts: [],
    paymentArtifacts: [],
    scoreArtifacts: []
  };

  for (const artifact of state.artifacts) {
    const target = artifactContainerForStep(artifact.stepKey);
    if (target) containers[target].push(artifact);
  }

  for (const [containerId, items] of Object.entries(containers)) {
    if (!items.length) {
      dom[containerId].innerHTML = "<span class='meta'>No artifact yet.</span>";
      continue;
    }

    dom[containerId].innerHTML = items
      .map((artifact) => `<a href="#" class="artifact-mini-link" data-artifact-key="${artifact.stepKey}">${artifact.title}</a><a href="#" class="artifact-mini-link" data-artifact-key="${artifact.stepKey}" data-download-pdf="1">PDF</a>`)
      .join("");
  }

  renderArtifactViewer();
}

function artifactContainerForStep(stepKey) {
  if (stepKey.startsWith("01-")) return "forecastArtifacts";
  if (stepKey.startsWith("02-") || stepKey.startsWith("03-") || stepKey.startsWith("04-")) return "prArtifacts";
  if (stepKey.startsWith("05-") || stepKey.startsWith("06")) return "approvalArtifacts";
  if (stepKey.startsWith("07-") || stepKey.startsWith("08-")) return "commsArtifacts";
  if (stepKey.startsWith("09-") || stepKey.startsWith("10-") || stepKey.startsWith("11-")) return "deliveryArtifacts";
  if (stepKey.startsWith("12-") || stepKey.startsWith("13-") || stepKey.startsWith("14-")) return "paymentArtifacts";
  if (stepKey.startsWith("15-")) return "scoreArtifacts";
  return null;
}

function renderArtifactViewer() {
  if (!state.artifacts.length) {
    dom.artifactViewer.innerHTML = "<div class='artifact-entry'><p>No artifact selected.</p></div>";
    if (dom.downloadArtifactPdfBtn) dom.downloadArtifactPdfBtn.disabled = true;
    return;
  }

  const selected = state.artifacts.find((artifact) => artifact.stepKey === state.activeArtifactKey) || state.artifacts[0];
  state.activeArtifactKey = selected.stepKey;
  if (dom.downloadArtifactPdfBtn) dom.downloadArtifactPdfBtn.disabled = false;

  dom.artifactViewer.innerHTML = `
    <p class="viewer-title"><strong>${selected.title}</strong></p>
    <p class="meta">${selected.time} | ${selected.filename}</p>
    <pre>${escapeHtml(selected.content)}</pre>
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function canApproveWithRole(role, threshold) {
  if (role === "manager") return threshold <= 5;
  if (role === "director") return threshold <= 20;
  return false;
}

function queueApprovalItem(item) {
  const queueItem = {
    ...item,
    status: "pending",
    createdAt: nowStamp()
  };
  state.pendingApprovals = [queueItem, ...state.pendingApprovals.filter((existing) => existing.id !== queueItem.id)].slice(0, 20);
  state.selectedPendingApprovalId = queueItem.id;
  renderPendingApprovalItems();
}

function advanceAfterApprovalForActivePr(approvedPrId) {
  const isActivePr = Boolean(state.pr && approvedPrId === state.pr.id);
  updateStage(isActivePr ? "PR Approved - Ready for PO Dispatch" : "Pending Approval Item Approved");
  if (isActivePr && state.demoMode && !state.delivery.expectedDate) {
    dom.sendPoBtn.click();
  }
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemoWorkflow() {
  if (state.demoRunning) return;

  state.demoRunning = true;
  state.demoMode = true;
  dom.runDemoBtn.disabled = true;
  dom.runDemoBtn.textContent = "Running Demo...";
  logAudit("POC demo runner started.");

  try {
    dom.skuSelect.value = skuCatalog[0].id;
    dom.monthSelect.value = "March 2026";
    dom.budgetInput.value = "25000";
    dom.forecastForm.requestSubmit();
    await pause(180);

    dom.createPrBtn.click();
    await pause(180);
    dom.requestPriceBtn.click();
    await pause(180);
    dom.humanSignoffBtn.click();
    await pause(180);

    dom.roleSelect.value = "manager";
    dom.thresholdInput.value = "0";
    dom.routeApprovalBtn.click();
    await pause(160);
    if (!dom.pendingApprovalSelect.disabled) {
      dom.pendingApprovalSelect.selectedIndex = 0;
      dom.pendingApprovalSelect.dispatchEvent(new Event("change"));
    }
    dom.approveBtn.click();
    await pause(180);

    if (!state.delivery.expectedDate) {
      dom.sendPoBtn.click();
    }
    await pause(180);
    dom.reminderBtn.click();
    await pause(180);
    dom.syncDeliveryBtn.click();
    await pause(180);
    dom.partialDeliveryBtn.click();
    await pause(180);
    dom.grnBtn.click();
    await pause(180);

    dom.invoiceBtn.click();
    await pause(180);
    dom.matchBtn.click();
    await pause(180);
    dom.executePaymentBtn.click();
    await pause(100);

    logAudit("POC demo runner completed.");
  } finally {
    state.demoMode = false;
    state.demoRunning = false;
    dom.runDemoBtn.disabled = false;
    dom.runDemoBtn.textContent = "Run Full Demo";
  }
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest(".artifact-mini-link");
    if (!link) return;
    event.preventDefault();
    const key = link.dataset.artifactKey;
    if (!key) return;
    state.activeArtifactKey = key;
    renderArtifactViewer();

    if (link.dataset.downloadPdf === "1") {
      const selected = getActiveArtifact();
      downloadArtifactPdf(selected);
    }
  });

  dom.runDemoBtn.addEventListener("click", () => {
    runDemoWorkflow();
  });

  dom.downloadArtifactPdfBtn.addEventListener("click", () => {
    const artifact = getActiveArtifact();
    if (!artifact) return;
    downloadArtifactPdf(artifact);
  });

  dom.roleSelect.addEventListener("change", () => {
    if (dom.roleSelect.value === "manager" && Number(dom.thresholdInput.value) > 5) {
      dom.thresholdInput.value = "5";
    }
    logAudit(`Role switched to ${dom.roleSelect.options[dom.roleSelect.selectedIndex].text}`);
  });

  dom.pendingApprovalSelect.addEventListener("change", () => {
    const id = dom.pendingApprovalSelect.value;
    state.selectedPendingApprovalId = id;
    const selectedItem = state.pendingApprovals.find((item) => item.id === id && item.status === "pending");
    if (selectedItem) {
      state.approval = {
        role: selectedItem.role,
        roleLabel: selectedItem.roleLabel,
        threshold: selectedItem.threshold,
        variance: selectedItem.variance,
        requiresApproval: true,
        approved: false
      };
      renderApproval();
    }
  });

  dom.forecastForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const sku = getSelectedSku();
    const budget = Number(dom.budgetInput.value || 0);

    if (!sku || budget < 1000) {
      logAudit("Forecast request blocked: invalid SKU or budget.");
      return;
    }

    state.forecast = computeForecast(sku, budget);
    state.pr = null;
    state.approval = null;
    state.payment = { invoiceAmount: null, matchPassed: false, paid: false, anomalyFlag: false };
    state.delivery = { expectedDate: null, actualDate: null, partialDelivered: 0, grnIssued: false, discrepancyFlag: false };
    updateStage("Forecast Complete");
    adjustAutomation(7);
    renderForecast();
    renderPr();
    renderApproval();
    renderDelivery();
    renderPayment();
    upsertArtifact("01-forecast-output", "Forecast Output", {
      sku: sku.id,
      month: dom.monthSelect.value,
      budgetUsd: budget,
      forecast: state.forecast,
      modelNotes: "Moving average + seasonality blend with safety stock optimization."
    });

    logAudit(`Forecast generated for ${sku.id}: demand ${state.forecast.predictedDemand}, recommended order ${state.forecast.recommendedQty}.`);
  });

  dom.createPrBtn.addEventListener("click", () => {
    const sku = getSelectedSku();
    if (!state.forecast || !sku) {
      logAudit("Draft PR creation blocked: generate forecast first.");
      return;
    }

    const priceVariance = Number((Math.random() * 0.09 + 0.01).toFixed(3));
    const newUnitPrice = sku.baselineUnitPrice * (1 + priceVariance);
    const totalUsd = state.forecast.recommendedQty * newUnitPrice * fxRates[sku.currency];

    state.pr = {
      id: `PR-${Date.now().toString().slice(-6)}`,
      sku: sku.id,
      supplier: sku.supplier,
      qty: state.forecast.recommendedQty,
      currency: sku.currency,
      unitPrice: newUnitPrice,
      totalUsd,
      quotedVariance: Number((priceVariance * 100).toFixed(2)),
      priceRequested: false,
      humanSignoff: false
    };

    updateStage("Draft PR Created");
    adjustAutomation(8);
    renderPr();
    upsertArtifact("02-draft-pr", "Draft Purchase Requisition", {
      prId: state.pr.id,
      sku: state.pr.sku,
      supplier: state.pr.supplier,
      qty: state.pr.qty,
      currency: state.pr.currency,
      unitPrice: Number(state.pr.unitPrice.toFixed(2)),
      totalUsd: Number(state.pr.totalUsd.toFixed(2)),
      gstTaxStatus: "Auto-calculated",
      source: "Forecast-driven PR draft"
    });
    logAudit(`Draft ${state.pr.id} generated for ${state.pr.qty} units; historical pricing reference applied.`);
  });

  dom.requestPriceBtn.addEventListener("click", () => {
    if (!state.pr) {
      logAudit("Supplier price request blocked: no PR available.");
      return;
    }

    state.pr.priceRequested = true;
    const aiBody = `AI Disclosure: This message is handled by OrderPilot Agent. Please confirm latest price for ${state.pr.qty} units.`;
    state.mail.unshift({
      subject: `Price Request for ${state.pr.id}`,
      body: aiBody,
      time: nowStamp()
    });

    const supplierQuote = Number((state.pr.unitPrice * (0.98 + Math.random() * 0.05)).toFixed(2));
    state.pr.unitPrice = supplierQuote;
    state.pr.totalUsd = state.pr.qty * supplierQuote * fxRates[state.pr.currency];

    state.mail.unshift({
      subject: `Supplier Reply: ${state.pr.id}`,
      body: `Updated quote ${state.pr.currency} ${supplierQuote.toFixed(2)} per unit. Delivery window unchanged.`,
      time: nowStamp()
    });

    updateStage("Supplier Pricing Received");
    adjustAutomation(10);
    renderPr();
    renderMailbox();
    upsertArtifact(
      "03-supplier-pricing",
      "Supplier Pricing Exchange",
      `Subject: Price Request for ${state.pr.id}\n\n${aiBody}\n\nSupplier Reply:\nUpdated quote ${state.pr.currency} ${supplierQuote.toFixed(2)} per unit.\n\nParsed by: OrderPilot NLP Agent\nTimestamp: ${nowStamp()}`,
      "text/plain",
      "txt"
    );
    logAudit(`Supplier pricing parsed by AI for ${state.pr.id}; updated unit quote ${state.pr.currency} ${supplierQuote.toFixed(2)}.`);
  });

  dom.humanSignoffBtn.addEventListener("click", () => {
    if (!state.pr || !state.pr.priceRequested) {
      logAudit("Human sign-off blocked: supplier pricing not yet requested.");
      return;
    }

    state.pr.humanSignoff = true;
    updateStage("Human Pricing Sign-off Complete");
    adjustAutomation(4);
    renderPr();
    upsertArtifact("04-human-signoff", "Human Sign-off Record", {
      prId: state.pr.id,
      decision: "Approved for approval routing",
      reviewerRole: "Purchase Manager",
      lockedFields: ["supplier quote", "quantity"],
      time: nowStamp()
    });
    logAudit(`Human pricing sign-off completed for ${state.pr.id}.`);
  });

  dom.routeApprovalBtn.addEventListener("click", () => {
    if (!state.pr || !state.pr.humanSignoff) {
      logAudit("Approval routing blocked: human pricing sign-off is mandatory.");
      return;
    }

    const role = dom.roleSelect.value;
    const roleLabel = dom.roleSelect.options[dom.roleSelect.selectedIndex].text;
    const threshold = Number(dom.thresholdInput.value || 0);
    if (!canApproveWithRole(role, threshold)) {
      logAudit("Approval routing denied: threshold exceeds role authorization.");
      return;
    }

    const variance = Number((state.pr.quotedVariance + Math.random() * 2).toFixed(2));
    const requiresApproval = variance > threshold;

    state.approval = { role, roleLabel, threshold, variance, requiresApproval, approved: !requiresApproval };
    updateStage(requiresApproval ? "Awaiting Approval" : "Auto-convert Eligible");
    adjustAutomation(8);
    if (requiresApproval) {
      queueApprovalItem({
        id: `APR-${Date.now().toString().slice(-6)}`,
        prId: state.pr.id,
        supplier: state.pr.supplier,
        variance,
        role,
        roleLabel,
        threshold
      });
    }
    renderApproval();
    upsertArtifact("05-approval-routing", "Approval Routing Packet", {
      prId: state.pr.id,
      role: state.approval.role,
      roleLabel: state.approval.roleLabel,
      thresholdPct: state.approval.threshold,
      priceVariancePct: state.approval.variance,
      requiresApproval: state.approval.requiresApproval,
      status: state.approval.approved ? "Auto-approved within threshold" : "Pending approver decision"
    });

    if (!requiresApproval) {
      logAudit(`PR ${state.pr.id} within ${threshold}% threshold. Auto-convert path enabled.`);
      advanceAfterApprovalForActivePr(state.pr.id);
    } else {
      logAudit(`PR ${state.pr.id} routed for approval. Variance ${variance}% exceeds ${threshold}% threshold.`);
    }
  });

  dom.approveBtn.addEventListener("click", () => {
    const selectedId = state.selectedPendingApprovalId || dom.pendingApprovalSelect.value;
    const selectedItem = state.pendingApprovals.find((item) => item.id === selectedId && item.status === "pending");

    if (!state.approval && !selectedItem) {
      logAudit("Approve action blocked: no routed approval.");
      return;
    }

    if (!state.approval && selectedItem) {
      state.approval = {
        role: selectedItem.role,
        roleLabel: selectedItem.roleLabel,
        threshold: selectedItem.threshold,
        variance: selectedItem.variance,
        requiresApproval: true,
        approved: false
      };
    }

    if (state.approval.requiresApproval && !selectedItem) {
      logAudit("Approve action blocked: select a pending approval item first.");
      return;
    }

    if (selectedItem) {
      selectedItem.status = "approved";
      selectedItem.approvedAt = nowStamp();
      selectedItem.approverRole = state.approval.role;
      state.pendingApprovals = state.pendingApprovals.filter((item) => item.status === "pending");
      state.selectedPendingApprovalId = state.pendingApprovals[0]?.id || null;
    }

    state.approval.approved = true;
    advanceAfterApprovalForActivePr(selectedItem ? selectedItem.prId : state.pr.id);
    adjustAutomation(3);
    renderApproval();
    upsertArtifact("06-approval-decision", "Approval Decision", {
      prId: selectedItem ? selectedItem.prId : state.pr.id,
      decision: "Approved",
      approverRole: state.approval.role,
      approvedAt: nowStamp()
    });
    logAudit(`Selected approval item approved by ${state.approval.role}; moved to next workflow step.`);
  });

  dom.delegateBtn.addEventListener("click", () => {
    if (!state.approval || state.approval.approved) {
      logAudit("Delegation rule skipped: no overdue approval.");
      return;
    }

    kpiState.approvalBottlenecks += 1;
    renderKpis();
    upsertArtifact("06b-escalation-alert", "Approval Escalation Alert", {
      prId: state.pr ? state.pr.id : null,
      escalationRule: "Delegation during approver absence",
      bottleneckCount: kpiState.approvalBottlenecks,
      createdAt: nowStamp()
    });
    logAudit("Delegation rule triggered for overdue approval; escalation alert sent.");
  });

  dom.sendPoBtn.addEventListener("click", () => {
    if (!state.pr || !state.approval || !state.approval.approved) {
      logAudit("PO dispatch blocked: PR not approved.");
      return;
    }

    const eta = new Date();
    eta.setDate(eta.getDate() + 8);
    state.delivery.expectedDate = eta.toLocaleDateString();

    state.mail.unshift({
      subject: `PO Dispatch ${state.pr.id}`,
      body: `AI Disclosure: OrderPilot Agent sent approved PO for ${state.pr.qty} units. Please acknowledge receipt.`,
      time: nowStamp()
    });

    updateStage("PO Dispatched");
    adjustAutomation(9);
    renderMailbox();
    renderDelivery();
    upsertArtifact(
      "07-po-dispatch-email",
      "PO Dispatch Email",
      `Subject: PO Dispatch ${state.pr.id}\n\nAI Disclosure: OrderPilot Agent sent approved PO for ${state.pr.qty} units.\nSupplier: ${state.pr.supplier}\nExpected Delivery: ${state.delivery.expectedDate}\nPlease acknowledge receipt.`,
      "text/plain",
      "txt"
    );
    logAudit(`PO sent to supplier ${state.pr.supplier} with AI disclosure tag.`);
  });

  dom.reminderBtn.addEventListener("click", () => {
    if (!state.delivery.expectedDate) {
      logAudit("Delivery reminder blocked: PO has not been dispatched.");
      return;
    }

    state.mail.unshift({
      subject: `Delivery Reminder ${state.pr.id}`,
      body: "AI Disclosure: Reminder to confirm delivery schedule and shipment tracking status.",
      time: nowStamp()
    });

    adjustAutomation(5);
    renderMailbox();
    upsertArtifact(
      "08-delivery-reminder",
      "Delivery Reminder Email",
      `Subject: Delivery Reminder ${state.pr.id}\n\nAI Disclosure: Reminder to confirm delivery schedule and shipment tracking status.`,
      "text/plain",
      "txt"
    );
    logAudit("Automated delivery reminder issued to supplier.");
  });

  dom.handoffBtn.addEventListener("click", () => {
    state.mail.unshift({
      subject: `Human Handoff ${state.pr ? state.pr.id : "N/A"}`,
      body: "Supplier requested human intervention. Ownership transferred to Purchase Manager.",
      time: nowStamp()
    });

    updateStage("Human Intervention");
    renderMailbox();
    upsertArtifact("08b-human-handoff", "Human Handoff Note", {
      conversationId: state.pr ? state.pr.id : "N/A",
      trigger: "Supplier requested human intervention",
      owner: "Purchase Manager",
      time: nowStamp()
    });
    logAudit("Supplier escalation request accepted; conversation handed off to human.");
  });

  dom.syncDeliveryBtn.addEventListener("click", () => {
    if (!state.delivery.expectedDate) {
      logAudit("Delivery sync skipped: no active shipment.");
      return;
    }

    const late = state.demoMode ? false : Math.random() > 0.65;
    const actualDate = new Date();
    actualDate.setDate(actualDate.getDate() + (late ? 2 : 0));
    state.delivery.actualDate = actualDate.toLocaleDateString();
    state.delivery.discrepancyFlag = late;

    if (late) {
      state.mail.unshift({
        subject: `Late Shipment Alert ${state.pr.id}`,
        body: "AI Alert: shipment delayed beyond expected date; review backorder handling.",
        time: nowStamp()
      });
      kpiState.onTimeRate = Math.max(55, kpiState.onTimeRate - 2);
    } else {
      kpiState.onTimeRate = Math.min(99, kpiState.onTimeRate + 1);
    }

    updateStage("Delivery Status Synced");
    adjustAutomation(6);
    renderDelivery();
    renderMailbox();
    renderKpis();
    upsertArtifact("09-delivery-sync-report", "Delivery Sync Report", {
      prId: state.pr.id,
      expectedDate: state.delivery.expectedDate,
      actualDate: state.delivery.actualDate,
      lateShipment: late,
      discrepancyFlag: state.delivery.discrepancyFlag,
      onTimeDeliveryRate: kpiState.onTimeRate
    });
    logAudit(`Periodic sync completed. Delivery status: ${late ? "late" : "on time"}.`);
  });

  dom.partialDeliveryBtn.addEventListener("click", () => {
    if (!state.pr || !state.delivery.expectedDate) {
      logAudit("Partial delivery entry blocked: no active PO.");
      return;
    }

    const delivered = state.demoMode ? state.pr.qty : Math.round(state.pr.qty * (0.45 + Math.random() * 0.4));
    state.delivery.partialDelivered = delivered;
    state.delivery.discrepancyFlag = delivered < state.pr.qty;
    renderDelivery();
    upsertArtifact("10-partial-delivery", "Partial Delivery Record", {
      prId: state.pr.id,
      orderedQty: state.pr.qty,
      deliveredQty: delivered,
      backorderQty: state.pr.qty - delivered,
      discrepancyFlag: state.delivery.discrepancyFlag
    });
    logAudit(`Partial delivery recorded: ${delivered}/${state.pr.qty} units received.`);
  });

  dom.grnBtn.addEventListener("click", () => {
    if (!state.delivery.partialDelivered) {
      logAudit("GRN generation blocked: no received goods quantity entered.");
      return;
    }

    state.delivery.grnIssued = true;
    updateStage("GRN Issued");
    adjustAutomation(4);
    renderDelivery();
    upsertArtifact("11-grn-document", "GRN Document", {
      prId: state.pr.id,
      grnId: `GRN-${Date.now().toString().slice(-6)}`,
      receivedQty: state.delivery.partialDelivered,
      qualityCheck: state.delivery.discrepancyFlag ? "Requires manual review" : "Passed",
      issuedAt: nowStamp()
    });
    logAudit(`GRN issued for ${state.delivery.partialDelivered} units.`);
  });

  dom.invoiceBtn.addEventListener("click", () => {
    if (!state.pr) {
      logAudit("Invoice import blocked: no PR available.");
      return;
    }

    const invoiceAmount = state.pr.totalUsd * (0.985 + Math.random() * 0.035);
    state.payment.invoiceAmount = Number(invoiceAmount.toFixed(2));
    renderPayment();
    upsertArtifact("12-invoice-import", "Supplier Invoice Import", {
      prId: state.pr.id,
      invoiceId: `INV-${Date.now().toString().slice(-6)}`,
      invoiceAmountUsd: state.payment.invoiceAmount,
      importedAt: nowStamp()
    });
    logAudit(`Supplier invoice imported: ${money(state.payment.invoiceAmount)}.`);
  });

  dom.matchBtn.addEventListener("click", () => {
    if (!state.payment.invoiceAmount || !state.delivery.grnIssued) {
      logAudit("3-way match blocked: invoice and GRN required.");
      return;
    }

    const poAmount = state.pr.totalUsd;
    const variancePct = Math.abs(state.payment.invoiceAmount - poAmount) / poAmount * 100;
    state.payment.matchPassed = variancePct <= 3.5 && !state.delivery.discrepancyFlag;
    state.payment.anomalyFlag = variancePct > 5;

    updateStage(state.payment.matchPassed ? "Payment Ready" : "Match Exception");
    adjustAutomation(7);
    renderPayment();
    upsertArtifact("13-three-way-match", "3-Way Match Report", {
      prId: state.pr.id,
      poAmountUsd: Number(poAmount.toFixed(2)),
      invoiceAmountUsd: state.payment.invoiceAmount,
      variancePct: Number(variancePct.toFixed(2)),
      grnIssued: state.delivery.grnIssued,
      matchPassed: state.payment.matchPassed,
      anomalyFlag: state.payment.anomalyFlag
    });
    logAudit(`3-way match executed. Variance ${variancePct.toFixed(2)}%; status ${state.payment.matchPassed ? "passed" : "exception"}.`);
  });

  dom.executePaymentBtn.addEventListener("click", () => {
    if (!state.payment.matchPassed) {
      logAudit("Payment blocked: 3-way match must pass before execution.");
      return;
    }

    state.payment.paid = true;
    kpiState.cashflowImpact = Number((kpiState.cashflowImpact + 0.6).toFixed(1));
    kpiState.costSavings = Number((kpiState.costSavings + 0.4).toFixed(1));
    updateStage("Payment Executed");
    adjustAutomation(8);
    renderPayment();
    renderKpis();
    upsertArtifact("14-payment-confirmation", "Payment Confirmation", {
      prId: state.pr.id,
      paymentStatus: "Executed",
      amountUsd: Number(state.payment.invoiceAmount.toFixed(2)),
      reconciliation: "Completed",
      paidAt: nowStamp()
    });
    logAudit("Banking API payment execution simulated and reconciled.");
  });
}

function bootstrap() {
  seedMockPendingApprovals();
  populateSkuList();
  renderKpis();
  renderForecast();
  renderPr();
  renderApproval();
  renderMailbox();
  renderDelivery();
  renderPayment();
  renderScorecard();
  renderAudit();
  renderArtifacts();
  bindEvents();

  logAudit("OrderPilot initialized. Data is siloed per client workspace; no cross-client aggregation.");
}

bootstrap();
