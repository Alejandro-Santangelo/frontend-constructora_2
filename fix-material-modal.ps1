# Script para corregir AsignarMaterialObraModal.jsx

$file = "src\components\AsignarMaterialObraModal.jsx"
$content = Get-Content $file -Encoding UTF8 -Raw

# Reemplazar el bloque de búsqueda de presupuestos (líneas 163-237)
$oldPattern = @'
timestamp = new Date\(\)\.getTime\(\);.*?// Extraer materiales de itemsCalculadora
'@

$newCode = @'
// 🆕 Buscar TANTO en presupuestos tradicionales COMO en trabajos extra
      const [dataTradicionales, dataTrabajosExtra] = await Promise.all([
        api.presupuestosNoCliente.getAll(empresaSeleccionada.id),
        api.trabajosExtra.getAll(empresaSeleccionada.id, { obraId: obra.id })
      ]);

      console.log('📦 Presupuestos tradicionales obtenidos:', dataTradicionales?.length || 0);
      console.log('📦 Trabajos extra obtenidos:', dataTrabajosExtra?.length || 0);

      // El backend puede devolver el array directamente o dentro de content/datos
      const presupuestosTradicionales = Array.isArray(dataTradicionales) ? dataTradicionales : (dataTradicionales?.content || dataTradicionales?.datos || []);
      const trabajosExtraArray = Array.isArray(dataTrabajosExtra) ? dataTrabajosExtra : [];

      // 🆕 Combinar ambos tipos de presupuestos
      const todosPresupuestos = [...presupuestosTradicionales, ...trabajosExtraArray];
      console.log('📦 Total presupuestos combinados:', todosPresupuestos.length);

      // Estados válidos para obras vinculadas (MODIFICADO NO se incluye)
      const estadosValidos = ['APROBADO', 'EN_EJECUCION', 'SUSPENDIDA', 'CANCELADA'];

      // Filtrar por obraId Y estado válido
      const presupuestosObra = (todosPresupuestos || []).filter(p =>
        (p.obraId === obra.id || p.idObra === obra.id) && estadosValidos.includes(p.estado)
      );
      console.log('✅ Presupuestos con estado válido de obra', obra.id, ':', presupuestosObra.length);

      if (presupuestosObra.length === 0) {
        throw new Error('No se encontró un presupuesto con estado válido (APROBADO, EN_EJECUCION, SUSPENDIDA, CANCELADA) para esta obra');
      }

      // Tomar el más reciente entre los APROBADOS (mayor versión o mayor ID)
      const presupuestoActual = presupuestosObra.sort((a, b) => {
        if (a.numeroPresupuesto === b.numeroPresupuesto) {
          return (b.version || 0) - (a.version || 0);
        }
        return b.id - a.id;
      })[0];

      const presupuestoId = presupuestoActual.id;
      const esTrabajoExtra = presupuestoActual.esTrabajoExtra || presupuestoActual.tipo === 'TRABAJO_EXTRA';

      console.log('✅ Presupuesto seleccionado:', {
        id: presupuestoId,
        version: presupuestoActual.version,
        esTrabajoExtra: esTrabajoExtra,
        estado: presupuestoActual.estado,
        fechaProbableInicio: presupuestoActual.fechaProbableInicio
      });

      // 🔥 Obtener presupuesto completo según su tipo
      let presupuestoData;
      if (esTrabajoExtra) {
        console.log('📦 Cargando trabajo extra completo ID:', presupuestoId);
        presupuestoData = await api.trabajosExtra.getById(presupuestoId, empresaSeleccionada.id);
      } else {
        console.log('📦 Cargando presupuesto tradicional completo ID:', presupuestoId);
        presupuestoData = await api.presupuestosNoCliente.getById(presupuestoId, empresaSeleccionada.id);
      }

      console.log('📦 presupuestoData completo recibido:', presupuestoData);
      console.log('📅 fechaProbableInicio en presupuestoData (completo):', presupuestoData.fechaProbableInicio);

      // Extraer materiales de itemsCalculadora
'@

$content = $content -replace $oldPattern, $newCode

Set-Content $file -Value $content -Encoding UTF8

Write-Host "✅ Archivo actualizado con éxito" -ForegroundColor Green
