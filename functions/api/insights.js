const json = (value, status = 200) => Response.json(value, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

function summarize(rows) {
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

export async function onRequestGet({ request, env }) {
  const patientId = new URL(request.url).searchParams.get("patientId") || "PT-2048";
  try {
    const { results } = await env.DB.prepare(`SELECT * FROM checkins
      WHERE patient_id = ? ORDER BY created_at DESC, id DESC LIMIT 14`)
      .bind(patientId)
      .all();
    return json(summarize(results));
  } catch {
    return json({ error: "Could not calculate the check-in summary." }, 500);
  }
}
