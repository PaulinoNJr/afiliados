const {
  setJsonSecurityHeaders,
  getAuthenticatedSupabaseUser,
  getUserRole,
  updateSupabaseAuthUserById,
  deleteSupabaseAuthUserById
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

  try {
    const currentUser = await getAuthenticatedSupabaseUser(accessToken);
    if (!currentUser?.id) {
      return res.status(401).json({
        ok: false,
        error: 'Sessao invalida para gerenciar usuarios.'
      });
    }

    const currentRole = await getUserRole(currentUser.id);
    if (currentRole !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: 'Apenas administradores podem gerenciar contas.'
      });
    }

    const userId = String(req.body?.userId || '').trim();
    const action = String(req.body?.action || '').trim().toLowerCase();

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'Usuario alvo ausente.'
      });
    }

    if (!['disable', 'delete'].includes(action)) {
      return res.status(400).json({
        ok: false,
        error: 'Acao invalida para gerenciamento de conta.'
      });
    }

    if (userId === currentUser.id) {
      return res.status(400).json({
        ok: false,
        error: 'Por seguranca, voce nao pode desativar ou excluir a propria conta por esta tela.'
      });
    }

    const targetRole = await getUserRole(userId);
    if (!targetRole) {
      return res.status(404).json({
        ok: false,
        error: 'Usuario nao encontrado.'
      });
    }

    if (action === 'disable') {
      await updateSupabaseAuthUserById(userId, {
        ban_duration: '876000h'
      });

      return res.status(200).json({
        ok: true,
        action,
        userId,
        message: 'Conta desativada com sucesso. O usuario nao conseguira mais entrar no sistema.'
      });
    }

    await deleteSupabaseAuthUserById(userId);

    return res.status(200).json({
      ok: true,
      action,
      userId,
      message: 'Conta excluida com sucesso. Os dados relacionados foram removidos conforme as regras de cascata do banco.'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
};
