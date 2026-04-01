const crypto = require('crypto');
const {
  getSupabaseConfig,
  getClientIp,
  enforceRateLimit
} = require('./_security');

function getCookieValue(cookieHeader, key) {
  const cookie = String(cookieHeader || '');
  const match = cookie.match(new RegExp(`(?:^|; )${key}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function createIpHash(value) {
  const raw = String(value || '').trim();
  const salt = String(process.env.CLICK_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!raw) return null;
  return crypto.createHash('sha256').update(`${salt}:${raw}`).digest('hex');
}

function isSafeRedirectUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function supabaseRestRequest({ path, method = 'GET', body } = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig({ requireServiceRoleKey: true });
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      'content-type': body ? 'application/json' : undefined,
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      prefer: body ? 'return=representation' : undefined
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Falha REST no Supabase (${response.status}).`);
  }

  return payload;
}

module.exports = async (req, res) => {
  const code = String(req.query?.code || '').trim().toLowerCase();

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!code || !/^[a-z0-9]{8,32}$/.test(code)) {
    return res.status(404).send('Link rastreavel invalido.');
  }

  try {
    enforceRateLimit(req, {
      keyPrefix: `track-click:${code}`,
      windowMs: 60 * 1000,
      max: 60
    });

    const rows = await supabaseRestRequest({
      path: `affiliate_links?select=id,code,affiliate_id,campaign_id,product_id,destination_url,status&code=eq.${encodeURIComponent(code)}&status=eq.active&limit=1`
    });

    const link = Array.isArray(rows) ? rows[0] : null;
    if (!link?.destination_url || !isSafeRedirectUrl(link.destination_url)) {
      return res.status(404).send('Link rastreável não encontrado.');
    }

    const existingSessionId = getCookieValue(req.headers.cookie, 'af_click_sid');
    const sessionId = existingSessionId || crypto.randomUUID();
    const referrer = String(req.headers.referer || '').trim() || null;
    const userAgent = String(req.headers['user-agent'] || '').trim() || null;
    const ipHash = createIpHash(getClientIp(req));

    try {
      await supabaseRestRequest({
        path: 'clicks',
        method: 'POST',
        body: {
          affiliate_link_id: link.id,
          affiliate_id: link.affiliate_id,
          campaign_id: link.campaign_id,
          product_id: link.product_id,
          session_id: sessionId,
          referrer,
          user_agent: userAgent,
          ip_hash: ipHash
        }
      });
    } catch (trackingError) {
      console.error('Falha ao registrar clique rastreavel:', trackingError);
    }

    res.setHeader(
      'Set-Cookie',
      `af_click_sid=${encodeURIComponent(sessionId)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`
    );
    return res.redirect(302, link.destination_url);
  } catch (error) {
    if (/Muitas requisicoes/i.test(error.message)) {
      return res.status(429).send('Muitas requisicoes em pouco tempo. Tente novamente em instantes.');
    }

    console.error('Falha ao resolver link rastreavel:', error);
    return res.status(500).send('Não foi possóvel processar o redirecionamento.');
  }
};
