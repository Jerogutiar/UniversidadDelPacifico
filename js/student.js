/**
 * @fileoverview Lógica de la página del estudiante
 * @module student
 * 
 * DESCRIPCIÓN:
 * Maneja la lógica del panel del estudiante, incluyendo la
 * visualización del carnet digital, cambio de contraseña
 * (en primer acceso) y descarga del PDF del carnet.
 * 
 * FUNCIONALIDADES:
 * - Visualización del carnet digital (frente y reverso)
 * - Cambio de contraseña (solo en primer acceso)
 * - Descarga del carnet en formato PDF
 * - Toggle de tema claro/oscuro
 * - Navegación entre secciones
 * 
 * ============================================
 */

(async function() {
  'use strict';
  
  /**
   * Espera a que todas las dependencias estén cargadas
   */
  async function waitForDependencies() {
    const maxAttempts = 50;
    let attempts = 0;
    
    return new Promise((resolve) => {
      const check = () => {
        attempts++;
        if (window.API && window.API.Students && window.Auth && window.showModal && window.Utils && window.generateCard) {
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('Timeout esperando dependencias');
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
  
  await waitForDependencies();
  
  // Verificar sesión
  const session = window.Auth.getSession();
  if (!session || session.role !== 'student') {
    window.location.href = '../index.html';
    return;
  }

  // Inicializar API
  await window.API.init();
  
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', async function(e) {
    e.preventDefault();
    await window.Auth.logout();
    window.location.href = '../index.html';
  });

  // Inicializar tema
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    document.getElementById('themeToggle').addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    });
  }
  initTheme();

  // Inicializar menú móvil
  function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (toggle && sidebar) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
      });
      
      // Cerrar al hacer click fuera o en el overlay
      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
          // Detectar clicks fuera del sidebar
          if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
            sidebar.classList.remove('open');
          }
        }
      });

      // Observar cambios de estado del sidebar para gestionar overlay
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            const isOpen = sidebar.classList.contains('open');
            let overlay = document.querySelector('.sidebar-overlay');
            
            if (isOpen && !overlay && window.innerWidth <= 1024) {
              overlay = document.createElement('div');
              overlay.className = 'sidebar-overlay';
              overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); z-index: 999;';
              overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.remove();
              });
              document.body.appendChild(overlay);
            } else if (!isOpen && overlay) {
              overlay.remove();
            }
          }
        });
      });

      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }
  }
  initMobileMenu();

  // Inicializar navegación
  function initNavigation() {
    const navItems = document.querySelectorAll('.dashboard-nav-item');
    const titles = {
      card: 'Mi Carnet Digital',
      download: 'Descargar PDF'
    };
    
    navItems.forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');
        
        // Actualizar título del header
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle && titles[section]) {
          pageTitle.textContent = titles[section];
        }
        
        // Actualizar nav activo
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Mostrar/ocultar secciones
        if (section === 'card') {
          document.getElementById('cardSection').style.display = 'block';
          document.getElementById('firstLoginSection').style.display = 'none';
        } else if (section === 'download') {
          const frontNode = document.getElementById('cardFront');
          const backNode = document.getElementById('cardBack');
          
          if (frontNode && backNode) {
            downloadPdfDirectly();
            setTimeout(() => {
              document.getElementById('cardSection').style.display = 'block';
              document.getElementById('firstLoginSection').style.display = 'none';
              navItems[0].classList.add('active');
              item.classList.remove('active');
              if (pageTitle) pageTitle.textContent = titles.card;
            }, 500);
          } else {
            window.showModal && window.showModal.warning('Carnet no cargado', 'Primero debes ver tu carnet.');
            navItems[0].classList.add('active');
            item.classList.remove('active');
            if (pageTitle) pageTitle.textContent = titles.card;
          }
        }
      });
    });
  }
  initNavigation();

  /**
   * Descarga el PDF directamente sin sección extra
   */
  async function downloadPdfDirectly() {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      window.showModal && window.showModal.error('Error', 'Las librerías necesarias para generar el PDF no están disponibles.');
      return;
    }

    const frontNode = document.getElementById('cardFront');
    const backNode = document.getElementById('cardBack');

    if (!frontNode || !backNode) {
      window.showModal && window.showModal.error('Error', 'No se encontraron los elementos del carnet.');
      return;
    }

    try {
      const scale = 2;
      const opts = {
        scale: scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true
      };

      // Renderizar ambos lados
      const canvasFront = await html2canvas(frontNode, opts);
      const canvasBack = await html2canvas(backNode, opts);

      const imgFront = canvasFront.toDataURL('image/png', 1.0);
      const imgBack = canvasBack.toDataURL('image/png', 1.0);

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      });
      
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 20;
      const gap = 15;
      const availableW = pageW - (margin * 2) - gap;
      const cardW = availableW / 2;

      // Calcular escalas
      const scaleFront = Math.min(
        cardW / canvasFront.width,
        (pageH - margin * 2) / canvasFront.height
      );
      const scaleBack = Math.min(
        cardW / canvasBack.width,
        (pageH - margin * 2) / canvasBack.height
      );

      const finalScale = Math.min(scaleFront, scaleBack);

      const fw = canvasFront.width * finalScale;
      const fh = canvasFront.height * finalScale;
      const bw = canvasBack.width * finalScale;
      const bh = canvasBack.height * finalScale;

      const yPos = (pageH - Math.max(fh, bh)) / 2;

      // Insertar frente (izquierda)
      doc.addImage(imgFront, 'PNG', margin, yPos, fw, fh, '', 'FAST');

      // Insertar reverso (derecha)
      doc.addImage(imgBack, 'PNG', margin + cardW + gap, yPos, bw, bh, '', 'FAST');

      // Obtener código del estudiante
      const studentCode = document.getElementById('displayCode')?.textContent || 'carnet';
      doc.save(`carnet_${studentCode}.pdf`);
      
      window.showModal && window.showModal.success('PDF Generado', 'El PDF se ha generado y descargado correctamente.');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      window.showModal && window.showModal.error('Error al Generar PDF', 'No se pudo generar el PDF: ' + (err?.message || String(err)));
    }
  }

  // Cargar datos del estudiante
  const firstLoginSection = document.getElementById('firstLoginSection');
  const cardSection = document.getElementById('cardSection');
  
  firstLoginSection.style.display = 'none';
  cardSection.style.display = 'none';

  let student = null;
  try {
    student = await window.API.Students.getByCode(session.code);
    if (!student) {
      window.showModal.error('Error', 'No se encontraron tus datos de carnet. Por favor, contacta a un funcionario.');
      return;
    }
  } catch (err) {
    console.error('Error al buscar estudiante:', err);
    window.showModal.error('Error', 'Error al cargar tus datos: ' + (err.message || 'Error desconocido'));
    return;
  }

  const isFirst = student.first_login || session.firstLogin || window.location.hash === '#first';
  
  if (isFirst) {
    firstLoginSection.style.display = 'block';
    cardSection.style.display = 'none';
    document.getElementById('pageTitle').textContent = 'Cambiar Contraseña';
  } else {
    firstLoginSection.style.display = 'none';
    cardSection.style.display = 'block';
    document.getElementById('pageTitle').textContent = 'Mi Carnet Digital';
  }

  // Generar y mostrar el carnet digital
  window.generateCard({
    name: student.name,
    lastname: student.lastname,
    code: student.code,
    cedula: student.cedula,
    program: student.program,
    expiry: student.expiry,
    sede: student.sede,
    rh: student.rh,
    photo: student.photo
  });


  // Configurar formulario de cambio de contraseña
  const changeForm = document.getElementById('changePwdForm');
  if (changeForm) {
    changeForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const p1 = document.getElementById('newPwd').value.trim();
      const p2 = document.getElementById('newPwd2').value.trim();
      
      if (!p1 || !p2 || p1 !== p2) {
        window.showModal.warning('Contraseña inválida', 'Asegúrate de llenar ambos campos y que coincidan.');
        return;
      }
      
      try {
        await window.Auth.changePassword(student.code, p1);
        window.showModal.success('Contraseña actualizada', 'Tu contraseña ha sido cambiada correctamente. Por favor, inicia sesión nuevamente con tu nueva contraseña.');
        
        // Cerrar sesión y redirigir al login
        await window.Auth.logout();
        setTimeout(() => {
          window.location.href = '../index.html';
        }, 1500);
      } catch (err) {
        window.showModal.error('No se pudo cambiar', err.message || 'Error desconocido');
      }
    });
  }
})();
