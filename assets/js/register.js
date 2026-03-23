(() => {
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
    registerBtn: document.getElementById('registerBtn'),
    signupPublicUrl: document.getElementById('signupPublicUrl'),
    status: document.getElementById('statusMessage')
  };

  let slugCheckNonce = 0;

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

  function updatePublicUrlPreview() {
    const slug = window.StoreUtils.normalizeStoreSlug(refs.slug.value);
    refs.slug.value = slug;
    refs.signupPublicUrl.textContent = slug
      ? `${window.location.origin}/${slug}`
      : `${window.location.origin}/sua-loja`;
  }

  async function validateSlugAvailability({ silent = false } = {}) {
    const validation = window.StoreUtils.validateStoreSlug(refs.slug.value);
    refs.slug.value = validation.slug;
    updatePublicUrlPreview();

    if (!validation.ok) {
      setSlugFeedback(validation.message, 'danger');
      return { ok: false, slug: validation.slug };
    }

    const nonce = ++slugCheckNonce;
    setSlugFeedback('Verificando disponibilidade...', 'secondary');

    try {
      const availability = await window.StoreUtils.checkSlugAvailability(validation.slug);
      if (nonce !== slugCheckNonce) return { ok: false, stale: true };

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

    if (password.length < 6) {
      showStatus('A senha deve ter pelo menos 6 caracteres.', 'warning');
      return;
    }

    if (password !== passwordConfirm) {
      showStatus('As senhas não coincidem.', 'warning');
      return;
    }

    if (photoUrl && !isValidHttpUrl(photoUrl)) {
      showStatus('Informe uma URL válida para a foto ou deixe o campo vazio.', 'warning');
      return;
    }

    const slugResult = await validateSlugAvailability();
    if (!slugResult.ok) return;

    setLoading(true);
    refs.status.classList.add('d-none');

    try {
      const { data, error } = await window.Auth.register(email, password, {
        first_name: firstName,
        last_name: lastName || null,
        phone: phone || null,
        photo_url: photoUrl || null,
        slug: slugResult.slug
      });

      if (error) throw error;

      refs.form.reset();
      updatePublicUrlPreview();
      setSlugFeedback('Esse endereço será usado na sua página pública.', 'secondary');

      if (data?.session) {
        const loginResult = await window.Auth.login(email, password);
        if (!loginResult?.error) {
          showStatus('Conta criada com sucesso. Redirecionando para o painel...', 'success');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 700);
          return;
        }
      }

      showStatus('Cadastro realizado. Agora entre com seu email e senha para acessar o painel.', 'success');
    } catch (err) {
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
  }

  document.addEventListener('DOMContentLoaded', init);
})();
