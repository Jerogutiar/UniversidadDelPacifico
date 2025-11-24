/**
 * ============================================
 * SISTEMA DE PRÉSTAMOS - BIBLIOTECA Y LABORATORIO
 * Universidad del Pacífico - Carnet Digital
 * ============================================
 * 
 * Funciones para gestionar préstamos de ítems de biblioteca
 * y laboratorio a estudiantes.
 */

(function() {
  'use strict';

  // Catálogo de ítems de biblioteca
  const LIBRARY_ITEMS = [
    'Computador de escritorio',
    'Computador portátil',
    'Audífonos',
    'Libros',
    'Juegos de mesa'
  ];

  /**
   * Obtener cliente de Supabase
   */
  async function getSupabase() {
    if (!window.API) {
      throw new Error('API no está disponible');
    }
    return await window.API.getClient();
  }

  /**
   * Registrar un nuevo préstamo
   * @param {Object} loanData - Datos del préstamo
   * @returns {Promise<Object>} Resultado de la operación
   */
  async function registerLoan(loanData) {
    try {
        const supabase = await getSupabase();
        
        // Preparar datos con fecha/hora personalizada o actual
        const borrowedAt = loanData.borrowedAt || new Date().toISOString();
        
        const { data, error } = await supabase
            .from('loans')
            .insert([{
                student_code: loanData.studentCode,
                student_name: loanData.studentName,
                category: loanData.category,
                item_type: loanData.itemType,
                item_description: loanData.itemDescription || null,
                staff_email: loanData.staffEmail,
                staff_name: loanData.staffName,
                borrowed_at: borrowedAt,
                status: 'active'
            }])
            .select()
            .single();

        if (error) throw error;

        return { success: true, data };
    } catch (error) {
        console.error('Error al registrar préstamo:', error);
        return { success: false, error: error.message };
    }
  }

  /**
   * Marcar un préstamo como devuelto
   * @param {string} loanId - ID del préstamo
   * @returns {Promise<Object>} Resultado de la operación
   */
  async function returnLoan(loanId) {
    try {
        const supabase = await getSupabase();
        
        const { data, error } = await supabase
            .from('loans')
            .update({
                status: 'returned',
                returned_at: new Date().toISOString()
            })
            .eq('id', loanId)
            .select()
            .single();

        if (error) throw error;

        return { success: true, data };
    } catch (error) {
        console.error('Error al marcar devolución:', error);
        return { success: false, error: error.message };
    }
  }

  /**
   * Obtener todos los préstamos activos
   * @returns {Promise<Array>} Lista de préstamos activos
   */
  async function getActiveLoans() {
    try {
        const supabase = await getSupabase();
        
        const { data, error } = await supabase
            .from('loans')
            .select('*')
            .eq('status', 'active')
            .order('borrowed_at', { ascending: false });

        if (error) throw error;

        // Calcular días transcurridos
        const loansWithDays = (data || []).map(loan => {
            const borrowed = new Date(loan.borrowed_at);
            const now = new Date();
            const daysDiff = Math.floor((now - borrowed) / (1000 * 60 * 60 * 24));
            return { ...loan, days_borrowed: daysDiff };
        });

        return { success: true, data: loansWithDays };
    } catch (error) {
        console.error('Error al obtener préstamos activos:', error);
        return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Obtener historial completo de préstamos
   * @param {Object} filters - Filtros opcionales
   * @returns {Promise<Array>} Lista de préstamos
   */
  async function getLoansHistory(filters = {}) {
    try {
        const supabase = await getSupabase();
        
        let query = supabase
            .from('loans')
            .select('*');

        // Aplicar filtros si existen
        if (filters.category) {
            query = query.eq('category', filters.category);
        }
        if (filters.status) {
            query = query.eq('status', filters.status);
        }
        if (filters.studentCode) {
            query = query.eq('student_code', filters.studentCode);
        }

        query = query.order('borrowed_at', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        // Calcular duración de préstamos
        const loansWithDuration = (data || []).map(loan => {
            const borrowed = new Date(loan.borrowed_at);
            const returned = loan.returned_at ? new Date(loan.returned_at) : new Date();
            const daysDiff = Math.floor((returned - borrowed) / (1000 * 60 * 60 * 24));
            return { ...loan, days_duration: daysDiff };
        });

        return { success: true, data: loansWithDuration };
    } catch (error) {
        console.error('Error al obtener historial:', error);
        return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Verificar si un estudiante existe
   * @param {string} studentCode - Código del estudiante
   * @returns {Promise<Object>} Datos del estudiante si existe
   */
  async function validateStudent(studentCode) {
    try {
        const supabase = await getSupabase();
        
        const { data, error } = await supabase
            .from('students')
            .select('code, name, lastname, program, sede')
            .eq('code', studentCode)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return { success: false, error: 'Estudiante no encontrado' };
            }
            throw error;
        }

        return { success: true, data };
    } catch (error) {
        console.error('Error al validar estudiante:', error);
        return { success: false, error: error.message };
    }
  }

  /**
   * Obtener préstamos activos de un estudiante específico
   * @param {string} studentCode - Código del estudiante
   * @returns {Promise<Array>} Lista de préstamos activos del estudiante
   */
  async function getStudentActiveLoans(studentCode) {
    try {
        const supabase = await getSupabase();
        
        const { data, error } = await supabase
            .from('loans')
            .select('*')
            .eq('student_code', studentCode)
            .eq('status', 'active')
            .order('borrowed_at', { ascending: false });

        if (error) throw error;

        return { success: true, data: data || [] };
    } catch (error) {
        console.error('Error al obtener préstamos del estudiante:', error);
        return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Obtener todos los préstamos (activos y devueltos)
   * @returns {Promise<Object>} Todos los préstamos
   */
  async function getAllLoans() {
    return await getLoansHistory();
  }

  // API pública
  window.LoansAPI = {
    LIBRARY_ITEMS,
    registerLoan,
    returnLoan,
    getActiveLoans,
    getLoansHistory,
    getAllLoans,
    validateStudent,
    getStudentActiveLoans
  };
})();
