import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import html2pdf from 'html2pdf.js';

/**
 * Genera HTML formateado para impresión
 * @param {Object} datos - Datos completos del presupuesto
 * @returns {string} HTML completo para imprimir
 */
const generarHTMLImpresion = (datos) => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Presupuesto ${datos.numeroPresupuesto || 'Nuevo'} - v${datos.version || 1}</title>
      <style>
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { margin: 0; }
        }

        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 11pt;
          line-height: 1.4;
          color: #333;
          max-width: 210mm;
          margin: 0 auto;
          padding: 10mm;
        }

        h1 {
          color: #0056b3;
          font-size: 24pt;
          margin-bottom: 5px;
          border-bottom: 3px solid #0056b3;
          padding-bottom: 10px;
        }

        h2 {
          color: #28a745;
          font-size: 16pt;
          margin-top: 20px;
          margin-bottom: 10px;
          border-bottom: 2px solid #28a745;
          padding-bottom: 5px;
        }

        h3 {
          color: #666;
          font-size: 13pt;
          margin-top: 15px;
          margin-bottom: 8px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 20px;
        }

        .header-info {
          flex: 1;
        }

        .header-meta {
          text-align: right;
          color: #666;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 10pt;
        }

        th {
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          padding: 8px;
          text-align: left;
          font-weight: bold;
          color: #495057;
        }

        td {
          border: 1px solid #dee2e6;
          padding: 8px;
        }

        tr:nth-child(even) {
          background-color: #f8f9fa;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 15px 0;
        }

        .info-item {
          padding: 8px;
          background-color: #f8f9fa;
          border-left: 3px solid #0056b3;
        }

        .info-label {
          font-weight: bold;
          color: #666;
          font-size: 9pt;
          text-transform: uppercase;
        }

        .info-value {
          color: #333;
          margin-top: 3px;
        }

        .total-box {
          background-color: #d1ecf1;
          border: 2px solid #0c5460;
          padding: 15px;
          margin: 20px 0;
          text-align: right;
          font-size: 14pt;
          font-weight: bold;
        }

        .subtotal {
          text-align: right;
          font-weight: bold;
          padding-top: 10px;
          border-top: 2px solid #dee2e6;
        }

        .page-break {
          page-break-before: always;
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 9pt;
          font-weight: bold;
        }

        .badge-success { background-color: #d4edda; color: #155724; }
        .badge-warning { background-color: #fff3cd; color: #856404; }
        .badge-info { background-color: #d1ecf1; color: #0c5460; }
        .badge-secondary { background-color: #e2e3e5; color: #383d41; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-info">
          <h1>📋 PRESUPUESTO</h1>
          <p style="font-size: 14pt; margin: 5px 0;">${datos.nombreEmpresa || 'Sin empresa'}</p>
        </div>
        <div class="header-meta">
          <p><strong>Nº:</strong> ${datos.numeroPresupuesto || 'Nuevo'}</p>
          <p><strong>Versión:</strong> ${datos.version || 1}</p>
          <p><strong>Estado:</strong> <span class="badge badge-${getBadgeClass(datos.estado)}">${formatEstado(datos.estado)}</span></p>
          <p><strong>Fecha:</strong> ${formatFecha(datos.fechaEmision)}</p>
        </div>
      </div>

      <h2>📍 Información General</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Solicitante</div>
          <div class="info-value">${datos.nombreSolicitante || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Teléfono</div>
          <div class="info-value">${datos.telefono || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Email</div>
          <div class="info-value">${datos.mail || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Dirección Particular</div>
          <div class="info-value">${datos.direccionParticular || '-'}</div>
        </div>
      </div>

      <h2>🏗️ Dirección de Obra</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Barrio</div>
          <div class="info-value">${datos.direccionObraBarrio || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Calle y Altura</div>
          <div class="info-value">${datos.direccionObraCalle || ''} ${datos.direccionObraAltura || ''}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Torre</div>
          <div class="info-value">${datos.direccionObraTorre || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Piso / Depto</div>
          <div class="info-value">${datos.direccionObraPiso || '-'} / ${datos.direccionObraDepartamento || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Localidad</div>
          <div class="info-value">${datos.direccionObraLocalidad || '-'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Provincia</div>
          <div class="info-value">${datos.direccionObraProvincia || '-'}</div>
        </div>
      </div>

      <h2>📅 Fechas y Plazos</h2>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Fecha Probable Inicio</div>
          <div class="info-value">${formatFecha(datos.fechaProbableInicio)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Vencimiento</div>
          <div class="info-value">${formatFecha(datos.vencimiento)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Fecha Creación</div>
          <div class="info-value">${formatFecha(datos.fechaCreacion)}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Tiempo Estimado</div>
          <div class="info-value">${datos.tiempoEstimadoTerminacion ? `${datos.tiempoEstimadoTerminacion} días` : '-'}</div>
        </div>
      </div>

      ${datos.descripcion ? `
        <h2>📝 Descripción</h2>
        <p>${datos.descripcion}</p>
      ` : ''}

      ${datos.observaciones ? `
        <h2>💬 Observaciones</h2>
        <p>${datos.observaciones}</p>
      ` : ''}

      ${generarSeccionConfiguracion(datos)}
      ${generarSeccionProfesionales(datos)}
      ${generarSeccionMateriales(datos)}
      ${generarSeccionOtrosCostos(datos)}

      <div class="total-box">
        💰 TOTAL PRESUPUESTO: $${formatMoneda(datos.montoTotal || 0)}
      </div>

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #999; font-size: 9pt;">
        <p>Documento generado el ${new Date().toLocaleString('es-AR')}</p>
      </div>
    </body>
    </html>
  `;
};

/**
 * Genera sección de Configuración del Presupuesto (solo si está visible)
 */
const generarSeccionConfiguracion = (datos) => {
  if (!datos.incluirConfiguracion) return '';

  let html = '<div class="page-break"></div><h2>⚙️ Configuración del Presupuesto</h2>';

  // Profesionales
  if (datos.configsProfesionales && datos.configsProfesionales.length > 0) {
    html += '<h3>👷 Profesionales</h3>';
    html += '<table><thead><tr><th>Tipo</th><th>Modalidad</th><th>Importe</th><th>Cantidad</th><th>Subtotal</th></tr></thead><tbody>';

    let totalProf = 0;
    datos.configsProfesionales.forEach(config => {
      const modo = config.modoSeleccionado || 'hora';
      const importe = Number(config[`importe${modo.charAt(0).toUpperCase() + modo.slice(1)}`] || 0);
      const cantidadKey = modo === 'hora' ? 'cantidadHoras' :
                          modo === 'dia' ? 'cantidadDias' :
                          modo === 'semana' ? 'cantidadSemanas' : 'cantidadMeses';
      const cantidad = Number(config[cantidadKey] || 0);
      const subtotal = importe * cantidad;
      totalProf += subtotal;

      html += `<tr>
        <td>${config.esGeneral ? '<em>General</em>' : config.tipoProfesional || '-'}</td>
        <td>Por ${modo}</td>
        <td>$${formatMoneda(importe)}</td>
        <td>${cantidad} ${modo}${cantidad > 1 ? 's' : ''}</td>
        <td>$${formatMoneda(subtotal)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    html += `<div class="subtotal">Subtotal Profesionales: $${formatMoneda(totalProf)}</div>`;
  }

  // Materiales
  if (datos.configsMateriales && datos.configsMateriales.length > 0) {
    html += '<h3>🧱 Materiales</h3>';
    html += '<table><thead><tr><th>Material</th><th>Categoría</th><th>Cantidad</th><th>Unidad</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead><tbody>';

    let totalMat = 0;
    datos.configsMateriales.forEach(config => {
      const subtotal = Number(config.presupuestoTotal || 0);
      totalMat += subtotal;

      html += `<tr>
        <td>${config.esGeneral ? '<em>General</em>' : config.tipoMaterial || '-'}</td>
        <td>${config.categoria || '-'}</td>
        <td>${config.cantidad || 0}</td>
        <td>${config.unidadMedida || '-'}</td>
        <td>$${formatMoneda(Number(config.presupuestoTotal || 0) / (Number(config.cantidad) || 1))}</td>
        <td>$${formatMoneda(subtotal)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    html += `<div class="subtotal">Subtotal Materiales: $${formatMoneda(totalMat)}</div>`;
  }

  // Otros Costos
  if (datos.configsOtros && datos.configsOtros.length > 0) {
    html += '<h3>💼 Otros Costos</h3>';
    html += '<table><thead><tr><th>Descripción</th><th>Categoría</th><th>Importe</th></tr></thead><tbody>';

    let totalOtros = 0;
    datos.configsOtros.forEach(config => {
      const importe = Number(config.presupuestoTotal || 0);
      totalOtros += importe;

      html += `<tr>
        <td>${config.esGeneral ? '<em>General</em>' : config.descripcion || '-'}</td>
        <td>${config.categoria || '-'}</td>
        <td>$${formatMoneda(importe)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    html += `<div class="subtotal">Subtotal Otros: $${formatMoneda(totalOtros)}</div>`;
  }

  return html;
};

/**
 * Genera sección de Profesionales detallados (solo si está visible)
 */
const generarSeccionProfesionales = (datos) => {
  if (!datos.incluirProfesionales || !datos.profesionales || datos.profesionales.length === 0) return '';

  let html = '<div class="page-break"></div><h2>👷 Profesionales Asignados (Detalle)</h2>';
  html += '<table><thead><tr><th>Tipo</th><th>Modalidad</th><th>Importe</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>';

  let total = 0;
  datos.profesionales.forEach(prof => {
    const importeCalc = Number(prof.importeCalculado || 0);
    total += importeCalc;

    const modo = prof.importeXHora ? 'hora' :
                 prof.importeXDia ? 'día' :
                 prof.importeXSemana ? 'semana' :
                 prof.importeXMes ? 'mes' : 'obra';

    const importe = prof.importeXHora || prof.importeXDia || prof.importeXSemana || prof.importeXMes || prof.importeXObra || 0;
    const cantidad = prof.cantidadHoras || prof.cantidadDias || prof.cantidadSemanas || prof.cantidadMeses || 1;

    html += `<tr>
      <td>${prof.tipoProfesional || '-'}</td>
      <td>Por ${modo}</td>
      <td>$${formatMoneda(Number(importe))}</td>
      <td>${cantidad}</td>
      <td>$${formatMoneda(importeCalc)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  html += `<div class="subtotal">Total Profesionales: $${formatMoneda(total)}</div>`;

  return html;
};

/**
 * Genera sección de Materiales detallados (solo si está visible)
 */
const generarSeccionMateriales = (datos) => {
  if (!datos.incluirMateriales || !datos.materiales || datos.materiales.length === 0) return '';

  let html = '<h2>🧱 Materiales (Detalle)</h2>';
  html += '<table><thead><tr><th>Material</th><th>Cantidad</th><th>Unidad</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead><tbody>';

  let total = 0;
  datos.materiales.forEach(mat => {
    const cantidad = Number(mat.cantidad || 0);
    const precioUnit = Number(mat.precioUnitario || 0);
    const subtotal = cantidad * precioUnit;
    total += subtotal;

    html += `<tr>
      <td>${mat.tipoMaterial || '-'}</td>
      <td>${cantidad}</td>
      <td>${mat.unidadMedida || '-'}</td>
      <td>$${formatMoneda(precioUnit)}</td>
      <td>$${formatMoneda(subtotal)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  html += `<div class="subtotal">Total Materiales: $${formatMoneda(total)}</div>`;

  return html;
};

/**
 * Genera sección de Otros Costos detallados (solo si está visible)
 */
const generarSeccionOtrosCostos = (datos) => {
  if (!datos.incluirOtrosCostos || !datos.otrosCostos || datos.otrosCostos.length === 0) return '';

  let html = '<h2>💼 Otros Costos (Detalle)</h2>';
  html += '<table><thead><tr><th>Descripción</th><th>Categoría</th><th>Importe</th></tr></thead><tbody>';

  let total = 0;
  datos.otrosCostos.forEach(costo => {
    const importe = Number(costo.importe || 0);
    total += importe;

    html += `<tr>
      <td>${costo.descripcion || '-'}</td>
      <td>${costo.categoria || '-'}</td>
      <td>$${formatMoneda(importe)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  html += `<div class="subtotal">Total Otros Costos: $${formatMoneda(total)}</div>`;

  return html;
};

// Funciones auxiliares de formato
const formatMoneda = (valor) => {
  return Number(valor || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatFecha = (fecha) => {
  if (!fecha) return '-';
  const date = new Date(fecha);
  return date.toLocaleDateString('es-AR');
};

const formatEstado = (estado) => {
  const estados = {
    'BORRADOR': 'Borrador',
    'A_ENVIAR': 'A Enviar',
    'ENVIADO': 'Enviado',
    'MODIFICADO': 'Modificado',
    'APROBADO': 'Aprobado',
    'OBRA_A_CONFIRMAR': 'Obra a Confirmar',
    'EN_EJECUCION': 'En Ejecución',
    'SUSPENDIDA': 'Suspendida',
    'TERMINADO': 'Terminado',
    'CANCELADO': 'Cancelado'
  };
  return estados[estado] || estado || '-';
};

const getBadgeClass = (estado) => {
  const clases = {
    'BORRADOR': 'secondary',
    'A_ENVIAR': 'success',
    'ENVIADO': 'info',
    'MODIFICADO': 'warning',
    'APROBADO': 'success',
    'OBRA_A_CONFIRMAR': 'warning',
    'EN_EJECUCION': 'primary',
    'SUSPENDIDA': 'danger',
    'TERMINADO': 'dark',
    'CANCELADO': 'danger'
  };
  return clases[estado] || 'secondary';
};

/**
 * Imprime el contenido actual usando el sistema de Windows
 * Permite guardar como PDF o imprimir directamente
 * @param {Object} datosCompletos - Datos completos del presupuesto con flags de secciones visibles
 */
export const handlePrint = (datosCompletos) => {
  // Crear una ventana nueva para imprimir con formato personalizado
  const ventanaImpresion = window.open('', '_blank');

  const htmlContent = generarHTMLImpresion(datosCompletos);

  ventanaImpresion.document.write(htmlContent);
  ventanaImpresion.document.close();

  // Esperar a que cargue el contenido antes de imprimir
  ventanaImpresion.onload = () => {
    ventanaImpresion.print();
  };
};

/**
 * Exporta datos a Excel (.xlsx)
 * @param {Array<Object>} data - Array de objetos con los datos a exportar
 * @param {string} filename - Nombre del archivo sin extensión
 * @param {string} sheetName - Nombre de la hoja de Excel
 */
export const exportToExcel = (data, filename = 'export', sheetName = 'Datos') => {
  try {
    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();

    // Crear hoja de trabajo desde el array de datos
    const ws = XLSX.utils.json_to_sheet(data);

    // Agregar la hoja al libro
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Generar archivo y descargarlo
    XLSX.writeFile(wb, `${filename}.xlsx`);

    return true;
  } catch (error) {
    console.error('Error al exportar a Excel:', error);
    return false;
  }
};

/**
 * Exporta datos a CSV
 * @param {Array<Object>} data - Array de objetos con los datos a exportar
 * @param {string} filename - Nombre del archivo sin extensión
 */
export const exportToCSV = (data, filename = 'export') => {
  try {
    // Crear hoja de trabajo
    const ws = XLSX.utils.json_to_sheet(data);

    // Convertir a CSV
    const csv = XLSX.utils.sheet_to_csv(ws);

    // Crear blob y descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (error) {
    console.error('Error al exportar a CSV:', error);
    return false;
  }
};

/**
 * Exporta datos a JSON
 * @param {Array<Object>|Object} data - Datos a exportar
 * @param {string} filename - Nombre del archivo sin extensión
 */
export const exportToJSON = (data, filename = 'export') => {
  try {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (error) {
    console.error('Error al exportar a JSON:', error);
    return false;
  }
};

/**
 * Prepara datos de presupuesto para exportación a Excel
 * Genera una estructura clara y organizada por secciones
 * @param {Object} presupuesto - Objeto con datos del presupuesto
 * @returns {Array} Array de objetos formateados para Excel/CSV
 */
export const prepararDatosPresupuesto = (presupuesto) => {
  const datos = [];

  // ========== ENCABEZADO ==========
  datos.push({
    'SECCIÓN': '═══════════════════════════════════════════════════════════',
    'CAMPO': '',
    'VALOR': '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': 'PRESUPUESTO',
    'CAMPO': `Nº ${presupuesto.numeroPresupuesto || 'NUEVO'} - Versión ${presupuesto.version || 1}`,
    'VALOR': presupuesto.nombreEmpresa || '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '═══════════════════════════════════════════════════════════',
    'CAMPO': '',
    'VALOR': '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({}); // Línea en blanco

  // ========== INFORMACIÓN GENERAL ==========
  datos.push({
    'SECCIÓN': '📋 INFORMACIÓN GENERAL',
    'CAMPO': '',
    'VALOR': '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Solicitante',
    'VALOR': presupuesto.nombreSolicitante || '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Teléfono',
    'VALOR': presupuesto.telefono || '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Email',
    'VALOR': presupuesto.mail || '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Dirección Particular',
    'VALOR': presupuesto.direccionParticular || '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Estado',
    'VALOR': presupuesto.estado || '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({}); // Línea en blanco

  // ========== DIRECCIÓN DE OBRA ==========
  datos.push({
    'SECCIÓN': '🏗️ DIRECCIÓN DE OBRA',
    'CAMPO': '',
    'VALOR': '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  const direccionCompleta = [
    presupuesto.direccionObraBarrio,
    presupuesto.direccionObraCalle,
    presupuesto.direccionObraAltura,
    presupuesto.direccionObraTorre ? `Torre ${presupuesto.direccionObraTorre}` : '',
    presupuesto.direccionObraPiso ? `Piso ${presupuesto.direccionObraPiso}` : '',
    presupuesto.direccionObraDepartamento ? `Depto ${presupuesto.direccionObraDepartamento}` : ''
  ].filter(Boolean).join(' ');

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Dirección Completa',
    'VALOR': direccionCompleta || '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Localidad',
    'VALOR': presupuesto.direccionObraLocalidad || '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Provincia',
    'VALOR': presupuesto.direccionObraProvincia || '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({}); // Línea en blanco

  // ========== FECHAS ==========
  datos.push({
    'SECCIÓN': '📅 FECHAS Y PLAZOS',
    'CAMPO': '',
    'VALOR': '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Fecha Creación',
    'VALOR': presupuesto.fechaCreacion ? new Date(presupuesto.fechaCreacion).toLocaleDateString('es-AR') : '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Fecha Probable Inicio',
    'VALOR': presupuesto.fechaProbableInicio ? new Date(presupuesto.fechaProbableInicio).toLocaleDateString('es-AR') : '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Vencimiento',
    'VALOR': presupuesto.vencimiento ? new Date(presupuesto.vencimiento).toLocaleDateString('es-AR') : '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '',
    'CAMPO': 'Tiempo Estimado',
    'VALOR': presupuesto.tiempoEstimadoTerminacion ? `${presupuesto.tiempoEstimadoTerminacion} días` : '-',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({}); // Línea en blanco

  // ========== PROFESIONALES ==========
  if (presupuesto.profesionales && presupuesto.profesionales.length > 0) {
    datos.push({
      'SECCIÓN': '👷 PROFESIONALES',
      'CAMPO': '',
      'VALOR': '',
      'CANTIDAD': '',
      'PRECIO UNITARIO': '',
      'SUBTOTAL': ''
    });

    let totalProf = 0;
    presupuesto.profesionales.forEach((prof, idx) => {
      const importe = Number(prof.importeCalculado || 0);
      totalProf += importe;

      const modo = prof.importeXHora ? 'Por Hora' :
                   prof.importeXDia ? 'Por Día' :
                   prof.importeXSemana ? 'Por Semana' :
                   prof.importeXMes ? 'Por Mes' : 'Por Obra';

      const precioUnit = prof.importeXHora || prof.importeXDia || prof.importeXSemana || prof.importeXMes || prof.importeXObra || 0;
      const cantidad = prof.cantidadHoras || prof.cantidadDias || prof.cantidadSemanas || prof.cantidadMeses || 1;

      datos.push({
        'SECCIÓN': `  ${idx + 1}`,
        'CAMPO': prof.tipoProfesional || '-',
        'VALOR': modo,
        'CANTIDAD': cantidad,
        'PRECIO UNITARIO': `$${formatMoneda(Number(precioUnit))}`,
        'SUBTOTAL': `$${formatMoneda(importe)}`
      });
    });

    datos.push({
      'SECCIÓN': '',
      'CAMPO': '',
      'VALOR': '',
      'CANTIDAD': '',
      'PRECIO UNITARIO': 'SUBTOTAL:',
      'SUBTOTAL': `$${formatMoneda(totalProf)}`
    });

    datos.push({}); // Línea en blanco
  }

  // ========== MATERIALES ==========
  if (presupuesto.materiales && presupuesto.materiales.length > 0) {
    datos.push({
      'SECCIÓN': '🧱 MATERIALES',
      'CAMPO': '',
      'VALOR': '',
      'CANTIDAD': '',
      'PRECIO UNITARIO': '',
      'SUBTOTAL': ''
    });

    let totalMat = 0;
    presupuesto.materiales.forEach((mat, idx) => {
      const cantidad = Number(mat.cantidad || 0);
      const precioUnit = Number(mat.precioUnitario || 0);
      const subtotal = cantidad * precioUnit;
      totalMat += subtotal;

      datos.push({
        'SECCIÓN': `  ${idx + 1}`,
        'CAMPO': mat.tipoMaterial || '-',
        'VALOR': mat.unidadMedida || '-',
        'CANTIDAD': cantidad,
        'PRECIO UNITARIO': `$${formatMoneda(precioUnit)}`,
        'SUBTOTAL': `$${formatMoneda(subtotal)}`
      });
    });

    datos.push({
      'SECCIÓN': '',
      'CAMPO': '',
      'VALOR': '',
      'CANTIDAD': '',
      'PRECIO UNITARIO': 'SUBTOTAL:',
      'SUBTOTAL': `$${formatMoneda(totalMat)}`
    });

    datos.push({}); // Línea en blanco
  }

  // ========== OTROS COSTOS ==========
  if (presupuesto.otrosCostos && presupuesto.otrosCostos.length > 0) {
    datos.push({
      'SECCIÓN': '💼 OTROS COSTOS',
      'CAMPO': '',
      'VALOR': '',
      'CANTIDAD': '',
      'PRECIO UNITARIO': '',
      'SUBTOTAL': ''
    });

    let totalOtros = 0;
    presupuesto.otrosCostos.forEach((costo, idx) => {
      const importe = Number(costo.importe || 0);
      totalOtros += importe;

      datos.push({
        'SECCIÓN': `  ${idx + 1}`,
        'CAMPO': costo.descripcion || '-',
        'VALOR': costo.categoria || '-',
        'CANTIDAD': '',
        'PRECIO UNITARIO': '',
        'SUBTOTAL': `$${formatMoneda(importe)}`
      });
    });

    datos.push({
      'SECCIÓN': '',
      'CAMPO': '',
      'VALOR': '',
      'CANTIDAD': '',
      'PRECIO UNITARIO': 'SUBTOTAL:',
      'SUBTOTAL': `$${formatMoneda(totalOtros)}`
    });

    datos.push({}); // Línea en blanco
  }

  // ========== HONORARIOS ==========
  if (presupuesto.honorariosTotal && presupuesto.honorariosTotal > 0) {
    datos.push({
      'SECCIÓN': '💰 HONORARIOS',
      'CAMPO': '',
      'VALOR': '',
      'CANTIDAD': '',
      'PRECIO UNITARIO': '',
      'SUBTOTAL': ''
    });

    datos.push({
      'SECCIÓN': '',
      'CAMPO': 'Total Honorarios',
      'VALOR': '',
      'CANTIDAD': '',
      'PRECIO UNITARIO': '',
      'SUBTOTAL': `$${formatMoneda(presupuesto.honorariosTotal)}`
    });

    datos.push({}); // Línea en blanco
  }

  // ========== TOTAL FINAL ==========
  datos.push({
    'SECCIÓN': '═══════════════════════════════════════════════════════════',
    'CAMPO': '',
    'VALOR': '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  datos.push({
    'SECCIÓN': '💵 TOTAL FINAL',
    'CAMPO': '',
    'VALOR': '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': `$${formatMoneda(presupuesto.montoTotal || 0)}`
  });

  datos.push({
    'SECCIÓN': '═══════════════════════════════════════════════════════════',
    'CAMPO': '',
    'VALOR': '',
    'CANTIDAD': '',
    'PRECIO UNITARIO': '',
    'SUBTOTAL': ''
  });

  // ========== OBSERVACIONES ==========
  if (presupuesto.descripcion || presupuesto.observaciones) {
    datos.push({}); // Línea en blanco

    if (presupuesto.descripcion) {
      datos.push({
        'SECCIÓN': '📝 DESCRIPCIÓN',
        'CAMPO': presupuesto.descripcion,
        'VALOR': '',
        'CANTIDAD': '',
        'PRECIO UNITARIO': '',
        'SUBTOTAL': ''
      });
    }

    if (presupuesto.observaciones) {
      datos.push({
        'SECCIÓN': '💬 OBSERVACIONES',
        'CAMPO': presupuesto.observaciones,
        'VALOR': '',
        'CANTIDAD': '',
        'PRECIO UNITARIO': '',
        'SUBTOTAL': ''
      });
    }
  }

  return datos;
};

/**
 * Genera un resumen de texto plano del presupuesto para compartir
 * @param {Object} presupuesto - Objeto con datos del presupuesto
 * @returns {string} Texto formateado para compartir
 */
export const generarResumenTexto = (presupuesto) => {
  let texto = '📋 PRESUPUESTO\n';
  texto += '═'.repeat(40) + '\n\n';

  // Información general
  if (presupuesto.nombreEmpresa) {
    texto += `🏢 Empresa: ${presupuesto.nombreEmpresa}\n`;
  }

  if (presupuesto.numeroPresupuesto) {
    texto += `📄 Nº: ${presupuesto.numeroPresupuesto}\n`;
  }

  if (presupuesto.version) {
    texto += `📌 Versión: ${presupuesto.version}\n`;
  }

  if (presupuesto.estado) {
    texto += `📊 Estado: ${formatEstado(presupuesto.estado)}\n`;
  }

  // Dirección de obra
  const direccionParts = [
    presupuesto.direccionObraBarrio,
    presupuesto.direccionObraCalle,
    presupuesto.direccionObraAltura,
    presupuesto.direccionObraTorre ? `Torre ${presupuesto.direccionObraTorre}` : '',
    presupuesto.direccionObraPiso ? `Piso ${presupuesto.direccionObraPiso}` : '',
    presupuesto.direccionObraDepartamento ? `Depto ${presupuesto.direccionObraDepartamento}` : ''
  ].filter(Boolean);

  if (direccionParts.length > 0) {
    texto += `📍 Obra: ${direccionParts.join(' ')}\n`;
  }

  if (presupuesto.nombreSolicitante) {
    texto += `👤 Solicitante: ${presupuesto.nombreSolicitante}\n`;
  }

  texto += '\n' + '─'.repeat(40) + '\n\n';

  // Configuración del Presupuesto (si está visible)
  if (presupuesto.incluirConfiguracion) {
    texto += '⚙️ CONFIGURACIÓN DEL PRESUPUESTO\n\n';

    // Configuraciones de Profesionales
    if (presupuesto.configsProfesionales && presupuesto.configsProfesionales.length > 0) {
      texto += '👷 Profesionales:\n';
      let totalProf = 0;
      presupuesto.configsProfesionales.forEach((config, idx) => {
        const modo = config.modoSeleccionado || 'hora';
        const importe = Number(config[`importe${modo.charAt(0).toUpperCase() + modo.slice(1)}`] || 0);
        const cantidadKey = modo === 'hora' ? 'cantidadHoras' :
                            modo === 'dia' ? 'cantidadDias' :
                            modo === 'semana' ? 'cantidadSemanas' : 'cantidadMeses';
        const cantidad = Number(config[cantidadKey] || 0);
        const subtotal = importe * cantidad;
        totalProf += subtotal;

        const tipo = config.esGeneral ? 'General' : (config.tipoProfesional || 'Sin especificar');
        texto += `  ${idx + 1}. ${tipo}\n`;
        texto += `     Por ${modo}: $${formatMoneda(importe)} × ${cantidad}\n`;
        texto += `     💵 $${formatMoneda(subtotal)}\n`;
      });
      texto += `  SUBTOTAL: $${formatMoneda(totalProf)}\n\n`;
    }

    // Configuraciones de Materiales
    if (presupuesto.configsMateriales && presupuesto.configsMateriales.length > 0) {
      texto += '🧱 Materiales:\n';
      let totalMat = 0;
      presupuesto.configsMateriales.forEach((config, idx) => {
        const subtotal = Number(config.presupuestoTotal || 0);
        totalMat += subtotal;

        const tipo = config.esGeneral ? 'General' : (config.tipoMaterial || 'Sin especificar');
        texto += `  ${idx + 1}. ${tipo}\n`;
        if (config.categoria) texto += `     Categoría: ${config.categoria}\n`;
        texto += `     💵 $${formatMoneda(subtotal)}\n`;
      });
      texto += `  SUBTOTAL: $${formatMoneda(totalMat)}\n\n`;
    }

    // Configuraciones de Otros
    if (presupuesto.configsOtros && presupuesto.configsOtros.length > 0) {
      texto += '💼 Otros Costos:\n';
      let totalOtros = 0;
      presupuesto.configsOtros.forEach((config, idx) => {
        const importe = Number(config.presupuestoTotal || 0);
        totalOtros += importe;

        const desc = config.esGeneral ? 'General' : (config.descripcion || 'Sin descripción');
        texto += `  ${idx + 1}. ${desc}\n`;
        texto += `     💵 $${formatMoneda(importe)}\n`;
      });
      texto += `  SUBTOTAL: $${formatMoneda(totalOtros)}\n\n`;
    }

    texto += '─'.repeat(40) + '\n\n';
  }

  // Profesionales detallados (si está visible)
  if (presupuesto.incluirProfesionales && presupuesto.profesionales && presupuesto.profesionales.length > 0) {
    texto += '👷 PROFESIONALES ASIGNADOS (Detalle)\n\n';
    let totalProf = 0;
    presupuesto.profesionales.forEach((prof, idx) => {
      const costo = Number(prof.importeCalculado) || 0;
      totalProf += costo;

      const modo = prof.importeXHora ? 'hora' :
                   prof.importeXDia ? 'día' :
                   prof.importeXSemana ? 'semana' :
                   prof.importeXMes ? 'mes' : 'obra';

      texto += `  ${idx + 1}. ${prof.tipoProfesional || 'Sin especificar'}\n`;
      texto += `     Modalidad: Por ${modo}\n`;
      texto += `     💵 $${formatMoneda(costo)}\n`;
    });
    texto += `  SUBTOTAL: $${formatMoneda(totalProf)}\n\n`;
    texto += '─'.repeat(40) + '\n\n';
  }

  // Materiales detallados (si está visible)
  if (presupuesto.incluirMateriales && presupuesto.materiales && presupuesto.materiales.length > 0) {
    texto += '🧱 MATERIALES (Detalle)\n\n';
    let totalMat = 0;
    presupuesto.materiales.forEach((mat, idx) => {
      const cantidad = Number(mat.cantidad || 0);
      const precioUnit = Number(mat.precioUnitario || 0);
      const subtotal = cantidad * precioUnit;
      totalMat += subtotal;

      texto += `  ${idx + 1}. ${mat.tipoMaterial || 'Sin nombre'}\n`;
      texto += `     Cantidad: ${cantidad} ${mat.unidadMedida || ''}\n`;
      texto += `     Precio unitario: $${formatMoneda(precioUnit)}\n`;
      texto += `     💵 $${formatMoneda(subtotal)}\n`;
    });
    texto += `  SUBTOTAL: $${formatMoneda(totalMat)}\n\n`;
    texto += '─'.repeat(40) + '\n\n';
  }

  // Otros Costos detallados (si está visible)
  if (presupuesto.incluirOtrosCostos && presupuesto.otrosCostos && presupuesto.otrosCostos.length > 0) {
    texto += '💼 OTROS COSTOS (Detalle)\n\n';
    let totalOtros = 0;
    presupuesto.otrosCostos.forEach((costo, idx) => {
      const monto = Number(costo.importe) || 0;
      totalOtros += monto;

      texto += `  ${idx + 1}. ${costo.descripcion || 'Sin descripción'}\n`;
      if (costo.categoria) texto += `     Categoría: ${costo.categoria}\n`;
      texto += `     💵 $${formatMoneda(monto)}\n`;
    });
    texto += `  SUBTOTAL: $${formatMoneda(totalOtros)}\n\n`;
    texto += '─'.repeat(40) + '\n\n';
  }

  // Total
  texto += '═'.repeat(40) + '\n';
  const total = Number(presupuesto.montoTotal) || 0;
  texto += `💰 TOTAL: $${formatMoneda(total)}\n`;
  texto += '═'.repeat(40) + '\n';

  return texto;
};

/**
 * Comparte el presupuesto por WhatsApp
 * @param {Object} presupuesto - Objeto con datos del presupuesto
 * @param {string} telefono - Número de teléfono (opcional)
 */
export const compartirPorWhatsApp = (presupuesto, telefono = '') => {
  const texto = generarResumenTexto(presupuesto);
  const textoEncoded = encodeURIComponent(texto);

  // Si hay teléfono, usarlo; si no, abrir selector de contactos
  const url = telefono
    ? `https://wa.me/${telefono}?text=${textoEncoded}`
    : `https://wa.me/?text=${textoEncoded}`;

  window.open(url, '_blank');
};

/**
 * Comparte el presupuesto por Email
 * @param {Object} presupuesto - Objeto con datos del presupuesto
 * @param {string} email - Email del destinatario (opcional)
 */
export const compartirPorEmail = (presupuesto, email = '') => {
  const texto = generarResumenTexto(presupuesto);
  const asunto = `Presupuesto ${presupuesto.numeroPresupuesto || 'Nuevo'} - ${presupuesto.nombreEmpresa || ''}`;

  const asuntoEncoded = encodeURIComponent(asunto);
  const cuerpoEncoded = encodeURIComponent(texto);

  const mailtoUrl = `mailto:${email}?subject=${asuntoEncoded}&body=${cuerpoEncoded}`;

  window.location.href = mailtoUrl;
};

/**
 * Captura el contenido visual del modal y lo exporta como PDF o imagen
 * @param {HTMLElement} elemento - Elemento DOM a capturar
 * @param {string} nombreArchivo - Nombre del archivo sin extensión
 * @param {string} formato - 'pdf' o 'png'
 * @returns {Promise<void>}
 */
export const capturarYExportarVisual = async (elemento, nombreArchivo, formato = 'pdf') => {
  try {
    if (!elemento) {
      throw new Error('No se encontró el elemento a capturar');
    }

    // Agregar clase temporal para ocultar elementos marcados
    elemento.classList.add('capturando-pdf');

    // Esperar un momento para que se apliquen los estilos
    await new Promise(resolve => setTimeout(resolve, 100));

    // Configurar ancho fijo para aprovechar mejor el espacio
    const anchoOriginal = elemento.style.width;
    const maxWidthOriginal = elemento.style.maxWidth;
    elemento.style.width = '1400px'; // Ancho fijo mayor para aprovechar el espacio
    elemento.style.maxWidth = '1400px';

    // Capturar el elemento como imagen de alta calidad
    const canvas = await html2canvas(elemento, {
      scale: 2, // Calidad suficiente
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      allowTaint: true,
      windowWidth: 1400,
      windowHeight: elemento.scrollHeight
    });

    // Restaurar estilos originales
    elemento.style.width = anchoOriginal;
    elemento.style.maxWidth = maxWidthOriginal;
    elemento.classList.remove('capturando-pdf');

    if (formato === 'png') {
      // Exportar como PNG
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${nombreArchivo}.png`;
        link.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } else {
      // Exportar como PDF con división simple de páginas
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 3; // Márgenes mínimos
      const footerHeight = 8; // Altura del pie de página
      const contentWidth = pageWidth - (2 * margin);
      const usablePageHeight = pageHeight - (2 * margin) - footerHeight;

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Calcular número de páginas de forma simple
      const numPages = Math.ceil(imgHeight / usablePageHeight);

      // Generar todas las páginas
      for (let i = 0; i < numPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        // Posicionamiento simple: cada página muestra su porción correspondiente
        const yOffset = -(i * usablePageHeight) + margin;
        pdf.addImage(imgData, 'PNG', margin, yOffset, imgWidth, imgHeight, undefined, 'FAST');
      }

      // Agregar numeración de páginas y pie de página
      for (let i = 1; i <= numPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(120);

        // Línea separadora superior del pie
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.1);
        pdf.line(margin, pageHeight - footerHeight + 1, pageWidth - margin, pageHeight - footerHeight + 1);

        // Numeración centrada
        pdf.text(`Página ${i} de ${numPages}`, pageWidth / 2, pageHeight - 4, { align: 'center' });

        // Fecha en la esquina derecha
        const fechaHora = `${new Date().toLocaleDateString('es-AR')} ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
        pdf.text(fechaHora, pageWidth - margin, pageHeight - 4, { align: 'right' });
      }

      pdf.save(`${nombreArchivo}.pdf`);
    }

    return true;
  } catch (error) {
    console.error('Error al capturar y exportar:', error);
    // Asegurarse de remover la clase en caso de error
    if (elemento) {
      elemento.classList.remove('capturando-pdf');
      elemento.style.width = '';
      elemento.style.maxWidth = '';
    }
    throw error;
  }
};

/**
 * Exporta el contenido HTML directamente a PDF con texto seleccionable (no como imagen)
 * @param {HTMLElement} elemento - Elemento DOM a exportar
 * @param {string} nombreArchivo - Nombre del archivo sin extensión
 * @returns {Promise<Blob>} - Retorna el blob del PDF generado
 */
export const exportarAPDFReal = async (elemento, nombreArchivo) => {
  let yaTeníaClaseCapturando = false;
  
  try {
    if (!elemento) {
      throw new Error('No se encontró el elemento a exportar');
    }

    // 🔍 Verificar si ya tiene la clase capturando-pdf (agregada por BotonesExportarPDFPresupuesto)
    yaTeníaClaseCapturando = elemento.classList.contains('capturando-pdf');
    
    // Solo agregar clase si NO la tiene ya
    if (!yaTeníaClaseCapturando) {
      elemento.classList.add('capturando-pdf');
    }

    // Ajustar estilos temporales
    const anchoOriginal = elemento.style.width;
    const maxWidthOriginal = elemento.style.maxWidth;

    elemento.style.width = '210mm';
    elemento.style.maxWidth = '210mm';

    // ⏱️ ESPERA MAYOR si viene del PDF Cliente (elementos fueron ocultados con !important)
    if (!yaTeníaClaseCapturando) {
      console.log('%c⏱️ exportarAPDFReal: Esperando 800ms para repaint...', 'color: orange; font-size: 14px;');
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(resolve, 800); // Espera más larga
          });
        });
      });
      console.log('%c✅ exportarAPDFReal: Tiempo de espera completado', 'color: green; font-size: 14px;');
    }

    // Configuración optimizada para PDF de PÁGINA CONTINUA
    const opciones = {
      margin: [5, 5, 5, 5], // [top, left, bottom, right] en mm - Márgenes mínimos
      filename: `${nombreArchivo}.pdf`,
      image: {
        type: 'jpeg',
        quality: 0.98
      },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        scrollY: 0,
        scrollX: 0,
        windowHeight: elemento.scrollHeight, // 🔑 Capturar TODO el contenido
        height: elemento.scrollHeight // 🔑 Altura completa
      },
      jsPDF: {
        unit: 'mm',
        format: [210, Math.ceil(elemento.scrollHeight * 0.264583 + 20)], // 🔑 Altura dinámica con buffer de 20mm
        orientation: 'portrait',
        compress: true
      }
      // 🚫 NO incluir pagebreak - dejamos que la página única maneje todo
    };

    console.log('%c📸 html2pdf.js: INICIANDO CAPTURA DEL ELEMENTO...', 'background: purple; color: white; font-size: 14px; padding: 5px;');
    
    // Generar el PDF y obtener el blob
    const pdfBlob = await html2pdf().set(opciones).from(elemento).output('blob');

    console.log('%c✅ html2pdf.js: CAPTURA COMPLETADA', 'background: green; color: white; font-size: 14px; padding: 5px;');

    // Restaurar estilos
    elemento.style.width = anchoOriginal;
    elemento.style.maxWidth = maxWidthOriginal;
    
    // Solo remover la clase si FUE ESTA FUNCIÓN quien la agregó
    if (!yaTeníaClaseCapturando) {
      elemento.classList.remove('capturando-pdf');
    }

    console.log('📄 PDF generado:', {
      tamaño: (pdfBlob.size / 1024).toFixed(2) + ' KB',
      tipo: pdfBlob.type
    });

    return pdfBlob;
  } catch (error) {
    console.error('Error al exportar a PDF:', error);
    if (elemento) {
      // Solo remover si esta función la agregó
      if (!yaTeníaClaseCapturando) {
        elemento.classList.remove('capturando-pdf');
      }
      elemento.style.width = '';
      elemento.style.maxWidth = '';
    }
    throw error;
  }
};

/**
 * Exporta y descarga directamente el PDF (sin retornar el blob)
 * @param {HTMLElement} elemento - Elemento DOM a exportar
 * @param {string} nombreArchivo - Nombre del archivo sin extensión
 * @returns {Promise<void>}
 */
export const descargarPDFDirecto = async (elemento, nombreArchivo) => {
  try {
    const pdfBlob = await exportarAPDFReal(elemento, nombreArchivo);

    // Descargar el blob
    const url = window.URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo.endsWith('.pdf') ? nombreArchivo : `${nombreArchivo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    console.log('✅ PDF descargado:', link.download);
  } catch (error) {
    console.error('Error al descargar PDF:', error);
    throw error;
  }
};
