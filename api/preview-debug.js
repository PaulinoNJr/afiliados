const {
  setJsonSecurityHeaders,
  applyCors,
  enforceRateLimit,
  getAuthenticatedSupabaseUser,
  getUserRole
} = require('./_security');

function normalizeText(raw, maxLength = 400) {
  if (raw === null || raw === undefined) return null;

  const plain = String(raw)
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return null;
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 3).trim()}...`;
}

function getOpenClawConfig() {
  const baseUrl = String(process.env.OPENCLAW_BASE_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.OPENCLAW_GATEWAY_TOKEN || '').trim();
  const password = String(process.env.OPENCLAW_GATEWAY_PASSWORD || '').trim();
  const missing = [];

  if (!baseUrl) missing.push('OPENCLAW_BASE_URL');
  if (!token && !password) missing.push('OPENCLAW_GATEWAY_TOKEN ou OPENCLAW_GATEWAY_PASSWORD');

  const agentId = String(process.env.OPENCLAW_AGENT_ID || 'main').trim() || 'main';
  const model = String(process.env.OPENCLAW_MODEL || `openclaw:${agentId}`).trim() || `openclaw:${agentId}`;
  const timeoutMs = Math.max(3000, Number(process.env.OPENCLAW_TIMEOUT_MS || 30000) || 30000);

  return {
    configured: missing.length === 0,
    missing,
    baseUrl,
    agentId,
    model,
    timeoutMs,
    authHeader: token || password ? `Bearer ${token || password}` : null,
    authMode: token ? 'token' : (password ? 'password' : null)
  };
}

function getMercadoLivreApiConfig() {
  const accessToken = String(
    process.env.MERCADOLIVRE_ACCESS_TOKEN ||
    process.env.MELI_ACCESS_TOKEN ||
    ''
  ).trim();

  return {
    configured: Boolean(accessToken)
  };
}

function extractAssistantTextFromChatCompletion(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('\n')
      .trim();
  }

  return null;
}

function extractJsonObjectFromText(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const directCandidates = [
    text,
    text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  ];

  for (const candidate of directCandidates) {
    if (!candidate) continue;

    try {
      return JSON.parse(candidate);
    } catch {
      // Continua para heuristica abaixo.
    }
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function buildProbePayload({ model, url }) {
  if (url) {
    return {
      model,
      temperature: 0,
      user: 'product-preview-debug',
      messages: [
        {
          role: 'system',
          content: [
            'Voce extrai dados de produto a partir de URLs de produto.',
            'Abra o link informado, siga redirecionamentos ate a pagina do produto e responda somente com JSON valido.',
            'Campos obrigatorios do JSON: title, image, price, description, source_url, resolved_product_url.',
            'Use null quando um campo nao puder ser obtido com confianca.',
            'Em price, retorne apenas numero decimal sem simbolo de moeda.',
            'Em image, retorne uma URL absoluta da imagem principal.',
            'Nao inclua markdown, comentarios ou texto fora do JSON.'
          ].join(' ')
        },
        {
          role: 'user',
          content: `Extraia os dados do produto desta URL: ${url}`
        }
      ]
    };
  }

  return {
    model,
    temperature: 0,
    user: 'product-preview-debug',
    messages: [
      {
        role: 'user',
        content: 'Responda somente com OK'
      }
    ]
  };
}

async function ensureDebugAccess(req) {
  const debugToken = String(process.env.PREVIEW_DEBUG_TOKEN || '').trim();
  const requestToken = String(req.headers['x-preview-debug-token'] || '').trim();

  if (debugToken && requestToken && requestToken === debugToken) {
    return true;
  }

  const authorization = String(req.headers.authorization || '').trim();
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const currentUser = await getAuthenticatedSupabaseUser(accessToken);

  if (!currentUser?.id) {
    return false;
  }

  const role = await getUserRole(currentUser.id);
  return role === 'admin';
}

module.exports = async (req, res) => {
  if (String(process.env.PREVIEW_DEBUG_ENABLED || '').trim() !== '1') {
    return res.status(404).json({ ok: false, error: 'Endpoint indisponivel.' });
  }

  setJsonSecurityHeaders(res);
  applyCors(req, res, {
    methods: 'GET, OPTIONS',
    headers: 'Content-Type, Authorization, X-Preview-Debug-Token'
  });

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Metodo nao permitido.' });
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: 'preview-debug',
      windowMs: 60 * 1000,
      max: 10
    });

    const allowed = await ensureDebugAccess(req);
    if (!allowed) {
      return res.status(403).json({
        ok: false,
        error: 'Acesso restrito ao modo debug.'
      });
    }
  } catch (error) {
    const status = /Muitas requisicoes/i.test(error.message) ? 429 : 500;
    return res.status(status).json({
      ok: false,
      error: error.message
    });
  }

  const config = getOpenClawConfig();
  const mercadolivreApi = getMercadoLivreApiConfig();
  const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
  const shouldProbe = req.query?.probe === '1' || Boolean(rawUrl);

  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ ok: false, error: 'A URL de teste deve usar http/https.' });
      }
    } catch {
      return res.status(400).json({ ok: false, error: 'A URL de teste e invalida.' });
    }
  }

  const summary = {
    configured: config.configured,
    missing: config.missing,
    base_url: config.baseUrl || null,
    auth_mode: config.authMode,
    agent_id: config.agentId,
    model: config.model,
    timeout_ms: config.timeoutMs,
    mercadolivre_api_token_configured: mercadolivreApi.configured
  };

  if (!shouldProbe || !config.configured) {
    return res.status(200).json({
      ok: true,
      config: summary,
      probe: shouldProbe
        ? {
            attempted: false,
            ok: false,
            reason: config.missing.length
              ? `Configuracao incompleta: ${config.missing.join(', ')}`
              : 'Probe nao solicitado.'
          }
        : null
    });
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller
    ? setTimeout(() => controller.abort(new Error('Open.Claw timeout')), config.timeoutMs)
    : null;

  try {
    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: config.authHeader,
        'x-openclaw-agent-id': config.agentId
      },
      body: JSON.stringify(buildProbePayload({ model: config.model, url: rawUrl || null })),
      signal: controller?.signal
    });

    const responseText = await response.text();
    let payload = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Mantem o texto bruto no retorno.
    }

    const assistantText = extractAssistantTextFromChatCompletion(payload);
    const parsedJson = rawUrl ? extractJsonObjectFromText(assistantText) : null;

    return res.status(200).json({
      ok: true,
      config: summary,
      probe: {
        attempted: true,
        ok: response.ok,
        http_status: response.status,
        url_tested: rawUrl || null,
        assistant_preview: normalizeText(assistantText || responseText, 500),
        parsed_json: parsedJson,
        raw_response_preview: payload ? null : normalizeText(responseText, 500)
      }
    });
  } catch (error) {
    return res.status(200).json({
      ok: true,
      config: summary,
      probe: {
        attempted: true,
        ok: false,
        url_tested: rawUrl || null,
        reason: error.message
      }
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
