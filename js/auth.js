/**
 * ============================================
 * GESTIÓN DE AUTENTICACIÓN Y SESIONES
 * Sistema de Carnet Digital - Universidad del Pacífico
 * ============================================
 * 
 * DESCRIPCIÓN:
 * Maneja la autenticación de usuarios y la gestión de sesiones
 * locales. Utiliza el módulo API para comunicación con Supabase.
 * 
 * FUNCIONALIDADES:
 * - Login de estudiantes y funcionarios
 * - Gestión de sesiones locales
 * - Cambio de contraseñas
 * - Logout
 * - Validación de sesiones
 * 
 * NOTAS:
 * - Las sesiones se almacenan en localStorage
 * - Las contraseñas se hashean con SHA-256 antes de enviarse
 * - El sistema valida automáticamente las sesiones al cargar
 * 
 * ============================================
 */

(function() {
  'use strict';

  const SESSION_KEY = 'auth_session';

  /**
   * Genera un ID de sesión único
   * @returns {string} ID de sesión
   */
  function generateSessionId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Obtiene la sesión actual
   * @returns {Object|null} Datos de la sesión
   */
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.expiresAt && session.expiresAt > Date.now()) {
          return session;
        }
        clearSession();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Guarda la sesión
   * @param {Object} sessionData - Datos de la sesión
   */
  function setSession(sessionData) {
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 días
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ...sessionData,
      expiresAt
    }));
  }

  /**
   * Limpia la sesión
   */
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /**
   * Login de estudiante
   * @param {string} code - Código del estudiante
   * @param {string} password - Contraseña
   * @returns {Promise<Object>} Datos del usuario
   */
  async function loginStudent(code, password) {
    // Esperar carga de módulo API
    let attempts = 0;
    while (!window.API || !window.API.Auth || !window.API.Auth.loginStudent) {
      if (attempts++ > 50) {
        throw new Error('API no está disponible. Por favor, recarga la página.');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const student = await window.API.Auth.loginStudent(code, password);
    
    const sessionId = generateSessionId();
    setSession({
      sessionId,
      role: 'student',
      code: student.code,
      name: student.name,
      firstLogin: student.first_login || false,
      ts: Date.now()
    });

    return {
      role: 'student',
      user: {
        code: student.code,
        name: student.name,
        lastname: student.lastname,
        firstLogin: student.first_login || false,
        active: student.active !== false,
        role: 'student'
      }
    };
  }

  /**
   * Login de funcionario
   * @param {string} email - Email del funcionario
   * @param {string} password - Contraseña
   * @returns {Promise<Object>} Datos del usuario
   */
  async function loginStaff(email, password) {
    // Esperar carga de módulo API
    let attempts = 0;
    while (!window.API || !window.API.Auth || !window.API.Auth.loginStaff) {
      if (attempts++ > 50) {
        throw new Error('API no está disponible. Por favor, recarga la página.');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const staff = await window.API.Auth.loginStaff(email, password);
    
    const sessionId = generateSessionId();
    setSession({
      sessionId,
      role: 'staff',
      id: staff.id,
      email: staff.email,
      name: staff.name,
      ts: Date.now()
    });

    return {
      role: 'staff',
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: 'staff'
      }
    };
  }

  /**
   * Logout
   * @returns {Promise<void>}
   */
  async function logout() {
    clearSession();
  }

  /**
   * Cambia la contraseña de un estudiante
   * @param {string} code - Código del estudiante
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<boolean>}
   */
  async function changePassword(code, newPassword) {
    if (!window.API) {
      throw new Error('API no está disponible');
    }
    return await window.API.Auth.changeStudentPassword(code, newPassword);
  }

  /**
   * API pública
   * @namespace window.Auth
   */
  window.Auth = {
    getSession,
    setSession,
    clearSession,
    loginStudent,
    loginStaff,
    logout,
    changePassword
  };
})();
