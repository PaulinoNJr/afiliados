function setJsonSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

const rateLimitStore = new Map();

function getClientIp(req) {
  const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '').trim();
  return forwardedFor.split(',')[0]?.trim() || '';
}

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
}

function getConfiguredAppOrigin() {
  return String(process.env.APP_URL || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
}

function normalizeHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
}

function getRequestOrigin(req) {
  const configuredOrigin = getConfiguredAppOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').trim();
  const fallbackProtocol = /localhost|127\.0\.0\.1/i.test(host) ? 'http' : 'https';
  const protocol = String(req?.headers?.['x-forwarded-proto'] || '').trim() || fallbackProtocol;

  if (!host) {
    return '';
  }

  const normalizedHost = normalizeHostname(host);
  if (!/^(localhost|127\.0\.0\.1)$/.test(normalizedHost)) {
    return '';
  }

  return `${protocol}://${host}`;
}

function getAllowedRecaptchaHostnames(req) {
  const configured = String(process.env.RECAPTCHA_ALLOWED_HOSTNAMES || '')
    .split(',')
    .map(normalizeHostname)
    .filter(Boolean);

  if (configured.length) {
    return configured;
  }

  const configuredOriginHostname = normalizeHostname(getConfiguredAppOrigin());
  if (configuredOriginHostname) {
    return [configuredOriginHostname];
  }

  const requestHosts = [
    req?.headers?.['x-forwarded-host'],
    req?.headers?.host
  ]
    .map(normalizeHostname)
    .filter(Boolean);

  return Array.from(new Set(requestHosts));
}

function getAllowedCorsOrigins(req) {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  if (configured.length) {
    return configured;
  }

  const defaults = [];
  const configuredOrigin = normalizeOrigin(getConfiguredAppOrigin());
  if (configuredOrigin) {
    defaults.push(configuredOrigin);
  }

  const localhostOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];

  const requestOrigin = normalizeOrigin(req?.headers?.origin);
  if (requestOrigin && /:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin)) {
    defaults.push(requestOrigin);
  }

  return Array.from(new Set([...defaults, ...localhostOrigins].filter(Boolean)));
}

function applyCors(req, res, { methods = 'GET, OPTIONS', headers = 'Content-Type', allowCredentials = false } = {}) {
  const origin = normalizeOrigin(req?.headers?.origin);
  const allowedOrigins = getAllowedCorsOrigins(req);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    if (allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
}

function enforceRateLimit(req, { keyPrefix = 'global', windowMs = 60_000, max = 60 } = {}) {
  const now = Date.now();
  const ip = getClientIp(req) || 'unknown';
  const key = `${keyPrefix}:${ip}`;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs
    });
    return;
  }

  entry.count += 1;
  if (entry.count > max) {
    throw new Error('Muitas requisicoes em pouco tempo. Tente novamente em instantes.');
  }
}

function getSupabaseConfig({ requireAnonKey = false, requireServiceRoleKey = false } = {}) {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url) {
    throw new Error('SUPABASE_URL precisa estar configurada no backend.');
  }

  if (requireAnonKey && !anonKey) {
    throw new Error('SUPABASE_ANON_KEY precisa estar configurada no backend.');
  }

  if (requireServiceRoleKey && !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY precisa estar configurada no backend.');
  }

  return {
    url,
    anonKey,
    serviceRoleKey
  };
}

function validatePasswordStrength(password) {
  const value = String(password || '');
  const rules = {
    minLength: value.length >= 8,
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    number: /\d/.test(value),
    special: /[!@#$%^&*()_\+\-=\[\]{};':"\\|<>?,./`~]/.test(value)
  };

  return {
    ok: Object.values(rules).every(Boolean),
    rules
  };
}

function parseJsonSafely(rawText) {
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    return {};
  }
}

async function callSupabaseAuthAdminUserEndpoint({ userId, method, body } = {}) {
  const { url, serviceRoleKey } = getSupabaseConfig({ requireServiceRoleKey: true });
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    throw new Error('ID do usuario ausente para operacao no Auth.');
  }

  const endpointCandidates = [
    `${url}/auth/v1/admin/user/${encodeURIComponent(normalizedUserId)}`,
    `${url}/auth/v1/admin/users/${encodeURIComponent(normalizedUserId)}`
  ];

  let lastError = null;

  for (const endpoint of endpointCandidates) {
    const headers = {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    };
    if (body) {
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const rawText = await response.text().catch(() => '');
    const payload = parseJsonSafely(rawText);

    if (response.ok) {
      return payload;
    }

    const message =
      payload?.msg ||
      payload?.message ||
      payload?.error_description ||
      payload?.error ||
      rawText ||
      `Falha ao acessar o Auth Admin (HTTP ${response.status}).`;

    lastError = new Error(message);

    if (response.status !== 404) {
      throw lastError;
    }
  }

  throw lastError || new Error('Falha ao acessar o Auth Admin.');
}

async function verifyRecaptchaToken({ token, req }) {
  const secret = String(
    process.env.RECAPTCHA_SECRET_KEY ||
    process.env.RECAPTCHA_SECRET ||
    ''
  ).trim();

  if (!secret) {
    throw new Error('RECAPTCHA_SECRET_KEY nao configurada no backend.');
  }

  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    throw new Error('Token do reCAPTCHA ausente.');
  }

  const body = new URLSearchParams({
    secret,
    response: normalizedToken
  });

  const remoteIp = getClientIp(req);
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
    throw new Error('Falha ao consultar o servico do reCAPTCHA.');
  }

  if (!payload?.success) {
    const codes = Array.isArray(payload?.['error-codes']) ? payload['error-codes'].join(', ') : '';
    throw new Error(codes ? `Verificacao reCAPTCHA recusada: ${codes}` : 'Verificacao reCAPTCHA recusada.');
  }

  const responseHostname = normalizeHostname(payload?.hostname);
  const allowedHostnames = getAllowedRecaptchaHostnames(req);

  if (allowedHostnames.length && (!responseHostname || !allowedHostnames.includes(responseHostname))) {
    throw new Error('Verificacao reCAPTCHA recusada: dominio invalido.');
  }

  return payload;
}

function validateRecaptchaV3Payload({ payload, expectedAction, minScore = 0.5 }) {
  const action = String(payload?.action || '').trim();
  const score = Number(payload?.score);
  const normalizedExpectedAction = String(expectedAction || '').trim();

  if (normalizedExpectedAction && action !== normalizedExpectedAction) {
    throw new Error('Verificacao reCAPTCHA recusada: acao invalida.');
  }

  if (!Number.isFinite(score)) {
    throw new Error('Verificacao reCAPTCHA recusada: score ausente.');
  }

  if (score < minScore) {
    throw new Error('Verificacao reCAPTCHA recusada: score abaixo do minimo permitido.');
  }

  return {
    action,
    score
  };
}

async function getAuthenticatedSupabaseUser(accessToken) {
  const { url, anonKey } = getSupabaseConfig({ requireAnonKey: true });
  const token = String(accessToken || '').trim();

  if (!token) {
    return null;
  }

  const response = await fetch(`${url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function getUserRole(userId) {
  const { url, serviceRoleKey } = getSupabaseConfig({ requireServiceRoleKey: true });
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  const endpoint = `${url}/rest/v1/user_profiles?select=role&user_id=eq.${encodeURIComponent(normalizedUserId)}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });

  if (!response.ok) {
    throw new Error('Nao foi possivel consultar o papel do usuario.');
  }

  const rows = await response.json();
  return rows?.[0]?.role || null;
}

async function createSupabaseAuthUser({ email, password, metadata = {}, emailConfirm = true }) {
  const { url, serviceRoleKey } = getSupabaseConfig({ requireServiceRoleKey: true });

  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    },
    body: JSON.stringify({
      email,
      password,
      user_metadata: metadata,
      email_confirm: Boolean(emailConfirm)
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Falha ao criar usuario no Auth.';
    throw new Error(message);
  }

  return payload;
}

async function updateSupabaseAuthUserById(userId, attributes = {}) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    throw new Error('ID do usuario ausente para atualizacao no Auth.');
  }

  return callSupabaseAuthAdminUserEndpoint({
    userId: normalizedUserId,
    method: 'PUT',
    body: attributes
  });
}

async function deleteSupabaseAuthUserById(userId) {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    throw new Error('ID do usuario ausente para exclusao no Auth.');
  }

  return callSupabaseAuthAdminUserEndpoint({
    userId: normalizedUserId,
    method: 'DELETE'
  });
}

async function deletePublicTableRows({ table, filters = [] }) {
  const { url, serviceRoleKey } = getSupabaseConfig({ requireServiceRoleKey: true });
  const endpoint = new URL(`${url}/rest/v1/${table}`);

  filters.forEach(({ column, operator = 'eq', value }) => {
    endpoint.searchParams.set(column, `${operator}.${value}`);
  });

  const response = await fetch(endpoint.toString(), {
    method: 'DELETE',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`
    }
  });

  const rawText = await response.text().catch(() => '');
  const payload = parseJsonSafely(rawText);

  if (!response.ok) {
    const message =
      payload?.msg ||
      payload?.message ||
      payload?.error_description ||
      payload?.error ||
      rawText ||
      `Falha ao remover registros de ${table} (HTTP ${response.status}).`;
    throw new Error(message);
  }

  return payload;
}

async function createSupabasePendingSignup({ email, password, metadata = {}, emailRedirectTo = '' }) {
  const { url, anonKey } = getSupabaseConfig({ requireAnonKey: true });
  const endpoint = new URL(`${url}/auth/v1/signup`);

  if (emailRedirectTo) {
    endpoint.searchParams.set('redirect_to', emailRedirectTo);
  }

  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anonKey
    },
    body: JSON.stringify({
      email,
      password,
      data: metadata
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || 'Falha ao iniciar o cadastro com confirmacao por email.';
    throw new Error(message);
  }

  return payload;
}

module.exports = {
  setJsonSecurityHeaders,
  applyCors,
  enforceRateLimit,
  getClientIp,
  getRequestOrigin,
  getConfiguredAppOrigin,
  normalizeHostname,
  getAllowedRecaptchaHostnames,
  getSupabaseConfig,
  validatePasswordStrength,
  verifyRecaptchaToken,
  validateRecaptchaV3Payload,
  getAuthenticatedSupabaseUser,
  getUserRole,
  createSupabaseAuthUser,
  createSupabasePendingSignup,
  updateSupabaseAuthUserById,
  deleteSupabaseAuthUserById,
  deletePublicTableRows
};
