/**
 * Script para migrar asignaciones de materiales y gastos desde localStorage a la BD
 * Ejecutar en la consola del navegador estando en la aplicación
 */

async function migrarAsignacionesABD() {
  console.log('🚀 Iniciando migración de asignaciones localStorage → BD...');

  // Obtener empresaId del contexto
  const empresaId = localStorage.getItem('empresaSeleccionada');
  if (!empresaId) {
    console.error('❌ No hay empresa seleccionada en localStorage');
    return;
  }

  const empresaObj = JSON.parse(empresaId);
  const idEmpresa = empresaObj.id;
  console.log('✅ Empresa ID:', idEmpresa);

  const todasLasClaves = Object.keys(localStorage);
  let totalMaterialesMigrados = 0;
  let totalGastosMigrados = 0;

  // 1. MIGRAR MATERIALES ASIGNADOS
  console.log('\n📦 === MIGRANDO MATERIALES ASIGNADOS ===');
  const clavesMateriales = todasLasClaves.filter(k => k.startsWith('obra_materiales_'));
  console.log(`📋 Encontradas ${clavesMateriales.length} claves de materiales`);

  for (const clave of clavesMateriales) {
    // Extraer obraId de la clave: obra_materiales_{obraId}_{empresaId}
    const partes = clave.split('_');
    const obraId = parseInt(partes[2]);

    if (!obraId) {
      console.warn(`⚠️ No se pudo extraer obraId de clave: ${clave}`);
      continue;
    }

    const materiales = JSON.parse(localStorage.getItem(clave) || '[]');
    console.log(`\n📁 Obra ${obraId}: ${materiales.length} materiales`);

    for (const material of materiales) {
      try {
        const payload = {
          obraId: obraId,
          materialCalculadoraId: material.materialId || null,
          cantidadAsignada: parseFloat(material.cantidadAsignada) || 0,
          semana: material.numeroSemana || null,
          fechaAsignacion: material.fechaAsignacion || null,
          observaciones: material.observaciones || ''
        };

        console.log(`  📤 Enviando: ${material.nombreMaterial}`, payload);

        const response = await fetch(`http://localhost:8080/api/obras/${obraId}/materiales`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'empresaId': idEmpresa.toString()
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const resultado = await response.json();
          console.log(`  ✅ Material migrado: ${material.nombreMaterial} (ID: ${resultado.id})`);
          totalMaterialesMigrados++;
        } else {
          const error = await response.text();
          console.error(`  ❌ Error migrando ${material.nombreMaterial}:`, response.status, error);
        }
      } catch (error) {
        console.error(`  ❌ Error procesando ${material.nombreMaterial}:`, error.message);
      }
    }
  }

  // 2. MIGRAR GASTOS/OTROS COSTOS ASIGNADOS
  console.log('\n💰 === MIGRANDO GASTOS ASIGNADOS ===');
  const clavesGastos1 = todasLasClaves.filter(k => k.startsWith('obra_otros_costos_'));
  const clavesGastos2 = todasLasClaves.filter(k => k.startsWith('asignaciones_locales_costos_'));
  const clavesGastos = [...clavesGastos1, ...clavesGastos2];

  console.log(`📋 Encontradas ${clavesGastos.length} claves de gastos`);

  for (const clave of clavesGastos) {
    // Extraer obraId
    let obraId;
    if (clave.startsWith('obra_otros_costos_')) {
      const partes = clave.split('_');
      obraId = parseInt(partes[3]);
    } else if (clave.startsWith('asignaciones_locales_costos_')) {
      const partes = clave.split('_');
      obraId = parseInt(partes[partes.length - 1]);
    }

    if (!obraId) {
      console.warn(`⚠️ No se pudo extraer obraId de clave: ${clave}`);
      continue;
    }

    const gastos = JSON.parse(localStorage.getItem(clave) || '[]');
    console.log(`\n📁 Obra ${obraId}: ${gastos.length} gastos`);

    for (const gasto of gastos) {
      try {
        const payload = {
          obraId: obraId,
          gastoGeneralId: gasto.gastoGeneralId || gasto.otroCostoId || null,
          importeAsignado: parseFloat(gasto.importeAsignado || gasto.importe) || 0,
          semana: gasto.semana || null,
          fechaAsignacion: gasto.fechaAsignacion || null,
          observaciones: gasto.observaciones || '',
          categoria: gasto.categoria || 'General'
        };

        console.log(`  📤 Enviando: ${gasto.descripcion || gasto.nombreOtroCosto}`, payload);

        const response = await fetch(`http://localhost:8080/api/obras/${obraId}/otros-costos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'empresaId': idEmpresa.toString()
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const resultado = await response.json();
          console.log(`  ✅ Gasto migrado: ${gasto.descripcion || gasto.nombreOtroCosto} (ID: ${resultado.id})`);
          totalGastosMigrados++;
        } else {
          const error = await response.text();
          console.error(`  ❌ Error migrando ${gasto.descripcion}:`, response.status, error);
        }
      } catch (error) {
        console.error(`  ❌ Error procesando ${gasto.descripcion}:`, error.message);
      }
    }
  }

  console.log('\n🎉 === MIGRACIÓN COMPLETADA ===');
  console.log(`📦 Materiales migrados: ${totalMaterialesMigrados}`);
  console.log(`💰 Gastos migrados: ${totalGastosMigrados}`);
  console.log(`\n💡 Recargando página en 3 segundos...`);

  setTimeout(() => {
    window.location.reload();
  }, 3000);
}

// Ejecutar automáticamente
migrarAsignacionesABD();
