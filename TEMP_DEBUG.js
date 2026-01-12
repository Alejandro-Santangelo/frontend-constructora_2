// CÓDIGO TEMPORAL - PEGAR EN LA CONSOLA DEL NAVEGADOR

// 1. Inspeccionar el objeto obra que se pasa al modal
console.log('=== DEBUG OBRA ===');
const obraElement = document.querySelector('[data-obra-id]');
if (obraElement) {
  console.log('Elemento obra encontrado');
}

// 2. Ejecutar esto cuando abras el modal de materiales
window.debugObraModal = function() {
  console.log('🚨🚨🚨 Debug manual de obra');
  // Copiar el resultado y pegarlo aquí
};

console.log('✅ Funciones de debug cargadas. Ahora abre el modal de materiales y ejecuta en consola: debugObraModal()');
