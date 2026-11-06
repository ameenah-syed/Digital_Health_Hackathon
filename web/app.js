const feelingInfo = {
  1: { label: "Bad", color: "#e87568" },
  2: { label: "Not great", color: "#eaa34c" },
  3: { label: "Okay", color: "#dfbd45" },
  4: { label: "Good", color: "#79bd69" },
  5: { label: "Great", color: "#36a977" },
};
const reasonChoices = ["Running or playing", "Cold air", "Allergies or pollen", "Smoke or strong smells", "A cold", "I'm not sure"];
const timingChoices = ["Morning", "During activity", "After activity", "Evening", "At night", "Not sure"];
const symptomChoices = ["Coughing", "Wheezing", "Tight chest", "Hard to breathe", "Hard to keep playing"];
const patientLessons = [
  { id: "asthma", title: "What is asthma?", subtitle: "Meet your airways", icon: "◉", detail: "Asthma can make the small airways in your lungs swell or get tight. That can make breathing feel harder. With help from trusted adults and your care team, many kids with asthma can play, learn, and do the things they enjoy.", source: "https://www.nhlbi.nih.gov/health/asthma/children" },
  { id: "symptoms", title: "Spot the signs", subtitle: "Your body gives clues", icon: "◎", detail: "Coughing, a whistling sound when breathing, a tight chest, or feeling short of breath can be clues. These feelings can have other causes too. A trusted adult and your healthcare team can help figure out what they mean.", source: "https://www.nhlbi.nih.gov/health/asthma/symptoms" },
  { id: "diagnosis", title: "How do doctors know?", subtitle: "You are part of the team", icon: "＋", detail: "A doctor or nurse asks about your health and listens to you breathe. They may use a breathing test, too. One symptom by itself does not tell you whether you have asthma. Only your healthcare team can diagnose asthma.", source: "https://www.nhlbi.nih.gov/health/asthma/diagnosis" },
  { id: "care-plan", title: "My asthma helper plan", subtitle: "Make it with an adult", icon: "⌖", detail: "Your personal asthma action plan is made with your healthcare team. It tells you and your adults which medicines to use and what to do when symptoms happen. Ask a trusted adult to help you follow your own plan. This app cannot make or change that plan.", source: "https://www.nhlbi.nih.gov/health/asthma/treatment-action-plan" },
];
const syntheticAges = { "PT-2048": 10, "PT-3107": 12, "PT-4821": 9, "PT-5639": 11 };
let entries = [];
let patients = [];
let selectedPatientId = "PT-2048";
let toastTimer;
let selectedDate = localStartOfDay(new Date());
let visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let selectedRing = "mood";
let patientWeekOffset = 0;
let patientHomeWeekOffset = 0;
let completedPatientLessons = new Set(JSON.parse(localStorage.getItem("smarthome-kids-lessons") || "[]"));
let patientModeInitialized = false;
let providerView = "home";
let patientView = "home";

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
  $("#patient-modal").querySelector(".patient-modal").insertBefore($("#checkin-form"), $("#patient-modal").querySelector(".modal-note"));
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
  $("#patient-checkin-host").append($("#checkin-form"));
  if (!$("#app-shell").classList.contains("patient-mode")) $("#patient-preview-button").focus();
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
  renderProviderHome();
  renderPatientHome();
  renderPatientApp();
}

function drawHomeTrend(targetSelector, rows, valueFor, color, minValue = 0, maxFloor = 3) {
  const host = $(targetSelector); host.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("p"); empty.className = "home-chart-empty"; empty.textContent = "No check-ins to show yet."; host.append(empty); return;
  }
  const width = 640, height = 178, left = 34, right = 12, top = 10, bottom = 32;
  const values = rows.map(valueFor); const maxValue = Math.max(maxFloor, ...values);
  const range = maxValue - minValue || 1;
  const x = (index) => rows.length === 1 ? (width - left - right) / 2 + left : left + (index / (rows.length - 1)) * (width - left - right);
  const y = (value) => top + ((maxValue - value) / range) * (height - top - bottom);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("preserveAspectRatio", "none");
  const ticks = [...new Set([minValue, Math.round((minValue + maxValue) / 2), maxValue])];
  ticks.forEach((tick) => {
    const grid = document.createElementNS(svg.namespaceURI, "line"); grid.setAttribute("x1", String(left)); grid.setAttribute("x2", String(width - right)); grid.setAttribute("y1", String(y(tick))); grid.setAttribute("y2", String(y(tick))); grid.setAttribute("stroke", "#edf2f1"); grid.setAttribute("stroke-width", "1"); svg.append(grid);
    const label = document.createElementNS(svg.namespaceURI, "text"); label.setAttribute("x", "0"); label.setAttribute("y", String(y(tick) + 3)); label.setAttribute("fill", "#9aa8aa"); label.setAttribute("font-size", "10"); label.textContent = String(tick); svg.append(label);
  });
  const points = rows.map((row, index) => `${x(index)},${y(valueFor(row))}`).join(" ");
  const area = document.createElementNS(svg.namespaceURI, "polygon"); area.setAttribute("points", `${x(0)},${height - bottom} ${points} ${x(rows.length - 1)},${height - bottom}`); area.setAttribute("fill", color); area.setAttribute("fill-opacity", ".10"); svg.append(area);
  const line = document.createElementNS(svg.namespaceURI, "polyline"); line.setAttribute("points", points); line.setAttribute("fill", "none"); line.setAttribute("stroke", color); line.setAttribute("stroke-width", "3"); line.setAttribute("stroke-linecap", "round"); line.setAttribute("stroke-linejoin", "round"); svg.append(line);
  rows.forEach((row, index) => {
    const dot = document.createElementNS(svg.namespaceURI, "circle"); dot.setAttribute("cx", String(x(index))); dot.setAttribute("cy", String(y(valueFor(row)))); dot.setAttribute("r", "3.5"); dot.setAttribute("fill", "#fff"); dot.setAttribute("stroke", color); dot.setAttribute("stroke-width", "2");
    const title = document.createElementNS(svg.namespaceURI, "title"); title.textContent = `${prettyDate(row.createdAt)} · ${valueFor(row)}`; dot.append(title); svg.append(dot);
  });
  [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])].forEach((index) => {
    const label = document.createElementNS(svg.namespaceURI, "text"); label.setAttribute("x", String(x(index))); label.setAttribute("y", String(height - 7)); label.setAttribute("fill", "#99a6a8"); label.setAttribute("font-size", "9"); label.setAttribute("text-anchor", index === 0 ? "start" : index === rows.length - 1 ? "end" : "middle"); label.textContent = prettyDate(rows[index].createdAt); svg.append(label);
  });
  host.append(svg);
}

function renderProviderHome() {
  const patient = patients.find((item) => item.id === selectedPatientId);
  if (!patient) return;
  const history = patientEntries().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latest = history[0];
  $("#home-patient-name").textContent = patient.name;
  $("#home-patient-id").textContent = patient.id;
  $("#home-patient-age").textContent = `${syntheticAges[patient.id] ?? "—"} · demo`;
  const summary = $("#home-update-summary"), meta = $("#home-update-meta"), date = $("#home-update-date");
  if (latest) {
    const feeling = feelingInfo[latest.feeling];
    const symptomSummary = latest.symptoms?.length ? `${latest.symptoms.length} symptom${latest.symptoms.length === 1 ? "" : "s"} reported` : "No symptoms reported";
    summary.textContent = `Latest check-in: feeling ${feeling.label.toLowerCase()} (${latest.feeling}/5); ${latest.inhalerNeeded ? "rescue inhaler needed" : "no rescue inhaler reported"}; ${symptomSummary}.`;
    meta.textContent = `Latest patient check-in · ${prettyTime(latest.createdAt)} · synthetic demo data`;
    date.textContent = prettyDate(latest.createdAt);
  } else {
    summary.textContent = "No check-in has been recorded yet.";
    meta.textContent = "Synthetic demo data";
    date.textContent = "—";
  }

  const chronological = history.slice(0, 14).reverse();
  drawHomeTrend("#home-symptoms-chart", chronological, (entry) => entry.symptoms?.length || 0, "#319bc7", 0, 3);
  drawHomeTrend("#home-feeling-chart", chronological, (entry) => entry.feeling, "#37ad67", 1, 5);
}

function setProviderView(view) {
  providerView = view;
  const isPatientApp = $("#app-shell").classList.contains("patient-mode");
  $("#provider-home").hidden = isPatientApp || view !== "home";
  $("#provider-app").hidden = isPatientApp || view !== "dashboard";
  document.querySelectorAll("[data-provider-view]").forEach((button) => {
    const active = button.dataset.providerView === view;
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  });
}

function patientStreak() {
  const days = new Set(patientEntries().map((entry) => localDateKey(new Date(entry.createdAt))));
  const cursor = localStartOfDay(new Date());
  if (!days.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDateKey(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

function renderPatientWeek() {
  const today = localStartOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() + patientWeekOffset * 7);
  const daysHost = $("#patient-week-days");
  daysHost.replaceChildren();
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(start); date.setDate(start.getDate() + index);
    const tracked = entriesOn(date).length > 0;
    const day = document.createElement("div");
    day.className = `week-day${tracked ? " tracked" : ""}${localDateKey(date) === localDateKey(today) ? " today" : ""}`;
    const name = document.createElement("small"); name.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date).toUpperCase();
    const number = document.createElement("strong"); number.textContent = String(date.getDate());
    const mark = document.createElement("i"); mark.textContent = tracked ? "✓" : "·";
    day.append(name, number, mark); daysHost.append(day);
  }
  const end = new Date(start); end.setDate(start.getDate() + 6);
  $("#patient-week-label").textContent = patientWeekOffset === 0 ? "This week" : `${prettyDate(start)} – ${prettyDate(end)}`;
  $("#patient-week-next").disabled = patientWeekOffset >= 0;
  $("#patient-streak").textContent = String(patientStreak());

  const badges = [
    ["first-check-in", "★", "First check-in", patientEntries().length > 0],
    ["streak-3", "♨", "3-day streak", patientStreak() >= 3],
    ["streak-7", "✿", "7-day streak", patientStreak() >= 7],
    ["symptom-spotter", "◎", "Symptom spotter", patientEntries().some((entry) => entry.symptoms?.length)],
    ["curious-learner", "▤", "Curious learner", completedPatientLessons.size >= 3],
  ];
  const badgesHost = $("#patient-badges"); badgesHost.replaceChildren();
  badges.forEach(([id, icon, label, earned]) => {
    const badge = document.createElement("span"); badge.className = `badge-chip${earned ? " earned" : ""}`;
    badge.textContent = `${earned ? icon : "🔒"} ${label}`; badge.title = earned ? "Earned" : "Keep checking in to earn this badge";
    badgesHost.append(badge);
  });
}

function renderPatientBreathing() {
  const host = $("#patient-breathing-chart"); host.replaceChildren();
  const recent = patientEntries().slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-14);
  if (!recent.length) {
    const empty = document.createElement("p"); empty.className = "patient-chart-empty"; empty.textContent = "Add a few check-ins and your breathing story will start to appear here."; host.append(empty);
    $("#patient-breathing-story").textContent = "Keep checking in to see your breathing clues over time.";
    return;
  }
  const width = 650, height = 160, padX = 14, padY = 12;
  const maxCount = Math.max(3, ...recent.map((entry) => entry.symptoms?.length || 0));
  const x = (i) => recent.length === 1 ? width / 2 : padX + (i / (recent.length - 1)) * (width - padX * 2);
  const y = (count) => height - padY - (count / maxCount) * (height - padY * 2);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", `0 0 ${width} ${height}`); svg.setAttribute("preserveAspectRatio", "none");
  [0, Math.ceil(maxCount / 2), maxCount].forEach((tick) => {
    const line = document.createElementNS(svg.namespaceURI, "line"); line.setAttribute("x1", String(padX)); line.setAttribute("x2", String(width - padX)); line.setAttribute("y1", String(y(tick))); line.setAttribute("y2", String(y(tick))); line.setAttribute("stroke", "#eaf1f0"); line.setAttribute("stroke-width", "1"); svg.append(line);
  });
  const fill = document.createElementNS(svg.namespaceURI, "polygon");
  fill.setAttribute("points", `${x(0)},${height - padY} ${recent.map((entry, i) => `${x(i)},${y(entry.symptoms?.length || 0)}`).join(" ")} ${x(recent.length - 1)},${height - padY}`); fill.setAttribute("fill", "#36a9db"); fill.setAttribute("fill-opacity", ".11"); svg.append(fill);
  const path = document.createElementNS(svg.namespaceURI, "polyline"); path.setAttribute("points", recent.map((entry, i) => `${x(i)},${y(entry.symptoms?.length || 0)}`).join(" ")); path.setAttribute("fill", "none"); path.setAttribute("stroke", "#319bc7"); path.setAttribute("stroke-width", "3"); path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round"); svg.append(path);
  recent.forEach((entry, i) => {
    const point = document.createElementNS(svg.namespaceURI, "circle"); point.setAttribute("cx", String(x(i))); point.setAttribute("cy", String(y(entry.symptoms?.length || 0))); point.setAttribute("r", "4"); point.setAttribute("fill", "#fff"); point.setAttribute("stroke", "#078b8c"); point.setAttribute("stroke-width", "2");
    const title = document.createElementNS(svg.namespaceURI, "title"); title.textContent = `${prettyDate(entry.createdAt)} · ${entry.symptoms?.length || 0} body clues`; point.append(title); svg.append(point);
  });
  host.append(svg);
  const current = recent.slice(-7), previous = recent.slice(-14, -7);
  const currentAverage = current.reduce((sum, entry) => sum + (entry.symptoms?.length || 0), 0) / current.length;
  const priorAverage = previous.length ? previous.reduce((sum, entry) => sum + (entry.symptoms?.length || 0), 0) / previous.length : null;
  let story;
  if (priorAverage === null) story = `You logged about ${currentAverage.toFixed(1)} body clues per check-in so far. A few more check-ins will help this picture grow.`;
  else if (currentAverage > priorAverage + .2) story = "Your recent check-ins include more breathing clues than the earlier ones. You can share what you notice with an adult.";
  else if (currentAverage < priorAverage - .2) story = "Your recent check-ins include fewer breathing clues than the earlier ones. Keep sharing what you notice with an adult.";
  else story = "Your check-ins show about the same number of breathing clues lately. Keep tracking so you and an adult can spot patterns together.";
  $("#patient-breathing-story").textContent = story;
}

function renderPatientLessons() {
  const host = $("#patient-lessons"); host.replaceChildren();
  patientLessons.forEach((lesson) => {
    const card = document.createElement("details"); card.className = "lesson-card";
    const summary = document.createElement("summary");
    const icon = document.createElement("span"); icon.className = "lesson-symbol"; icon.textContent = lesson.icon;
    const heading = document.createElement("span"); heading.className = "lesson-heading";
    const title = document.createElement("strong"); title.textContent = lesson.title;
    const subtitle = document.createElement("small"); subtitle.textContent = lesson.subtitle;
    heading.append(title, subtitle); summary.append(icon, heading);
    const detail = document.createElement("p"); detail.textContent = lesson.detail;
    const source = document.createElement("a"); source.href = lesson.source; source.target = "_blank"; source.rel = "noreferrer"; source.textContent = "Learn more with an adult ↗";
    const complete = document.createElement("button"); complete.type = "button"; complete.className = "lesson-complete"; complete.textContent = completedPatientLessons.has(lesson.id) ? "✓ Lesson badge earned" : "☆ I learned this!";
    complete.addEventListener("click", () => {
      completedPatientLessons.add(lesson.id); localStorage.setItem("smarthome-kids-lessons", JSON.stringify([...completedPatientLessons]));
      renderPatientLessons(); renderPatientWeek();
    });
    card.append(summary, detail, source, complete); host.append(card);
  });
  const count = completedPatientLessons.size;
  $("#patient-lesson-progress").textContent = `${count} of 4 lessons explored`;
  $("#lesson-progress-track i").style.width = `${Math.min(100, count / 4 * 100)}%`;
}

function renderPatientApp() {
  renderPatientWeek(); renderPatientBreathing(); renderPatientLessons();
  $("#controller-check").checked = localStorage.getItem("smarthome-controller-taken") !== "false";
  $("#rescue-check").checked = localStorage.getItem("smarthome-rescue-available") !== "false";
  $("#device-check").checked = localStorage.getItem("smarthome-nebulizer-ready") !== "false";
}

function renderPatientHome() {
  const patient = patients.find((item) => item.id === "PT-2048");
  if (!patient) return;
  const history = patientEntries().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const latest = history[0];
  $("#patient-home-name").textContent = patient.name;
  $("#patient-home-id").textContent = patient.id;
  $("#patient-home-age").textContent = `${syntheticAges[patient.id] ?? "—"} · demo`;
  renderPatientHomeWeek(history);
  const chronological = history.slice(0, 14).reverse();
  drawHomeTrend("#patient-home-symptoms-chart", chronological, (entry) => entry.symptoms?.length || 0, "#319bc7", 0, 3);
  drawHomeTrend("#patient-home-feeling-chart", chronological, (entry) => entry.feeling, "#37ad67", 1, 5);
}

function renderPatientHomeWeek(history = patientEntries()) {
  const today = localStartOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() + patientHomeWeekOffset * 7);
  const daysHost = $("#patient-home-week-days");
  daysHost.replaceChildren();
  let completedDays = 0;
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(start); date.setDate(start.getDate() + index);
    const tracked = history.some((entry) => localDateKey(new Date(entry.createdAt)) === localDateKey(date));
    if (tracked) completedDays += 1;
    const day = document.createElement("div");
    day.className = `patient-home-day${tracked ? " is-complete" : ""}${localDateKey(date) === localDateKey(today) ? " is-today" : ""}`;
    const label = document.createElement("small"); label.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
    const number = document.createElement("strong"); number.textContent = String(date.getDate());
    const mark = document.createElement("span"); mark.textContent = tracked ? "✓" : "·";
    day.append(label, number, mark); daysHost.append(day);
  }
  const end = new Date(start); end.setDate(start.getDate() + 6);
  $("#patient-home-week-label").textContent = patientHomeWeekOffset === 0 ? "This week" : `${prettyDate(start)} – ${prettyDate(end)}`;
  $("#patient-home-week-next").disabled = patientHomeWeekOffset >= 0;
  $("#patient-home-streak").textContent = String(patientStreak());
  $("#patient-home-week-summary").textContent = `${completedDays} of 7 days checked in this week`;
  const latest = history.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  $("#patient-home-latest").textContent = latest
    ? `Latest check-in · ${prettyDate(latest.createdAt)} at ${prettyTime(latest.createdAt)} · Feeling ${feelingInfo[latest.feeling].label.toLowerCase()}`
    : "No check-ins yet this week. Pick a day to start your streak!";
}

function setPatientView(view) {
  patientView = view;
  const isPatient = $("#app-shell").classList.contains("patient-mode");
  $("#patient-home").hidden = !isPatient || view !== "home";
  $("#patient-app").hidden = !isPatient || view !== "daily-checkin";
  document.querySelectorAll("[data-patient-view]").forEach((button) => {
    const active = button.dataset.patientView === view;
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  });
}

function setAppMode(mode) {
  const isPatient = mode === "patient";
  const wasPatientMode = $("#app-shell").classList.contains("patient-mode");
  $("#app-shell").classList.toggle("patient-mode", isPatient);
  setPatientView(isPatient ? (wasPatientMode ? patientView : "home") : "home");
  setProviderView(isPatient ? providerView : "home");
  document.querySelectorAll("[data-app-mode]").forEach((button) => {
    const active = button.dataset.appMode === mode;
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  });
  if (isPatient) {
    selectedPatientId = "PT-2048"; selectedDate = localStartOfDay(new Date()); visibleMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    if (!patientModeInitialized) {
      $("input[name=inhaler][value=no]").checked = true;
      $("input[name=medication][value=yes]").checked = $("#controller-check").checked;
      $("input[name=medication][value=no]").checked = !$("#controller-check").checked;
      $("#reason-field").hidden = true;
      patientModeInitialized = true;
    }
    renderPatientList(); render(); loadInsights();
  } else {
    render();
  }
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
    if (!$("#patient-modal").hidden) closePatientPreview();
    const isPatient = $("#app-shell").classList.contains("patient-mode");
    if (isPatient) resetPatientCheckIn();
    toast(isPatient ? "Check-in complete! It’s saved in the shared demo." : "Check-in saved to the provider dashboard.");
    if (isPatient) $("#patient-breathing").scrollIntoView({ behavior: "smooth", block: "center" });
    else if (providerView === "home") $("#home-update-summary").scrollIntoView({ behavior: "smooth", block: "center" });
    else $("#latest-card").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    console.error(error);
    toast("Could not save this check-in. Please try again.");
  } finally {
    setLoading(false);
  }
}

function resetPatientCheckIn() {
  $("#checkin-form").reset();
  $("#feeling-options .feeling-option").forEach((button) => button.classList.toggle("selected", button.dataset.score === "4"));
  document.querySelectorAll("#reason-options .choice-chip, #timing-options .choice-chip, #symptom-options .choice-chip").forEach((button) => button.classList.remove("selected"));
  $("input[name=inhaler][value=no]").checked = true;
  $("input[name=medication][value=yes]").checked = $("#controller-check").checked;
  $("input[name=medication][value=no]").checked = !$("#controller-check").checked;
  $("#reason-field").hidden = true;
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
  anchor.download = `smarthome-${selectedPatientId}-synthetic-checkins.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

renderFeelingOptions();
renderChoices("#reason-options", reasonChoices, "reason");
renderChoices("#timing-options", timingChoices, "timing", "radio");
renderChoices("#symptom-options", symptomChoices, "symptom");
$("#patient-checkin-host").append($("#checkin-form"));
document.querySelectorAll("[data-app-mode]").forEach((button) => button.addEventListener("click", () => setAppMode(button.dataset.appMode)));
document.querySelectorAll("[data-provider-view]").forEach((button) => button.addEventListener("click", () => setProviderView(button.dataset.providerView)));
document.querySelectorAll("[data-patient-view]").forEach((button) => button.addEventListener("click", () => setPatientView(button.dataset.patientView)));
document.querySelectorAll("[data-patient-target]").forEach((button) => button.addEventListener("click", () => {
  if (!$("#app-shell").classList.contains("patient-mode")) setAppMode("patient");
  setPatientView("daily-checkin");
  const target = $(`#${button.dataset.patientTarget}`);
  if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
}));
document.querySelectorAll("[data-open-provider-dashboard]").forEach((button) => button.addEventListener("click", () => {
  if ($("#app-shell").classList.contains("patient-mode")) setAppMode("provider");
  setProviderView("dashboard");
  const target = button.dataset.scrollTarget ? $(`#${button.dataset.scrollTarget}`) : null;
  if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "start" }));
}));
$("#provider-home").querySelectorAll('[data-module-action="trends"]').forEach((button) => button.addEventListener("click", () => {
  setProviderView("dashboard"); requestAnimationFrame(() => $("#symptom-trend-chart").scrollIntoView({ behavior: "smooth", block: "center" }));
}));
$("#provider-home").querySelectorAll('[data-module-action="medication"]').forEach((button) => button.addEventListener("click", () => {
  setProviderView("dashboard"); requestAnimationFrame(() => $(".patterns-card").scrollIntoView({ behavior: "smooth", block: "center" }));
}));
$("#provider-home").querySelectorAll('[data-module-action="notes"]').forEach((button) => button.addEventListener("click", () => toast("Patient notes are a placeholder module in this demo.")));
$("#provider-home").querySelectorAll("[data-open-questionnaire]").forEach((button) => button.addEventListener("click", openPatientPreview));
$("#dashboard-settings-button").addEventListener("click", () => $("#dashboard-settings-dialog").showModal());
$("#close-dashboard-settings").addEventListener("click", () => $("#dashboard-settings-dialog").close());
$("#settings-done").addEventListener("click", () => $("#dashboard-settings-dialog").close());
$("#dashboard-settings-dialog").addEventListener("click", (event) => {
  if (event.target === $("#dashboard-settings-dialog")) $("#dashboard-settings-dialog").close();
});
document.querySelectorAll(".sidebar nav a").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  const target = link.getAttribute("href");
  if (target === "#dashboard") { setProviderView("home"); return; }
  setProviderView("dashboard");
  const anchor = $(target);
  if (anchor) requestAnimationFrame(() => anchor.scrollIntoView({ behavior: "smooth", block: "start" }));
}));
$("#patient-week-previous").addEventListener("click", () => { patientWeekOffset -= 1; renderPatientWeek(); });
$("#patient-week-next").addEventListener("click", () => { if (patientWeekOffset < 0) patientWeekOffset += 1; renderPatientWeek(); });
$("#patient-home-week-previous").addEventListener("click", () => { patientHomeWeekOffset -= 1; renderPatientHomeWeek(); });
$("#patient-home-week-next").addEventListener("click", () => { if (patientHomeWeekOffset < 0) patientHomeWeekOffset += 1; renderPatientHomeWeek(); });
$("#patient-provider-link").addEventListener("click", () => setAppMode("provider"));
$("#controller-check").addEventListener("change", (event) => {
  localStorage.setItem("smarthome-controller-taken", String(event.target.checked));
  $("input[name=medication][value=yes]").checked = event.target.checked;
  $("input[name=medication][value=no]").checked = !event.target.checked;
});
$("#rescue-check").addEventListener("change", (event) => localStorage.setItem("smarthome-rescue-available", String(event.target.checked)));
$("#device-check").addEventListener("change", (event) => localStorage.setItem("smarthome-nebulizer-ready", String(event.target.checked)));
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
document.querySelectorAll("input[name=medication]").forEach((input) => input.addEventListener("change", () => {
  const taken = $("input[name=medication]:checked").value === "yes";
    localStorage.setItem("smarthome-controller-taken", String(taken));
  $("#controller-check").checked = taken;
}));
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#patient-modal").hidden) closePatientPreview(); });
loadEntries();
