(() => {
  const RECAPTCHA_ACTION = 'register_submit';

  const state = {
    slugCheckNonce: 0,
    recaptchaLoaded: false,
    recaptchaScriptPromise: null
  };

  const refs = {
    form: document.getElementById('registerForm'),
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
    refs.recaptchaStatus.className = `d-block mt-3 text-${tone}`;
    refs.recaptchaStatus.textContent = message;
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
    const hasConfirm = refs.passwordConfirm.value.length > 0;

    if (!hasConfirm) {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-secondary';
      refs.passwordMatchFeedback.textContent = 'Repita a mesma senha no campo de confirmacao.';
    } else if (matches) {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-success';
      refs.passwordMatchFeedback.textContent = 'As senhas coincidem.';
    } else {
      refs.passwordMatchFeedback.className = 'd-block mt-2 text-danger';
      refs.passwordMatchFeedback.textContent = 'As senhas nao coincidem.';
    }

    return {
      ...result,
      matches
    };
  }

  function updatePublicUrlPreview() {
    const slug = window.StoreUtils.normalizeStoreSlug(refs.slug.value);
    refs.slug.value = slug;
    refs.signupPublicUrl.textContent = slug
      ? `${window.location.origin}/${slug}`
      : `${window.location.origin}/sua-loja`;
  }

  async function registerUserViaApi({ email, password, recaptchaToken, metadata }) {
    const response = await fetch('/api/register-user', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        recaptchaToken,
        metadata
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Nao foi possivel criar a conta com seguranca.');
    }

    return payload;
  }

  function markRecaptchaLoaded() {
    if (!window.AppConfig?.recaptchaConfigured) {
      refs.registerBtn.disabled = true;
      setRecaptchaStatus('Configure RECAPTCHA_SITE_KEY no frontend para liberar o cadastro seguro.', 'warning');
      return;
    }

    setRecaptchaStatus('Protecao Google reCAPTCHA v3 carregada e pronta para validar o cadastro.', 'secondary');
  }

  function loadRecaptchaScript() {
    if (!window.AppConfig?.recaptchaConfigured) {
      refs.registerBtn.disabled = true;
      setRecaptchaStatus('Configure RECAPTCHA_SITE_KEY no frontend para liberar o cadastro seguro.', 'warning');
      return Promise.resolve(false);
    }

    if (window.grecaptcha?.ready) {
      state.recaptchaLoaded = true;
      markRecaptchaLoaded();
      return Promise.resolve(true);
    }

    if (state.recaptchaScriptPromise) {
      return state.recaptchaScriptPromise;
    }

    state.recaptchaScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(window.AppConfig.RECAPTCHA_SITE_KEY)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (!window.grecaptcha?.ready) {
          reject(new Error('Google reCAPTCHA v3 nao ficou disponivel apos o carregamento do script.'));
          return;
        }

        state.recaptchaLoaded = true;
        markRecaptchaLoaded();
        resolve(true);
      };
      script.onerror = () => reject(new Error('Falha ao carregar o script do Google reCAPTCHA v3.'));
      document.head.appendChild(script);
    }).catch((error) => {
      setRecaptchaStatus(error.message, 'danger');
      throw error;
    });

    return state.recaptchaScriptPromise;
  }

  async function getRecaptchaToken() {
    if (!window.AppConfig?.recaptchaConfigured) {
      throw new Error('RECAPTCHA_SITE_KEY nao configurada no frontend.');
    }

    if (!state.recaptchaLoaded || !window.grecaptcha) {
      throw new Error('Google reCAPTCHA v3 ainda nao foi carregado.');
    }

    setRecaptchaStatus('Validando o risco da solicitacao com Google reCAPTCHA v3...', 'secondary');

    const token = await new Promise((resolve, reject) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha.execute(window.AppConfig.RECAPTCHA_SITE_KEY, { action: RECAPTCHA_ACTION })
          .then(resolve)
          .catch(() => reject(new Error('Falha ao executar o Google reCAPTCHA v3.')));
      });
    });

    if (!token) {
      throw new Error('Nao foi possivel gerar o token de seguranca do Google reCAPTCHA v3.');
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

      setSlugFeedback('Slug disponivel para cadastro.', 'success');
      return { ok: true, slug: availability.slug };
    } catch (err) {
      setSlugFeedback(`Erro ao verificar slug: ${err.message}`, 'danger');
      if (!silent) showStatus(`Erro ao validar slug: ${err.message}`, 'danger');
      return { ok: false, slug: validation.slug };
    }
  }

  async function onSubmit(event) {
    event.preventDefault();

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
      showStatus('Escolha uma senha com pelo menos 8 caracteres, letras maiusculas, minusculas, numeros e caractere especial.', 'warning');
      return;
    }

    if (!passwordValidation.matches) {
      showStatus('As senhas nao coincidem.', 'warning');
      return;
    }

    if (photoUrl && !isValidHttpUrl(photoUrl)) {
      showStatus('Informe uma URL valida para a foto ou deixe o campo vazio.', 'warning');
      return;
    }

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
          first_name: firstName,
          last_name: lastName || null,
          phone: phone || null,
          photo_url: photoUrl || null,
          slug: slugResult.slug
        }
      });

      refs.form.reset();
      updatePublicUrlPreview();
      updatePasswordValidation();
      setSlugFeedback('Esse endereco sera usado na sua pagina publica.', 'secondary');
      setRecaptchaStatus('Cadastro validado com Google reCAPTCHA v3. A protecao permanece ativa para a proxima tentativa.', 'secondary');

      const loginResult = await window.Auth.login(email, password);
      if (!loginResult?.error) {
        showStatus('Conta criada com sucesso. Redirecionando para o painel...', 'success');
        setTimeout(() => {
          window.location.href = 'admin.html';
        }, 700);
        return;
      }

      showStatus('Cadastro realizado. Agora entre com seu email e senha para acessar o painel.', 'success');
    } catch (err) {
      setRecaptchaStatus('A validacao com Google reCAPTCHA v3 falhou. Tente novamente em instantes.', 'warning');
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
      if (!refs.slug.value.trim()) {
        refs.slug.value = window.StoreUtils.normalizeStoreSlug(refs.firstName.value);
        updatePublicUrlPreview();
      }
    });

    refs.form.addEventListener('submit', onSubmit);
    updatePublicUrlPreview();
    updatePasswordValidation();
    try {
      await loadRecaptchaScript();
    } catch (err) {
      showStatus(err.message, 'warning');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
