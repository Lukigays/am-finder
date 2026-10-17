/**
 * GET /api/ping — tes cepat: function-nya hidup atau nggak.
 * Buka https://<domain>/api/ping di browser. Harusnya keluar JSON:
 * {"ok":true,"build":"1.4.0","engine":"amfinder",...}
 */
export default function handler(req, res) {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify({
    ok: true,
    app: 'lukyy',
    build: '1.5.0',
    engine: 'amfinder',
    now: new Date().toISOString()
  }))
}
