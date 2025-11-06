/**
 * @fileoverview Lógica de la página de inicio de sesión
 * @module login
 * 
 * DESCRIPCIÓN:
 * Maneja la lógica de la página de login, incluyendo el selector
 * de rol (Estudiante/Funcionario), validación de formularios,
 * y redirección según el tipo de usuario.
 * 
 * FUNCIONALIDADES:
 * - Selector de rol (Estudiante/Funcionario)
 * - Validación de credenciales
 * - Manejo de primer acceso (contraseña = cédula)
 * - Toggle de tema claro/oscuro
 * - Redirección según rol del usuario
 * 
 * ============================================
 */

(function() {
  'use strict';
  
  // Variables de estado
  let role = 'student';
  const tabStudent = document.getElementById('tabStudent');
  const tabStaff = document.getElementById('tabStaff');
  const idInput = document.getElementById('loginId');
  const idLabel = document.getElementById('loginIdLabel');
  const idHelp = document.getElementById('loginIdHelp');
  const pwdHelp = document.getElementById('loginPwdHelp');
  const form = document.getElementById('loginForm');
  const themeToggle = document.getElementById('themeToggle');

  /**
   * Inicializa el toggle de tema
   */
  function initThemeToggle() {
    // Recuperar tema desde localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }

  /**
   * Cambiar el rol activo (Estudiante/Funcionario)
   * @param {string} newRole - 'student' o 'staff'
   */
  function setRole(newRole) {
    role = newRole;
    const isStudent = role === 'student';
    tabStudent.classList.toggle('active', isStudent);
    tabStaff.classList.toggle('active', !isStudent);
    tabStudent.setAttribute('aria-selected', String(isStudent));
    tabStaff.setAttribute('aria-selected', String(!isStudent));
    
    if (isStudent) {
      idLabel.textContent = 'Código de Estudiante';
      idInput.placeholder = 'Ej: 12300298';
      idHelp.textContent = 'Usa tu código asignado en el carnet';
      pwdHelp.textContent = 'Primer acceso: tu contraseña es tu cédula. Si la olvidas, contacta a un funcionario.';
    } else {
      idLabel.textContent = 'Email del Funcionario';
      idInput.placeholder = 'usuario@udp.edu';
      idHelp.textContent = 'Usa tu email institucional';
      pwdHelp.textContent = 'Contraseña definida al registrarte';
    }
    idInput.focus();
  }
  
  /**
   * Espera a que la API y Auth estén disponibles
   */
  async function waitForAPI() {
    const maxAttempts = 50;
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const check = () => {
        attempts++;
        // Validar disponibilidad de módulos API y Auth
        if (window.API && window.API.Auth && window.Auth && window.Auth.loginStudent && window.Auth.loginStaff) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('API o Auth no disponible. Verifica que todos los scripts estén cargados.'));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
  
  // Inicializar
  initThemeToggle();
  
  // Toggle de visibilidad de contraseña
  const passwordInput = document.getElementById('loginPassword');
  const passwordWrapper = passwordInput.parentElement;
  
  // Crear botón de toggle
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'password-toggle-btn';
  toggleBtn.setAttribute('aria-label', 'Mostrar/ocultar contraseña');
  toggleBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;
  
  // Wrapper para el input
  const wrapper = document.createElement('div');
  wrapper.className = 'password-input-wrapper';
  passwordInput.parentNode.insertBefore(wrapper, passwordInput);
  wrapper.appendChild(passwordInput);
  wrapper.appendChild(toggleBtn);
  
  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    toggleBtn.classList.toggle('active', type === 'text');
    toggleBtn.innerHTML = type === 'password' ? `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    ` : `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
  });
  
  // Event listeners para cambio de rol
  tabStudent.addEventListener('click', () => setRole('student'));
  tabStaff.addEventListener('click', () => setRole('staff'));
  
  // Verificar hash en URL para activar tab correcto
  if (window.location.hash === '#staff') {
    setRole('staff');
  } else {
    setRole('student');
  }

  /**
   * Manejar envío del formulario de login
   */
  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const id = idInput.value.trim();
    const pwd = document.getElementById('loginPassword').value.trim();
    
    if (!id || !pwd) {
      window.showModal && window.showModal.warning('Campos requeridos', 'Completa todos los campos.');
      return;
    }

    // Mostrar loading
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Ingresando...';

    try {
      // Esperar carga de módulos API y Auth
      await waitForAPI();
      
      // Validar funciones de autenticación disponibles
      if (!window.Auth || typeof window.Auth.loginStudent !== 'function' || typeof window.Auth.loginStaff !== 'function') {
        throw new Error('Módulo de autenticación no está completamente cargado. Por favor, recarga la página.');
      }
      
      let res;
      if (role === 'student') {
        res = await window.Auth.loginStudent(id, pwd);
      } else {
        res = await window.Auth.loginStaff(id, pwd);
      }

      // Redirigir según el rol y estado
      if (res.role === 'staff') {
        window.location.href = 'html/staff.html';
      } else {
        if (res.user.firstLogin) {
          window.location.href = 'html/student.html#first';
        } else {
          window.location.href = 'html/student.html';
        }
      }
    } catch (err) {
      // Detectar error de carnet inactivo
      if (err.message && err.message.includes('inactivo')) {
        window.showModal && window.showModal.error(
          'Carnet Inactivo', 
          'Tu carnet está inactivo. Por favor, contacta con un funcionario para reactivarlo.'
        );
      } else {
        window.showModal && window.showModal.error('Acceso denegado', err.message || 'Credenciales inválidas');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

})();
