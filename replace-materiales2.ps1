# Script para reemplazar la lógica en calcularDiasHabilesSemana
$filePath = "c:\Users\Usuario\Desktop\AppConstructoras\PROYECTO MODIFICADO\frontend-constructora_2\src\components\AsignarMaterialObraModal.jsx"

# Leer el archivo línea por línea
$lines = Get-Content $filePath -Encoding UTF8

# Encontrar la línea que contiene "Encontrar el lunes de la semana de inicio"
$startIdx = -1
$endIdx = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "Encontrar el lunes de la semana de inicio") {
        $startIdx = $i
        Write-Host "Encontrado inicio en línea $($i + 1)" -ForegroundColor Green
    }
    # Buscar el primer "return diasHabiles;" DESPUÉS del inicio y ANTES del } catch
    if ($startIdx -ne -1 -and $lines[$i] -match "^\s+return diasHabiles;\s*$" -and $endIdx -eq -1) {
        $endIdx = $i
        Write-Host "Encontrado fin (return diasHabiles) en línea $($i + 1)" -ForegroundColor Green
        break
    }
}

if ($startIdx -eq -1 -or $endIdx -eq -1) {
    Write-Host "❌ No se pudo encontrar la sección a reemplazar" -ForegroundColor Red
    Write-Host "startIdx: $startIdx, endIdx: $endIdx" -ForegroundColor Yellow
    exit 1
}

# Definir las nuevas líneas
$newLines = @(
    '      // Encontrar el primer lunes',
    '      const primerLunes = new Date(fechaInicio.getTime());',
    '      const diaSemanaInicio = primerLunes.getDay();',
    '      const diasHastaPrimerLunes = diaSemanaInicio === 0 ? -6 : 1 - diaSemanaInicio;',
    '      primerLunes.setDate(primerLunes.getDate() + diasHastaPrimerLunes);',
    '',
    '      // Calcular el lunes de la semana solicitada (calendario directo)',
    '      const fechaLunes = new Date(primerLunes.getTime());',
    '      fechaLunes.setDate(primerLunes.getDate() + ((numeroSemana - 1) * 7));',
    '',
    "      const nombresDias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];",
    '     const diasHabiles = [];',
    '',
    '      for (let i = 0; i < 5; i++) {',
    '        const dia = new Date(fechaLunes.getTime());',
    '        dia.setDate(fechaLunes.getDate() + i);',
    '',
    '        if (isNaN(dia.getTime())) {',
    '          console.error(`❌ Día ${i} inválido:`, dia);',
    '          continue;',
    '        }',
    '',
    '        diasHabiles.push({',
    '          fecha: new Date(dia.getTime()),',
    "          fechaStr: dia.toISOString().split('T')[0],",
    '          nombre: nombresDias[i],',
    '          numero: dia.getDate(),',
    '          esFeriado: esFeriado(dia)',
    '        });',
    '      }',
    '',
    '      console.log(`📅 [MATERIALES] Días calculados para semana ${numeroSemana}:`, diasHabiles);',
    '      return diasHabiles;'
)

Write-Host "Reemplazando líneas $($startIdx + 1) a $($endIdx + 1)" -ForegroundColor Cyan

# Construir el nuevo archivo
$newContent = @()
if ($startIdx -gt 0) {
    $newContent += $lines[0..($startIdx-1)]  # Líneas antes del cambio
}
$newContent += $newLines                      # Nuevas líneas
if ($endIdx -lt ($lines.Count - 1)) {
    $newContent += $lines[($endIdx+1)..($lines.Count-1)]  # Líneas después del cambio
}

# Guardar el archivo
$newContent | Set-Content $filePath -Encoding UTF8

Write-Host "✅ Archivo modificado exitosamente" -ForegroundColor Green
Write-Host "Total líneas originales: $($lines.Count)" -ForegroundColor Cyan
Write-Host "Total líneas nuevas: $($newContent.Count)" -ForegroundColor Cyan
