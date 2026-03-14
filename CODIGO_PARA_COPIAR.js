/**
 * CÓDIGO PARA COPIAR Y PEGAR EN ObrasPage.jsx
 * ==============================================
 * 
 * Busca las secciones indicadas y agrega estos bloques de código
 */

// ============================================
// 1. ESTADOS (Agregar después de los otros estados de modales)
// ============================================

// 🆕 Estados para Jornales Diarios
const [mostrarModalRegistrarJornales, setMostrarModalRegistrarJornales] = React.useState(false);
const [mostrarModalHistorialJornales, setMostrarModalHistorialJornales] = React.useState(false);
const [obraParaJornales, setObraParaJornales] = React.useState(null);


// ============================================
// 2. HANDLERS (Agregar en el objeto de controls/menuOptions)
// ============================================

handleRegistrarJornales: () => {
  if (selectedObraId) {
    // Verificar si es una tarea
    if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
      const tareaIdNumerico = parseInt(selectedObraId.replace('ta_', ''));
      const tarea = trabajosAdicionales.find(ta => ta.id === tareaIdNumerico);
      if (tarea) {
        const tareaComoObra = {
          ...tarea,
          id: tareaIdNumerico,
          nombre: tarea.nombre
        };
        setObraParaJornales(tareaComoObra);
        setMostrarModalRegistrarJornales(true);
      }
    } else {
      // Es una obra normal
      const obra = obras.find(o => o.id === selectedObraId);
      if (obra) {
        setObraParaJornales(obra);
        setMostrarModalRegistrarJornales(true);
      }
    }
  } else {
    showNotification('Seleccione una obra para registrar jornales', 'warning');
  }
},
handleHistorialJornales: () => {
  if (selectedObraId) {
    // Verificar si es una tarea
    if (typeof selectedObraId === 'string' && selectedObraId.startsWith('ta_')) {
      const tareaIdNumerico = parseInt(selectedObraId.replace('ta_', ''));
      const tarea = trabajosAdicionales.find(ta => ta.id === tareaIdNumerico);
      if (tarea) {
        const tareaComoObra = {
          ...tarea,
          id: tareaIdNumerico,
          nombre: tarea.nombre
        };
        setObraParaJornales(tareaComoObra);
        setMostrarModalHistorialJornales(true);
      }
    } else {
      // Es una obra normal
      const obra = obras.find(o => o.id === selectedObraId);
      if (obra) {
        setObraParaJornales(obra);
        setMostrarModalHistorialJornales(true);
      }
    }
  } else {
    showNotification('Seleccione una obra para ver historial', 'warning');
  }
},


// ============================================
// 3. MODALES JSX (Agregar al final antes del cierre del return)
// ============================================

{/* 🆕 JORNALES DIARIOS - Modal Registrar Horas */}
{mostrarModalRegistrarJornales && obraParaJornales && (
  <RegistrarJornalesDiariosModal
    show={mostrarModalRegistrarJornales}
    onHide={() => {
      setMostrarModalRegistrarJornales(false);
      setObraParaJornales(null);
    }}
    obra={obraParaJornales}
    onJornalCreado={() => {
      showNotification('✅ Jornales registrados exitosamente', 'success');
    }}
  />
)}

{/* 🆕 JORNALES DIARIOS - Modal Ver Historial */}
{mostrarModalHistorialJornales && obraParaJornales && (
  <HistorialJornalesModal
    show={mostrarModalHistorialJornales}
    onHide={() => {
      setMostrarModalHistorialJornales(false);
      setObraParaJornales(null);
    }}
    obra={obraParaJornales}
  />
)}


// ============================================
// 4. BOTONES EN SIDEBAR (Agregar donde prefieras)
// ============================================

{/* Opción A: Botones Separados */}
<Button 
  variant="info" 
  size="sm"
  onClick={controls.handleRegistrarJornales}
  className="mb-2 w-100"
  disabled={!selectedObraId}
  title="Registrar las horas trabajadas hoy"
>
  <i className="fas fa-clock me-2"></i>
  Registrar Horas Hoy
</Button>

<Button 
  variant="outline-info" 
  size="sm"
  onClick={controls.handleHistorialJornales}
  className="mb-2 w-100"
  disabled={!selectedObraId}
  title="Ver historial completo de jornales de la obra"
>
  <i className="fas fa-history me-2"></i>
  Historial de Jornales
</Button>


{/* Opción B: Dropdown/Grupo */}
<div className="mb-3">
  <h6 className="text-muted mb-2">
    <i className="fas fa-clock me-2"></i>Control Horario
  </h6>
  <Button 
    variant="info" 
    size="sm"
    onClick={controls.handleRegistrarJornales}
    className="mb-2 w-100"
    disabled={!selectedObraId}
  >
    <i className="fas fa-plus-circle me-2"></i>
    Registrar Jornales
  </Button>
  <Button 
    variant="outline-info" 
    size="sm"
    onClick={controls.handleHistorialJornales}
    className="w-100"
    disabled={!selectedObraId}
  >
    <i className="fas fa-list me-2"></i>
    Ver Historial
  </Button>
</div>


// ============================================
// 5. EJEMPLO COMPLETO DE SECCIÓN EN SIDEBAR
// ============================================

<div className="sidebar-section">
  <h5 className="sidebar-title">
    <i className="fas fa-cog me-2"></i>
    Configuración de Obra
  </h5>
  
  {/* Botones existentes */}
  <Button onClick={controls.handleVerProfesionales} className="w-100 mb-2">
    Ver Profesionales Asignados
  </Button>
  <Button onClick={controls.handleAsignarMateriales} className="w-100 mb-2">
    Asignar Materiales
  </Button>
  
  {/* 🆕 NUEVOS BOTONES DE JORNALES */}
  <hr />
  <h6 className="text-muted mb-2">
    <i className="fas fa-clock me-2"></i>Control Horario Diario
  </h6>
  <Button 
    variant="info" 
    size="sm"
    onClick={controls.handleRegistrarJornales}
    className="mb-2 w-100"
    disabled={!selectedObraId}
  >
    <i className="fas fa-clock me-2"></i>
    Registrar Horas Hoy
  </Button>
  <Button 
    variant="outline-info" 
    size="sm"
    onClick={controls.handleHistorialJornales}
    className="w-100"
    disabled={!selectedObraId}
  >
    <i className="fas fa-history me-2"></i>
    Ver Historial
  </Button>
</div>


// ============================================
// NOTAS IMPORTANTES
// ============================================

/*
1. Los imports ya están agregados en ObrasPage.jsx:
   - RegistrarJornalesDiariosModal
   - HistorialJornalesModal

2. El servicio jornalesDiariosService.js ya está creado

3. Los modales están completamente funcionales y listos para usar

4. Solo falta agregar los 3 bloques de código:
   - Estados (línea ~200-300)
   - Handlers (donde estén los otros handlers)
   - JSX de modales (al final del return)
   - Botones en sidebar (donde prefieras)

5. Una vez agregado, el sistema estará 100% funcional

6. Los jornales se sincronizan automáticamente con:
   - Profesionales asignados (desde AsignacionProfesionalObra)
   - Datos de backend (tabla profesional_jornales_diarios)
   - Cálculos automáticos de montos

7. El workflow es:
   a) Seleccionar obra
   b) Click en "Registrar Horas Hoy"
   c) Ingresar horas (0.25, 0.5, 1.0, etc.)
   d) Guardar
   e) Ver en "Historial" el resumen y detalle
*/
