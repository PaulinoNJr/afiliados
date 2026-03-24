const {
  setJsonSecurityHeaders,
  validatePasswordStrength,
  verifyRecaptchaToken,
  createSupabaseAuthUser
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

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const recaptchaToken = String(req.body?.recaptchaToken || '').trim();
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {};

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
      error: 'A senha nao atende aos requisitos minimos de seguranca.'
    });
  }

  try {
    await verifyRecaptchaToken({
      token: recaptchaToken,
      req
    });

    const user = await createSupabaseAuthUser({
      email,
      password,
      metadata: {
        first_name: metadata.first_name || null,
        last_name: metadata.last_name || null,
        phone: metadata.phone || null,
        photo_url: metadata.photo_url || null,
        slug: metadata.slug || null
      },
      emailConfirm: true
    });

    return res.status(200).json({
      ok: true,
      user: {
        id: user?.user?.id || null,
        email: user?.user?.email || email
      }
    });
  } catch (error) {
    return res.status(/recaptcha|requisitos|minimos/i.test(error.message) ? 400 : 500).json({
      ok: false,
      error: error.message
    });
  }
};
