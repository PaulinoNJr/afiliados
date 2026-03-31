const {
  setJsonSecurityHeaders,
  applyCors,
  enforceRateLimit,
  verifyRecaptchaToken,
  validateRecaptchaV3Payload
} = require('./_security');

module.exports = async (req, res) => {
  setJsonSecurityHeaders(res);
  applyCors(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type'
  });

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'verify-recaptcha',
      windowMs: 60 * 1000,
      max: 30
    });

    const payload = await verifyRecaptchaToken({
      token: req.body?.token,
      req
    });

    const validation = validateRecaptchaV3Payload({
      payload,
      expectedAction: req.body?.action || '',
      minScore: Number(req.body?.minScore || process.env.RECAPTCHA_MIN_SCORE || 0.5)
    });

    return res.status(200).json({
      ok: true,
      action: validation.action || null,
      score: validation.score,
      hostname: payload.hostname || null,
      challengeTs: payload.challenge_ts || null
    });
  } catch (error) {
    const isConfigError = /RECAPTCHA_SECRET_KEY/.test(error.message);
    const isValidationError = /recaptcha|recusada|ausente/i.test(error.message);
    const isRateLimitError = /Muitas requisicoes/i.test(error.message);

    return res.status(isRateLimitError ? 429 : (isConfigError ? 500 : (isValidationError ? 400 : 500))).json({
      ok: false,
      error: error.message
    });
  }
};
