const {
  setJsonSecurityHeaders,
  applyCors,
  enforceRateLimit,
  validatePasswordStrength,
  verifyRecaptchaToken,
  validateRecaptchaV3Payload,
  getRequestOrigin,
  createSupabasePendingSignup
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

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const recaptchaToken = String(req.body?.recaptchaToken || '').trim();
  const recaptchaAction = String(req.body?.recaptchaAction || '').trim();
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};
  const activationWindowDays = 5;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      error: 'Email e senha sao obrigatorios.'
    });
  }

  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.ok) {
    return res.status(400).json({
      ok: false,
      error: 'A senha não atende aos requisitos mínimos de segurança.'
    });
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'register-user',
      windowMs: 15 * 60 * 1000,
      max: 10
    });

    const payload = await verifyRecaptchaToken({
      token: recaptchaToken,
      req
    });

    validateRecaptchaV3Payload({
      payload,
      expectedAction: recaptchaAction || 'register_submit',
      minScore: Number(process.env.RECAPTCHA_MIN_SCORE || 0.5)
    });

    const activationExpiresAt = new Date(Date.now() + activationWindowDays * 24 * 60 * 60 * 1000).toISOString();
    const requestOrigin = getRequestOrigin(req);
    if (!requestOrigin) {
      throw new Error('APP_URL ou SITE_URL precisa estar configurada para o fluxo de ativacao.');
    }
    const emailRedirectTo = `${requestOrigin}/ativacao`;

    const signup = await createSupabasePendingSignup({
      email,
      password,
      metadata: {
        account_type: metadata.account_type || 'advertiser',
        company_name: metadata.company_name || null,
        first_name: metadata.first_name || null,
        last_name: metadata.last_name || null,
        phone: metadata.phone || null,
        photo_url: metadata.photo_url || null,
        slug: metadata.slug || null,
        activation_window_days: activationWindowDays,
        activation_expires_at: activationExpiresAt
      },
      emailRedirectTo
    });

    return res.status(200).json({
      ok: true,
      activation: {
        status: 'pending',
        expiresAt: activationExpiresAt,
        windowDays: activationWindowDays,
        redirectTo: emailRedirectTo
      },
      user: {
        id: signup?.user?.id || null,
        email: signup?.user?.email || email
      }
    });
  } catch (error) {
    const isRateLimitError = /Muitas requisicoes/i.test(error.message);
    return res.status(isRateLimitError ? 429 : (/recaptcha|requisitos|minimos/i.test(error.message) ? 400 : 500)).json({
      ok: false,
      error: error.message
    });
  }
};
