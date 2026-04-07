(() => {
  const RECAPTCHA_ACTION = 'register_submit';

  const state = {
    recaptchaLoaded: false,
    recaptchaScriptPromise: null,
    slugCheckNonce: 0
  };

  const refs = {
    form: document.getElementById('registerForm'),
    companyName: document.getElementById('companyName'),
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    phone: document.getElementById('phone'),
    photoUrl: document.getElementById('photoUrl'),
    email: document.getElementById('email'),
    slug: document.getElementById('slug'),
    slugFeedback: document.getElementById('slugFeedback'),
    password: document.getElementById('password'),
    passwordConfirm: document.getElementById('passwordConfirm'),
    passwordRules: document.getElementById('passwordRules'),
    passwordMatchFeedback: document.getElementById('passwordMatchFeedback'),
    recaptchaStatus: document.getElementById('recaptchaStatus'),
    registerBtn: document.getElementById('registerBtn'),
    signupPublicUrl: document.getElementById('signupPublicUrl'),
    status: document.getElementById('statusMessage')
  };

  function showStatus(message, type = 'danger') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function setLoading(isLoading) {
    refs.registerBtn.disabled = isLoading;
    refs.registerBtn.textContent = isLoading ? 'Criando conta...' : 'Criar conta';
  }

  function isValidHttpUrl(raw) {
    try {
      const parsed = new URL(raw);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function setSlugFeedback(message, tone = 'secondary') {
    refs.slugFeedback.className = `d-block mt-2 text-${tone}`;
    refs.slugFeedback.textContent = message;
  }

  function setRecaptchaStatus(message, tone = 'secondary') {
    refs.recaptchaStatus.className = `d-block text-${tone}`;
    refs.recaptchaStatus.textContent = message;
  }

  function getSuggestedSlug() {
    return window.StoreUtils.normalizeStoreSlug(
      refs.slug.value ||
      refs.companyName.value ||
      refs.firstName.value ||
      refs.email.value.split('@')[0] ||
      'minha-loja'
    );
  }

  function updatePublicUrlPreview() {
    const slug = window.StoreUtils.normalizeStoreSlug(refs.slug.value || getSuggestedSlug());
    refs.signupPublicUrl.textContent = slug
      ? `${window.location.origin}/${slug}`
      : `${window.location.origin}/sua-loja`;
  }

  function updatePasswordValidation() {
    const result = window.StoreUtils.validatePasswordRules(refs.password.value);
    const rulesList = refs.passwordRules?.querySelectorAll('[data-rule]') || [];

    rulesList.forEach((item) => {
      const ruleName = item.getAttribute('data-rule');
      const valid = Boolean(result.rules[ruleName]);
      item.classList.toggle('is-valid', valid);
      item.classList.toggle('is-invalid', !valid && refs.password.value.length > 0);
    });

    const matches = refs.passwordConfirm.value.length > 0 && refs.password.value === refs.passwordConfirm.value;

    if (!refs.passwordConfirm.value.length) {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-secondary';
      refs.passwordMatchFeedback.textContent = 'Repita a mesma senha no campo de confirmação.';
    } else if (matches) {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-success';
      refs.passwordMatchFeedback.textContent = 'As senhas coincidem.';
    } else {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-danger';
      refs.passwordMatchFeedback.textContent = 'As senhas não coincidem.';
    }

    return {
      ...result,
      matches
    };
  }

  async function ensureRecaptchaSiteKey() {
    const currentKey = String(window.AppConfig?.RECAPTCHA_SITE_KEY || '').trim();
    if (currentKey) return currentKey;

    try {
      const response = await fetch('/api/public-config', {
        method: 'GET',
        headers: { accept: 'application/json' }
      });

      const payload = await response.json().catch(() => ({}));
      const resolvedKey = String(payload?.recaptchaSiteKey || '').trim();
      if (!response.ok || !resolvedKey) return '';

      window.AppConfig.RECAPTCHA_SITE_KEY = resolvedKey;
      window.AppConfig.recaptchaConfigured = true;
      return resolvedKey;
    } catch {
      return '';
    }
  }

  function markRecaptchaLoaded() {
    if (!window.AppConfig?.recaptchaConfigured) {
      refs.registerBtn.disabled = true;
      setRecaptchaStatus('Configure RECAPTCHA_SITE_KEY na Vercel ou no frontend para ativar a proteção automática.', 'warning');
      return;
    }

    refs.registerBtn.disabled = false;
    setRecaptchaStatus('Proteção automática Google reCAPTCHA v3 ativa.', 'success');
  }

  function loadRecaptchaScript() {
    if (state.recaptchaScriptPromise) {
      return state.recaptchaScriptPromise;
    }

    state.recaptchaScriptPromise = ensureRecaptchaSiteKey().then((siteKey) => {
      if (!siteKey) {
        refs.registerBtn.disabled = true;
        setRecaptchaStatus('Configure RECAPTCHA_SITE_KEY na Vercel ou no frontend para ativar a proteção automática.', 'warning');
        return false;
      }

      if (window.grecaptcha?.ready) {
        state.recaptchaLoaded = true;
        markRecaptchaLoaded();
        return true;
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (!window.grecaptcha?.ready) {
            reject(new Error('O Google reCAPTCHA v3 não ficou disponível após o carregamento do script.'));
            return;
          }

          state.recaptchaLoaded = true;
          markRecaptchaLoaded();
          resolve(true);
        };
        script.onerror = () => reject(new Error('Falha ao carregar o script do Google reCAPTCHA v3.'));
        document.head.appendChild(script);
      });
    }).catch((error) => {
      setRecaptchaStatus(error.message, 'danger');
      throw error;
    });

    return state.recaptchaScriptPromise;
  }

  async function getRecaptchaToken() {
    const siteKey = await ensureRecaptchaSiteKey();
    if (!siteKey) {
      throw new Error('RECAPTCHA_SITE_KEY não configurada na Vercel ou no frontend.');
    }

    if (!state.recaptchaLoaded || !window.grecaptcha) {
      throw new Error('O Google reCAPTCHA v3 ainda não foi carregado.');
    }

    setRecaptchaStatus('Validando o risco da solicitação com Google reCAPTCHA v3...', 'secondary');

    const token = await new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(siteKey, { action: RECAPTCHA_ACTION })
          .then(resolve)
          .catch(() => reject(new Error('Falha ao executar o Google reCAPTCHA v3.')));
      });
    });

    if (!token) {
      throw new Error('Não foi possível gerar o token de segurança do Google reCAPTCHA v3.');
    }

    setRecaptchaStatus('Token do Google reCAPTCHA v3 gerado com sucesso.', 'success');
    return token;
  }

  async function validateSlugAvailability({ silent = false } = {}) {
    const validation = window.StoreUtils.validateStoreSlug(refs.slug.value);
    refs.slug.value = validation.slug;
    updatePublicUrlPreview();

    if (!validation.ok) {
      setSlugFeedback(validation.message, 'danger');
      return { ok: false, slug: validation.slug };
    }

    const nonce = ++state.slugCheckNonce;
    setSlugFeedback('Verificando disponibilidade...', 'secondary');

    try {
      const availability = await window.StoreUtils.checkSlugAvailability(validation.slug);
      if (nonce !== state.slugCheckNonce) return { ok: false, stale: true };

      if (!availability.available) {
        setSlugFeedback(availability.reason, 'danger');
        if (!silent) showStatus(availability.reason, 'warning');
        return { ok: false, slug: availability.slug };
      }

      setSlugFeedback('Slug disponível para cadastro.', 'success');
      return { ok: true, slug: availability.slug };
    } catch (err) {
      setSlugFeedback(`Erro ao verificar slug: ${err.message}`, 'danger');
      if (!silent) showStatus(`Erro ao validar slug: ${err.message}`, 'danger');
      return { ok: false, slug: validation.slug };
    }
  }

  async function registerUserViaApi({ email, password, recaptchaToken, recaptchaAction, metadata }) {
    const response = await fetch('/api/register-user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        recaptchaToken,
        recaptchaAction,
        metadata
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Não foi possível criar a conta com segurança.');
    }

    return payload;
  }

  async function onSubmit(event) {
    event.preventDefault();

    const companyName = refs.companyName.value.trim();
    const firstName = refs.firstName.value.trim();
    const lastName = refs.lastName.value.trim();
    const phone = refs.phone.value.trim();
    const photoUrl = refs.photoUrl.value.trim();
    const email = refs.email.value.trim();
    const password = refs.password.value;
    const passwordConfirm = refs.passwordConfirm.value;

    if (!firstName || !email || !password || !passwordConfirm) {
      showStatus('Preencha nome, email e senha.', 'warning');
      return;
    }

    const passwordValidation = updatePasswordValidation();
    if (!passwordValidation.ok) {
      showStatus('Escolha uma senha com pelo menos 8 caracteres, letras maiúsculas, minúsculas, números e caractere especial.', 'warning');
      return;
    }

    if (!passwordValidation.matches) {
      showStatus('As senhas não coincidem.', 'warning');
      return;
    }

    if (photoUrl && !isValidHttpUrl(photoUrl)) {
      showStatus('Informe uma URL válida para a foto ou deixe o campo vazio.', 'warning');
      return;
    }

    refs.slug.value = refs.slug.value.trim() || getSuggestedSlug();
    const slugResult = await validateSlugAvailability();
    if (!slugResult.ok) return;

    setLoading(true);
    refs.status.classList.add('d-none');

    try {
      const recaptchaToken = await getRecaptchaToken();
      await registerUserViaApi({
        email,
        password,
        recaptchaToken,
        recaptchaAction: RECAPTCHA_ACTION,
        metadata: {
          account_type: 'advertiser',
          company_name: companyName || null,
          first_name: firstName,
          last_name: lastName || null,
          phone: phone || null,
          photo_url: photoUrl || null,
          slug: slugResult.slug || null
        }
      });

      refs.form.reset();
      updatePasswordValidation();
      updatePublicUrlPreview();
      setSlugFeedback('Esse identificador será usado para montar sua URL pública inicial.', 'secondary');
      setRecaptchaStatus('Cadastro validado com Google reCAPTCHA v3. A proteção permanece ativa para a próxima tentativa.', 'secondary');
      showStatus(`Conta criada. Enviamos um email de ativação para ${email}.`, 'success');
    } catch (err) {
      setRecaptchaStatus('A validação com Google reCAPTCHA v3 falhou. Tente novamente em instantes.', 'warning');
      showStatus(`Erro ao criar conta: ${err.message}`, 'danger');
    } finally {
      setLoading(false);
    }
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    refs.phone.addEventListener('input', () => {
      refs.phone.value = window.StoreUtils.formatPhone(refs.phone.value);
    });

    refs.password.addEventListener('input', updatePasswordValidation);
    refs.passwordConfirm.addEventListener('input', updatePasswordValidation);

    refs.slug.addEventListener('input', () => {
      refs.slug.value = window.StoreUtils.normalizeStoreSlug(refs.slug.value);
      updatePublicUrlPreview();
      const validation = window.StoreUtils.validateStoreSlug(refs.slug.value);
      setSlugFeedback(validation.message, validation.ok ? 'secondary' : 'danger');
    });

    refs.slug.addEventListener('blur', async () => {
      if (!refs.slug.value.trim()) return;
      await validateSlugAvailability({ silent: true });
    });

    refs.firstName.addEventListener('blur', () => {
      if (refs.slug.value.trim()) return;
      refs.slug.value = getSuggestedSlug();
      updatePublicUrlPreview();
    });

    refs.companyName.addEventListener('input', updatePublicUrlPreview);
    refs.email.addEventListener('input', updatePublicUrlPreview);
    refs.form.addEventListener('submit', onSubmit);

    updatePasswordValidation();
    updatePublicUrlPreview();

    try {
      await loadRecaptchaScript();
    } catch (err) {
      showStatus(err.message, 'warning');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
