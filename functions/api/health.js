export function onRequestGet({ env }) {
  return Response.json({ ok: true, storage: env.DB ? "d1" : "unconfigured" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
