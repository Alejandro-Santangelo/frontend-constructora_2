/**
 * Script de debug para inspeccionar localStorage
 * Ejecutar en la consola del navegador
 */

console.log('🔍 === DEBUG LOCALSTORAGE ===\n');

// Obtener todas las claves
const todasLasClaves = Object.keys(localStorage);

// 1. MATERIALES
console.log('📦 === MATERIALES ===');
const clavesMateriales = todasLasClaves.filter(k => k.startsWith('obra_materiales_'));
console.log(`Encontradas ${clavesMateriales.length} claves de materiales:\n`);

clavesMateriales.forEach(clave => {
  const materiales = JSON.parse(localStorage.getItem(clave) || '[]');
  console.log(`\n📁 ${clave}:`);
  console.log(`   Total: ${materiales.length} materiales`);

  if (materiales.length > 0) {
    console.log('\n   Materiales guardados:');
    materiales.forEach((mat, idx) => {
      console.log(`   ${idx + 1}. ${mat.nombreMaterial || 'Sin nombre'}`);
      console.log(`      - ID: ${mat.id || mat.materialId}`);
      console.log(`      - Cantidad: ${mat.cantidadAsignada || mat.cantidad}`);
      console.log(`      - Precio: $${mat.precioUnitario || mat.precio || 0}`);
      console.log(`      - Semana: ${mat.numeroSemana || mat.semana || 'No especificada'}`);
      console.log(`      - Fecha: ${mat.fechaAsignacion || 'No especificada'}`);
      console.log(`      - Campos disponibles: ${Object.keys(mat).join(', ')}\n`);
    });
  }
});

// 2. GASTOS/OTROS COSTOS
console.log('\n💰 === GASTOS/OTROS COSTOS ===');
const clavesGastos1 = todasLasClaves.filter(k => k.startsWith('obra_otros_costos_'));
const clavesGastos2 = todasLasClaves.filter(k => k.startsWith('asignaciones_locales_costos_'));

console.log(`Encontradas ${clavesGastos1.length} claves "obra_otros_costos_"`);
console.log(`Encontradas ${clavesGastos2.length} claves "asignaciones_locales_costos_"\n`);

[...clavesGastos1, ...clavesGastos2].forEach(clave => {
  const gastos = JSON.parse(localStorage.getItem(clave) || '[]');
  console.log(`\n📁 ${clave}:`);
  console.log(`   Total: ${gastos.length} gastos`);

  if (gastos.length > 0) {
    console.log('\n   Gastos guardados:');
    gastos.forEach((gasto, idx) => {
      console.log(`   ${idx + 1}. ${gasto.descripcion || gasto.nombreOtroCosto || 'Sin descripción'}`);
      console.log(`      - ID: ${gasto.id}`);
      console.log(`      - Importe: $${gasto.importeAsignado || gasto.importe || 0}`);
      console.log(`      - Semana: ${gasto.semana || gasto.numeroSemana || 'No especificada'}`);
      console.log(`      - Fecha: ${gasto.fechaAsignacion || 'No especificada'}`);
      console.log(`      - Categoría: ${gasto.categoria || 'Sin categoría'}`);
      console.log(`      - Campos disponibles: ${Object.keys(gasto).join(', ')}\n`);
    });
  }
});

// 3. TRABAJOS EXTRA
console.log('\n🔧 === TRABAJOS EXTRA ===');
const clavesTrabajosExtra = todasLasClaves.filter(k => k.startsWith('obra_trabajos_extra_'));
console.log(`Encontradas ${clavesTrabajosExtra.length} claves de trabajos extra:\n`);

clavesTrabajosExtra.forEach(clave => {
  const trabajos = JSON.parse(localStorage.getItem(clave) || '[]');
  console.log(`\n📁 ${clave}:`);
  console.log(`   Total: ${trabajos.length} trabajos`);

  if (trabajos.length > 0) {
    console.log('\n   Trabajos guardados:');
    trabajos.forEach((trabajo, idx) => {
      console.log(`   ${idx + 1}. ${trabajo.nombre || 'Sin nombre'}`);
      console.log(`      - ID: ${trabajo.id}`);
      console.log(`      - Días: ${(trabajo.dias || []).length}`);
      console.log(`      - Profesionales: ${(trabajo.profesionales || []).length}`);
      console.log(`      - Tareas: ${(trabajo.tareas || []).length}`);
      console.log(`      - Campos disponibles: ${Object.keys(trabajo).join(', ')}\n`);
    });
  }
});

console.log('\n✅ === FIN DEBUG ===');
