function setJsonSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function getClientIp(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').trim();
  return forwardedFor.split(',')[0]?.trim() || '';
}

function getRequestOrigin(req) {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').trim();
  const fallbackProtocol = /localhost|127\.0\.0\.1/i.test(host) ? 'http' : 'https';
  const protocol = String(req?.headers?.['x-forwarded-proto'] || '').trim() || fallbackProtocol;

  if (!host) {
    const fallback = String(process.env.APP_URL || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
    return fallback || '';
  }

  return `${protocol}://${host}`;
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

function getAllowedRecaptchaHostnames(req) {
  const configured = String(process.env.RECAPTCHA_ALLOWED_HOSTNAMES || '')
    .split(',')
    .map(normalizeHostname)
    .filter(Boolean);

  if (configured.length) {
    return configured;
  }

  const requestHosts = [
    req?.headers?.['x-forwarded-host'],
    req?.headers?.host
  ]
    .map(normalizeHostname)
    .filter(Boolean);

  return Array.from(new Set(requestHosts));
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
  getClientIp,
  getRequestOrigin,
  normalizeHostname,
  getAllowedRecaptchaHostnames,
  getSupabaseConfig,
  validatePasswordStrength,
  verifyRecaptchaToken,
  validateRecaptchaV3Payload,
  getAuthenticatedSupabaseUser,
  getUserRole,
  createSupabaseAuthUser,
  createSupabasePendingSignup
};
