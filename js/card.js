/**
 * ============================================
 * GENERADOR DE CARNET CON CÓDIGO DE BARRAS ESCANEABLE
 * Sistema de Carnet Digital - Universidad del Pacífico
 * ============================================
 * 
 * DESCRIPCIÓN:
 * Maneja la generación, renderizado y actualización del carnet digital,
 * incluyendo la actualización de datos del estudiante, generación de
 * código de barras y configuración de descarga de PDF.
 * 
 * FUNCIONALIDADES:
 * - Actualización de datos del carnet (frente y reverso)
 * - Generación de código de barras escaneable
 * - Configuración de descarga de PDF
 * - Manejo de foto del estudiante
 * - Formateo de fechas en español
 * 
 * DEPENDENCIAS:
 * - JsBarcode: para generación de códigos de barras
 * - html2canvas: para captura de elementos
 * - jsPDF: para generación de PDFs
 * 
 * ============================================
 */

(function() {
  'use strict';

  /**
   * Verificar que las librerías necesarias estén disponibles
   * @returns {boolean} true si JsBarcode está disponible
   */
  function checkLibraries() {
    if (typeof JsBarcode === 'undefined') {
      console.error('JsBarcode no está disponible');
      return false;
    }
    return true;
  }

  /**
   * Formatear fecha a formato español legible
   * @param {string} dateString - Fecha en formato YYYY-MM-DD o formato español
   * @returns {string} Fecha formateada en español (ej: "15 ENERO 2025")
   */
  function formatDateToSpanish(dateString) {
    if (!dateString) return '';
    
    // Si ya viene en formato legible, retornarlo
    if (dateString.includes(' ')) return dateString;
    
    try {
      const date = new Date(dateString + 'T00:00:00');
      const months = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
      ];
      
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      
      return `${day} ${month} ${year}`;
    } catch (e) {
      return dateString;
    }
  }

  /**
   * Generar código codificado para el código de barras
   * @param {Object} data - Datos del estudiante
   * @param {string} data.code - Código del estudiante
   * @returns {string} Código en formato "UPAC-{codigo}"
   */
  function encodeStudentData(data) {
    // Formato: UPAC-{codigo} para identificar carnets de Universidad del Pacífico
    return `UPAC-${data.code}`;
  }

  /**
   * Decodificar datos del código de barras escaneado
   * @param {string} encodedString - Código escaneado (formato "UPAC-{codigo}" o solo código)
   * @returns {Promise<Object|null>} Datos del estudiante o null si no se encuentra
   */
  async function decodeStudentData(encodedString) {
    try {
      let code = '';
      if (encodedString.startsWith('UPAC-')) {
        code = encodedString.substring(5);
      } else {
        code = encodedString;
      }
      
      if (!code) {
        return { code: '' };
      }
      
      // Consultar datos del estudiante en Supabase
      try {
        if (window.Supabase) {
          const { data: studentData, error: studentError } = await window.Supabase
            .from('students')
            .select('code, cedula, name, lastname, program, expiry, sede, rh, photo, active')
            .eq('code', code)
            .single();

          if (!studentError && studentData) {
            return studentData;
          }
        }
      } catch (e) {
        console.warn('Error al consultar Supabase:', e);
      }
      
      // Fallback: retornar código básico
      return { code: code };
    } catch (error) {
      console.error('Error al decodificar datos:', error);
      return null;
    }
  }

  /**
   * Generar código de barras visual en el carnet
   * @param {string} encodedValue - Valor codificado para el código de barras (formato UPAC-xxx)
   * @param {string} displayCode - Código a mostrar visiblemente debajo del código de barras
   * @param {string} elementId - ID del elemento SVG donde generar el código (default: '#barcode')
   */
  function generateBarcode(encodedValue, displayCode, elementId = '#barcode') {
    if (!checkLibraries()) {
      console.error('JsBarcode no está disponible');
      if (window.showModal) {
        window.showModal.error('Error', 'La librería JsBarcode no está disponible.');
      }
      return;
    }

    // Función auxiliar para localizar el elemento
    function findBarcodeElement() {
      let barcodeSvg = document.querySelector(elementId);
      
      // Buscar por getElementById si el selector falla
      if (!barcodeSvg && elementId.startsWith('#')) {
        barcodeSvg = document.getElementById(elementId.substring(1));
      }
      
      // Buscar elemento con id="barcode" como alternativa
      if (!barcodeSvg) {
        barcodeSvg = document.getElementById('barcode');
      }
      
      return barcodeSvg;
    }

    // Buscar el elemento
    let barcodeSvg = findBarcodeElement();
    
    // Reintentos de búsqueda con intervalo de tiempo
    if (!barcodeSvg) {
      let attempts = 0;
      const maxAttempts = 5;
      
      const tryFind = () => {
        barcodeSvg = findBarcodeElement();
        attempts++;
        
        if (!barcodeSvg && attempts < maxAttempts) {
          setTimeout(tryFind, 100);
          return;
        }
        
        // Procesar resultado de búsqueda
        if (barcodeSvg) {
          generateBarcodeNow(barcodeSvg, encodedValue, displayCode, elementId);
        } else {
          // Elemento no encontrado tras múltiples intentos
          if (window.showModal) {
            window.showModal.warning('Advertencia', 'No se pudo encontrar el elemento para generar el código de barras. Asegúrate de que el carnet esté visible.');
          }
        }
      };
      
      tryFind();
      return;
    }

    // Generar código de barras en el elemento encontrado
    generateBarcodeNow(barcodeSvg, encodedValue, displayCode, elementId);
  }

  /**
   * Función auxiliar para generar el código de barras en el elemento SVG
   * @param {HTMLElement} barcodeSvg - Elemento SVG contenedor
   * @param {string} encodedValue - Valor codificado para el código de barras
   * @param {string} displayCode - Código a mostrar visiblemente
   * @param {string} elementId - ID del elemento (para referencia)
   * @returns {void}
   */
  function generateBarcodeNow(barcodeSvg, encodedValue, displayCode, elementId) {
    // Limpiar contenido anterior
    while (barcodeSvg.firstChild) {
      barcodeSvg.removeChild(barcodeSvg.firstChild);
    }

    // Crear un elemento SVG dentro del contenedor
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgElement.setAttribute('id', 'barcode-svg-element');
    barcodeSvg.appendChild(svgElement);

    // Configurar visibilidad del elemento
    barcodeSvg.style.display = 'flex';
    barcodeSvg.style.visibility = 'visible';
    barcodeSvg.style.opacity = '1';

    try {
      // Usar el SVG recién creado para generar el código de barras
      const svgSelector = '#barcode-svg-element';
      JsBarcode(svgSelector, encodedValue, {
        format: "CODE128",
        width: 2,
        height: 60,
        displayValue: true,
        text: displayCode, // Mostrar código del estudiante visiblemente
        fontSize: 12,
        textMargin: 5,
        background: "#ffffff",
        lineColor: "#000000",
        margin: 8,
        marginTop: 8,
        marginBottom: 8,
        valid: function(valid) {
          if (!valid) {
            console.error('Código de barras no válido');
          }
        }
      });
    } catch (error) {
      console.error('Error al generar código de barras:', error);
      // Método alternativo usando el elemento SVG directamente
      try {
        JsBarcode(svgElement, encodedValue, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          text: displayCode,
          fontSize: 12,
          textMargin: 5,
          background: "#ffffff",
          lineColor: "#000000",
          margin: 8,
          marginTop: 8,
          marginBottom: 8
        });
        // Código de barras generado con método alternativo
      } catch (secondError) {
        console.error('Error al generar código de barras (método alternativo):', secondError);
        if (window.showModal) {
          window.showModal.error('Error', 'No se pudo generar el código de barras: ' + (secondError?.message || String(secondError)));
        }
      }
    }
  }

  /**
   * Actualizar todos los elementos visuales del carnet con los datos del estudiante
   * @param {Object} data - Datos del estudiante (name, lastname, code, cedula, program, expiry, sede, rh, photo)
   */
  function updateCardData(data) {
    // Elementos del frente del carnet
    const displayName = document.getElementById('displayName');
    const displayCed = document.getElementById('displayCed');
    const displayProgram = document.getElementById('displayProgram');
    const displayCode = document.getElementById('displayCode');
    const displayCedula = document.getElementById('displayCedula');
    const sedeFront = document.getElementById('sedeFront');
    const profileImage = document.getElementById('profileImage');

    if (displayName) displayName.textContent = data.name || '';
    if (displayCed) displayCed.textContent = data.lastname || '';
    if (displayCedula) displayCedula.textContent = `C.C. ${data.cedula || ''}`;
    if (displayProgram) displayProgram.textContent = data.program || '';
    if (displayCode) displayCode.textContent = data.code || '';
    if (sedeFront) sedeFront.textContent = data.sede || '';

    // Reverso
    const expiryDate = document.getElementById('expiryDate');
    const barcodeText = document.getElementById('barcodeText');

    if (expiryDate) {
      const formattedDate = formatDateToSpanish(data.expiry);
      expiryDate.textContent = formattedDate;
    }
    if (barcodeText) barcodeText.textContent = data.code || '';

    // Foto
    if (profileImage) {
      if (data.photo) {
        profileImage.src = data.photo;
      } else {
        profileImage.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400'%3E%3Crect fill='%23f0f0f0' width='300' height='400'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='14' fill='%23999' text-anchor='middle' dy='.3em'%3ESube tu foto%3C/text%3E%3C/svg%3E";
      }
    }
  }


  /**
   * Configurar el botón de descarga de PDF del carnet
   * Genera un PDF con ambas caras del carnet (frente y reverso) lado a lado
   */
  function setupDownloadPdf() {
    // Localizar botón de descarga en el DOM
    let downloadPdfBtn = document.getElementById('downloadPdfBtn');
    
    // Reintentar búsqueda con retraso si no existe
    if (!downloadPdfBtn) {
      setTimeout(() => {
        downloadPdfBtn = document.getElementById('downloadPdfBtn');
        if (downloadPdfBtn && !downloadPdfBtn.hasAttribute('data-listener-added')) {
          attachDownloadListener(downloadPdfBtn);
        }
      }, 500);
      return;
    }
    
    if (!downloadPdfBtn.hasAttribute('data-listener-added')) {
      attachDownloadListener(downloadPdfBtn);
    }
  }

  /**
   * Adjunta el listener al botón de descarga
   */
  function attachDownloadListener(btn) {
    if (!btn) return;
    btn.setAttribute('data-listener-added', 'true');
    
    btn.addEventListener('click', async function() {
      if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        if (window.showModal) {
          window.showModal.error('Error', 'Las librerías necesarias para generar el PDF no están disponibles.');
        } else {
          alert('Las librerías necesarias para generar el PDF no están disponibles.');
        }
        return;
      }

      const frontNode = document.getElementById('cardFront');
      const backNode = document.getElementById('cardBack');

      if (!frontNode || !backNode) {
        if (window.showModal) {
          window.showModal.error('Error', 'No se encontraron los elementos del carnet.');
        } else {
          alert('No se encontraron los elementos del carnet.');
        }
        return;
      }

      this.disabled = true;
      this.textContent = 'Generando PDF...';
      document.body.classList.add('loading');

      const scale = 2;
      const opts = {
        scale: scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true
      };

      try {
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

        // Calcular escalas para que ambas caras quepan lado a lado
        const scaleFront = Math.min(
          cardW / canvasFront.width,
          (pageH - margin * 2) / canvasFront.height
        );
        const scaleBack = Math.min(
          cardW / canvasBack.width,
          (pageH - margin * 2) / canvasBack.height
        );

        // Usar la misma escala para ambas (la menor)
        const finalScale = Math.min(scaleFront, scaleBack);

        const fw = canvasFront.width * finalScale;
        const fh = canvasFront.height * finalScale;
        const bw = canvasBack.width * finalScale;
        const bh = canvasBack.height * finalScale;

        // Calcular posición vertical centrada
        const yPos = (pageH - Math.max(fh, bh)) / 2;

        // Insertar frente (izquierda) - mismo sentido, sin rotación
        doc.addImage(imgFront, 'PNG', margin, yPos, fw, fh, '', 'FAST');

        // Insertar reverso (derecha) - mismo sentido, lado a lado, sin rotación
        doc.addImage(imgBack, 'PNG', margin + cardW + gap, yPos, bw, bh, '', 'FAST');

        // Obtener código del estudiante
        const studentCode = document.getElementById('displayCode')?.textContent || 'carnet';
        doc.save(`carnet_${studentCode}.pdf`);
        
        if (window.showModal) {
          window.showModal.success('PDF Generado', 'El PDF se ha generado y descargado correctamente.');
        } else {
          alert('PDF generado y descargado correctamente.');
        }
      } catch (err) {
        console.error('Error al generar PDF:', err);
        if (window.showModal) {
          window.showModal.error('Error al Generar PDF', 'No se pudo generar el PDF: ' + (err?.message || String(err)));
        } else {
          alert('Error al generar PDF: ' + (err?.message || String(err)));
        }
      } finally {
        btn.disabled = false;
        const btnText = btn.querySelector('svg') ? btn.innerHTML.replace('Generando PDF...', '') : 'Descargar PDF';
        if (btn.innerHTML) {
          btn.innerHTML = btn.innerHTML.includes('Generando') ? 
            btn.innerHTML.replace('Generando PDF...', btnText) : btnText;
        } else {
          btn.textContent = 'Descargar PDF';
        }
        document.body.classList.remove('loading');
      }
    });
  }

  /**
   * Función principal para generar y renderizar el carnet digital
   * @param {Object} data - Datos del estudiante
   * @param {string} data.name - Nombre del estudiante
   * @param {string} data.lastname - Apellidos del estudiante
   * @param {string} data.code - Código del estudiante
   * @param {string} data.cedula - Cédula de identidad
   * @param {string} data.program - Programa académico
   * @param {string} data.expiry - Fecha de expiración
   * @param {string} data.sede - Sede de la universidad
   * @param {string} data.rh - Factor RH (opcional)
   * @param {string} data.photo - Foto en Base64 (opcional)
   */
  window.generateCard = function(data) {
    // Actualizar datos en el carnet
    updateCardData(data);

    const encodedData = encodeStudentData(data);
    
    setTimeout(() => {
      generateBarcode(encodedData, data.code);
    }, 100);

    setupDownloadPdf();
  };

  /**
   * Función global para decodificar códigos de barras escaneados
   * Disponible para el validador y otros módulos
   */
  window.decodeStudentData = decodeStudentData;
})();
