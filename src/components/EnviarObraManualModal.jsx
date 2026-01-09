import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const EnviarObraManualModal = ({ show, onClose, obra, empresaId, showNotification }) => {
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const contentRef = useRef(null);

  if (!show || !obra) return null;

  // Función para generar PDF de la obra
  const generarPDF = async () => {
    try {
      setGenerandoPDF(true);
      
      // Crear contenedor temporal para el PDF
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.width = '800px';
      tempContainer.style.padding = '40px';
      tempContainer.style.backgroundColor = 'white';
      tempContainer.style.fontFamily = 'Arial, sans-serif';
      
      tempContainer.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2196F3; padding-bottom: 20px;">
            <h1 style="color: #2196F3; margin: 0; font-size: 28px;">Presupuesto de Obra</h1>
            <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">Obra Manual - ${obra.nombre || 'Sin nombre'}</p>
          </div>
          
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
              📍 Información de la Obra
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px; font-weight: bold; color: #555; width: 200px;">Nombre:</td>
                <td style="padding: 8px; color: #333;">${obra.nombre || 'Sin especificar'}</td>
              </tr>
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 8px; font-weight: bold; color: #555;">Dirección:</td>
                <td style="padding: 8px; color: #333;">
                  ${obra.direccionObraCalle || ''} ${obra.direccionObraAltura || ''}
                  ${obra.direccionObraTorre ? ', Torre ' + obra.direccionObraTorre : ''}
                  ${obra.direccionObraPiso ? ', Piso ' + obra.direccionObraPiso : ''}
                  ${obra.direccionObraDepartamento ? ', Depto ' + obra.direccionObraDepartamento : ''}
                  ${obra.direccionObraBarrio ? '<br>' + obra.direccionObraBarrio : ''}
                </td>
              </tr>
              ${obra.nombreSolicitante ? `
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #555;">Solicitante:</td>
                  <td style="padding: 8px; color: #333;">${obra.nombreSolicitante}</td>
                </tr>
              ` : ''}
              ${obra.telefono ? `
                <tr style="background-color: #f9f9f9;">
                  <td style="padding: 8px; font-weight: bold; color: #555;">Teléfono:</td>
                  <td style="padding: 8px; color: #333;">${obra.telefono}</td>
                </tr>
              ` : ''}
              ${obra.mail ? `
                <tr>
                  <td style="padding: 8px; font-weight: bold; color: #555;">Email:</td>
                  <td style="padding: 8px; color: #333;">${obra.mail}</td>
                </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
              📋 Descripción de la Obra
            </h3>
            <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #f9f9f9; border-radius: 4px;">
              ${obra.descripcion || 'Sin descripción'}
            </p>
          </div>
          
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
              💰 Presupuesto Estimado
            </h3>
            <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1976d2;">
                $${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">Pesos Argentinos</p>
            </div>
          </div>
          
          ${obra.observaciones ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #333; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #eee; padding-bottom: 8px;">
                📝 Observaciones
              </h3>
              <p style="color: #555; line-height: 1.6; margin: 0; padding: 12px; background-color: #fff9e6; border-left: 4px solid #ffa726; border-radius: 4px;">
                ${obra.observaciones}
              </p>
            </div>
          ` : ''}
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 12px;">
            <p style="margin: 0;">Documento generado el ${new Date().toLocaleDateString('es-AR')}</p>
            <p style="margin: 5px 0 0 0;">Este presupuesto es válido por 30 días</p>
          </div>
        </div>
      `;
      
      document.body.appendChild(tempContainer);
      
      // Generar PDF
      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      document.body.removeChild(tempContainer);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 10;
      
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      
      const nombreArchivo = `Presupuesto_Obra_${obra.nombre?.replace(/\s/g, '_') || obra.id}_${new Date().getTime()}.pdf`;
      pdf.save(nombreArchivo);
      
      showNotification && showNotification('✅ PDF generado exitosamente', 'success');
      
    } catch (error) {
      console.error('Error generando PDF:', error);
      showNotification && showNotification('❌ Error al generar PDF: ' + error.message, 'error');
    } finally {
      setGenerandoPDF(false);
    }
  };

  // Función para enviar por WhatsApp
  const enviarPorWhatsApp = async () => {
    try {
      // Primero generar el PDF
      await generarPDF();
      
      // Luego abrir WhatsApp
      const mensaje = `
*PRESUPUESTO DE OBRA*

📍 *${obra.nombre || 'Obra sin nombre'}*

*Dirección:*
${obra.direccionObraCalle || ''} ${obra.direccionObraAltura || ''}
${obra.direccionObraTorre ? 'Torre ' + obra.direccionObraTorre : ''}
${obra.direccionObraPiso ? 'Piso ' + obra.direccionObraPiso : ''}
${obra.direccionObraDepartamento ? 'Depto ' + obra.direccionObraDepartamento : ''}
${obra.direccionObraBarrio || ''}

*Descripción:*
${obra.descripcion || 'Sin descripción'}

💰 *Presupuesto Estimado:*
$${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

${obra.observaciones ? '*Observaciones:*\n' + obra.observaciones : ''}

_Este presupuesto es válido por 30 días_
_📎 PDF descargado - Adjúntalo al mensaje_
    `.trim();

      // Si hay teléfono en la obra, usar ese. Sino, abrir WhatsApp para que el usuario elija
      const telefono = obra.telefono?.replace(/\D/g, '') || '';
      
      if (telefono) {
        // Abrir WhatsApp Web/App con el teléfono pre-cargado
        const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
      } else {
        // Abrir WhatsApp Web sin número (el usuario elige a quién enviar)
        // En móvil abrirá la app, en desktop abrirá WhatsApp Web
        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
      }
      
      showNotification && showNotification('✅ PDF generado. Abriendo WhatsApp...', 'success');
    } catch (error) {
      console.error('Error en enviarPorWhatsApp:', error);
      showNotification && showNotification('❌ Error al preparar el envío', 'error');
    }
  };

  // Función para enviar por Email
  const enviarPorEmail = async () => {
    try {
      // Primero generar el PDF
      await generarPDF();
      
      // Luego abrir el cliente de email
      const asunto = `Presupuesto de Obra - ${obra.nombre || 'Sin nombre'}`;
      const cuerpo = `
PRESUPUESTO DE OBRA

${obra.nombre || 'Obra sin nombre'}

Dirección:
${obra.direccionObraCalle || ''} ${obra.direccionObraAltura || ''}
${obra.direccionObraTorre ? 'Torre ' + obra.direccionObraTorre : ''}
${obra.direccionObraPiso ? 'Piso ' + obra.direccionObraPiso : ''}
${obra.direccionObraDepartamento ? 'Depto ' + obra.direccionObraDepartamento : ''}
${obra.direccionObraBarrio || ''}

Descripción:
${obra.descripcion || 'Sin descripción'}

Presupuesto Estimado:
$${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

${obra.observaciones ? 'Observaciones:\n' + obra.observaciones : ''}

Este presupuesto es válido por 30 días.

📎 Se ha descargado el PDF adjunto. Por favor, adjúntalo manualmente a este email.
    `.trim();

      // Abrir el cliente de email predeterminado del sistema
      const mailTo = obra.mail || '';
      const url = `mailto:${mailTo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.location.href = url;
      
      showNotification && showNotification('✅ PDF generado. Abriendo cliente de email...', 'success');
    } catch (error) {
      console.error('Error en enviarPorEmail:', error);
      showNotification && showNotification('❌ Error al preparar el envío', 'error');
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              <i className="fas fa-paper-plane me-2"></i>
              Enviar Presupuesto de Obra Manual
            </h5>
            <button 
              type="button" 
              className="btn btn-light btn-sm ms-auto" 
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
          
          <div className="modal-body">
            <div className="alert alert-info mb-3">
              <i className="fas fa-info-circle me-2"></i>
              <strong>Obra Manual:</strong> {obra.nombre || 'Sin nombre'}
            </div>

            <div className="card mb-3">
              <div className="card-header bg-light">
                <h6 className="mb-0">
                  <i className="fas fa-file-alt me-2"></i>
                  Información del Presupuesto
                </h6>
              </div>
              <div className="card-body" ref={contentRef}>
                <div className="row">
                  <div className="col-md-8 mb-3">
                    <label className="form-label">
                      Descripción de la Obra
                      <small className="text-muted ms-2">(Ej: "Refacción integral" o "Construcción nueva")</small>
                    </label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={obra.descripcion || ''}
                      disabled
                      readOnly
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Presupuesto Estimado</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={`$${(obra.presupuestoEstimado || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      disabled
                      readOnly
                    />
                  </div>
                </div>
                
                <div className="mb-3">
                  <label className="form-label">Observaciones</label>
                  <textarea 
                    className="form-control" 
                    rows="3" 
                    value={obra.observaciones || ''}
                    disabled
                    readOnly
                  />
                </div>

                <div className="row">
                  <div className="col-md-6 mb-2">
                    <small className="text-muted">
                      <strong>Dirección:</strong><br />
                      {obra.direccionObraCalle} {obra.direccionObraAltura}
                      {obra.direccionObraTorre && `, Torre ${obra.direccionObraTorre}`}
                      {obra.direccionObraPiso && `, Piso ${obra.direccionObraPiso}`}
                      {obra.direccionObraDepartamento && `, Depto ${obra.direccionObraDepartamento}`}
                      {obra.direccionObraBarrio && <><br />{obra.direccionObraBarrio}</>}
                    </small>
                  </div>
                  <div className="col-md-6 mb-2">
                    {obra.nombreSolicitante && (
                      <small className="text-muted">
                        <strong>Solicitante:</strong> {obra.nombreSolicitante}<br />
                      </small>
                    )}
                    {obra.telefono && (
                      <small className="text-muted">
                        <strong>Teléfono:</strong> {obra.telefono}<br />
                      </small>
                    )}
                    {obra.mail && (
                      <small className="text-muted">
                        <strong>Email:</strong> {obra.mail}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header bg-light">
                <h6 className="mb-0">
                  <i className="fas fa-share-alt me-2"></i>
                  Opciones de Envío
                </h6>
              </div>
              <div className="card-body">
                <div className="d-grid gap-2">
                  <button 
                    className="btn btn-danger btn-lg"
                    onClick={generarPDF}
                    disabled={generandoPDF}
                  >
                    {generandoPDF ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Generando PDF...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-file-pdf me-2"></i>
                        Descargar PDF
                      </>
                    )}
                  </button>

                  <button 
                    className="btn btn-success btn-lg"
                    onClick={enviarPorWhatsApp}
                  >
                    <i className="fab fa-whatsapp me-2"></i>
                    Enviar por WhatsApp
                    {obra.telefono && (
                      <small className="d-block mt-1" style={{ fontSize: '0.8rem' }}>
                        {obra.telefono}
                      </small>
                    )}
                  </button>

                  <button 
                    className="btn btn-primary btn-lg"
                    onClick={enviarPorEmail}
                  >
                    <i className="fas fa-envelope me-2"></i>
                    Enviar por Email
                    {obra.mail && (
                      <small className="d-block mt-1" style={{ fontSize: '0.8rem' }}>
                        {obra.mail}
                      </small>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
            >
              <i className="fas fa-times me-2"></i>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnviarObraManualModal;
