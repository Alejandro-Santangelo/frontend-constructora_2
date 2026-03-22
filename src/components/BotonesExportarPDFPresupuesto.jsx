import React, { useState, useEffect, useRef } from 'react';
import { exportarAPDFReal, compartirPorWhatsApp } from '../utils/exportUtils';
import { Button, Spinner, Row, Col } from 'react-bootstrap';

/**
 * Componente para generar PDFs de presupuesto con dos variantes:
 * 1. PDF INTERNO: Completo, con toda la información (configuraciones, descuentos, etc.)
 * 2. PDF CLIENTE: Limpio, solo información relevante para el cliente
 * 
 * @param {Object} props
 * @param {React.RefObject} props.modalContentRef - Referencia al elemento DOM a capturar
 * @param {Object} props.presupuesto - Datos del presupuesto
 * @param {boolean} props.abrirWhatsAppDespuesDePDF - Abrir WhatsApp después de generar
 * @param {Function} props.onPDFGenerado - Callback después de generar el PDF
 * @param {string} props.tipoPDFAGenerar - Tipo de PDF a generar automáticamente ('interno' o 'cliente')
 * @param {boolean} props.soloMostrarBotonInterno - Si es true, solo muestra el botón de PDF Interno
 */
const BotonesExportarPDFPresupuesto = ({ 
  modalContentRef, 
  presupuesto, 
  abrirWhatsAppDespuesDePDF = false,
  onPDFGenerado = null,
  tipoPDFAGenerar = 'interno',
  soloMostrarBotonInterno = false
}) => {
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [tipoPDFActual, setTipoPDFActual] = useState(null); // 'interno' o 'cliente'
  const botonAutoPDFRef = useRef(null); // Referencia al botón invisible para auto-click

  console.log('🎯 BotonesExportarPDFPresupuesto - Props:', {
    tipoPDFAGenerar,
    abrirWhatsAppDespuesDePDF,
    presupuestoId: presupuesto?.id
  });

  /**
   * Genera PDF para CLIENTE (limpio, sin configuraciones internas)
   * USA LA TÉCNICA CONFIRMADA POR EL USUARIO: setProperty con !important
   */
  const generarPDFCliente = async () => {
    console.clear(); // LIMPIAR CONSOLA
    console.log('%c📄 === INICIANDO PDF CLIENTE ===', 'background: blue; color: white; font-size: 20px; padding: 10px;');
    
    if (!modalContentRef?.current || !presupuesto) {
      alert('❌ Error: No se puede generar el PDF. Falta información del presupuesto.');
      return;
    }
    
    setGenerandoPDF(true);
    setTipoPDFActual('cliente');

    // 🎯 ESTRATEGIA: Ocultar con setProperty(!important) ANTES de pasar a exportarAPDFReal
    let elementosOcultadosInfo = [];

    try {
      const elemento = modalContentRef.current;
      
      // 🔍 BUSCAR todos los elementos .ocultar-en-pdf
      const elementosAOcultar = Array.from(elemento.querySelectorAll('.ocultar-en-pdf'));
      console.log(`%c🔍 Encontrados ${elementosAOcultar.length} elementos .ocultar-en-pdf`, 'background: cyan; color: black; font-size: 16px; padding: 5px;');
      
      // Mostrar detalles de cada elemento
      elementosAOcultar.forEach((el, index) => {
        console.log(`   ${index + 1}. ${el.tagName} - clases: ${el.className}`);
      });
      
      // 🚫 OCULTAR CON !IMPORTANT Y MÚLTIPLES PROPI EDADES PARA MÁXIMA EFECTIVIDAD
      elementosAOcultar.forEach((el, index) => {
        // Guardar estado original
        elementosOcultadosInfo.push({
          elemento: el,
          displayOriginal: el.style.display,
          visibilityOriginal: el.style.visibility,
          positionOriginal: el.style.position,
          opacityOriginal: el.style.opacity,
          heightOriginal: el.style.height,
          widthOriginal: el.style.width,
          overflowOriginal: el.style.overflow
        });
        
        // 🔥 OCULTACIÓN AGRESIVA: múltiples propiedades con !important
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('position', 'absolute', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('height', '0', 'important');
        el.style.setProperty('width', '0', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
        el.style.setProperty('max-height', '0', 'important');
        el.style.setProperty('max-width', '0', 'important');
        el.style.setProperty('margin', '0', 'important');
        el.style.setProperty('padding', '0', 'important');
        el.style.setProperty('border', 'none', 'important');
        
        console.log(`   🚫 ${index + 1}. Ocultado agresivamente: ${el.className}`);
      });
      
      console.log(`%c✅ ${elementosAOcultar.length} elementos ocultados agresivamente`, 'background: green; color: white; font-size: 16px; padding: 5px;');
      
      // ⏱️ PAUSA: Esperar 3000ms para que el DOM se actualice completamente y aplique todos los estilos CSS
      console.log('%c⏱️ Esperando actualización del DOM (3 segundos)...', 'background: orange; color: black; font-size: 14px; padding: 5px;');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('%c✅ Generando PDF AHORA...', 'background: green; color: white; font-size: 16px; padding: 5px;');
      
      // 📸 GENERAR PDF (ahora con elementos ocultos)
      const nombreArchivo = `presupuesto_${presupuesto.numeroPresupuesto || presupuesto.id}_cliente`;
      console.log('%c📸 Capturando PDF CLIENTE...', 'background: purple; color: white; font-size: 16px; padding: 5px;');
      
      const pdfBlob = await exportarAPDFReal(elemento, nombreArchivo);
      console.log('%c✅ PDF CLIENTE capturado', 'background: green; color: white; font-size: 16px; padding: 5px;');
      
      // 🔄 RESTAURAR estilos originales INMEDIATAMENTE
      console.log(`🔄 Restaurando ${elementosOcultadosInfo.length} elementos...`);
      elementosOcultadosInfo.forEach(({ 
        elemento: ele, 
        displayOriginal, 
        visibilityOriginal, 
        positionOriginal, 
        opacityOriginal,
        heightOriginal,
        widthOriginal,
        overflowOriginal
      }) => {
        if (displayOriginal) {
          ele.style.display = displayOriginal;
        } else {
          ele.style.removeProperty('display');
        }
        
        if (visibilityOriginal) {
          ele.style.visibility = visibilityOriginal;
        } else {
          ele.style.removeProperty('visibility');
        }
        
        if (positionOriginal) {
          ele.style.position = positionOriginal;
        } else {
          ele.style.removeProperty('position');
        }
        
        if (opacityOriginal) {
          ele.style.opacity = opacityOriginal;
        } else {
          ele.style.removeProperty('opacity');
        }

        if (heightOriginal) {
          ele.style.height = heightOriginal;
        } else {
          ele.style.removeProperty('height');
        }

        if (widthOriginal) {
          ele.style.width = widthOriginal;
        } else {
          ele.style.removeProperty('width');
        }

        if (overflowOriginal) {
          ele.style.overflow = overflowOriginal;
        } else {
          ele.style.removeProperty('overflow');
        }

        // Remover propiedades adicionales
        ele.style.removeProperty('max-height');
        ele.style.removeProperty('max-width');
        ele.style.removeProperty('margin');
        ele.style.removeProperty('padding');
        ele.style.removeProperty('border');
      });
      console.log('✅ Estilos restaurados');
      
      // 💾 DESCARGAR
      if (pdfBlob) {
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${nombreArchivo}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('✅ PDF CLIENTE generado y descargado');

        if (abrirWhatsAppDespuesDePDF) {
          const telefono = presupuesto.telefono || presupuesto.telefonoSolicitante || '';
          compartirPorWhatsApp(presupuesto, telefono);
        }

        if (onPDFGenerado) {
          onPDFGenerado(pdfBlob, 'cliente');
        }
      }
    } catch (error) {
      console.error('❌ Error al generar PDF CLIENTE:', error);
      alert(`Error al generar PDF: ${error.message}`);
      
      // RESTAURAR en caso de error
      if (elementosOcultadosInfo.length > 0) {
        console.log('🔄 Restaurando estilos después de error...');
        elementosOcultadosInfo.forEach(({ 
          elemento: ele, 
          displayOriginal, 
          visibilityOriginal, 
          positionOriginal, 
          opacityOriginal,
          heightOriginal,
          widthOriginal,
          overflowOriginal
        }) => {
          if (displayOriginal) {
            ele.style.display = displayOriginal;
          } else {
            ele.style.removeProperty('display');
          }
          
          if (visibilityOriginal) {
            ele.style.visibility = visibilityOriginal;
          } else {
            ele.style.removeProperty('visibility');
          }
          
          if (positionOriginal) {
            ele.style.position = positionOriginal;
          } else {
            ele.style.removeProperty('position');
          }
          
          if (opacityOriginal) {
            ele.style.opacity = opacityOriginal;
          } else {
            ele.style.removeProperty('opacity');
          }

          if (heightOriginal) {
            ele.style.height = heightOriginal;
          } else {
            ele.style.removeProperty('height');
          }

          if (widthOriginal) {
            ele.style.width = widthOriginal;
          } else {
            ele.style.removeProperty('width');
          }

          if (overflowOriginal) {
            ele.style.overflow = overflowOriginal;
          } else {
            ele.style.removeProperty('overflow');
          }

          // Remover propiedades adicionales
          ele.style.removeProperty('max-height');
          ele.style.removeProperty('max-width');
          ele.style.removeProperty('margin');
          ele.style.removeProperty('padding');
          ele.style.removeProperty('border');
        });
      }
    } finally {
      setGenerandoPDF(false);
      setTipoPDFActual(null);
      console.log('🏁 === PDF CLIENTE FINALIZADO ===\n');
    }
  };

  /**
   * Genera PDF INTERNO (completo, con todas las configuraciones)
   */
  const generarPDFInterno = async () => {
    console.log('📄 === INICIANDO PDF INTERNO ===');
    
    if (!modalContentRef?.current || !presupuesto) {
      alert('❌ Error: No se puede generar el PDF. Falta información del presupuesto.');
      return;
    }
    
    setGenerandoPDF(true);
    setTipoPDFActual('interno');

    try {
      const elemento = modalContentRef.current;
      
      // ⏱️ Esperar estabilización
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 📸 Generar PDF (con todos los elementos)
      const nombreArchivo = `presupuesto_${presupuesto.numeroPresupuesto || presupuesto.id}_interno`;
      console.log('📸 Capturando PDF INTERNO...');
      
      const pdfBlob = await exportarAPDFReal(elemento, nombreArchivo);
      console.log('✅ PDF INTERNO capturado');
      
      // 💾 Descargar
      if (pdfBlob) {
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${nombreArchivo}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        console.log('✅ PDF INTERNO generado y descargado');

        if (abrirWhatsAppDespuesDePDF) {
          const telefono = presupuesto.telefono || presupuesto.telefonoSolicitante || '';
          compartirPorWhatsApp(presupuesto, telefono);
        }

        if (onPDFGenerado) {
          onPDFGenerado(pdfBlob, 'interno');
        }
      }
    } catch (error) {
      console.error('❌ Error al generar PDF INTERNO:', error);
      alert(`Error al generar PDF: ${error.message}`);
    } finally {
      setGenerandoPDF(false);
      setTipoPDFActual(null);
      console.log('🏁 === PDF INTERNO FINALIZADO ===\n');
    }
  };

  /**
   * Función unificada para mantener compatibilidad
   */
  const generarPDF = async (tipoPDF) => {
    if (tipoPDF === 'cliente') {
      await generarPDFCliente();
    } else {
      await generarPDFInterno();
    }
  };

  return (
    <div className="mt-4">
      {/* 👻 Botón invisible para auto-click desde el modal padre */}
      <button
        ref={botonAutoPDFRef}
        id="guardar-pdf-button"
        type="button"
        style={{ display: 'none' }}
        onClick={() => generarPDF(tipoPDFAGenerar)}
        aria-hidden="true"
      />

      <Row className="g-2">
        <Col xs={12}>
          <h6 className="mb-2 text-dark fw-bold">
            <i className="fas fa-file-pdf me-2"></i>
            Generar Presupuesto
          </h6>
          <div className="mb-3 p-3 fw-bold" style={{
            backgroundColor: '#fff3cd',
            borderWidth: '2px 2px 2px 5px',
            borderStyle: 'solid',
            borderColor: '#ffc107 #ffc107 #ffc107 #ff9800',
            borderRadius: '8px',
            color: '#856404',
            fontSize: '0.95rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <i className="fas fa-info-circle me-2" style={{ color: '#ff9800' }}></i>
            📄 Elegí el tipo de PDF según tu necesidad
          </div>
        </Col>

        {/* Botón PDF Interno */}
        <Col md={soloMostrarBotonInterno ? 12 : 6}>
          <Button
            variant="primary"
            className="w-100"
            onClick={() => generarPDF('interno')}
            disabled={generandoPDF}
            title="PDF completo con todas las configuraciones, descuentos y mayores costos (solo para uso interno)"
            style={{
              minHeight: '100px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: '12px',
              boxShadow: generandoPDF && tipoPDFActual === 'interno' ? '0 0 20px rgba(13,110,253,0.5)' : 'none'
            }}
          >
            {generandoPDF && tipoPDFActual === 'interno' ? (
              <>
                <Spinner animation="border" size="sm" />
                <span>Generando PDF Interno...</span>
              </>
            ) : (
              <>
                <i className="fas fa-file-alt" style={{ fontSize: '2rem' }}></i>
                <span>PDF Interno</span>
                <small style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.85 }}>
                  Completo • Uso interno
                </small>
              </>
            )}
          </Button>
          <small className="text-muted d-block mt-2 text-center">
            ✅ Incluye configuraciones, descuentos y mayores costos
          </small>
        </Col>

        {/* Botón PDF Cliente - Solo se muestra si no es soloMostrarBotonInterno */}
        {!soloMostrarBotonInterno && (
        <Col md={6}>
          <Button
            variant="success"
            className="w-100"
            onClick={() => generarPDF('cliente')}
            disabled={generandoPDF}
            title="PDF limpio y profesional, solo con información relevante para el cliente"
            style={{
              minHeight: '100px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: '12px',
              boxShadow: generandoPDF && tipoPDFActual === 'cliente' ? '0 0 20px rgba(40,167,69,0.5)' : 'none'
            }}
          >
            {generandoPDF && tipoPDFActual === 'cliente' ? (
              <>
                <Spinner animation="border" size="sm" />
                <span>Generando PDF Cliente...</span>
              </>
            ) : (
              <>
                <i className="fas fa-file-invoice" style={{ fontSize: '2rem' }}></i>
                <span>PDF Cliente</span>
                <small style={{ fontSize: '0.75rem', fontWeight: 'normal', opacity: 0.85 }}>
                  Profesional • Para enviar
                </small>
              </>
            )}
          </Button>
          <small className="text-muted d-block mt-2 text-center">
            🎯 Solo información relevante • Sin configuraciones internas
          </small>
        </Col>
        )}

        <Col xs={12} className="mt-2">
          <div className="alert alert-info mb-0 py-2" style={{ fontSize: '0.85rem' }}>
            <i className="fas fa-lightbulb me-2"></i>
            <strong>Tip:</strong> Ambos PDFs mantienen la funcionalidad de WhatsApp si está habilitada
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default BotonesExportarPDFPresupuesto;
