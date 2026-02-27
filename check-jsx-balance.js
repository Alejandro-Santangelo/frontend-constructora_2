const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'PresupuestoNoClienteModal.jsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Contar divs abiertos y cerrados dentro del form
let formStartLine = -1;
let formEndLine = -1;
let inForm = false;
let openDivs = [];
let openFragments = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;

  // Detectar apertura del form
  if (line.includes('<form') && line.includes('ref={modalContentRef}')) {
    formStartLine = lineNum;
    inForm = true;
    console.log(`✅ Form abierto en línea ${lineNum}`);
  }

  // Detectar cierre del form
  if (line.trim() === '</form>' && inForm) {
    formEndLine = lineNum;
    inForm = false;
    console.log(`✅ Form cerrado en línea ${lineNum}`);
  }

  if (inForm) {
    // Contar divs abiertos
    const divMatches = line.match(/<div[^>]*>/g);
    if (divMatches) {
      divMatches.forEach(() => {
        openDivs.push(lineNum);
      });
    }

    // Contar divs cerrados (que no sean auto-cerrados)
    const closeDivMatches = line.match(/<\/div>/g);
    if (closeDivMatches) {
      closeDivMatches.forEach(() => {
        if (openDivs.length > 0) {
          openDivs.pop();
        }
      });
    }

    // Contar fragmentos abiertos
    if (line.includes('<>') && !line.includes('</>')) {
      openFragments.push(lineNum);
    }

    // Contar fragmentos cerrados
    if (line.includes('</>')) {
      if (openFragments.length > 0) {
        openFragments.pop();
      }
    }
  }
}

console.log(`\n📊 Resumen:`);
console.log(`Form: línea ${formStartLine} a ${formEndLine}`);
console.log(`\nDivs sin cerrar dentro del form: ${openDivs.length}`);
if (openDivs.length > 0) {
  console.log(`❌ Divs abiertos en las líneas:`, openDivs.slice(-10)); // Mostrar los últimos 10
}

console.log(`\nFragmentos sin cerrar dentro del form: ${openFragments.length}`);
if (openFragments.length > 0) {
  console.log(`❌ Fragmentos abiertos en las líneas:`, openFragments);
}
