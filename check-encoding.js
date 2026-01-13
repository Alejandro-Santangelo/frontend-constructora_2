const fs = require('fs');
const path = require('path');

/**
 * Script para verificar y corregir encoding de archivos
 * Uso: node check-encoding.js
 */

const EXTENSIONS = ['.js', '.jsx', '.json', '.css', '.html', '.md'];
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build'];

// Patrones de caracteres mal codificados comunes
const ENCODING_ISSUES = [
  { pattern: /Ã³/g, correct: 'ó', name: 'ó (o acentuada)' },
  { pattern: /Ã­/g, correct: 'í', name: 'í (i acentuada)' },
  { pattern: /Ã±/g, correct: 'ñ', name: 'ñ (eñe)' },
  { pattern: /Ã¡/g, correct: 'á', name: 'á (a acentuada)' },
  { pattern: /Ã©/g, correct: 'é', name: 'é (e acentuada)' },
  { pattern: /Ãº/g, correct: 'ú', name: 'ú (u acentuada)' },
  { pattern: /Â²/g, correct: '²', name: '² (superíndice 2)' },
  { pattern: /Â³/g, correct: '³', name: '³ (superíndice 3)' },
  { pattern: /Â¿/g, correct: '¿', name: '¿ (interrogación)' },
  { pattern: /\u00F0\u0178\u201C\u00A6/g, correct: '📦', name: '📦 (emoji caja)' },
  { pattern: /\u00F0\u0178\u201C\u2039/g, correct: '📋', name: '📋 (emoji clipboard)' },
];

function shouldIgnore(filePath) {
  return IGNORE_DIRS.some(dir => filePath.includes(dir));
}

function hasValidExtension(filePath) {
  return EXTENSIONS.some(ext => filePath.endsWith(ext));
}

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let issues = [];
    let hasIssues = false;

    ENCODING_ISSUES.forEach(({ pattern, correct, name }) => {
      const matches = content.match(pattern);
      if (matches) {
        hasIssues = true;
        issues.push(`  - ${name}: ${matches.length} ocurrencias`);
      }
    });

    if (hasIssues) {
      console.log(`\n❌ ${filePath}`);
      issues.forEach(issue => console.log(issue));
      return { file: filePath, hasIssues: true };
    }

    return { file: filePath, hasIssues: false };
  } catch (error) {
    console.error(`Error leyendo ${filePath}:`, error.message);
    return { file: filePath, hasIssues: false, error: true };
  }
}

function scanDirectory(dir) {
  let results = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (shouldIgnore(fullPath)) continue;

      if (entry.isDirectory()) {
        results = results.concat(scanDirectory(fullPath));
      } else if (hasValidExtension(entry.name)) {
        results.push(checkFile(fullPath));
      }
    }
  } catch (error) {
    console.error(`Error escaneando ${dir}:`, error.message);
  }

  return results;
}

// Ejecutar
console.log('🔍 Escaneando archivos en busca de problemas de encoding...\n');
const startTime = Date.now();
const results = scanDirectory('./src');
const endTime = Date.now();

const filesWithIssues = results.filter(r => r.hasIssues);
const filesScanned = results.filter(r => !r.error).length;

console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN');
console.log('='.repeat(60));
console.log(`Archivos escaneados: ${filesScanned}`);
console.log(`Archivos con problemas: ${filesWithIssues.length}`);
console.log(`Tiempo: ${endTime - startTime}ms`);

if (filesWithIssues.length === 0) {
  console.log('\n✅ ¡No se encontraron problemas de encoding!');
} else {
  console.log('\n⚠️  Ejecuta el script de corrección para arreglar estos archivos.');
}
