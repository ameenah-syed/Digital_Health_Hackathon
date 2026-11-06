const json = (value, status = 200) => Response.json(value, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

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
    patientId: row.patient_id,
  };
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM checkins ORDER BY created_at DESC, id DESC LIMIT 250",
    ).all();
    return json(results.map(serialize));
  } catch {
    return json({ error: "Could not load the demo check-ins." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const payload = await request.json();
    if (!Number.isInteger(payload.feeling) || payload.feeling < 1 || payload.feeling > 5) {
      return json({ error: "Feeling must be an integer from 1 to 5." }, 400);
    }
    if (typeof payload.inhalerNeeded !== "boolean") {
      return json({ error: "Inhaler use must be yes or no." }, 400);
    }
    const list = (value) => Array.isArray(value)
      ? value.filter((item) => typeof item === "string").slice(0, 12)
      : [];
    const record = {
      createdAt: /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
        ? `${payload.date}T12:00:00.000Z`
        : new Date().toISOString(),
      feeling: payload.feeling,
      inhalerNeeded: payload.inhalerNeeded,
      medicationTaken: payload.medicationTaken !== false,
      inhalerReasons: payload.inhalerNeeded ? list(payload.inhalerReasons) : [],
      timing: typeof payload.timing === "string" ? payload.timing.slice(0, 60) : "",
      symptoms: list(payload.symptoms),
      patientId: typeof payload.patientId === "string" ? payload.patientId : "PT-2048",
    };
    const patient = await env.DB.prepare("SELECT id FROM patients WHERE id = ?")
      .bind(record.patientId)
      .first();
    if (!patient) return json({ error: "Choose a patient from the demo list." }, 400);
    const result = await env.DB.prepare(`INSERT INTO checkins
      (created_at, feeling, inhaler_needed, medication_taken, inhaler_reasons, timing, symptoms, peak_flow, patient_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`)
      .bind(record.createdAt, record.feeling, Number(record.inhalerNeeded),
        Number(record.medicationTaken), JSON.stringify(record.inhalerReasons), record.timing,
        JSON.stringify(record.symptoms), record.patientId)
      .run();
    return json({ ...record, id: result.meta.last_row_id, peakFlow: null }, 201);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    return json({ error: status === 400 ? "Invalid request." : "Could not save the check-in." }, status);
  }
}
