const {
  setJsonSecurityHeaders,
  verifyRecaptchaToken
} = require('./_security');

module.exports = async (req, res) => {
  setJsonSecurityHeaders(res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
  }

  try {
    const payload = await verifyRecaptchaToken({
      token: req.body?.token,
      req
    });

    return res.status(200).json({
      ok: true,
      hostname: payload.hostname || null,
      challengeTs: payload.challenge_ts || null
    });
  } catch (error) {
    const isConfigError = /RECAPTCHA_SECRET_KEY/.test(error.message);
    const isValidationError = /recaptcha|recusada|ausente/i.test(error.message);

    return res.status(isConfigError ? 500 : (isValidationError ? 400 : 500)).json({
      ok: false,
      error: error.message
    });
  }
};
