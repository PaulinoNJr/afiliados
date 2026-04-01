const {
  setJsonSecurityHeaders,
  applyCors,
  enforceRateLimit,
  getAuthenticatedSupabaseUser,
  getUserRole,
  updateSupabaseAuthUserById,
  deleteSupabaseAuthUserById,
  deletePublicTableRows
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
    return res.status(405).json({ ok: false, error: 'M?todo n?o permitido.' });
  }

  const authorization = String(req.headers.authorization || '').trim();
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  async function runAccountAction({ userId, action, currentUserId }) {
    if (!userId) {
      return {
        ok: false,
        userId,
        error: 'Usuário alvo ausente.'
      };
    }

    if (userId === currentUserId) {
      return {
        ok: false,
        userId,
        error: 'Por segurança, você não pode desativar ou excluir a própria conta por esta tela.'
      };
    }

    const targetRole = await getUserRole(userId);
    if (!targetRole) {
      return {
        ok: false,
        userId,
        error: 'Usuário não encontrado.'
      };
    }

    if (action === 'disable') {
      await updateSupabaseAuthUserById(userId, {
        ban_duration: '876000h'
      });

      return {
        ok: true,
        userId,
        action,
        message: 'Conta desativada com sucesso.'
      };
    }

    await deletePublicTableRows({
      table: 'produtos',
      filters: [
        { column: 'profile_id', value: userId }
      ]
    });

    await deletePublicTableRows({
      table: 'produtos',
      filters: [
        { column: 'created_by', value: userId }
      ]
    });

    await deleteSupabaseAuthUserById(userId);

    return {
      ok: true,
      userId,
      action,
      message: 'Conta excluida com sucesso.'
    };
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'admin-manage-user',
      windowMs: 60 * 1000,
      max: 20
    });

    const currentUser = await getAuthenticatedSupabaseUser(accessToken);
    if (!currentUser?.id) {
      return res.status(401).json({
        ok: false,
        error: 'Sessão inválida para gerenciar usuários.'
      });
    }

    const currentRole = await getUserRole(currentUser.id);
    if (currentRole !== 'admin') {
      return res.status(403).json({
        ok: false,
        error: 'Apenas administradores podem gerenciar contas.'
      });
    }

    const action = String(req.body?.action || '').trim().toLowerCase();
    const singleUserId = String(req.body?.userId || '').trim();
    const batchUserIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
    const userIds = Array.from(new Set(
      (batchUserIds.length ? batchUserIds : [singleUserId])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));

    if (!userIds.length) {
      return res.status(400).json({
        ok: false,
        error: 'Usuário alvo ausente.'
      });
    }

    if (!['disable', 'delete'].includes(action)) {
      return res.status(400).json({
        ok: false,
        error: 'Ação inválida para gerenciamento de conta.'
      });
    }

    if (userIds.length === 1) {
      const result = await runAccountAction({
        userId: userIds[0],
        action,
        currentUserId: currentUser.id
      });

      if (!result.ok) {
        return res.status(/propria conta/i.test(result.error) ? 400 : 404).json({
          ok: false,
          error: result.error
        });
      }

      return res.status(200).json({
        ok: true,
        action,
        userId: result.userId,
        message: action === 'disable'
          ? 'Conta desativada com sucesso. O usuário não conseguirá mais entrar no sistema.'
          : 'Conta excluida com sucesso. Os dados relacionados foram removidos conforme as regras de cascata do banco.'
      });
    }

    const results = [];
    const errors = [];

    for (const userId of userIds) {
      try {
        const result = await runAccountAction({
          userId,
          action,
          currentUserId: currentUser.id
        });

        if (result.ok) {
          results.push(result);
        } else {
          errors.push(result);
        }
      } catch (error) {
        errors.push({
          ok: false,
          userId,
          error: error.message
        });
      }
    }

    return res.status(200).json({
      ok: errors.length === 0,
      partial: results.length > 0 && errors.length > 0,
      action,
      results,
      errors,
      message: errors.length === 0
        ? `${results.length} conta(s) processada(s) com sucesso.`
        : `${results.length} conta(s) processada(s) com sucesso e ${errors.length} com erro.`
    });
  } catch (error) {
    const message = /SUPABASE_SERVICE_ROLE_KEY/i.test(error.message)
      ? 'SUPABASE_SERVICE_ROLE_KEY não está configurada no backend. Adicione essa chave nas variáveis de ambiente para permitir desativar ou excluir contas pelo admin.'
      : error.message;

    const status = /Muitas requisicoes/i.test(error.message) ? 429 : 500;
    return res.status(status).json({
      ok: false,
      error: message
    });
  }
};
