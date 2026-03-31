const {
  setJsonSecurityHeaders,
  applyCors,
  enforceRateLimit,
  validatePasswordStrength,
  getAuthenticatedSupabaseUser,
  getUserRole,
  createSupabaseAuthUser
} = require('./_security');

module.exports = async (req, res) => {
  setJsonSecurityHeaders(res);
  applyCors(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, Authorization'
  });

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
  }

  const authorization = String(req.headers.authorization || '').trim();
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  try {
    enforceRateLimit(req, {
      keyPrefix: 'admin-create-user',
      windowMs: 60 * 1000,
      max: 20
    });

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
    const requestedRole = String(req.body?.role || 'advertiser').trim().toLowerCase();
    const roleToCreate = ['advertiser', 'affiliate'].includes(requestedRole) ? requestedRole : 'advertiser';

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

    const user = await createSupabaseAuthUser({
      email,
      password,
      metadata: {
        account_type: roleToCreate
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
    const status = /Muitas requisicoes/i.test(error.message) ? 429 : 500;
    return res.status(status).json({
      ok: false,
      error: error.message
    });
  }
};
