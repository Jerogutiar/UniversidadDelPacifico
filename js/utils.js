/**
 * ============================================
 * UTILIDADES COMPARTIDAS
 * Sistema de Carnet Digital - Universidad del Pacífico
 * ============================================
 * 
 * DESCRIPCIÓN:
 * Módulo de utilidades compartidas que proporciona funciones
 * de sanitización, validación, manejo de fechas, procesamiento
 * de imágenes y toggle de visibilidad de contraseñas.
 * 
 * FUNCIONALIDADES:
 * - Sanitización de texto para prevenir XSS
 * - Validación de cédulas y códigos de estudiante
 * - Formateo de fechas en español
 * - Redimensionamiento y compresión de imágenes
 * - Toggle de visibilidad de contraseñas
 * 
 * ============================================
 */

(function() {
  'use strict';

  /**
   * Sanitiza texto eliminando caracteres potencialmente peligrosos
   * @param {string|null|undefined} text - Texto a sanitizar
   * @returns {string} Texto sanitizado
   */
  function sanitize(text) {
    if (text == null) return '';
    return String(text).replace(/[<>]/g, '');
  }

  /**
   * Valida formato de cédula colombiana
   * @param {string} cedula - Cédula a validar
   * @returns {boolean} true si la cédula tiene entre 8 y 10 dígitos numéricos
   */
  function validateCedula(cedula) {
    return /^\d{8,10}$/.test(String(cedula).trim());
  }

  /**
   * Valida formato de código de estudiante
   * @param {string} code - Código a validar
   * @returns {boolean} true si el código tiene entre 6 y 12 dígitos numéricos
   */
  function validateStudentCode(code) {
    return /^\d{6,12}$/.test(String(code).trim());
  }

  /**
   * Formatea fecha en formato YYYY-MM-DD a formato español legible
   * @param {string} dateString - Fecha en formato YYYY-MM-DD o formato español
   * @returns {string} Fecha formateada en español (ej: "15 ENERO 2025")
   */
  function formatDateToSpanish(dateString) {
    if (!dateString) return '';
    if (dateString.includes(' ')) return dateString;
    try {
      const date = new Date(dateString + 'T00:00:00');
      const months = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    } catch (_) {
      return dateString;
    }
  }

  /**
   * Verifica si una fecha está en el pasado
   * @param {string} ymd - Fecha en formato YYYY-MM-DD
   * @returns {boolean} true si la fecha es anterior a hoy
   */
  function isPastDateYmd(ymd) {
    if (!ymd) return false;
    const today = new Date();
    const d = new Date(ymd + 'T00:00:00');
    return d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  /**
   * Redimensiona imagen a un tamaño máximo manteniendo proporción
   * @param {File} file - Archivo de imagen a redimensionar
   * @param {number} maxW - Ancho máximo en píxeles (default: 400)
   * @param {number} maxH - Alto máximo en píxeles (default: 500)
   * @param {number} quality - Calidad de compresión JPEG 0-1 (default: 0.9)
   * @returns {Promise<string>} Promise que resuelve con la imagen en formato Base64
   * @throws {Error} Si el archivo no es una imagen válida
   */
  function resizeImage(file, maxW = 400, maxH = 500, quality = 0.9) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        return reject(new Error('Archivo inválido'));
      }
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          let { width, height } = img;
          const ratio = Math.min(maxW / width, maxH / height, 1);
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(width * ratio);
          canvas.height = Math.round(height * ratio);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Inicializa toggle de visibilidad de contraseña para un campo específico
   * Crea un botón que permite mostrar/ocultar la contraseña sin afectar el tamaño del texto
   * @param {HTMLElement} inputElement - Campo de entrada de tipo password
   * @returns {void}
   */
  function initPasswordToggle(inputElement) {
    if (!inputElement || inputElement.type !== 'password') {
      return;
    }

    if (inputElement.parentElement.querySelector('.password-toggle-btn')) {
      return;
    }

    const computedStyle = window.getComputedStyle(inputElement);
    const originalFontSize = computedStyle.fontSize;
    const originalFontFamily = computedStyle.fontFamily;
    const originalLineHeight = computedStyle.lineHeight;
    const originalLetterSpacing = computedStyle.letterSpacing;

    const wrapper = document.createElement('div');
    wrapper.className = 'password-input-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';

    inputElement.parentNode.insertBefore(wrapper, inputElement);
    wrapper.appendChild(inputElement);

    inputElement.style.fontSize = originalFontSize;
    inputElement.style.fontFamily = originalFontFamily;
    inputElement.style.lineHeight = originalLineHeight;
    inputElement.style.letterSpacing = originalLetterSpacing;
    inputElement.style.fontWeight = computedStyle.fontWeight;
    inputElement.style.fontStyle = computedStyle.fontStyle;

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'password-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'Mostrar contraseña');
    
    const eyeOpenIcon = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon eye-open">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    
    const eyeClosedIcon = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon eye-closed">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
    
    toggleBtn.innerHTML = eyeOpenIcon;
    wrapper.appendChild(toggleBtn);

    function togglePassword() {
      if (inputElement.type === 'password') {
        inputElement.type = 'text';
        inputElement.style.fontSize = originalFontSize;
        inputElement.style.fontFamily = originalFontFamily;
        inputElement.style.lineHeight = originalLineHeight;
        inputElement.style.letterSpacing = originalLetterSpacing;
        toggleBtn.setAttribute('aria-label', 'Ocultar contraseña');
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = eyeClosedIcon;
      } else {
        inputElement.type = 'password';
        inputElement.style.fontSize = originalFontSize;
        inputElement.style.fontFamily = originalFontFamily;
        inputElement.style.lineHeight = originalLineHeight;
        inputElement.style.letterSpacing = originalLetterSpacing;
        toggleBtn.setAttribute('aria-label', 'Mostrar contraseña');
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = eyeOpenIcon;
      }
    }

    toggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      togglePassword();
    });

    toggleBtn.addEventListener('mousedown', function(e) {
      e.preventDefault();
    });
  }

  /**
   * Inicializa todos los campos de contraseña en la página actual
   * Busca todos los inputs de tipo password y les agrega el toggle de visibilidad
   * @returns {void}
   */
  function initAllPasswordToggles() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
      initPasswordToggle(input);
    });
  }

  /**
   * Inicialización automática de toggles de contraseña
   * Se ejecuta cuando el DOM está listo y después de un pequeño delay
   * para asegurar que todos los inputs estén completamente renderizados
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initAllPasswordToggles, 100);
    });
  } else {
    setTimeout(initAllPasswordToggles, 100);
  }

  // Inicialización adicional para inputs dinámicos
  setTimeout(initAllPasswordToggles, 300);

  /**
   * API pública de utilidades
   * Disponible globalmente como window.Utils
   * @namespace window.Utils
   */
  window.Utils = {
    sanitize,
    validateCedula,
    validateStudentCode,
    formatDateToSpanish,
    isPastDateYmd,
    resizeImage
  };

  /**
   * Exportar funciones de password toggle para uso manual si es necesario
   * @function window.initPasswordToggle
   * @function window.initAllPasswordToggles
   */
  window.initPasswordToggle = initPasswordToggle;
  window.initAllPasswordToggles = initAllPasswordToggles;
})();
