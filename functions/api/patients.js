export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, name, initials, summary FROM patients ORDER BY name",
    ).all();
    return Response.json(results, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not load the demo patient list." }, { status: 500 });
  }
}
