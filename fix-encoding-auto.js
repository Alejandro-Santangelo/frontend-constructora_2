const fs = require('fs');
const path = require('path');

/**
 * Script automático para CORREGIR problemas de encoding
 * Uso: npm run fix-encoding
 */

const EXTENSIONS = ['.js', '.jsx', '.json', '.css', '.html', '.md'];
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build'];

// Patrones de caracteres mal codificados y sus correcciones
const FIXES = [
  // Vocales acentuadas
  { pattern: /Ã³/g, correct: 'ó', name: 'ó' },
  { pattern: /Ã­/g, correct: 'í', name: 'í' },
  { pattern: /Ã±/g, correct: 'ñ', name: 'ñ' },
  { pattern: /Ã¡/g, correct: 'á', name: 'á' },
  { pattern: /Ã©/g, correct: 'é', name: 'é' },
  { pattern: /Ãº/g, correct: 'ú', name: 'ú' },
  { pattern: /Ã/g, correct: 'Á', name: 'Á' },
  { pattern: /Ã‰/g, correct: 'É', name: 'É' },
  { pattern: /Ã/g, correct: 'Í', name: 'Í' },
  { pattern: /Ã"/g, correct: 'Ó', name: 'Ó' },
  { pattern: /Ãš/g, correct: 'Ú', name: 'Ú' },
  { pattern: /Ã'/g, correct: 'Ñ', name: 'Ñ' },

  // Superíndices y símbolos
  { pattern: /Â²/g, correct: '²', name: '²' },
  { pattern: /Â³/g, correct: '³', name: '³' },
  { pattern: /Â¿/g, correct: '¿', name: '¿' },
  { pattern: /Â¡/g, correct: '¡', name: '¡' },
  { pattern: /Ã—/g, correct: '×', name: '×' },
  { pattern: /â†'/g, correct: '→', name: '→' },

  // Emojis comunes
  { pattern: /ðŸ"¦/g, correct: '📦', name: '📦' },
  { pattern: /ðŸ"‹/g, correct: '📋', name: '📋' },
  { pattern: /ðŸ"/g, correct: '🔍', name: '🔍' },
  { pattern: /ðŸ"¥/g, correct: '🔥', name: '🔥' },
  { pattern: /ðŸ"„/g, correct: '🔄', name: '🔄' },
  { pattern: /ðŸ§¹/g, correct: '🧹', name: '🧹' },
  { pattern: /ðŸ"…/g, correct: '📅', name: '📅' },
  { pattern: /ðŸ'°/g, correct: '💰', name: '💰' },
  { pattern: /ðŸ"¤/g, correct: '📤', name: '📤' },
  { pattern: /ðŸ"Š/g, correct: '📊', name: '📊' },
  { pattern: /âœ…/g, correct: '✅', name: '✅' },
  { pattern: /âŒ/g, correct: '❌', name: '❌' },
  { pattern: /âš ï¸/g, correct: '⚠️', name: '⚠️' },
];

function shouldIgnore(filePath) {
  return IGNORE_DIRS.some(dir => filePath.includes(dir));
}

function hasValidExtension(filePath) {
  return EXTENSIONS.some(ext => filePath.endsWith(ext));
}

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let totalReplacements = 0;
    let fixes = [];

    FIXES.forEach(({ pattern, correct, name }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        content = content.replace(pattern, correct);
        totalReplacements += matches.length;
        fixes.push(`    - ${name}: ${matches.length}x`);
      }
    });

    if (totalReplacements > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`\n✅ ${path.relative(process.cwd(), filePath)}`);
      fixes.forEach(fix => console.log(fix));
      return { file: filePath, fixed: true, count: totalReplacements };
    }

    return { file: filePath, fixed: false, count: 0 };
  } catch (error) {
    console.error(`❌ Error procesando ${filePath}:`, error.message);
    return { file: filePath, fixed: false, count: 0, error: true };
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
        results.push(fixFile(fullPath));
      }
    }
  } catch (error) {
    console.error(`Error escaneando ${dir}:`, error.message);
  }

  return results;
}

// Ejecutar
console.log('🔧 Corrigiendo problemas de encoding automáticamente...\n');
const startTime = Date.now();
const results = scanDirectory('./src');
const endTime = Date.now();

const filesFixed = results.filter(r => r.fixed);
const totalReplacements = results.reduce((sum, r) => sum + r.count, 0);
const filesScanned = results.filter(r => !r.error).length;

console.log('\n' + '='.repeat(60));
console.log('📊 RESUMEN');
console.log('='.repeat(60));
console.log(`Archivos escaneados: ${filesScanned}`);
console.log(`Archivos corregidos: ${filesFixed.length}`);
console.log(`Total de correcciones: ${totalReplacements}`);
console.log(`Tiempo: ${endTime - startTime}ms`);

if (filesFixed.length === 0) {
  console.log('\n✅ ¡No se encontraron problemas de encoding!');
} else {
  console.log(`\n✅ ${filesFixed.length} archivos corregidos exitosamente`);
  console.log('💡 Recuerda commitear los cambios si es necesario');
}

process.exit(0);
