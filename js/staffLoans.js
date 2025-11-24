/**
 * ============================================
 * STAFF LOANS - INTERFAZ DE PRÉSTAMOS
 * Universidad del Pacífico - Carnet Digital
 * ============================================
 */

(function() {
  'use strict';

  // ============================================
  // INICIALIZACIÓN
  // ============================================

  function initLoans() {
    const loanForm = document.getElementById('loanForm');
    const loanCategoryInputs = document.querySelectorAll('input[name="loanCategory"]');
    const loanStudentCode = document.getElementById('loanStudentCode');
    const clearLoansFiltersBtn = document.getElementById('clearLoansFiltersBtn');

    // Event listeners
    if (loanForm) {
        loanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleLoanSubmit(e);
        });
    }

    if (loanCategoryInputs) {
        loanCategoryInputs.forEach(input => {
            input.addEventListener('change', handleCategoryChange);
        });
    }

    if (loanStudentCode) {
        loanStudentCode.addEventListener('blur', handleStudentValidation);
    }

    if (clearLoansFiltersBtn) {
        clearLoansFiltersBtn.addEventListener('click', clearLoansFilters);
    }

    // Event listeners para filtros
    const filterLoanStudent = document.getElementById('filterLoanStudent');
    const filterLoanCategory = document.getElementById('filterLoanCategory');
    const filterLoanStatus = document.getElementById('filterLoanStatus');
    
    if (filterLoanStudent) filterLoanStudent.addEventListener('input', applyLoansFilters);
    if (filterLoanCategory) filterLoanCategory.addEventListener('change', applyLoansFilters);
    if (filterLoanStatus) filterLoanStatus.addEventListener('change', applyLoansFilters);

    // Event listener para búsqueda en préstamos activos
    const searchActiveLoanInput = document.getElementById('searchActiveLoanInput');
    if (searchActiveLoanInput) {
      searchActiveLoanInput.addEventListener('input', (e) => {
        loadActiveLoans(e.target.value);
      });
    }

    // Cargar datos iniciales
    loadActiveLoans();
    loadLoansHistory();
  }

  // ============================================
  // CAMBIO DE CATEGORÍA (BIBLIOTECA/LABORATORIO)
  // ============================================

  function handleCategoryChange(event) {
    const category = event.target.value;
    const libraryItemGroup = document.getElementById('libraryItemGroup');
    const labItemGroup = document.getElementById('labItemGroup');
    const libraryItem = document.getElementById('libraryItem');
    const labItem = document.getElementById('labItem');

    if (category === 'biblioteca') {
        libraryItemGroup.style.display = 'block';
        labItemGroup.style.display = 'none';
        libraryItem.required = true;
        labItem.required = false;
        labItem.value = '';
    } else {
        libraryItemGroup.style.display = 'none';
        labItemGroup.style.display = 'block';
        libraryItem.required = false;
        labItem.required = true;
        libraryItem.value = '';
    }
  }

  // ============================================
  // VALIDACIÓN DE ESTUDIANTE
  // ============================================

  async function handleStudentValidation(event) {
    const code = event.target.value.trim();
    const infoElement = document.getElementById('loanStudentInfo');

    if (!code) {
        infoElement.textContent = '';
        return;
    }

    infoElement.textContent = 'Validando...';
    infoElement.style.color = 'var(--text-secondary)';

    const result = await window.LoansAPI.validateStudent(code);

    if (result.success) {
        infoElement.textContent = `✓ ${result.data.name} - ${result.data.program}`;
        infoElement.style.color = 'var(--primary-green)';
    } else {
        infoElement.textContent = `✗ ${result.error}`;
        infoElement.style.color = '#ef4444';
    }
  }

  // ============================================
  // REGISTRAR PRÉSTAMO
  // ============================================

  async function handleLoanSubmit(event) {
    event.preventDefault();

    const category = document.querySelector('input[name="loanCategory"]:checked').value;
    const studentCode = document.getElementById('loanStudentCode').value.trim();
    const libraryItem = document.getElementById('libraryItem').value;
    const labItem = document.getElementById('labItem').value.trim();
    const description = document.getElementById('loanDescription').value.trim();
    const loanDate = document.getElementById('loanDate')?.value;
    const loanTime = document.getElementById('loanTime')?.value;

    // Validar estudiante
    const studentResult = await window.LoansAPI.validateStudent(studentCode);
    if (!studentResult.success) {
        window.showModal && window.showModal.error('Error', studentResult.error);
        return;
    }

    // Obtener ítem según categoría
    const itemType = category === 'biblioteca' ? libraryItem : labItem;

    if (!itemType) {
        window.showModal && window.showModal.warning('Falta información', 'Por favor seleccione o ingrese un ítem');
        return;
    }

    // Obtener datos del staff actual
    const session = window.Auth && window.Auth.getSession();
    if (!session || session.role !== 'staff') {
        window.showModal && window.showModal.error('Error', 'No se pudo obtener información del funcionario');
        return;
    }

    // Preparar fecha/hora del préstamo
    let borrowedAt = null;
    if (loanDate && loanTime) {
        borrowedAt = new Date(`${loanDate}T${loanTime}`).toISOString();
    }

    // Preparar datos del préstamo
    const loanData = {
        studentCode: studentCode,
        studentName: `${studentResult.data.name} ${studentResult.data.lastname || ''}`.trim(),
        category: category,
        itemType: itemType,
        itemDescription: description || null,
        staffEmail: session.email,
        staffName: session.name,
        borrowedAt: borrowedAt
    };

    // Registrar préstamo
    const result = await window.LoansAPI.registerLoan(loanData);

    if (result.success) {
        window.showModal && window.showModal.success('Éxito', 'Préstamo registrado exitosamente');
        document.getElementById('loanForm').reset();
        document.getElementById('loanStudentInfo').textContent = '';
        
        // Resetear campos de fecha/hora a valores por defecto
        const now = new Date();
        const dateInput = document.getElementById('loanDate');
        const timeInput = document.getElementById('loanTime');
        if (dateInput) dateInput.value = now.toISOString().split('T')[0];
        if (timeInput) timeInput.value = now.toTimeString().slice(0, 5);
        
        // Mostrar biblioteca por defecto
        document.getElementById('libraryItemGroup').style.display = 'block';
        document.getElementById('labItemGroup').style.display = 'none';
        
        loadActiveLoans();
        loadLoansHistory();
    } else {
        window.showModal && window.showModal.error('Error', result.error);
    }
  }

  // ============================================
  // CARGAR PRÉSTAMOS ACTIVOS
  // ============================================

  async function loadActiveLoans(searchTerm = '') {
    const container = document.getElementById('activeLoansContainer');
    const countElement = document.getElementById('activeLoansCount');

    container.innerHTML = '<p class="text-secondary">Cargando...</p>';

    const result = await window.LoansAPI.getActiveLoans();

    if (!result.success) {
        container.innerHTML = `<p class="text-secondary">Error al cargar préstamos: ${result.error}</p>`;
        return;
    }

    let loans = result.data;

    // Filtrar por código de estudiante si hay término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      loans = loans.filter(loan => 
        loan.student_code.toLowerCase().includes(term) ||
        loan.student_name.toLowerCase().includes(term)
      );
    }

    if (loans.length === 0) {
        container.innerHTML = searchTerm 
          ? '<p class="text-secondary">No se encontraron préstamos con ese código</p>'
          : '<p class="text-secondary">No hay préstamos activos</p>';
        countElement.textContent = '0 préstamos activos';
        return;
    }

    const totalLoans = result.data.length;
    if (searchTerm && loans.length !== totalLoans) {
      countElement.textContent = `${loans.length} de ${totalLoans} préstamo${totalLoans !== 1 ? 's' : ''} activo${totalLoans !== 1 ? 's' : ''}`;
    } else {
      countElement.textContent = `${loans.length} préstamo${loans.length !== 1 ? 's' : ''} activo${loans.length !== 1 ? 's' : ''}`;
    }

    const loansHTML = loans.map(loan => `
    <div class="loan-item">
      <div class="loan-item-header">
        <div>
          <strong>${loan.student_name}</strong>
          <div class="loan-item-code">${loan.student_code}</div>
        </div>
        <span class="status-badge ${loan.category}">${loan.category === 'biblioteca' ? 'Biblioteca' : 'Laboratorio'}</span>
      </div>
      <div class="loan-item-body">
        <p><strong>Ítem:</strong> ${loan.item_type}</p>
        ${loan.item_description ? `<p class="text-secondary"><small>${loan.item_description}</small></p>` : ''}
        <p class="text-secondary"><small>Prestado hace ${loan.days_borrowed} día${loan.days_borrowed !== 1 ? 's' : ''}</small></p>
        <p class="text-secondary"><small>Por: ${loan.staff_name}</small></p>
      </div>
      <div class="loan-item-actions">
        <button class="btn btn-sm btn-secondary" onclick="handleReturnLoan('${loan.id}')">Marcar como devuelto</button>
      </div>
    </div>
  `).join('');

    container.innerHTML = loansHTML;
}

  // ============================================
  // MARCAR PRÉSTAMO COMO DEVUELTO
  // ============================================

  window.handleReturnLoan = async function (loanId) {
    // Usar modal personalizado en lugar de confirm()
    if (window.showModal && window.showModal.confirm) {
      const confirmed = await window.showModal.confirm(
        'Confirmar devolución',
        '¿Estás seguro de que deseas marcar este préstamo como devuelto?',
        {
          confirmText: 'Marcar como devuelto',
          cancelText: 'Cancelar'
        }
      );

      if (confirmed) {
        const result = await window.LoansAPI.returnLoan(loanId);

        if (result.success) {
          window.showModal.success('Éxito', 'Préstamo marcado como devuelto');
          loadActiveLoans();
          loadLoansHistory();
        } else {
          window.showModal.error('Error', result.error);
        }
      }
    } else {
      // Fallback a confirm nativo si el modal no está disponible
      if (confirm('¿Confirmar devolución de este préstamo?')) {
        const result = await window.LoansAPI.returnLoan(loanId);
        if (result.success) {
          alert('Préstamo marcado como devuelto');
          loadActiveLoans();
          loadLoansHistory();
        } else {
          alert('Error: ' + result.error);
        }
      }
    }
  };

  // ============================================
  // CARGAR HISTORIAL DE PRÉSTAMOS
  // ============================================

  async function loadLoansHistory(filters = {}) {
    const container = document.getElementById('loansHistoryContainer');

    container.innerHTML = '<p class="text-secondary">Cargando...</p>';

    const result = await window.LoansAPI.getLoansHistory(filters);

    if (!result.success) {
        container.innerHTML = `<p class="text-secondary">Error al cargar historial: ${result.error}</p>`;
        return;
    }

    const loans = result.data;

    if (loans.length === 0) {
        container.innerHTML = '<p class="text-secondary">No hay préstamos registrados</p>';
        return;
    }

    const loansHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Estudiante</th>
          <th>Categoría</th>
          <th>Ítem</th>
          <th>Prestado</th>
          <th>Devuelto</th>
          <th>Duración</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${loans.map(loan => `
          <tr>
            <td>
              <strong>${loan.student_name}</strong><br>
              <small class="text-secondary">${loan.student_code}</small>
            </td>
            <td><span class="status-badge ${loan.category}">${loan.category === 'biblioteca' ? 'Biblioteca' : 'Laboratorio'}</span></td>
            <td>${loan.item_type}</td>
            <td>${formatDate(loan.borrowed_at)}</td>
            <td>${loan.returned_at ? formatDate(loan.returned_at) : '-'}</td>
            <td>${loan.days_duration} día${loan.days_duration !== 1 ? 's' : ''}</td>
            <td><span class="status-badge ${loan.status}">${loan.status === 'active' ? 'Activo' : 'Devuelto'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

    container.innerHTML = loansHTML;
}

  // ============================================
  // FILTROS DE HISTORIAL
  // ============================================

  function clearLoansFilters() {
    document.getElementById('filterLoanStudent').value = '';
    document.getElementById('filterLoanCategory').value = '';
    document.getElementById('filterLoanStatus').value = '';
    loadLoansHistory();
  }

  function applyLoansFilters() {
    const filters = {
        studentCode: document.getElementById('filterLoanStudent').value.trim(),
        category: document.getElementById('filterLoanCategory').value,
        status: document.getElementById('filterLoanStatus').value
    };

    // Remover filtros vacíos
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });

    loadLoansHistory(filters);
  }

  // ============================================
  // UTILIDADES
  // ============================================

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
  }

  // Exponer initLoans globalmente
  window.StaffLoans = {
    init: initLoans
  };
})();
