/**
 * ============================================
 * SISTEMA DE MODALES PERSONALIZADOS
 * Sistema de Carnet Digital - Universidad del Pacífico
 * ============================================
 * 
 * DESCRIPCIÓN:
 * Proporciona un sistema de modales personalizados para mostrar
 * mensajes de éxito, error, advertencia, información y confirmación.
 * Los modales se adaptan automáticamente al tema claro/oscuro.
 * 
 * FUNCIONALIDADES:
 * - Modales de éxito (success)
 * - Modales de error (error)
 * - Modales de advertencia (warning)
 * - Modales de información (info)
 * - Modales de confirmación (confirm)
 * 
 * USO:
 * - window.showModal.success(title, message)
 * - window.showModal.error(title, message)
 * - window.showModal.warning(title, message)
 * - window.showModal.info(title, message)
 * - window.showModal.confirm(title, message) -> Promise<boolean>
 * 
 * ============================================
 */

(function() {
  'use strict';

  /**
   * Crear contenedor de modales si no existe
   * @returns {void}
   */
  function createModalContainer() {
    if (document.getElementById('customModalContainer')) {
      return;
    }

    const container = document.createElement('div');
    container.id = 'customModalContainer';
    container.className = 'custom-modal-container';
    document.body.appendChild(container);
  }

  /**
   * Crear modal personalizado
   * @param {string} type - Tipo de modal: 'success', 'error', 'warning', 'info'
   * @param {string} title - Título del modal
   * @param {string} message - Mensaje del modal
   * @param {Object} options - Opciones adicionales
   * @param {string} options.buttonText - Texto del botón (default: 'Aceptar')
   * @param {Function} options.onConfirm - Callback al confirmar
   * @returns {HTMLElement} Elemento del modal creado
   */
  function createModal(type, title, message, options = {}) {
    createModalContainer();

    const container = document.getElementById('customModalContainer');
    const modalId = 'modal_' + Date.now();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = `custom-modal ${type}`;
    
    // Iconos SVG profesionales en lugar de emojis
    const iconMap = {
      success: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      </svg>`,
      error: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>`,
      warning: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      </svg>`,
      info: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`
    };

    const icon = iconMap[type] || iconMap.info;

    // Detectar ruta base según la ubicación del archivo
    const basePath = window.location.pathname.includes('/html/') ? '../' : '';
    
    modal.innerHTML = `
      <div class="custom-modal-overlay"></div>
      <div class="custom-modal-content">
        <div class="custom-modal-header">
          <div class="custom-modal-logo">
            <img src="${basePath}assets/images/favicon.ico" alt="Logo Universidad del Pacífico" onerror="this.style.display='none'" />
          </div>
          <button class="custom-modal-close" aria-label="Cerrar">&times;</button>
        </div>
        <div class="custom-modal-body">
          <div class="custom-modal-icon ${type}">
            ${icon}
          </div>
          <h3 class="custom-modal-title">${title}</h3>
          <div class="custom-modal-message">${message}</div>
        </div>
        <div class="custom-modal-footer">
          <button class="btn btn-primary custom-modal-btn">${options.buttonText || 'Aceptar'}</button>
        </div>
      </div>
    `;

    container.appendChild(modal);

    // Animar entrada (usar requestAnimationFrame para mejor rendimiento)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.classList.add('active');
      });
    });

    // Cerrar modal
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.remove();
      }, 100);
    };

    modal.querySelector('.custom-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.custom-modal-overlay').addEventListener('click', closeModal);
    modal.querySelector('.custom-modal-btn').addEventListener('click', () => {
      if (options.onConfirm) {
        options.onConfirm();
      }
      closeModal();
    });

    // Cerrar con ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    return modal;
  }

  /**
   * API pública del sistema de modales
   * @namespace window.showModal
   */
  window.showModal = {
    /**
     * Mostrar modal de éxito
     * @param {string} title - Título del modal
     * @param {string} message - Mensaje del modal
     * @param {Object} options - Opciones adicionales
     * @returns {HTMLElement} Elemento del modal
     */
    success: (title, message, options) => createModal('success', title, message, options),
    
    /**
     * Mostrar modal de error
     * @param {string} title - Título del modal
     * @param {string} message - Mensaje del modal
     * @param {Object} options - Opciones adicionales
     * @returns {HTMLElement} Elemento del modal
     */
    error: (title, message, options) => createModal('error', title, message, options),
    
    /**
     * Mostrar modal de advertencia
     * @param {string} title - Título del modal
     * @param {string} message - Mensaje del modal
     * @param {Object} options - Opciones adicionales
     * @returns {HTMLElement} Elemento del modal
     */
    warning: (title, message, options) => createModal('warning', title, message, options),
    
    /**
     * Mostrar modal de información
     * @param {string} title - Título del modal
     * @param {string} message - Mensaje del modal
     * @param {Object} options - Opciones adicionales
     * @returns {HTMLElement} Elemento del modal
     */
    info: (title, message, options) => createModal('info', title, message, options),
    
    /**
     * Mostrar modal de confirmación (retorna Promise)
     * @param {string} title - Título del modal
     * @param {string} message - Mensaje del modal
     * @param {Object} options - Opciones adicionales
     * @param {string} options.cancelText - Texto del botón cancelar (default: 'Cancelar')
     * @param {string} options.confirmText - Texto del botón confirmar (default: 'Confirmar')
     * @returns {Promise<boolean>} Promise que resuelve a true si se confirma, false si se cancela
     */
    confirm: (title, message, options = {}) => {
      return new Promise((resolve) => {
        createModalContainer();
        const container = document.getElementById('customModalContainer');
        const modalId = 'modal_' + Date.now();

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'custom-modal confirm';
        
        // Detectar ruta base según la ubicación del archivo
        const basePath = window.location.pathname.includes('/html/') ? '../' : '';
        
        modal.innerHTML = `
          <div class="custom-modal-overlay"></div>
          <div class="custom-modal-content">
            <div class="custom-modal-header">
              <div class="custom-modal-logo">
                <img src="${basePath}assets/images/favicon.ico" alt="Logo Universidad del Pacífico" onerror="this.style.display='none'" />
              </div>
              <button class="custom-modal-close" aria-label="Cerrar">&times;</button>
            </div>
            <div class="custom-modal-body">
              <div class="custom-modal-icon warning">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                </svg>
              </div>
              <h3 class="custom-modal-title">${title}</h3>
              <div class="custom-modal-message">${message}</div>
            </div>
            <div class="custom-modal-footer">
              <button class="btn btn-secondary custom-modal-btn-cancel">${options.cancelText || 'Cancelar'}</button>
              <button class="btn btn-primary custom-modal-btn-confirm">${options.confirmText || 'Confirmar'}</button>
            </div>
          </div>
        `;

        container.appendChild(modal);

        // Animar entrada (usar requestAnimationFrame para mejor rendimiento)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            modal.classList.add('active');
          });
        });

        const closeModal = () => {
          modal.classList.remove('active');
          setTimeout(() => {
            modal.remove();
          }, 100);
        };

        modal.querySelector('.custom-modal-close').addEventListener('click', () => {
          resolve(false);
          closeModal();
        });
        modal.querySelector('.custom-modal-overlay').addEventListener('click', () => {
          resolve(false);
          closeModal();
        });
        modal.querySelector('.custom-modal-btn-cancel').addEventListener('click', () => {
          resolve(false);
          closeModal();
        });
        modal.querySelector('.custom-modal-btn-confirm').addEventListener('click', () => {
          resolve(true);
          closeModal();
        });
      });
    }
  };
})();

