/**
 * SCRIPT DE DIAGNOSTICO PARA TRABAJOS EXTRA
 *
 * Copia y pega este contenido en la consola del navegador (F12 > Console)
 * para diagnosticar la estructura del trabajo extra y su presupuesto
 */

// Función para diagnosticar un trabajo extra
const diagnosticarTrabajoExtra = async (trabajoExtraId = 8, empresaId = 1) => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO DE TRABAJO EXTRA');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Trabajo Extra ID: ${trabajoExtraId}`);
  console.log(`Empresa ID: ${empresaId}`);

  try {
    // 1. Obtener el trabajo extra
    const response = await fetch(`/api/v1/trabajos-extra/${trabajoExtraId}`, {
      headers: {
        'X-Tenant-ID': empresaId.toString(),
        'empresaId': empresaId.toString()
      }
    });

    const trabajoExtra = await response.json();

    console.log('\n📋 ESTRUCTURA DEL TRABAJO EXTRA:');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Propiedades principales:');
    console.log(`   - id: ${trabajoExtra.id}`);
    console.log(`   - nombre/nombreObra: ${trabajoExtra.nombre || trabajoExtra.nombreObra}`);
    console.log(`   - obraId: ${trabajoExtra.obraId}`);

    console.log('\n🔑 PROPIEDADES DE PRESUPUESTO (CRÍTICAS):');
    const presupuestoPropiedades = [
      'presupuestoId',
      'presupuestoNoClienteId',
      'presupuestoNoCliente',
      'presupuesto',
      'budgetId',
      'budgetNoClientId'
    ];

    presupuestoPropiedades.forEach(prop => {
      if (trabajoExtra.hasOwnProperty(prop)) {
        console.log(`   ✅ ${prop}: ${typeof trabajoExtra[prop] === 'object' ? JSON.stringify(trabajoExtra[prop]).substring(0, 100) : trabajoExtra[prop]}`);
      }
    });

    console.log('\n📦 TODAS LAS PROPIEDADES DEL TRABAJO EXTRA:');
    console.log('═══════════════════════════════════════════════════════════');
    const props = Object.keys(trabajoExtra).sort();
    props.forEach(prop => {
      const value = trabajoExtra[prop];
      let display = '';
      if (value === null || value === undefined) {
        display = '(vacío)';
      } else if (typeof value === 'object') {
        display = `${Array.isArray(value) ? `Array[${value.length}]` : 'Object'} - ${JSON.stringify(value).substring(0, 50)}...`;
      } else if (typeof value === 'string' && value.length > 50) {
        display = `"${value.substring(0, 50)}..."`;
      } else {
        display = value;
      }
      console.log(`   - ${prop}: ${display}`);
    });

    console.log('\n🔍 DEDUCCIÓN:');
    console.log('═══════════════════════════════════════════════════════════');

    // Lógica para deducir presupuestoId
    const presupuestoId =
      trabajoExtra.presupuestoNoClienteId ||
      trabajoExtra.presupuestoId ||
      (trabajoExtra.presupuestoNoCliente?.id) ||
      trabajoExtra.id;  // Fallback

    console.log(`✅ PRESUPUESTO ID DEDUCIDO: ${presupuestoId}`);
    console.log(`   Fuente: ${
      trabajoExtra.presupuestoNoClienteId ? 'presupuestoNoClienteId' :
      trabajoExtra.presupuestoId ? 'presupuestoId' :
      trabajoExtra.presupuestoNoCliente?.id ? 'presupuestoNoCliente.id' :
      'ID del trabajo extra (FALLBACK)'
    }`);

    // Verificar que el presupuesto existe
    console.log(`\n🔍 Intentando verificar que presupuesto ${presupuestoId} existe...`);
    try {
      const presupuestoResponse = await fetch(`/api/presupuestos-no-cliente/${presupuestoId}/otros-costos`, {
        headers: {
          'empresaId': empresaId.toString()
        }
      });

      if (presupuestoResponse.ok) {
        const otrosCostos = await presupuestoResponse.json();
        console.log(`✅ ¡ÉXITO! Presupuesto ${presupuestoId} existe y tiene ${otrosCostos.length} otros costos`);
      } else {
        console.log(`❌ ERROR ${presupuestoResponse.status}: Presupuesto ${presupuestoId} NO encontrado`);
        console.log(`   Respuesta: ${await presupuestoResponse.text()}`);
      }
    } catch (presupuestoError) {
      console.log(`❌ Error verificando presupuesto: ${presupuestoError.message}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📝 RECOMENDACIONES:');
    console.log('═══════════════════════════════════════════════════════════');

    if (trabajoExtra.presupuestoNoClienteId || trabajoExtra.presupuestoId) {
      console.log('✅ El trabajo extra tiene presupuestoId correctamente configurado');
      console.log('   → La solución debería funcionar correctamente');
    } else if (trabajoExtra.presupuestoNoCliente?.id) {
      console.log('✅ El trabajo extra tiene presupuestoNoCliente.id');
      console.log('   → La solución debería funcionar correctamente');
    } else {
      console.log('⚠️ El trabajo extra NO tiene presupuestoNoClienteId ni presupuestoId');
      console.log('   → Necesita migración en backend para vincular trabajo extra a presupuesto');
      console.log('   → O el trabajo extra debería tener su PROPIO presupuesto con el mismo ID');
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
  }
};

// EJECUTAR
console.log('🚀 Ejecutando: diagnosticarTrabajoExtra(8, 1)');
console.log('   (Cambiar números si es diferente)');
diagnosticarTrabajoExtra(8, 1);
