const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Database } = require("node:sqlite");

const root = path.join(__dirname, "web");
const dataDir = process.env.DATA_DIR || path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(process.env.DB_PATH || path.join(dataDir, "airwise.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT 'Asthma care'
  );
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    feeling INTEGER NOT NULL CHECK (feeling BETWEEN 1 AND 5),
    inhaler_needed INTEGER NOT NULL,
    medication_taken INTEGER NOT NULL DEFAULT 1,
    inhaler_reasons TEXT NOT NULL DEFAULT '[]',
    timing TEXT NOT NULL DEFAULT '',
    symptoms TEXT NOT NULL DEFAULT '[]',
    peak_flow INTEGER,
    patient_id TEXT NOT NULL DEFAULT 'PT-2048'
  );
`);

const patients = [
  { id: "PT-2048", name: "Jordan M.", initials: "JM", summary: "Asthma care · Active monitoring" },
  { id: "PT-3107", name: "Sam R.", initials: "SR", summary: "Asthma care · Active monitoring" },
  { id: "PT-4821", name: "Casey T.", initials: "CT", summary: "Asthma care · Active monitoring" },
  { id: "PT-5639", name: "Avery L.", initials: "AL", summary: "Asthma care · Active monitoring" },
];
const savePatient = db.prepare("INSERT OR IGNORE INTO patients (id, name, initials, summary) VALUES (?, ?, ?, ?)");
for (const patient of patients) savePatient.run(patient.id, patient.name, patient.initials, patient.summary);

// Upgrade databases created by an earlier local build without losing their entries.
const checkinColumns = db.prepare("PRAGMA table_info(checkins)").all().map((column) => column.name);
if (!checkinColumns.includes("patient_id")) {
  db.exec("ALTER TABLE checkins ADD COLUMN patient_id TEXT NOT NULL DEFAULT 'PT-2048'");
}
db.exec("CREATE INDEX IF NOT EXISTS checkins_patient_created ON checkins(patient_id, created_at DESC)");

function insertCheckIn(item) {
  return db.prepare(`INSERT INTO checkins
    (created_at, feeling, inhaler_needed, medication_taken, inhaler_reasons, timing, symptoms, peak_flow, patient_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(item.createdAt, item.feeling, item.inhalerNeeded ? 1 : 0,
      item.medicationTaken ? 1 : 0, JSON.stringify(item.inhalerReasons || []), item.timing || "",
      JSON.stringify(item.symptoms || []), item.peakFlow ?? null, item.patientId || "PT-2048");
}

function seedDemoData() {
  if (db.prepare("SELECT COUNT(*) AS count FROM checkins").get().count > 0) return;
  const rows = [
    [0, true, true, 3, ["Coughing", "Tight chest"], 390, "During activity", ["Exercise"]],
    [1, false, true, 4, [], 420, "Morning", []],
    [2, true, false, 2, ["Wheezing"], 350, "At night", ["Cold air"]],
    [3, false, true, 5, [], 440, "No pattern", []],
    [4, true, true, 3, ["Shortness of breath"], 380, "During activity", ["Exercise", "Pollen / allergies"]],
    [5, false, true, 4, ["Coughing"], 410, "Evening", []],
    [7, true, false, 1, ["Wheezing", "Tight chest"], 320, "At night", ["Cold air"]],
    [9, false, true, 5, [], 450, "No pattern", []],
    [11, false, true, 4, [], 430, "Morning", []],
    [14, true, true, 3, ["Coughing"], 395, "During activity", ["Exercise"]],
  ];
  const now = new Date();
  db.exec("BEGIN");
  try {
    for (const [daysAgo, inhalerNeeded, medicationTaken, feeling, symptoms, peakFlow, timing, inhalerReasons] of rows) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      date.setHours(9, 15 + (rows.length - daysAgo) % 40, 0, 0);
      insertCheckIn({ createdAt: date.toISOString(), feeling, inhalerNeeded, medicationTaken, symptoms, peakFlow, timing, inhalerReasons });
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
seedDemoData();

function seedOtherPatients() {
  const profiles = [
    { id: "PT-3107", rows: [
      [0, 5, false, true, 460, "No pattern", []], [1, 4, true, true, 430, "After activity", ["Exercise"]],
      [3, 4, false, true, 445, "Morning", []], [5, 3, true, true, 410, "Evening", ["Pollen / allergies"]],
      [8, 5, false, true, 455, "No pattern", []], [12, 4, false, true, 440, "Morning", []],
    ] },
    { id: "PT-4821", rows: [
      [0, 2, true, false, 335, "At night", ["Cold air"]], [2, 3, true, true, 360, "Morning", ["Illness"]],
      [4, 3, false, true, 375, "No pattern", []], [6, 2, true, true, 345, "At night", ["Cold air"]],
      [9, 4, false, true, 390, "Evening", []], [13, 3, true, false, 350, "During activity", ["Exercise"]],
    ] },
    { id: "PT-5639", rows: [
      [0, 4, false, true, 425, "No pattern", []], [1, 5, false, true, 440, "Morning", []],
      [4, 4, true, true, 405, "During activity", ["Exercise"]], [7, 5, false, true, 450, "No pattern", []],
      [10, 4, false, true, 435, "Evening", []], [14, 5, false, true, 445, "No pattern", []],
    ] },
  ];
  const countFor = db.prepare("SELECT COUNT(*) AS count FROM checkins WHERE patient_id = ?");
  const insert = db.prepare(`INSERT INTO checkins
    (created_at, feeling, inhaler_needed, medication_taken, inhaler_reasons, timing, symptoms, peak_flow, patient_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const profile of profiles) {
    if (countFor.get(profile.id).count > 0) continue;
    for (const [daysAgo, feeling, inhalerNeeded, medicationTaken, peakFlow, timing, inhalerReasons] of profile.rows) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      date.setHours(8 + daysAgo % 6, 10, 0, 0);
      const symptoms = inhalerNeeded ? (inhalerReasons.includes("Cold air") ? ["Wheezing", "Tight chest"] : ["Coughing"]) : [];
      insert.run(date.toISOString(), feeling, Number(inhalerNeeded), Number(medicationTaken),
        JSON.stringify(inhalerReasons), timing, JSON.stringify(symptoms), peakFlow, profile.id);
    }
  }
}
seedOtherPatients();

function serialize(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    feeling: row.feeling,
    inhalerNeeded: Boolean(row.inhaler_needed),
    medicationTaken: Boolean(row.medication_taken),
    inhalerReasons: JSON.parse(row.inhaler_reasons),
    timing: row.timing,
    symptoms: JSON.parse(row.symptoms),
    peakFlow: row.peak_flow,
    patientId: row.patient_id || "PT-2048",
  };
}

function summarizeInsights(rows) {
  const recent = rows.slice(0, 7);
  const previous = rows.slice(7, 14);
  const symptomReports = (items) => items.reduce((total, row) => total + JSON.parse(row.symptoms).length, 0);
  const recentReports = symptomReports(recent);
  const previousReports = symptomReports(previous);
  const recentRate = recent.length ? recentReports / recent.length : 0;
  const previousRate = previous.length ? previousReports / previous.length : 0;
  const rateDelta = recentRate - previousRate;
  const reasons = recent.filter((row) => row.inhaler_needed).flatMap((row) => JSON.parse(row.inhaler_reasons));
  const reasonCounts = new Map();
  reasons.forEach((reason) => reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1));
  const mostSelectedReason = [...reasonCounts].sort((left, right) => right[1] - left[1])[0] || null;
  const missedMedicationEntries = recent.filter((row) => !row.medication_taken).length;
  const direction = rateDelta > 0.25 ? "rising" : rateDelta < -0.25 ? "falling" : "stable";
  const followUps = [];
  if (previous.length) {
    followUps.push(`Average symptom mentions per check-in: ${recentRate.toFixed(2)} in the most recent ${recent.length} vs ${previousRate.toFixed(2)} in the prior ${previous.length}; review any change with the patient.`);
  } else {
    followUps.push("More check-ins are needed before comparing symptom patterns.");
  }
  if (missedMedicationEntries > 0) {
    followUps.push(`Controller medication was marked missed in ${missedMedicationEntries} of the last ${recent.length} check-ins; ask whether access or refill timing is a concern.`);
  }
  if (mostSelectedReason) {
    followUps.push(`“${mostSelectedReason[0]}” was the most selected reason alongside reported inhaler use (${mostSelectedReason[1]} entries); confirm the patient's context.`);
  }
  return {
    recentCheckIns: recent.length,
    previousCheckIns: previous.length,
    symptomReports: { recent: recentReports, previous: previousReports, recentRate, previousRate, rateDelta, direction },
    missedMedicationEntries,
    mostSelectedInhalerReason: mostSelectedReason ? { label: mostSelectedReason[0], count: mostSelectedReason[1] } : null,
    followUps,
  };
}

function sendJSON(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

async function readJSON(request) {
  let body = "";
  for await (const part of request) {
    body += part;
    if (body.length > 16_384) throw new Error("Request body too large");
  }
  return JSON.parse(body);
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/health" && request.method === "GET") {
    return sendJSON(response, 200, { ok: true, storage: "sqlite" });
  }
  if (url.pathname === "/api/patients" && request.method === "GET") {
    return sendJSON(response, 200, db.prepare("SELECT id, name, initials, summary FROM patients ORDER BY name").all());
  }
  if (url.pathname === "/api/insights" && request.method === "GET") {
    const patientId = patients.some((patient) => patient.id === url.searchParams.get("patientId"))
      ? url.searchParams.get("patientId")
      : "PT-2048";
    const rows = db.prepare("SELECT * FROM checkins WHERE patient_id = ? ORDER BY created_at DESC, id DESC LIMIT 14").all(patientId);
    return sendJSON(response, 200, summarizeInsights(rows));
  }
  if (url.pathname === "/api/checkins" && request.method === "GET") {
    const patientId = url.searchParams.get("patientId");
    const rows = patientId
      ? db.prepare("SELECT * FROM checkins WHERE patient_id = ? ORDER BY created_at DESC, id DESC LIMIT 250").all(patientId)
      : db.prepare("SELECT * FROM checkins ORDER BY created_at DESC, id DESC LIMIT 250").all();
    return sendJSON(response, 200, rows.map(serialize));
  }
  if (url.pathname === "/api/checkins" && request.method === "POST") {
    try {
      const payload = await readJSON(request);
      if (!Number.isInteger(payload.feeling) || payload.feeling < 1 || payload.feeling > 5) {
        return sendJSON(response, 400, { error: "Feeling must be an integer from 1 to 5." });
      }
      if (typeof payload.inhalerNeeded !== "boolean") {
        return sendJSON(response, 400, { error: "Inhaler use must be yes or no." });
      }
      const list = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string").slice(0, 12) : [];
      const record = {
        createdAt: /^\d{4}-\d{2}-\d{2}$/.test(payload.date) ? `${payload.date}T12:00:00.000Z` : new Date().toISOString(),
        feeling: payload.feeling,
        inhalerNeeded: payload.inhalerNeeded,
        medicationTaken: payload.medicationTaken !== false,
        inhalerReasons: payload.inhalerNeeded ? list(payload.inhalerReasons) : [],
        timing: typeof payload.timing === "string" ? payload.timing.slice(0, 60) : "",
        symptoms: list(payload.symptoms),
        peakFlow: null,
        patientId: patients.some((patient) => patient.id === payload.patientId) ? payload.patientId : "PT-2048",
      };
      const result = insertCheckIn(record);
      const row = db.prepare("SELECT * FROM checkins WHERE id = ?").get(Number(result.lastInsertRowid));
      return sendJSON(response, 201, serialize(row));
    } catch (error) {
      const status = error instanceof SyntaxError || error.message.includes("too large") ? 400 : 500;
      return sendJSON(response, status, { error: status === 400 ? "Invalid request." : "Could not save the check-in." });
    }
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    return response.end("Method not allowed");
  }
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const absolutePath = path.resolve(root, `.${requestedPath}`);
  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    return response.end("Forbidden");
  }
  fs.readFile(absolutePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Not found");
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(absolutePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": absolutePath.endsWith(".html") ? "no-cache" : "public, max-age=3600",
    });
    if (request.method === "HEAD") return response.end();
    response.end(data);
  });
});

const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || "0.0.0.0", () => console.log(`Airwise demo listening on ${port}`));
