module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
  }

  const secret = String(
    process.env.RECAPTCHA_SECRET_KEY ||
    process.env.RECAPTCHA_SECRET ||
    ''
  ).trim();

  if (!secret) {
    return res.status(500).json({
      ok: false,
      error: 'RECAPTCHA_SECRET_KEY nao configurada no backend.'
    });
  }

  const token = String(req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({
      ok: false,
      error: 'Token do reCAPTCHA ausente.'
    });
  }

  const forwardedFor = String(req.headers['x-forwarded-for'] || '').trim();
  const remoteIp = forwardedFor.split(',')[0]?.trim() || '';

  try {
    const body = new URLSearchParams({
      secret,
      response: token
    });

    if (remoteIp) {
      body.set('remoteip', remoteIp);
    }

    const googleResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    const payload = await googleResponse.json();

    if (!googleResponse.ok) {
      return res.status(502).json({
        ok: false,
        error: 'Falha ao consultar o servico do reCAPTCHA.'
      });
    }

    if (!payload?.success) {
      return res.status(400).json({
        ok: false,
        error: 'Verificacao reCAPTCHA recusada.',
        codes: Array.isArray(payload?.['error-codes']) ? payload['error-codes'] : []
      });
    }

    return res.status(200).json({
      ok: true,
      hostname: payload.hostname || null,
      challengeTs: payload.challenge_ts || null
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: `Erro ao validar o reCAPTCHA: ${error.message}`
    });
  }
};
