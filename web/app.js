const feelingInfo = {
  1: { label: "Bad", color: "#e87568" },
  2: { label: "Not great", color: "#eaa34c" },
  3: { label: "Okay", color: "#dfbd45" },
  4: { label: "Good", color: "#79bd69" },
  5: { label: "Great", color: "#36a977" },
};
const reasonChoices = ["Exercise", "Cold air", "Pollen / allergies", "Smoke / pollution", "Illness", "Other"];
const timingChoices = ["Morning", "During activity", "After activity", "Evening", "At night", "No pattern"];
const symptomChoices = ["Coughing", "Wheezing", "Tight chest", "Shortness of breath", "Activity limits"];
let entries = [];
let patients = [];
let selectedPatientId = "PT-2048";
let toastTimer;
let selectedDate = localStartOfDay(new Date());
let visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let selectedRing = "mood";

const $ = (selector) => document.querySelector(selector);
const safeText = (value) => String(value ?? "");
const prettyDate = (value) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
const prettyTime = (value) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
function localStartOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function localDateKey(date) { return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
function patientEntries() { return entries.filter((item) => item.patientId === selectedPatientId); }
function entriesOn(date) { const key = localDateKey(date); return patientEntries().filter((item) => localDateKey(new Date(item.createdAt)) === key).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); }
function entriesThroughSelectedDay() {
  const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
  const start = new Date(selectedDate); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
  return patientEntries().filter((item) => { const date = new Date(item.createdAt); return date >= start && date <= end; });
}
function faceMarkup(score) {
  const mouths = {
    1: "M20 44 Q32 31 44 44",
    2: "M21 42 Q32 36 43 42",
    3: "M22 41 H42",
    4: "M21 37 Q32 47 43 37",
    5: "M19 35 Q32 51 45 35",
  };
  const color = feelingInfo[score].color;
  return `<svg class="feeling-face" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="${color}"/><circle cx="22" cy="25" r="3" fill="#293c38"/><circle cx="42" cy="25" r="3" fill="#293c38"/><path d="${mouths[score]}" fill="none" stroke="#293c38" stroke-width="3.5" stroke-linecap="round"/></svg>`;
}

function ringProgress(entry, key) {
  if (!entry) return 0;
  if (key === "mood") return entry.feeling / 5;
  if (key === "medication") return entry.medicationTaken ? 1 : 0.28;
  return entry.inhalerNeeded ? 0.35 : 1;
}
function ringSvg(entry, key, small = false) {
  const colors = { mood: "#32b879", medication: "#43b6d4", inhaler: "#a66ae3" };
  const radii = small ? [10, 7, 4] : [13];
  const size = small ? 25 : 31;
  const circumference = (r) => 2 * Math.PI * r;
  const rings = small ? ["mood", "medication", "inhaler"] : [key];
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${rings.map((name, index) => {
    const radius = radii[index]; const length = circumference(radius); const progress = ringProgress(entry, name);
    const track = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="${colors[name]}" opacity=".15"/>`;
    const arc = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="${colors[name]}" stroke-dasharray="${length * progress} ${length}"/>`;
    return track + arc;
  }).join("")}</svg>`;
}

function metricDetails(entry, key) {
  if (!entry) return { title: "No check-in for this day", description: "The patient has not submitted an entry for this date." };
  if (key === "mood") return { title: `Mood · ${entry.feeling}/5 · ${feelingInfo[entry.feeling].label}`, description: "Patient rating, where 1 is bad and 5 is great." };
  if (key === "medication") return { title: `Controller medication · ${entry.medicationTaken ? "Taken" : "Missed"}`, description: "Patient-reported daily controller medication." };
  const reasons = entry.inhalerReasons?.length ? ` Trigger: ${entry.inhalerReasons.join(", ")}.` : "";
  const symptoms = entry.symptoms?.length ? ` Symptoms: ${entry.symptoms.join(", ")}.` : " No symptoms reported.";
  return { title: `Rescue inhaler · ${entry.inhalerNeeded ? "Needed" : "Not needed"}`, description: `${entry.timing ? `Symptoms tend to appear ${entry.timing.toLowerCase()}.` : "Symptom timing not reported."}${reasons}${symptoms}` };
}

function renderCalendar() {
  const selected = entriesOn(selectedDate)[0];
  const isToday = localDateKey(selectedDate) === localDateKey(new Date());
  $("#selected-day-label").textContent = isToday ? `Today · ${prettyDate(selectedDate)}` : prettyDate(selectedDate);
  $("#month-label").textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(visibleMonth);
  const grid = $("#month-grid"); grid.replaceChildren();
  ["S", "M", "T", "W", "T", "F", "S"].forEach((day) => {
    const heading = document.createElement("span"); heading.className = "month-weekday"; heading.textContent = day; grid.append(heading);
  });
  const offset = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay();
  const days = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  for (let index = 0; index < 42; index += 1) {
    const day = index - offset + 1;
    const cell = document.createElement("button"); cell.type = "button";
    if (day < 1 || day > days) { cell.className = "month-day empty"; cell.tabIndex = -1; grid.append(cell); continue; }
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    const dateEntries = entriesOn(date); const active = localDateKey(date) === localDateKey(selectedDate);
    cell.className = `month-day${active ? " selected" : ""}${localDateKey(date) === localDateKey(new Date()) ? " today" : ""}`;
    cell.setAttribute("aria-label", `${date.toLocaleDateString(undefined, { dateStyle: "full" })}${dateEntries.length ? ", check-in logged" : ", no check-in"}`);
    cell.innerHTML = `<span class="mini-rings">${ringSvg(dateEntries[0], "mood", true)}</span><span>${day}</span>`;
    cell.addEventListener("click", () => { selectedDate = localStartOfDay(date); render(); });
    grid.append(cell);
  }

  const detail = metricDetails(selected, selectedRing);
  $("#calendar-detail-title").textContent = detail.title;
  $("#calendar-detail-description").textContent = detail.description;
  const ringHost = $("#daily-rings"); ringHost.replaceChildren();
  [["mood", "Mood"], ["medication", "Meds"], ["inhaler", "Inhaler"]].forEach(([key, label]) => {
    const button = document.createElement("button"); button.type = "button";
    button.className = `daily-ring-button${selectedRing === key ? " selected" : ""}`;
    button.setAttribute("aria-label", `${label}: ${metricDetails(selected, key).title}`);
    button.innerHTML = `<span class="daily-ring">${ringSvg(selected, key)}</span><span class="daily-ring-label">${label}</span>`;
    button.addEventListener("click", () => { selectedRing = key; renderCalendar(); });
    ringHost.append(button);
  });
}

function renderChoices(target, choices, name, mode = "checkbox") {
  const host = $(target);
  host.replaceChildren();
  choices.forEach((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-chip";
    button.textContent = choice;
    button.dataset.group = name;
    button.dataset.value = choice;
    button.dataset.mode = mode;
    button.addEventListener("click", () => {
      if (mode === "radio") {
        host.querySelectorAll(".choice-chip").forEach((item) => item.classList.remove("selected"));
      }
      button.classList.toggle("selected");
    });
    host.append(button);
  });
}

function renderFeelingOptions() {
  const host = $("#feeling-options");
  host.replaceChildren();
  for (let score = 1; score <= 5; score += 1) {
    const info = feelingInfo[score];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `feeling-option${score === 4 ? " selected" : ""}`;
    button.dataset.score = score;
    button.setAttribute("aria-label", `${score} out of 5, ${info.label}`);
    button.innerHTML = `${faceMarkup(score)}<small>${score} · ${info.label}</small>`;
    button.addEventListener("click", () => {
      host.querySelectorAll(".feeling-option").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
    });
    host.append(button);
  }
}

function openPatientPreview() {
  $("#patient-modal").hidden = false;
  document.body.classList.add("modal-open");
  $("#close-modal").focus();
}
function renderPatientList() {
  const host = $("#patient-list");
  host.replaceChildren();
  patients.forEach((patient) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `patient-option${patient.id === selectedPatientId ? " active" : ""}`;
    button.setAttribute("aria-pressed", String(patient.id === selectedPatientId));
    const initials = document.createElement("span");
    initials.className = "patient-option-avatar";
    initials.textContent = patient.initials;
    const details = document.createElement("span");
    details.className = "patient-option-details";
    const name = document.createElement("strong");
    name.textContent = patient.name;
    const id = document.createElement("small");
    id.textContent = patient.id;
    details.append(name, id);
    button.append(initials, details);
    button.addEventListener("click", () => {
      selectedPatientId = patient.id;
      renderPatientList();
      render();
      loadInsights();
    });
    host.append(button);
  });
  const selected = patients.find((patient) => patient.id === selectedPatientId) || patients[0];
  if (!selected) return;
  selectedPatientId = selected.id;
  $("#patient-name").textContent = selected.name;
  $("#patient-id").textContent = selected.id;
  $("#patient-initials").textContent = selected.initials;
  $("#breadcrumb-patient").textContent = selected.name;
}
function closePatientPreview() {
  $("#patient-modal").hidden = true;
  document.body.classList.remove("modal-open");
  $("#patient-preview-button").focus();
}
function toast(message) {
  const host = $("#toast");
  host.textContent = message;
  host.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => host.classList.remove("visible"), 2400);
}
function selectedChips(selector) {
  return [...document.querySelectorAll(`${selector} .choice-chip.selected`)].map((item) => item.dataset.value);
}
function setLoading(loading) {
  const button = $(".submit-button");
  button.disabled = loading;
  button.innerHTML = loading ? "Saving…" : "Save today’s check-in <span>→</span>";
}

function showPatterns() {
  const recent = entriesThroughSelectedDay();
  const renderCounts = (selector, values) => {
    const counts = new Map();
    values.forEach((value) => { if (value) counts.set(value, (counts.get(value) || 0) + 1); });
    const host = $(selector);
    host.replaceChildren();
    const sorted = [...counts].sort((a, b) => b[1] - a[1]);
    if (!sorted.length) {
      const empty = document.createElement("span");
      empty.className = "chip";
      empty.textContent = "No reports yet";
      host.append(empty);
      return;
    }
    sorted.forEach(([label, count]) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.append(document.createTextNode(label));
      const n = document.createElement("b");
      n.textContent = `×${count}`;
      chip.append(n);
      host.append(chip);
    });
  };
  renderCounts("#timing-chips", recent.map((item) => item.timing));
  renderCounts("#reason-chips", recent.flatMap((item) => item.inhalerReasons || []));
  renderCounts("#symptom-chips", recent.flatMap((item) => item.symptoms || []));
  renderCounts("#medication-chips", recent.filter((item) => item.medicationTaken).map(() => "Medication taken"));
}

function showSymptomTrend() {
  const host = $("#symptom-trend-chart");
  host.replaceChildren();
  const end = new Date(selectedDate); end.setHours(23, 59, 59, 999);
  const recent = patientEntries()
    .filter((entry) => new Date(entry.createdAt) <= end)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-14);
  if (!recent.length) {
    host.innerHTML = '<p class="chart-empty">No symptom check-ins recorded yet.</p>';
    return;
  }

  const width = 560;
  const height = 164;
  const left = 10;
  const right = 12;
  const top = 12;
  const bottom = 24;
  const max = Math.max(3, ...recent.map((entry) => (entry.symptoms || []).length));
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const xAt = (index) => recent.length === 1 ? left + plotWidth / 2 : left + (index / (recent.length - 1)) * plotWidth;
  const yAt = (count) => top + plotHeight - (count / max) * plotHeight;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  [0, Math.ceil(max / 2), max].forEach((tick) => {
    const y = yAt(tick);
    const line = document.createElementNS(svg.namespaceURI, "line");
    line.setAttribute("x1", String(left)); line.setAttribute("x2", String(width - right));
    line.setAttribute("y1", String(y)); line.setAttribute("y2", String(y));
    line.setAttribute("class", "trend-gridline"); svg.append(line);
  });
  const points = recent.map((entry, index) => `${xAt(index)},${yAt((entry.symptoms || []).length)}`).join(" ");
  const line = document.createElementNS(svg.namespaceURI, "polyline");
  line.setAttribute("points", points); line.setAttribute("class", "trend-line"); svg.append(line);
  recent.forEach((entry, index) => {
    const count = (entry.symptoms || []).length;
    const point = document.createElementNS(svg.namespaceURI, "circle");
    point.setAttribute("cx", String(xAt(index))); point.setAttribute("cy", String(yAt(count)));
    point.setAttribute("r", "4"); point.setAttribute("class", "trend-point");
    const title = document.createElementNS(svg.namespaceURI, "title");
    title.textContent = `${prettyDate(entry.createdAt)} · ${count} symptom${count === 1 ? "" : "s"}`;
    point.append(title); svg.append(point);
  });
  host.append(svg);
  $("#trend-max-label").textContent = String(max);
  $("#trend-mid-label").textContent = String(Math.ceil(max / 2));

  const labels = document.createElement("div");
  labels.className = "trend-date-labels";
  [...new Set([0, Math.floor((recent.length - 1) / 2), recent.length - 1])].forEach((index) => {
    const label = document.createElement("span");
    label.textContent = prettyDate(recent[index].createdAt);
    labels.append(label);
  });
  host.append(labels);
}

function showSymptomMix() {
  const donut = $("#symptom-donut");
  const legend = $("#symptom-pie-legend");
  const recent = entriesThroughSelectedDay();
  const counts = new Map();
  recent.flatMap((entry) => entry.symptoms || []).forEach((symptom) => counts.set(symptom, (counts.get(symptom) || 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const colors = ["#078b8c", "#36a9db", "#37ad67", "#a64a9c", "#e56c9a", "#d89b38"];
  const total = sorted.reduce((sum, item) => sum + item[1], 0);
  legend.replaceChildren();
  if (!total) {
    donut.style.background = "#edf2f1";
    donut.setAttribute("aria-label", "No symptoms reported in the selected period");
    const empty = document.createElement("span"); empty.className = "pie-empty"; empty.textContent = "No reports"; legend.append(empty);
    return;
  }
  let offset = 0;
  const slices = sorted.map(([, count], index) => {
    const start = offset;
    offset += (count / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${offset}%`;
  });
  donut.style.background = `conic-gradient(${slices.join(",")})`;
  donut.setAttribute("aria-label", sorted.map(([name, count]) => `${name}: ${count}`).join(", "));
  sorted.forEach(([name, count], index) => {
    const item = document.createElement("div"); item.className = "pie-legend-item";
    const swatch = document.createElement("i"); swatch.style.backgroundColor = colors[index % colors.length];
    const label = document.createElement("span"); label.textContent = name;
    const value = document.createElement("b"); value.textContent = String(count);
    item.append(swatch, label, value); legend.append(item);
  });
}

function showLatest() {
  const dayEntries = entriesOn(selectedDate);
  const entry = dayEntries[0];
  const recent = entriesThroughSelectedDay();
  if (!entry) {
    $("#feeling-value").textContent = "—";
    $("#feeling-mood").textContent = "No check-in";
    $("#inhaler-value").textContent = "—";
    $("#inhaler-trend").textContent = "Selected day";
    $("#tracked-value").textContent = String(patientEntries().length);
    $("#tracking-rate").textContent = "All time";
    const patientHistory = patientEntries();
    $("#last-entry-date").textContent = patientHistory.length ? prettyDate(patientHistory[0].createdAt) : "—";
    $("#last-checkin").textContent = "No check-in for selected day";
    $("#latest-time").textContent = prettyDate(selectedDate);
    $("#latest-face").replaceChildren();
    $("#latest-inhaler").textContent = "No patient entry for this day";
    $("#latest-feeling").textContent = "No check-in recorded";
    $("#latest-reasons").textContent = "No data";
    $("#latest-medication").textContent = "No data";
    $("#latest-timing").textContent = "No data";
    $("#latest-symptoms").textContent = "No data";
    $("#peak-flow-value").textContent = "—";
    $("#medication-value").textContent = "—";
    return;
  }
  const mood = feelingInfo[entry.feeling];
  const inhalerCount = recent.filter((item) => item.inhalerNeeded).length;
  const avg = recent.reduce((sum, item) => sum + item.feeling, 0) / recent.length;
  $("#feeling-value").textContent = `${entry.feeling}/5`;
  $("#feeling-mood").textContent = mood.label;
  $("#feeling-mood").style.color = mood.color;
  $("#inhaler-value").textContent = `${inhalerCount} ${inhalerCount === 1 ? "day" : "days"}`;
  $("#inhaler-trend").textContent = `${Math.round((inhalerCount / recent.length) * 100)}% of entries`;
  $("#tracked-value").textContent = String(patientEntries().length);
  $("#tracking-rate").textContent = `${avg.toFixed(1)} avg feeling`;
  $("#last-entry-date").textContent = prettyDate(entry.createdAt);
  $("#last-checkin").textContent = `${prettyDate(entry.createdAt)} · ${prettyTime(entry.createdAt)}`;
  $("#latest-time").textContent = `${prettyDate(entry.createdAt)} · ${prettyTime(entry.createdAt)}`;
  $("#latest-face").innerHTML = faceMarkup(entry.feeling);
  $("#latest-face").style.color = mood.color;
  $("#latest-face").style.backgroundColor = `color-mix(in srgb, ${mood.color} 14%, white)`;
  $("#latest-feeling").textContent = `${entry.feeling}/5 · ${mood.label}`;
  $("#latest-inhaler").textContent = entry.inhalerNeeded ? "Rescue inhaler needed" : "Rescue inhaler not needed";
  $("#latest-reasons").textContent = entry.inhalerNeeded ? (entry.inhalerReasons?.join(", ") || "Reason not selected") : "Not needed today";
  $("#latest-medication").textContent = entry.medicationTaken ? "Taken" : "Missed";
  $("#latest-timing").textContent = entry.timing || "Not reported";
  $("#latest-symptoms").textContent = entry.symptoms?.length ? entry.symptoms.join(", ") : "None reported";
  const latestPeak = recent.find((item) => item.peakFlow != null);
  $("#peak-flow-value").textContent = latestPeak ? String(latestPeak.peakFlow) : "—";
  const medicationDays = recent.filter((item) => item.medicationTaken).length;
  $("#medication-value").textContent = `${medicationDays}/${recent.length}`;
}

function showHistory() {
  const body = $("#tracker-rows");
  body.replaceChildren();
  patientEntries().slice(0, 6).forEach((entry) => {
    const info = feelingInfo[entry.feeling];
    const row = document.createElement("tr");
    const date = document.createElement("td");
    date.textContent = `${prettyDate(entry.createdAt)} · ${prettyTime(entry.createdAt)}`;
    const feeling = document.createElement("td");
    feeling.innerHTML = `<span class="feel-cell">${faceMarkup(entry.feeling)}<span>${info.label}</span><span class="rating">${entry.feeling}/5</span></span>`;
    const inhaler = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = `status-pill${entry.inhalerNeeded ? " yes" : ""}`;
    pill.textContent = entry.inhalerNeeded ? "Needed" : "No";
    inhaler.append(pill);
    const medication = document.createElement("td");
    const medicationPill = document.createElement("span");
    medicationPill.className = `status-pill${entry.medicationTaken ? " yes" : ""}`;
    medicationPill.textContent = entry.medicationTaken ? "Taken" : "Missed";
    medication.append(medicationPill);
    const symptoms = document.createElement("td");
    symptoms.textContent = entry.symptoms?.length ? entry.symptoms.join(", ") : "—";
    row.append(date, feeling, medication, inhaler, symptoms);
    body.append(row);
  });
}

function render() {
  renderCalendar();
  showLatest();
  showSymptomTrend();
  showSymptomMix();
  showPatterns();
  showHistory();
}

async function loadEntries() {
  try {
    const [patientsResponse, entriesResponse] = await Promise.all([
      fetch("/api/patients"),
      fetch("/api/checkins"),
    ]);
    if (!patientsResponse.ok || !entriesResponse.ok) throw new Error("Could not load dashboard data");
    patients = await patientsResponse.json();
    entries = await entriesResponse.json();
    renderPatientList();
    render();
    loadInsights();
  } catch (error) {
    console.error(error);
    toast("Could not reach the demo data service. Refresh to try again.");
  }
}

async function loadInsights() {
  const host = $("#provider-insights");
  try {
    const response = await fetch(`/api/insights?patientId=${encodeURIComponent(selectedPatientId)}`);
    if (!response.ok) throw new Error("Could not load provider prompts");
    const data = await response.json();
    host.replaceChildren();

    const summary = document.createElement("div");
    summary.className = "signal-summary";
    const comparison = document.createElement("span");
    comparison.className = "signal-chip";
    comparison.textContent = data.previousCheckIns
      ? `Symptom mentions/check-in: ${data.symptomReports.recentRate.toFixed(2)} recent vs ${data.symptomReports.previousRate.toFixed(2)} prior`
      : `${data.recentCheckIns} check-ins available`;
    const medication = document.createElement("span");
    medication.className = "signal-chip";
    medication.textContent = `Missed controller doses: ${data.missedMedicationEntries}`;
    summary.append(comparison, medication);
    if (data.mostSelectedInhalerReason) {
      const trigger = document.createElement("span");
      trigger.className = "signal-chip";
      trigger.textContent = `Most selected inhaler reason: ${data.mostSelectedInhalerReason.label} (${data.mostSelectedInhalerReason.count})`;
      summary.append(trigger);
    }
    host.append(summary);

    const prompts = document.createElement("ul");
    prompts.className = "signal-prompts";
    data.followUps.forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      prompts.append(item);
    });
    host.append(prompts);
  } catch (error) {
    console.error(error);
    host.textContent = "Trend summary is unavailable right now.";
  }
}

async function submitCheckIn(event) {
  event.preventDefault();
  const feeling = Number($("#feeling-options .feeling-option.selected")?.dataset.score || 4);
  const inhalerNeeded = $("input[name=inhaler]:checked").value === "yes";
  const body = {
    feeling,
    inhalerNeeded,
    medicationTaken: $("input[name=medication]:checked").value === "yes",
    symptoms: selectedChips("#symptom-options"),
    timing: selectedChips("#timing-options")[0] || "",
    inhalerReasons: inhalerNeeded ? selectedChips("#reason-options") : [],
    date: localDateKey(selectedDate),
    patientId: selectedPatientId,
  };
  setLoading(true);
  try {
    const response = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("Could not save check-in");
    const saved = await response.json();
    entries = [saved, ...entries];
    render();
    loadInsights();
    closePatientPreview();
    toast("Check-in saved to the provider dashboard.");
    $("#latest-card").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error(error);
    toast("Could not save this check-in. Please try again.");
  } finally {
    setLoading(false);
  }
}

function exportSummary() {
  const lines = [["Date", "Feeling (1 bad to 5 great)", "Rescue inhaler needed", "Inhaler reason", "Symptom timing", "Symptoms", "Peak flow (L/min)"]];
  patientEntries().forEach((item) => lines.push([
    new Date(item.createdAt).toISOString(), item.feeling, item.inhalerNeeded ? "Yes" : "No",
    (item.inhalerReasons || []).join("; "), item.timing || "", (item.symptoms || []).join("; "), item.peakFlow ?? "",
  ]));
  const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `airwise-${selectedPatientId}-synthetic-checkins.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

renderFeelingOptions();
renderChoices("#reason-options", reasonChoices, "reason");
renderChoices("#timing-options", timingChoices, "timing", "radio");
renderChoices("#symptom-options", symptomChoices, "symptom");
$("#patient-preview-button").addEventListener("click", openPatientPreview);
$("#close-modal").addEventListener("click", closePatientPreview);
$("#patient-modal").addEventListener("click", (event) => { if (event.target.id === "patient-modal") closePatientPreview(); });
$("#checkin-form").addEventListener("submit", submitCheckIn);
$("#jump-to-history").addEventListener("click", () => $("#tracker").scrollIntoView({ behavior: "smooth" }));
$("#export-button").addEventListener("click", exportSummary);
$("#all-entries").addEventListener("click", () => toast("Showing the latest six entries in this demo view."));
$("#calendar-toggle").addEventListener("click", () => {
  $("#month-view").hidden = !$("#month-view").hidden;
  $("#calendar-chevron").textContent = $("#month-view").hidden ? "⌄" : "⌃";
});
$("#previous-day").addEventListener("click", () => { selectedDate.setDate(selectedDate.getDate() - 1); visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1); render(); });
$("#next-day").addEventListener("click", () => { selectedDate.setDate(selectedDate.getDate() + 1); visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1); render(); });
$("#previous-month").addEventListener("click", () => { visibleMonth.setMonth(visibleMonth.getMonth() - 1); renderCalendar(); });
$("#next-month").addEventListener("click", () => { visibleMonth.setMonth(visibleMonth.getMonth() + 1); renderCalendar(); });
document.querySelectorAll("input[name=inhaler]").forEach((input) => input.addEventListener("change", () => {
  $("#reason-field").hidden = $("input[name=inhaler]:checked").value !== "yes";
}));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#patient-modal").hidden) closePatientPreview(); });
loadEntries();
