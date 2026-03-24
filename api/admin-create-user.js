const {
  setJsonSecurityHeaders,
  validatePasswordStrength,
  getAuthenticatedSupabaseUser,
  getUserRole,
  createSupabaseAuthUser
} = require('./_security');

module.exports = async (req, res) => {
  setJsonSecurityHeaders(res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
  }

  const authorization = String(req.headers.authorization || '').trim();
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  const currentUser = await getAuthenticatedSupabaseUser(accessToken);
  if (!currentUser?.id) {
    return res.status(401).json({
      ok: false,
      error: 'Sessao invalida para criar usuarios.'
    });
  }

  const role = await getUserRole(currentUser.id);
  if (role !== 'admin') {
    return res.status(403).json({
      ok: false,
      error: 'Apenas administradores podem criar usuarios.'
    });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

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
    const user = await createSupabaseAuthUser({
      email,
      password,
      metadata: {},
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
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
};
