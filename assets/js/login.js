(() => {
  const refs = {
    tabLogin: document.getElementById('tabLogin'),
    tabRegister: document.getElementById('tabRegister'),
    loginSection: document.getElementById('loginSection'),
    registerSection: document.getElementById('registerSection'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),

    email: document.getElementById('email'),
    password: document.getElementById('password'),
    registerEmail: document.getElementById('registerEmail'),
    registerPassword: document.getElementById('registerPassword'),
    registerPasswordConfirm: document.getElementById('registerPasswordConfirm'),

    status: document.getElementById('statusMessage'),
    loginBtn: document.getElementById('loginBtn'),
    registerBtn: document.getElementById('registerBtn')
  };

  function showStatus(message, type = 'danger') {
    refs.status.className = `alert alert-${type}`;
    refs.status.textContent = message;
    refs.status.classList.remove('d-none');
  }

  function hideStatus() {
    refs.status.classList.add('d-none');
  }

  function setLoginLoading(isLoading) {
    refs.loginBtn.disabled = isLoading;
    refs.loginBtn.textContent = isLoading ? 'Entrando...' : 'Entrar';
  }

  function setRegisterLoading(isLoading) {
    refs.registerBtn.disabled = isLoading;
    refs.registerBtn.textContent = isLoading ? 'Criando conta...' : 'Criar conta';
  }

  function setTab(mode) {
    const isLogin = mode === 'login';

    refs.loginSection.classList.toggle('d-none', !isLogin);
    refs.registerSection.classList.toggle('d-none', isLogin);
    refs.tabLogin.className = isLogin ? 'btn btn-primary' : 'btn btn-outline-primary';
    refs.tabRegister.className = isLogin ? 'btn btn-outline-primary' : 'btn btn-primary';
    hideStatus();
  }

  async function init() {
    if (window.AppConfig?.missingConfig) {
      showStatus('Configure SUPABASE_URL e SUPABASE_ANON_KEY em assets/js/config.js.', 'warning');
      return;
    }

    try {
      await window.Auth.redirectIfAuthenticated('admin.html');
    } catch (err) {
      showStatus(err.message || 'Erro ao validar sessao.');
    }

    refs.tabLogin.addEventListener('click', () => setTab('login'));
    refs.tabRegister.addEventListener('click', () => setTab('register'));
    refs.loginForm.addEventListener('submit', onLoginSubmit);
    refs.registerForm.addEventListener('submit', onRegisterSubmit);
  }

  async function onLoginSubmit(event) {
    event.preventDefault();

    const email = refs.email.value.trim();
    const password = refs.password.value;

    if (!email || !password) {
      showStatus('Informe email e senha.');
      return;
    }

    setLoginLoading(true);
    hideStatus();

    try {
      const { error } = await window.Auth.login(email, password);

      if (error) {
        showStatus(`Falha no login: ${error.message}`);
        return;
      }

      showStatus('Login realizado com sucesso. Redirecionando...', 'success');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 500);
    } catch (err) {
      showStatus(err.message || 'Erro inesperado durante login.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function onRegisterSubmit(event) {
    event.preventDefault();

    const email = refs.registerEmail.value.trim();
    const password = refs.registerPassword.value;
    const confirmPassword = refs.registerPasswordConfirm.value;

    if (!email || !password || !confirmPassword) {
      showStatus('Preencha email, senha e confirmacao de senha.');
      return;
    }

    if (password.length < 6) {
      showStatus('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      showStatus('As senhas nao coincidem.');
      return;
    }

    setRegisterLoading(true);
    hideStatus();

    try {
      const { data, error } = await window.Auth.register(email, password);

      if (error) {
        showStatus(`Falha no cadastro: ${error.message}`);
        return;
      }

      const needsEmailConfirmation = data?.user && !data?.session;

      if (needsEmailConfirmation) {
        refs.email.value = email;
        refs.password.value = '';
        refs.registerForm.reset();
        setTab('login');
        showStatus('Conta criada. Verifique seu email para confirmar o cadastro antes de entrar.', 'success');
        return;
      }

      showStatus('Conta criada com sucesso. Redirecionando...', 'success');
      setTimeout(() => {
        window.location.href = 'admin.html';
      }, 700);
    } catch (err) {
      showStatus(err.message || 'Erro inesperado durante cadastro.');
    } finally {
      setRegisterLoading(false);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
