/**
 * 🔍 SCRIPT DE DIAGNÓSTICO - PDF CLIENTE DESDE SIDEBAR
 *
 * Uso:
 * 1. Abrí el modal de presupuesto desde "Enviar Presupuesto" > "PDF Cliente"
 * 2. Copiá y pegá este script completo en la consola del navegador
 * 3. Ejecutalo y revisá el reporte
 */

(function diagnosticarPDFCliente() {
  console.clear();
  console.log('🔍 ===== DIAGNÓSTICO PDF CLIENTE =====\n');

  // 1. Verificar modal visible
  const modal = document.querySelector('.modal-backdrop') || document.querySelector('[role="dialog"]');
  console.log('1️⃣ Modal visible:', modal ? '✅ SÍ' : '❌ NO');

  // 2. Buscar botón PDF (ambos IDs por si acaso)
  const botonNuevo = document.getElementById('boton-pdf-dual-auto');
  const botonViejo = document.getElementById('guardar-pdf-button');
  console.log('\n2️⃣ Botones encontrados:');
  console.log('   - boton-pdf-dual-auto:', botonNuevo ? '✅ EXISTE' : '❌ NO EXISTE');
  console.log('   - guardar-pdf-button (viejo):', botonViejo ? '⚠️ EXISTE (conflicto!)' : '✅ No existe');

  if (botonNuevo) {
    console.log('   - Texto del botón:', botonNuevo.textContent.trim());
    console.log('   - Visible:', botonNuevo.offsetParent !== null ? '✅ SÍ' : '❌ NO (display:none o hidden)');
  }

  // 3. Buscar elementos con clase .ocultar-en-pdf
  const elementosOcultar = document.querySelectorAll('.ocultar-en-pdf');
  console.log('\n3️⃣ Elementos con .ocultar-en-pdf:', elementosOcultar.length);
  if (elementosOcultar.length > 0) {
    elementosOcultar.forEach((el, i) => {
      const titulo = el.querySelector('h2, h3, h4, .titulo, [class*="titulo"]');
      const tituloTexto = titulo ? titulo.textContent.trim() : 'Sin título identificable';
      console.log(`   ${i+1}. ${tituloTexto.substring(0, 50)}...`);
      console.log(`      - Display actual: ${el.style.display || 'default'}`);
      console.log(`      - Computed display: ${window.getComputedStyle(el).display}`);
    });
  } else {
    console.warn('   ⚠️ NO SE ENCONTRARON elementos con clase .ocultar-en-pdf');
    console.log('   Esto significa que:');
    console.log('   - O el presupuesto no tiene esas secciones');
    console.log('   - O la clase no está aplicada en el JSX');
  }

  // 4. Verificar componente BotonesExportarPDFPresupuesto
  const contenedorExportacion = document.querySelector('[class*="exportacion"], [class*="botones-pdf"]');
  console.log('\n4️⃣ Contenedor de exportación:', contenedorExportacion ? '✅ EXISTE' : '❌ NO EXISTE');

  // 5. Buscar en React DevTools (si está disponible)
  console.log('\n5️⃣ Estado React (si disponible):');
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('   ✅ React DevTools detectado');
    console.log('   💡 Verificá en Components tab:');
    console.log('      - PresupuestoNoClienteModal > props > tipoPDFAGenerar');
    console.log('      - PresupuestoNoClienteModal > props > abrirWhatsAppDespuesDePDF');
  } else {
    console.log('   ⚠️ React DevTools no disponible');
  }

  // 6. Simular click (NO ejecutar, solo mostrar código)
  console.log('\n6️⃣ Para simular click manual:');
  if (botonNuevo) {
    console.log(`   document.getElementById('boton-pdf-dual-auto').click();`);
  }

  // 7. Verificar si generarPDFCliente está definido
  console.log('\n7️⃣ Funciones globales relevantes:');
  console.log('   - window.generarPDFCliente:', typeof window.generarPDFCliente);
  console.log('   - window.exportarAPDFReal:', typeof window.exportarAPDFReal);

  // 8. Resumen y recomendaciones
  console.log('\n📋 ===== RESUMEN =====');
  const problemas = [];

  if (!modal) problemas.push('Modal no está visible');
  if (!botonNuevo) problemas.push('Botón boton-pdf-dual-auto no existe');
  if (botonViejo) problemas.push('Botón viejo guardar-pdf-button todavía existe (posible conflicto)');
  if (elementosOcultar.length === 0) problemas.push('No hay elementos con clase .ocultar-en-pdf');

  if (problemas.length === 0) {
    console.log('✅ Todo parece estar correcto. El problema puede estar en:');
    console.log('   1. La lógica del useEffect no se ejecuta');
    console.log('   2. El auto-click no se dispara');
    console.log('   3. La función generarPDFCliente no oculta correctamente');
  } else {
    console.warn('⚠️ Problemas detectados:');
    problemas.forEach((p, i) => console.warn(`   ${i+1}. ${p}`));
  }

  console.log('\n💡 Próximos pasos sugeridos:');
  console.log('   1. Si el botón existe pero no se clickea: verificar useEffect');
  console.log('   2. Si el botón se clickea pero secciones no se ocultan: verificar generarPDFCliente()');
  console.log('   3. Si faltan elementos .ocultar-en-pdf: revisar JSX del modal');

  console.log('\n🔍 ===== FIN DIAGNÓSTICO =====');
})();
