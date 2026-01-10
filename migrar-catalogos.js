/**
 * Script de migración para agregar materiales y gastos asignados a sus catálogos
 * Ejecutar en la consola del navegador estando en la aplicación
 *
 * IMPORTANTE: Ejecutar desde cualquier página de la aplicación
 * NOTA: Los servicios fueron corregidos para enviar JSON en formato esperado por backend
 */

async function migrarAsignacionesACatalogos() {
  console.log('🚀 Iniciando migración de asignaciones a catálogos...');
  console.log('📋 Versión: 2.0 - Con servicios corregidos');

  // Obtener empresaId del contexto
  const empresaId = localStorage.getItem('empresaSeleccionada');
  if (!empresaId) {
    console.error('❌ No hay empresa seleccionada en localStorage');
    return;
  }

  const empresaObj = JSON.parse(empresaId);
  const idEmpresa = empresaObj.id;
  console.log('✅ Empresa ID:', idEmpresa);

  // Importar servicios dinámicamente
  const catalogoMaterialesModule = await import('/src/services/catalogoMaterialesService.js');
  const catalogoGastosModule = await import('/src/services/catalogoGastosService.js');

  const { obtenerOCrearMaterial } = catalogoMaterialesModule;
  const { obtenerOCrearGasto } = catalogoGastosModule;

  // 1. MIGRAR MATERIALES
  console.log('\n📦 === MIGRANDO MATERIALES ===');

  // Buscar todas las claves de materiales en localStorage
  const todasLasClaves = Object.keys(localStorage);
  const clavesMateriales = todasLasClaves.filter(k => k.startsWith('obra_materiales_'));

  console.log(`📋 Encontradas ${clavesMateriales.length} claves de materiales`);

  const materialesUnicos = new Map(); // nombre+unidad -> material

  for (const clave of clavesMateriales) {
    const materiales = JSON.parse(localStorage.getItem(clave) || '[]');
    console.log(`  📁 ${clave}: ${materiales.length} materiales`);

    for (const material of materiales) {
      const key = `${material.nombreMaterial}_${material.unidadMedida}`;
      if (!materialesUnicos.has(key)) {
        // Buscar precio en diferentes campos posibles
        const precio = material.precioUnitario
                    || material.precio
                    || material.subtotal
                    || (material.cantidadAsignada > 0 ? (material.importe || 0) / material.cantidadAsignada : 0)
                    || 0;

        materialesUnicos.set(key, {
          nombre: material.nombreMaterial,
          unidadMedida: material.unidadMedida,
          precioUnitario: precio
        });

        console.log(`    💰 ${material.nombreMaterial}: $${precio.toFixed(2)}`);
      }
    }
  }

  console.log(`\n✨ Materiales únicos a crear: ${materialesUnicos.size}`);

  for (const [key, material] of materialesUnicos) {
    try {
      // Usar el servicio que ya maneja correctamente los headers
      const created = await obtenerOCrearMaterial(
        material.nombre,
        material.unidadMedida,
        material.precioUnitario,
        idEmpresa
      );

      console.log(`  ✅ Material procesado: ${material.nombre} (ID: ${created.id})`);

    } catch (error) {
      console.error(`  ❌ Error procesando ${material.nombre}:`, error.message);
    }
  }

  // 2. MIGRAR GASTOS GENERALES
  console.log('\n💰 === MIGRANDO GASTOS GENERALES ===');

  // Buscar todas las claves de gastos en localStorage
  const clavesGastos = todasLasClaves.filter(k => k.startsWith('obra_otros_costos_'));

  console.log(`📋 Encontradas ${clavesGastos.length} claves de gastos`);

  const gastosUnicos = new Map(); // descripcion -> gasto

  for (const clave of clavesGastos) {
    const gastos = JSON.parse(localStorage.getItem(clave) || '[]');
    console.log(`  📁 ${clave}: ${gastos.length} gastos`);

    for (const gasto of gastos) {
      const descripcion = gasto.nombreOtroCosto || gasto.descripcion;
      if (descripcion && !gastosUnicos.has(descripcion)) {
        gastosUnicos.set(descripcion, {
          descripcion: descripcion,
          precioUnitario: gasto.importeAsignado || 0
        });
      }
    }
  }

  console.log(`\n✨ Gastos únicos a crear: ${gastosUnicos.size}`);

  for (const [desc, gasto] of gastosUnicos) {
    try {
      // Usar el servicio que ya maneja correctamente los headers
      const created = await obtenerOCrearGasto(
        gasto.descripcion,
        gasto.precioUnitario,
        idEmpresa
      );

      console.log(`  ✅ Gasto procesado: ${gasto.descripcion} (ID: ${created.id})`);

    } catch (error) {
      console.error(`  ❌ Error procesando ${gasto.descripcion}:`, error.message);
    }
  }

  console.log('\n🎉 Migración completada!');
  console.log('💡 Recargando página en 2 segundos...');

  // Recargar automáticamente
  setTimeout(() => {
    window.location.reload();
  }, 2000);
}

// Ejecutar automáticamente
migrarAsignacionesACatalogos();
