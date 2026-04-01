const {
  setJsonSecurityHeaders,
  applyCors,
  enforceRateLimit
} = require('./_security');

module.exports = async (req, res) => {
  setJsonSecurityHeaders(res);
  applyCors(req, res, {
    methods: 'GET, OPTIONS',
    headers: 'Content-Type'
  });

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'public-config',
      windowMs: 60 * 1000,
      max: 60
    });
  } catch (error) {
    return res.status(429).json({
      ok: false,
      error: error.message
    });
  }

  return res.status(200).json({
    ok: true,
    recaptchaSiteKey: String(process.env.RECAPTCHA_SITE_KEY || '').trim()
  });
};
