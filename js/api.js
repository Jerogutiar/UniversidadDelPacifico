/**
 * ============================================
 * API CENTRALIZADA PARA SUPABASE
 * Sistema de Carnet Digital - Universidad del Pacífico
 * ============================================
 * 
 * DESCRIPCIÓN:
 * Módulo centralizado que maneja toda la comunicación con Supabase.
 * Todas las interacciones con la base de datos deben pasar por este
 * módulo para mantener consistencia y facilitar mantenimiento.
 * 
 * ESTRUCTURA:
 * - window.API.init() - Inicializa el cliente de Supabase
 * - window.API.Auth - Métodos de autenticación
 * - window.API.Students - Operaciones con estudiantes
 * - window.API.Staff - Operaciones con funcionarios
 * 
 * NOTAS:
 * - Usa variables de entorno para credenciales (configurar en producción)
 * - Implementa mecanismo de espera para inicialización asíncrona
 * - Todas las funciones retornan Promises
 * - Maneja errores de manera consistente
 * 
 * ============================================
 */

(function() {
  'use strict';

  const SUPABASE_CONFIG = {
    url: 'https://etkyirvkdkvnkgfuwjug.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0a3lpcnZrZGt2bmtnZnV3anVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzOTIxODAsImV4cCI6MjA3Nzk2ODE4MH0.jPR4QZ2Vu9iWFuwg2Prlcg1RCbmB66Wn4MTNWHS5evM'
  };

  let supabaseClient = null;
  let initializationPromise = null;

  /**
   * Inicializa el cliente de Supabase
   * @returns {Promise<Object>} Promise que resuelve con el cliente de Supabase
   */
  function initSupabase() {
    if (supabaseClient) {
      return Promise.resolve(supabaseClient);
    }

    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = new Promise((resolve, reject) => {
      const maxAttempts = 50;
      let attempts = 0;

      const tryInit = () => {
        attempts++;
        
        if (typeof window.supabase === 'undefined') {
          if (attempts >= maxAttempts) {
            reject(new Error('Supabase library no está disponible'));
            return;
          }
          setTimeout(tryInit, 100);
          return;
        }

        try {
          supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
          window.Supabase = supabaseClient;
          resolve(supabaseClient);
        } catch (error) {
          reject(error);
        }
      };

      tryInit();
    });

    return initializationPromise;
  }

  /**
   * Obtiene el cliente de Supabase (inicializa si es necesario)
   * @returns {Promise<Object>} Promise con el cliente de Supabase
   */
  async function getSupabase() {
    if (!supabaseClient) {
      await initSupabase();
    }
    return supabaseClient;
  }

  /**
   * Sanitiza texto eliminando caracteres peligrosos
   * @param {string} text - Texto a sanitizar
   * @returns {string} Texto sanitizado
   */
  function sanitize(text) {
    if (text == null) return '';
    return String(text).replace(/[<>]/g, '');
  }

  /**
   * Genera hash SHA-256 de un texto
   * @param {string} text - Texto a hashear
   * @returns {Promise<string>} Hash hexadecimal
   */
  async function sha256(text) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      // Método alternativo de hash
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0;
      }
      return String(Math.abs(hash));
    }
  }

  /**
   * API pública - Autenticación y sesiones
   */
  const AuthAPI = {
    /**
     * Login de estudiante
     * @param {string} code - Código del estudiante
     * @param {string} password - Contraseña
     * @returns {Promise<Object>} Datos del estudiante
     */
    async loginStudent(code, password) {
      const supabase = await getSupabase();
      const passwordHash = await sha256(password);
      const sanitizedCode = sanitize(code);

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('code', sanitizedCode)
        .eq('password_hash', passwordHash)
        .single();

      if (error || !data) {
        throw new Error('Credenciales inválidas');
      }

      if (data.active === false) {
        throw new Error('Tu carnet está inactivo. Por favor, contacta con un funcionario para reactivarlo.');
      }

      return data;
    },

    /**
     * Login de funcionario
     * @param {string} email - Email del funcionario
     * @param {string} password - Contraseña
     * @returns {Promise<Object>} Datos del funcionario
     */
    async loginStaff(email, password) {
      const supabase = await getSupabase();
      const passwordHash = await sha256(password);
      const sanitizedEmail = sanitize(email);

      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('email', sanitizedEmail)
        .eq('password_hash', passwordHash)
        .single();

      if (error || !data) {
        throw new Error('Credenciales inválidas');
      }

      return data;
    },

    /**
     * Cambia la contraseña de un estudiante
     * @param {string} code - Código del estudiante
     * @param {string} newPassword - Nueva contraseña
     * @returns {Promise<boolean>} true si se actualizó
     */
    async changeStudentPassword(code, newPassword) {
      const supabase = await getSupabase();
      const passwordHash = await sha256(newPassword);
      const sanitizedCode = sanitize(code);
      const now = Date.now();

      const { data: existing } = await supabase
        .from('students')
        .select('password_history')
        .eq('code', sanitizedCode)
        .single();

      if (!existing) {
        throw new Error('Estudiante no encontrado');
      }

      let history = existing.password_history ? JSON.parse(existing.password_history) : [];
      history.push({ changedAt: now, changedBy: 'self' });
      if (history.length > 10) history = history.slice(-10);

      const { error } = await supabase
        .from('students')
        .update({
          password_hash: passwordHash,
          first_login: false,
          password_history: JSON.stringify(history),
          updated_at: now
        })
        .eq('code', sanitizedCode);

      if (error) throw new Error(error.message);
      return true;
    }
  };

  /**
   * API pública - Estudiantes
   */
  const StudentsAPI = {
    /**
     * Obtiene un estudiante por código
     * @param {string} code - Código del estudiante
     * @returns {Promise<Object|null>} Datos del estudiante
     */
    async getByCode(code) {
      const supabase = await getSupabase();
      const sanitizedCode = sanitize(code);

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('code', sanitizedCode)
        .single();

      if (error) return null;
      return data;
    },

    /**
     * Lista todos los estudiantes
     * @returns {Promise<Array>} Lista de estudiantes
     */
    async listAll() {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('students')
        .select('code, cedula, name, lastname, program, expiry, sede, rh, photo, first_login, active, created_at, updated_at')
        .order('code');

      if (error) {
        console.error('Error al listar estudiantes:', error);
        return [];
      }
      return data || [];
    },

    /**
     * Crea o actualiza un estudiante
     * @param {Object} studentData - Datos del estudiante
     * @returns {Promise<Object>} Estudiante creado/actualizado
     */
    async createOrUpdate(studentData) {
      if (!studentData || !studentData.code) {
        throw new Error('Datos de estudiante inválidos');
      }

      const supabase = await getSupabase();
      const code = sanitize(studentData.code);
      const now = Date.now();

      // Consultar existencia del estudiante
      const { data: existing } = await supabase
        .from('students')
        .select('code, password_hash, first_login')
        .eq('code', code)
        .single();

      const passwordDefault = studentData.cedula || studentData.code;
      const passwordHash = existing ? existing.password_hash : await sha256(passwordDefault);

      const data = {
        code: code,
        cedula: sanitize(studentData.cedula || ''),
        name: sanitize(studentData.name || ''),
        lastname: sanitize(studentData.lastname || ''),
        program: sanitize(studentData.program || ''),
        expiry: sanitize(studentData.expiry || ''),
        sede: sanitize(studentData.sede || ''),
        rh: sanitize(studentData.rh || ''),
        photo: studentData.photo || null,
        password_hash: passwordHash,
        active: studentData.active !== undefined ? studentData.active : true,
        updated_at: now
      };

      if (existing) {
        // Actualizar
        const { error } = await supabase
          .from('students')
          .update(data)
          .eq('code', code);

        if (error) {
          throw new Error(error.message || 'Error al actualizar estudiante');
        }
      } else {
        // Crear
        data.first_login = true;
        data.active = true;
        data.created_at = now;

        const { error } = await supabase
          .from('students')
          .insert(data);

        if (error) {
          throw new Error(error.message || 'Error al crear estudiante');
        }
      }

      return await this.getByCode(code);
    },

    /**
     * Restablece la contraseña de un estudiante (solo staff)
     * @param {string} code - Código del estudiante
     * @param {string} newPassword - Nueva contraseña
     * @param {string} changedBy - Quien cambió la contraseña
     * @returns {Promise<boolean>} true si se actualizó
     */
    async resetPassword(code, newPassword, changedBy = 'staff') {
      const supabase = await getSupabase();
      const passwordHash = await sha256(newPassword);
      const sanitizedCode = sanitize(code);
      const now = Date.now();

      const { data: existing } = await supabase
        .from('students')
        .select('password_history')
        .eq('code', sanitizedCode)
        .single();

      if (!existing) {
        throw new Error('Estudiante no encontrado');
      }

      let history = existing.password_history ? JSON.parse(existing.password_history) : [];
      history.push({ changedAt: now, changedBy });
      if (history.length > 10) history = history.slice(-10);

      const { error } = await supabase
        .from('students')
        .update({
          password_hash: passwordHash,
          first_login: true,
          password_history: JSON.stringify(history),
          updated_at: now
        })
        .eq('code', sanitizedCode);

      if (error) throw new Error(error.message);
      return true;
    },

    /**
     * Elimina un estudiante
     * @param {string} code - Código del estudiante
     * @returns {Promise<boolean>} true si se eliminó
     */
    async delete(code) {
      const supabase = await getSupabase();
      const sanitizedCode = sanitize(code);

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('code', sanitizedCode);

      if (error) throw new Error(error.message);
      return true;
    }
  };

  /**
   * API pública - Funcionarios
   */
  const StaffAPI = {
    /**
     * Lista todos los funcionarios
     * @returns {Promise<Array>} Lista de funcionarios
     */
    async listAll() {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('staff')
        .select('id, name, email, created_at, updated_at')
        .order('name');

      if (error) {
        console.error('Error al listar funcionarios:', error);
        return [];
      }
      return data || [];
    },

    /**
     * Crea un nuevo funcionario (solo desde panel de staff)
     * @param {Object} staffData - Datos del funcionario
     * @returns {Promise<Object>} Funcionario creado
     */
    async create(staffData) {
      const supabase = await getSupabase();

      // Validar email institucional
      if (!staffData.email.includes('@udp.edu') && !staffData.email.includes('@unipacifico.edu.co')) {
        throw new Error('Email debe ser institucional (@udp.edu o @unipacifico.edu.co)');
      }

      // Consultar existencia del funcionario
      const { data: existing } = await supabase
        .from('staff')
        .select('id')
        .or(`email.eq.${staffData.email},id.eq.${staffData.id || staffData.email}`)
        .single();

      if (existing) {
        throw new Error('El funcionario ya existe');
      }

      const passwordHash = await sha256(staffData.password);
      const now = Date.now();

      const { data, error } = await supabase
        .from('staff')
        .insert({
          id: staffData.id || staffData.email,
          name: sanitize(staffData.name || ''),
          email: sanitize(staffData.email || ''),
          password_hash: passwordHash,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || 'Error al registrar');
      }

      return { id: data.id, name: data.name, email: data.email, role: 'staff' };
    },

    /**
     * Elimina un funcionario
     * @param {string} email - Email del funcionario
     * @returns {Promise<boolean>} true si se eliminó
     */
    async delete(email) {
      const supabase = await getSupabase();
      const sanitizedEmail = sanitize(email);

      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('email', sanitizedEmail);

      if (error) throw new Error(error.message);
      return true;
    },

    /**
     * Restablece la contraseña de un funcionario
     * @param {string} email - Email del funcionario
     * @param {string} newPassword - Nueva contraseña
     * @param {string} changedBy - Quien cambió la contraseña
     * @returns {Promise<boolean>} true si se actualizó
     */
    async resetPassword(email, newPassword, changedBy = 'staff') {
      const supabase = await getSupabase();
      const passwordHash = await sha256(newPassword);
      const sanitizedEmail = sanitize(email);
      const now = Date.now();

      const { data: existing } = await supabase
        .from('staff')
        .select('password_history, id')
        .eq('email', sanitizedEmail)
        .single();

      if (!existing) {
        throw new Error('Funcionario no encontrado');
      }

      let history = existing.password_history ? JSON.parse(existing.password_history) : [];
      history.push({ changedAt: now, changedBy });
      if (history.length > 10) history = history.slice(-10);

      const { error } = await supabase
        .from('staff')
        .update({
          password_hash: passwordHash,
          password_history: JSON.stringify(history),
          updated_at: now
        })
        .eq('id', existing.id);

      if (error) throw new Error(error.message);
      return true;
    }
  };

  // Inicializar automáticamente
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    initSupabase();
  }

  /**
   * API pública global
   * @namespace window.API
   */
  window.API = {
    Auth: AuthAPI,
    Students: StudentsAPI,
    Staff: StaffAPI,
    init: initSupabase,
    getClient: getSupabase
  };
})();

