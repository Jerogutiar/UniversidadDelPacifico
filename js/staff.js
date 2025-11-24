/**
 * @fileoverview Lógica del panel de administración de funcionarios
 * @module staff
 */

(function () {
  'use strict';
  if (window.__staffInit) { return; }
  window.__staffInit = true;

  let currentSection = 'dashboard';
  let html5QrcodeScanner = null;
  let isScanning = false;

  /**
   * Espera a que todas las dependencias estén cargadas
   */
  async function waitForDependencies() {
    const maxAttempts = 50;
    let attempts = 0;

    return new Promise((resolve) => {
      const check = () => {
        attempts++;
        if (window.API && window.API.Students && window.API.Staff && window.Auth && window.Utils && window.showModal) {
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('Dependencias no cargadas');
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * Inicializa el panel
   */
  async function initialize() {
    await waitForDependencies();

    // Verificar sesión
    const session = window.Auth.getSession();
    if (!session || session.role !== 'staff') {
      window.location.href = '../index.html';
      return;
    }

    // Inicializar API
    await window.API.init();

    // Inicializar navegación
    initNavigation();

    // Inicializar tema
    initTheme();

    // Inicializar menú móvil
    initMobileMenu();

    // Inicializar secciones
    initDashboard();
    initStudentsSection();
    initStaffSection();
    initValidator();
    initExportSection();

    // Cargar datos iniciales
    loadDashboardStats();
    renderStudentList();
    renderStaffList();
  }

  /**
   * Inicializa la navegación entre secciones
   */
  function initNavigation() {
    const navItems = document.querySelectorAll('.dashboard-nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');
        switchSection(section);
      });
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await window.Auth.logout();
      window.location.href = '../index.html';
    });
  }

  /**
   * Cambia de sección
   */
  function switchSection(section) {
    currentSection = section;

    // Actualizar nav
    document.querySelectorAll('.dashboard-nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-section') === section);
    });

    // Actualizar contenido
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `${section}-section`);
    });

    // Actualizar título del header
    const titles = {
      dashboard: 'Dashboard',
      'students-create': 'Administrar Estudiante',
      'students-list': 'Lista de Estudiantes',
      'students-passwords': 'Contraseñas',
      staff: 'Funcionarios',
      validator: 'Validar Carnet',
      loans: 'Préstamos',
      export: 'Exportar Datos'
    };
    document.getElementById('pageTitle').textContent = titles[section] || 'Dashboard';
    
    // Inicializar préstamos si es necesario
    if (section === 'loans' && window.StaffLoans && !window.__loansInitialized) {
      window.__loansInitialized = true;
      window.StaffLoans.init();
    }
  }

  /**
   * Inicializa el tema
   */
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

  /**
   * Inicializa el menú móvil
   */
  function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');

    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
      });
    }

    // Cerrar al hacer click fuera o en el overlay
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 && sidebar.classList.contains('open')) {
        // Detectar clicks fuera del sidebar
        if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      }
    });

    // Manejar cierre del overlay dinámico
    const handleOverlayClick = (e) => {
      if (e.target.classList.contains('sidebar-overlay')) {
        sidebar.classList.remove('open');
        document.body.removeChild(e.target);
      }
    };

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

  /**
   * Inicializa el dashboard
   */
  function initDashboard() {
    // Se inicializa en loadDashboardStats
  }

  /**
   * Carga las estadísticas del dashboard
   */
  async function loadDashboardStats() {
    try {
      const students = await window.API.Students.listAll();
      const staff = await window.API.Staff.listAll();

      const active = students.filter(s => s.active !== false && !isExpired(s.expiry)).length;
      const expiring = students.filter(s => isExpiringSoon(s.expiry)).length;

      document.getElementById('statTotalStudents').textContent = students.length;
      document.getElementById('statActiveCards').textContent = active;
      document.getElementById('statExpiring').textContent = expiring;
      document.getElementById('statStaff').textContent = staff.length;

      // Cargar datos adicionales del dashboard expandido
      await loadRecentLoans();
      await loadRecentStudents(students);
    } catch (err) {
      console.error('Error al cargar estadísticas:', err);
    }
  }

  /**
   * Carga préstamos activos recientes para el dashboard
   */
  async function loadRecentLoans() {
    const container = document.getElementById('dashboardRecentLoans');
    if (!container) return;

    try {
      if (!window.LoansAPI) {
        container.innerHTML = '<p class="text-secondary">Módulo de préstamos no disponible</p>';
        return;
      }

      const result = await window.LoansAPI.getActiveLoans();
      const loans = result.data || [];
      const recentLoans = loans.slice(0, 5);

      if (recentLoans.length === 0) {
        container.innerHTML = '<p class="text-secondary">No hay préstamos activos en este momento</p>';
        return;
      }

      const loansHTML = recentLoans.map(loan => `
        <div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <strong style="color: var(--text-primary);">${loan.student_name}</strong>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
              ${loan.item_type} • ${loan.days_borrowed || 0} día${(loan.days_borrowed || 0) !== 1 ? 's' : ''}
            </div>
          </div>
          <span class="status-badge ${loan.category}">${loan.category === 'biblioteca' ? 'Biblioteca' : 'Laboratorio'}</span>
        </div>
      `).join('');

      container.innerHTML = loansHTML;
    } catch (err) {
      console.error('Error al cargar préstamos recientes:', err);
      container.innerHTML = '<p class="text-secondary">Error al cargar préstamos</p>';
    }
  }

  /**
   * Carga estudiantes registrados recientemente
   */
  async function loadRecentStudents(students) {
    const container = document.getElementById('dashboardRecentStudents');
    if (!container) return;

    try {
      // Ordenar por fecha de creación (más recientes primero)
      const sorted = [...students].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      const recent = sorted.slice(0, 5);

      if (recent.length === 0) {
        container.innerHTML = '<p class="text-secondary">No hay estudiantes registrados</p>';
        return;
      }

      const studentsHTML = recent.map(student => `
        <div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <strong style="color: var(--text-primary);">${student.name} ${student.lastname || ''}</strong>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
              ${student.code} • ${student.program || 'Sin programa'}
            </div>
          </div>
          <span class="status-badge ${student.active !== false && !isExpired(student.expiry) ? 'active' : 'inactive'}">
            ${student.active !== false && !isExpired(student.expiry) ? 'Activo' : 'Inactivo'}
          </span>
        </div>
      `).join('');

      container.innerHTML = studentsHTML;
    } catch (err) {
      console.error('Error al cargar estudiantes recientes:', err);
      container.innerHTML = '<p class="text-secondary">Error al cargar estudiantes</p>';
    }
  }

  /**
   * Carga estadísticas por programa
   */
  async function loadProgramStats(students) {
    const container = document.getElementById('dashboardProgramStats');
    if (!container) return;

    try {
      // Agrupar por programa
      const programCount = {};
      students.forEach(s => {
        const prog = s.program || 'Sin programa';
        programCount[prog] = (programCount[prog] || 0) + 1;
      });

      // Ordenar por cantidad
      const sorted = Object.entries(programCount).sort((a, b) => b[1] - a[1]);
      const top5 = sorted.slice(0, 5);

      if (top5.length === 0) {
        container.innerHTML = '<p class="text-secondary">No hay datos disponibles</p>';
        return;
      }

      const maxCount = top5[0][1];
      const statsHTML = top5.map(([program, count]) => {
        const percentage = (count / maxCount) * 100;
        return `
          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-size: 0.875rem; color: var(--text-primary); font-weight: 500;">${program}</span>
              <span style="font-size: 0.875rem; color: var(--text-secondary); font-weight: 600;">${count}</span>
            </div>
            <div style="height: 8px; background: var(--bg-tertiary); border-radius: 10px; overflow: hidden;">
              <div style="height: 100%; width: ${percentage}%; background: linear-gradient(90deg, var(--udp-blue), var(--primary-green)); transition: width 0.3s ease;"></div>
            </div>
          </div>
        `;
      }).join('');

      container.innerHTML = statsHTML;
    } catch (err) {
      console.error('Error al cargar estadísticas de programas:', err);
      container.innerHTML = '<p class="text-secondary">Error al cargar datos</p>';
    }
  }

  /**
   * Carga estadísticas por sede
   */
  async function loadSedeStats(students) {
    const container = document.getElementById('dashboardSedeStats');
    if (!container) return;

    try {
      // Agrupar por sede
      const sedeCount = {};
      students.forEach(s => {
        const sede = s.sede || 'Sin sede';
        sedeCount[sede] = (sedeCount[sede] || 0) + 1;
      });

      // Ordenar por cantidad
      const sorted = Object.entries(sedeCount).sort((a, b) => b[1] - a[1]);

      if (sorted.length === 0) {
        container.innerHTML = '<p class="text-secondary">No hay datos disponibles</p>';
        return;
      }

      const total = students.length;
      const statsHTML = sorted.map(([sede, count]) => {
        const percentage = ((count / total) * 100).toFixed(1);
        return `
          <div style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <strong style="color: var(--text-primary); font-size: 0.95rem;">${sede}</strong>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                ${percentage}% del total
              </div>
            </div>
            <div style="font-size: 1.25rem; font-weight: 700; color: var(--accent-primary);">${count}</div>
          </div>
        `;
      }).join('');

      container.innerHTML = statsHTML;
    } catch (err) {
      console.error('Error al cargar estadísticas de sedes:', err);
      container.innerHTML = '<p class="text-secondary">Error al cargar datos</p>';
    }
  }

  /**
   * Inicializa las secciones de estudiantes
   */
  function initStudentsSection() {
    // Formulario de estudiante (sección crear)
    const form = document.getElementById('studentForm');
    if (form) {
      form.addEventListener('submit', handleStudentSubmit);
    }

    // Limpiar formulario
    document.getElementById('clearFormBtn')?.addEventListener('click', () => {
      form.reset();
      document.getElementById('photoPreview')?.classList.remove('active');
      document.getElementById('previewImage').src = '';
    });

    // Vista previa de foto
    const fileInput = document.getElementById('studentPhoto');
    if (fileInput) {
      fileInput.addEventListener('change', handlePhotoUpload);
    }
    document.getElementById('removePhoto')?.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      document.getElementById('photoPreview')?.classList.remove('active');
      document.getElementById('previewImage').src = '';
    });

    // Búsqueda y filtros (sección lista)
    document.getElementById('searchInput')?.addEventListener('input', renderStudentList);
    document.getElementById('filterProgram')?.addEventListener('change', renderStudentList);
    document.getElementById('filterSede')?.addEventListener('change', renderStudentList);
    document.getElementById('filterStatus')?.addEventListener('change', renderStudentList);
    document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
      const searchInput = document.getElementById('searchInput');
      const filterProgram = document.getElementById('filterProgram');
      const filterSede = document.getElementById('filterSede');
      const filterStatus = document.getElementById('filterStatus');
      if (searchInput) searchInput.value = '';
      if (filterProgram) filterProgram.value = '';
      if (filterSede) filterSede.value = '';
      if (filterStatus) filterStatus.value = '';
      renderStudentList();
    });

    // Restablecer contraseña (sección contraseñas)
    document.getElementById('resetBtn')?.addEventListener('click', handleResetStudentPassword);

    // Cargar opciones de filtros
    loadFilterOptions();

    // Renderizar lista inicialmente
    renderStudentList();
  }

  /**
   * Maneja el envío del formulario de estudiante
   */
  async function handleStudentSubmit(e) {
    e.preventDefault();

    const name = window.Utils.sanitize(document.getElementById('studentName').value.trim().toUpperCase());
    const lastname = window.Utils.sanitize(document.getElementById('studentLastname').value.trim());
    const code = document.getElementById('studentCode').value.trim();
    const cedula = document.getElementById('studentCedula').value.trim();
    const program = window.Utils.sanitize(document.getElementById('studentProgram').value.trim().toUpperCase());
    const expiryInput = document.getElementById('studentExpiry').value.trim();
    const sede = document.getElementById('studentSede').value.trim();
    const rh = document.getElementById('studentRH').value.trim();
    const active = document.getElementById('studentActive').checked;

    // Validaciones
    if (!name || !lastname || !code || !cedula || !program || !expiryInput || !sede) {
      window.showModal.warning('Campos incompletos', 'Completa todos los campos requeridos.');
      return;
    }

    if (!window.Utils.validateStudentCode(code)) {
      window.showModal.warning('Código inválido', 'El código debe ser numérico de 6 a 12 dígitos.');
      return;
    }

    if (!window.Utils.validateCedula(cedula)) {
      window.showModal.warning('Cédula inválida', 'La cédula debe tener entre 8 y 10 dígitos numéricos.');
      return;
    }

    if (window.Utils.isPastDateYmd(expiryInput)) {
      window.showModal.warning('Fecha inválida', 'La fecha de expiración no puede estar en el pasado.');
      return;
    }

    // Foto
    let photoData = null;
    const previewImg = document.getElementById('previewImage');
    if (previewImg && previewImg.src && previewImg.src.startsWith('data:')) {
      photoData = previewImg.src;
    } else {
      const existing = await window.API.Students.getByCode(code);
      if (existing && existing.photo) {
        photoData = existing.photo;
      }
    }

    const formattedExpiry = window.Utils.formatDateToSpanish(expiryInput);
    const finalActive = active && !window.Utils.isPastDateYmd(expiryInput) ? true : false;

    try {
      await window.API.Students.createOrUpdate({
        name, lastname, code, cedula, program,
        expiry: formattedExpiry, sede, rh, photo: photoData, active: finalActive
      });

      window.showModal.success('Guardado', 'El carnet y el perfil del estudiante se han guardado.');
      renderStudentList();
      loadDashboardStats();
      loadFilterOptions();

      // Limpiar formulario después de crear nuevo estudiante
      const existing = await window.API.Students.getByCode(code);
      if (!existing || existing.code !== code) {
        form.reset();
        document.getElementById('photoPreview').classList.remove('active');
      }
    } catch (err) {
      window.showModal.error('Error', err.message || 'No se pudo guardar');
    }
  }

  /**
   * Maneja la subida de foto
   */
  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      window.showModal.warning('Archivo inválido', 'Por favor selecciona una imagen.');
      e.target.value = '';
      return;
    }

    try {
      const resizedPhoto = await window.Utils.resizeImage(file, 400, 500, 0.9);
      if (resizedPhoto) {
        document.getElementById('previewImage').src = resizedPhoto;
        document.getElementById('photoPreview').classList.add('active');
        document.getElementById('fileInputText').textContent = file.name;
      }
    } catch (err) {
      window.showModal.error('Error', 'No se pudo procesar la imagen: ' + err.message);
      e.target.value = '';
    }
  }

  /**
   * Renderiza la lista de estudiantes
   */
  async function renderStudentList() {
    const listNode = document.getElementById('studentList');
    if (!listNode) return;

    const all = await window.API.Students.listAll();
    const filters = {
      search: document.getElementById('searchInput')?.value.trim() || '',
      program: document.getElementById('filterProgram')?.value || '',
      sede: document.getElementById('filterSede')?.value || '',
      status: document.getElementById('filterStatus')?.value || ''
    };

    let filtered = all.filter(s => {
      if (filters.search) {
        const term = filters.search.toLowerCase();
        const code = (s.code || '').toLowerCase();
        const ced = (s.cedula || '').toLowerCase();
        const name = (s.name || '').toLowerCase();
        const last = (s.lastname || '').toLowerCase();
        if (!code.includes(term) && !ced.includes(term) && !name.includes(term) && !last.includes(term)) {
          return false;
        }
      }
      if (filters.program && s.program !== filters.program) return false;
      if (filters.sede && s.sede !== filters.sede) return false;
      if (filters.status) {
        const isActive = s.active !== false;
        if (filters.status === 'inactive' && isActive) return false;
        if (filters.status === 'expired' && !isExpired(s.expiry)) return false;
        if (filters.status === 'expiring' && !isExpiringSoon(s.expiry)) return false;
        if (filters.status === 'active' && (!isActive || isExpired(s.expiry) || isExpiringSoon(s.expiry))) return false;
      }
      return true;
    }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));

    document.getElementById('studentCount').textContent = `${filtered.length} de ${all.length} estudiante(s)`;

    if (!filtered.length) {
      listNode.innerHTML = '<p class="text-tertiary">No se encontraron estudiantes con los filtros seleccionados.</p>';
      return;
    }

    listNode.innerHTML = filtered.map(s => {
      const expired = isExpired(s.expiry);
      const expiring = isExpiringSoon(s.expiry);
      const isActive = s.active !== false;

      let statusBadge = '';
      if (!isActive) {
        statusBadge = '<span class="status-badge inactive">INACTIVO</span>';
      } else if (expired) {
        statusBadge = '<span class="status-badge expired">EXPIRADO</span>';
      } else if (expiring) {
        statusBadge = '<span class="status-badge expiring">POR VENCER</span>';
      } else {
        statusBadge = '<span class="status-badge active">ACTIVO</span>';
      }

      return `
        <div class="student-item" data-code="${s.code}">
          <div class="student-info">
            <div>
              <strong>${s.name || 'N/A'}</strong>
              <small>${s.lastname || ''}</small>
              ${s.cedula ? `<small>C.C. ${s.cedula}</small>` : ''}
              ${s.program ? `<small style="color: var(--accent-primary);">${s.program}</small>` : ''}
              ${statusBadge}
            </div>
            <div class="student-code">${s.code || ''}</div>
          </div>
        </div>
      `;
    }).join('');

    // Event listeners para redirigir a sección de edición al hacer click
    listNode.querySelectorAll('.student-item').forEach(el => {
      el.addEventListener('click', async () => {
        const code = el.getAttribute('data-code');
        const student = await window.API.Students.getByCode(code);
        if (student) {
          // Cambiar a la sección de crear/editar estudiantes
          document.querySelectorAll('.dashboard-nav-item').forEach(item => {
            item.classList.remove('active');
          });
          const createTab = document.querySelector('[data-section="students-create"]');
          if (createTab) {
            createTab.classList.add('active');
          }

          // Cambiar la sección activa
          document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
          });
          const createSection = document.getElementById('students-create-section');
          if (createSection) {
            createSection.classList.add('active');
          }

          // Actualizar título
          const pageTitle = document.getElementById('pageTitle');
          if (pageTitle) {
            pageTitle.textContent = 'Administrar Estudiante';
          }

          // Cargar datos en el formulario
          fillFormFromStudent(student);
          window.showModal.info('Cargado', 'Datos del estudiante cargados. Puedes editarlos ahora.');
        }
      });
    });
  }

  /**
   * Llena el formulario con datos de estudiante
   */
  function fillFormFromStudent(s) {
    document.getElementById('studentName').value = s.name || '';
    document.getElementById('studentLastname').value = s.lastname || '';
    document.getElementById('studentCode').value = s.code || '';
    document.getElementById('studentCedula').value = s.cedula || '';
    document.getElementById('studentProgram').value = s.program || '';

    // Formatear fecha española al formato YYYY-MM-DD
    if (s.expiry && s.expiry.includes(' ')) {
      const parts = s.expiry.split(' ');
      const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const monthIndex = months.indexOf(parts[1]);
      if (monthIndex !== -1) {
        const date = new Date(parseInt(parts[2]), monthIndex, parseInt(parts[0]));
        document.getElementById('studentExpiry').value = date.toISOString().split('T')[0];
      }
    } else if (s.expiry) {
      document.getElementById('studentExpiry').value = s.expiry;
    }

    document.getElementById('studentSede').value = s.sede || 'Buenaventura';
    document.getElementById('studentRH').value = s.rh || '';

    const isActive = s.active !== false;
    document.getElementById('studentActive').checked = isActive;
    document.getElementById('studentInactive').checked = !isActive;

    if (s.photo) {
      document.getElementById('previewImage').src = s.photo;
      document.getElementById('photoPreview').classList.add('active');
      document.getElementById('fileInputText').textContent = 'Foto cargada';
    }
  }

  /**
   * Carga las opciones de filtros
   */
  async function loadFilterOptions() {
    const all = await window.API.Students.listAll();
    const programs = [...new Set(all.map(s => s.program).filter(Boolean))].sort();
    const sedes = [...new Set(all.map(s => s.sede).filter(Boolean))].sort();

    const programSelect = document.getElementById('filterProgram');
    const sedeSelect = document.getElementById('filterSede');

    if (programSelect) {
      programSelect.innerHTML = '<option value="">Todos los programas</option>' +
        programs.map(p => `<option value="${p}">${p}</option>`).join('');
    }

    if (sedeSelect) {
      sedeSelect.innerHTML = '<option value="">Todas las sedes</option>' +
        sedes.map(s => `<option value="${s}">${s}</option>`).join('');
    }
  }

  /**
   * Maneja el restablecimiento de contraseña de estudiante
   */
  async function handleResetStudentPassword() {
    const code = document.getElementById('resetCode').value.trim();
    const pwd = document.getElementById('resetPwd').value.trim();

    if (!code || !pwd) {
      window.showModal.warning('Campos requeridos', 'Ingresa código y nueva contraseña.');
      return;
    }

    try {
      const session = window.Auth.getSession();
      await window.API.Students.resetPassword(code, pwd, session?.email || 'staff');
      document.getElementById('resetCode').value = '';
      document.getElementById('resetPwd').value = '';
      window.showModal.success('Listo', 'Contraseña del estudiante actualizada.');
    } catch (err) {
      window.showModal.error('Error', err.message || 'No se pudo actualizar');
    }
  }

  /**
   * Inicializa la sección de funcionarios
   */
  function initStaffSection() {
    // Formulario de registro
    document.getElementById('staffRegisterForm').addEventListener('submit', handleStaffRegister);

    // Restablecer contraseña
    document.getElementById('resetStaffBtn')?.addEventListener('click', handleResetStaffPassword);

    // Búsqueda
    document.getElementById('searchStaffInput')?.addEventListener('input', renderStaffList);

    // Exportar
    document.getElementById('exportDownloadBtn')?.addEventListener('click', handleExport);
  }

  /**
   * Maneja el registro de funcionario
   */
  async function handleStaffRegister(e) {
    e.preventDefault();

    const name = document.getElementById('staffName').value.trim();
    const email = document.getElementById('staffEmail').value.trim();
    const password = document.getElementById('staffPassword').value.trim();

    if (!name || !email || !password) {
      window.showModal.warning('Campos requeridos', 'Completa todos los campos.');
      return;
    }

    try {
      await window.API.Staff.create({ name, email, password });
      window.showModal.success('Registrado', 'Funcionario creado correctamente.');
      document.getElementById('staffRegisterForm').reset();
      renderStaffList();
      loadDashboardStats();
    } catch (err) {
      window.showModal.error('Error', err.message || 'No se pudo registrar');
    }
  }

  /**
   * Renderiza la lista de funcionarios
   */
  async function renderStaffList() {
    const listNode = document.getElementById('staffList');
    if (!listNode) return;

    const all = await window.API.Staff.listAll();
    const search = document.getElementById('searchStaffInput')?.value.trim().toLowerCase() || '';

    const filtered = all.filter(s => {
      if (search) {
        const name = (s.name || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        return name.includes(search) || email.includes(search);
      }
      return true;
    });

    document.getElementById('staffCount').textContent = `${filtered.length} funcionario(s)`;

    if (!filtered.length) {
      listNode.innerHTML = '<p class="text-tertiary">No se encontraron funcionarios.</p>';
      return;
    }

    listNode.innerHTML = filtered.map(s => {
      const id = s.id || s.email || 'unknown';
      return `
        <div class="staff-item">
          <div class="staff-info">
            <div>
              <strong>${s.name || 'N/A'}</strong>
              <small>${s.email || ''}</small>
            </div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteStaff('${id}')">Eliminar</button>
        </div>
      `;
    }).join('');
  }

  /**
   * Elimina un funcionario
   */
  window.deleteStaff = async function (id) {
    if (!await window.showModal.confirm('Confirmar', `¿Estás seguro de eliminar a este funcionario?`)) {
      return;
    }

    try {
      await window.API.Staff.delete(id);
      window.showModal.success('Eliminado', 'Funcionario eliminado correctamente.');
      renderStaffList();
      loadDashboardStats();
    } catch (err) {
      window.showModal.error('Error', err.message || 'No se pudo eliminar');
    }
  };

  /**
   * Maneja el restablecimiento de contraseña de funcionario
   */
  async function handleResetStaffPassword() {
    const email = document.getElementById('resetStaffEmail').value.trim();
    const pwd = document.getElementById('resetStaffPwd').value.trim();

    if (!email || !pwd) {
      window.showModal.warning('Campos requeridos', 'Ingresa email y nueva contraseña.');
      return;
    }

    try {
      const session = window.Auth.getSession();
      await window.API.Staff.resetPassword(email, pwd, session?.email || 'staff');
      document.getElementById('resetStaffEmail').value = '';
      document.getElementById('resetStaffPwd').value = '';
      window.showModal.success('Listo', 'Contraseña del funcionario actualizada.');
    } catch (err) {
      window.showModal.error('Error', err.message || 'No se pudo actualizar');
    }
  }

  /**
   * Inicializa la sección de exportar datos
   */
  function initExportSection() {
    document.getElementById('exportDownloadBtn')?.addEventListener('click', handleExport);
  }

  /**
   * Maneja la exportación de datos
   */
  async function handleExport() {
    const type = document.getElementById('exportType').value;

    try {
      if (type.includes('students')) {
        const data = await window.API.Students.listAll();
        const filename = type === 'students-json' ? 'estudiantes.json' : 'estudiantes.csv';
        if (type === 'students-json') {
          download(filename, JSON.stringify(data, null, 2), 'application/json');
        } else {
          download(filename, toCsv(data), 'text/csv');
        }
      } else if (type.includes('staff')) {
        const data = await window.API.Staff.listAll();
        const filename = type === 'staff-json' ? 'funcionarios.json' : 'funcionarios.csv';
        if (type === 'staff-json') {
          download(filename, JSON.stringify(data, null, 2), 'application/json');
        } else {
          download(filename, toCsv(data), 'text/csv');
        }
      }
      window.showModal.success('Exportado', 'Datos exportados correctamente.');
    } catch (err) {
      window.showModal.error('Error', err.message || 'No se pudo exportar');
    }
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toCsv(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(headers.map(h => {
        const value = r[h];
        if (h === 'photo' && value) return '"Foto incluida"';
        return `"${(value ?? '').toString().replace(/"/g, '""')}"`;
      }).join(','));
    }
    return lines.join('\n');
  }

  /**
   * Inicializa el validador de carnets
   */
  function initValidator() {
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');

    if (!startBtn || !stopBtn) return;

    startBtn.addEventListener('click', startScanner);
    stopBtn.addEventListener('click', stopScanner);
  }

  /**
   * Inicia el escáner
   */
  async function startScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      window.showModal.warning('Librería No Disponible', 'La librería de escaneo no está disponible.');
      return;
    }

    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');

    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';

    html5QrcodeScanner = new Html5Qrcode("barcode-reader");

    const config = {
      fps: 10,
      qrbox: { width: 300, height: 120 },
      aspectRatio: 1.0
    };

    if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
      config.formatsToSupport = [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E
      ];
    }

    try {
      await html5QrcodeScanner.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanError
      );
      isScanning = true;
    } catch (err) {
      console.error('Error al iniciar escáner:', err);
      startBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
      window.showModal.warning('Cámara no disponible', 'No se pudo acceder a la cámara.');
    }
  }

  /**
   * Detiene el escáner
   */
  async function stopScanner() {
    if (html5QrcodeScanner && isScanning) {
      try {
        await html5QrcodeScanner.stop();
        html5QrcodeScanner.clear();
        isScanning = false;
        document.getElementById('startScanBtn').style.display = 'inline-flex';
        document.getElementById('stopScanBtn').style.display = 'none';
      } catch (err) {
        console.error('Error al detener escáner:', err);
      }
    }
  }

  /**
   * Callback cuando se escanea exitosamente
   */
  async function onScanSuccess(decodedText) {
    await stopScanner();
    validateCode(decodedText);
  }

  /**
   * Callback para errores de escaneo
   */
  function onScanError(errorMessage) {
    // Los errores de escaneo son normales durante la búsqueda de códigos
  }

  /**
   * Valida un código escaneado
   */
  async function validateCode(code) {
    let studentCode = code;
    if (code.startsWith('UPAC-')) {
      studentCode = code.substring(5);
    }

    try {
      const student = await window.API.Students.getByCode(studentCode);
      if (student) {
        const isActive = student.active !== false;
        const statusText = isActive ? '<span class="status-badge active">ACTIVO</span>' : '<span class="status-badge inactive">INACTIVO</span>';

        const message = `
          <div style="text-align: left; margin-top: 12px;">
            <p><strong>Estado:</strong> ${statusText}</p>
            <p><strong>Nombre:</strong> ${student.name || 'N/A'}</p>
            <p><strong>Apellidos:</strong> ${student.lastname || 'N/A'}</p>
            <p><strong>Cédula:</strong> ${student.cedula || 'N/A'}</p>
            <p><strong>Código:</strong> ${student.code || 'N/A'}</p>
            <p><strong>Programa:</strong> ${student.program || 'N/A'}</p>
            <p><strong>Válido hasta:</strong> ${student.expiry || 'N/A'}</p>
            <p><strong>Sede:</strong> ${student.sede || 'N/A'}</p>
          </div>
        `;

        if (isActive) {
          window.showModal.success('Carnet Válido', `El carnet pertenece a un estudiante registrado y está activo.${message}`);
        } else {
          window.showModal.warning('Carnet Inactivo', `El carnet pertenece a un estudiante registrado pero está inactivo.${message}`);
        }
      } else {
        window.showModal.error('Carnet Inválido', 'El código del carnet no es válido o no se encuentra registrado en el sistema.');
      }
    } catch (err) {
      window.showModal.error('Error', 'Error al validar el carnet: ' + err.message);
    }
  }

  /**
   * Verifica si una fecha está expirada
   */
  function isExpired(expiry) {
    if (!expiry) return false;
    try {
      let expiryDate;
      if (expiry.includes(' ')) {
        const parts = expiry.split(' ');
        const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const monthIndex = months.indexOf(parts[1]);
        if (monthIndex !== -1) {
          expiryDate = new Date(parseInt(parts[2]), monthIndex, parseInt(parts[0]));
        }
      } else {
        expiryDate = new Date(expiry + 'T00:00:00');
      }
      if (expiryDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expiryDate.setHours(0, 0, 0, 0);
        return expiryDate < today;
      }
    } catch (e) { }
    return false;
  }

  /**
   * Verifica si una fecha está por vencer
   */
  function isExpiringSoon(expiry) {
    if (!expiry) return false;
    try {
      let expiryDate;
      if (expiry.includes(' ')) {
        const parts = expiry.split(' ');
        const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const monthIndex = months.indexOf(parts[1]);
        if (monthIndex !== -1) {
          expiryDate = new Date(parseInt(parts[2]), monthIndex, parseInt(parts[0]));
        }
      } else {
        expiryDate = new Date(expiry + 'T00:00:00');
      }
      if (expiryDate) {
        const today = new Date();
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
      }
    } catch (e) { }
    return false;
  }

  // Inicialización al cargar la página
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
