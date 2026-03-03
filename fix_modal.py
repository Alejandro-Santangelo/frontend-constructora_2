#!/usr/bin/env python3
"""
Fix AsignarMaterialObraModal.jsx:
1. abrirAsignacionParaDia: auto-seleccionar tipoAsignacion cuando solo hay una opcion
2. Boton "Agregar Material": preseleccionar IMPORTE_GLOBAL en modo global
3. Selector: ocultarlo cuando solo hay una opcion disponible
"""

f = r'c:\Users\Usuario\Desktop\AppConstructoras\frontend-constructora_2\src\components\AsignarMaterialObraModal.jsx'

with open(f, 'r', encoding='utf-8') as fp:
    content = fp.read()

print(f"Archivo leido: {len(content)} chars")

# =============================================================================
# CAMBIO 1: Funcion abrirAsignacionParaDia - auto-seleccionar tipoAsignacion
# =============================================================================
# Buscar el bloque de setNuevaAsignacion donde tipoAsignacion: ''
# El bloque esta dentro de abrirAsignacionParaDia

old_block_1 = '''    setNuevaAsignacion({
      tipoAsignacion: '',
      materialId: '',
      cantidadAsignada: '',
      importeUnitario: '',
      importeAsignado: '',
      fechaAsignacion: fechaStr,
      observaciones: '',
      esManual: false
    });'''

# Hay que encontrarlo en el contexto correcto - buscar antes de setMostrarDetalleSemana(false)
# Para asegurarnos de que es el de abrirAsignacionParaDia

# Buscar la funcion completa
marker_start = '  // Nueva funci'  # puede ser con ?? por encoding
# Mejor buscar por un patron mas unico
import re

# Patron: la funcion abrirAsignacionParaDia
pattern = r'(  const abrirAsignacionParaDia = \(fechaStr\) => \{.*?setMostrarDetalleSemana\(false\); // Cerrar detalle semanal\n    setMostrarFormularioIndividual\(true\); // Abrir formulario individual\n.*?  \};)'

match = re.search(pattern, content, re.DOTALL)
if match:
    print("\n=== CAMBIO 1: Encontrado bloque abrirAsignacionParaDia ===")
    print(f"Posicion: {match.start()}-{match.end()}")
    print("Primeros 200 chars:", repr(match.group(0)[:200]))

    new_func = '''  const abrirAsignacionParaDia = (fechaStr) => {
    // Auto-detectar tipo de asignacion segun el contexto disponible
    const tieneGlobal = (modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && presupuestoGlobalDisponible > 0;
    const tieneDetalle = materialesDisponibles.length > 0;

    let tipoAuto = '';
    let materialAuto = '';
    let importeAuto = '';

    if (tieneDetalle && !tieneGlobal) {
      // Solo opcion detallada: preseleccionarla
      tipoAuto = 'ELEMENTO_DETALLADO';
      // Si solo hay 1 material, preseleccionarlo tambien
      if (materialesDisponibles.length === 1) {
        const mat = materialesDisponibles[0];
        materialAuto = mat.id ? mat.id.toString() : '';
        importeAuto = String(mat.importe || mat.precioUnitario || '');
      }
    } else if (tieneGlobal && !tieneDetalle) {
      // Solo opcion global: preseleccionarla
      tipoAuto = 'IMPORTE_GLOBAL';
    }
    // Si hay ambas opciones, dejar tipoAuto vacio para que el usuario elija

    setNuevaAsignacion({
      tipoAsignacion: tipoAuto,
      materialId: materialAuto,
      cantidadAsignada: '',
      importeUnitario: importeAuto,
      importeAsignado: importeAuto,
      fechaAsignacion: fechaStr,
      observaciones: '',
      esManual: false
    });
    setNuevoGastoManual({
      descripcion: '',
      categoria: 'General',
      categoriaCustom: '',
      cantidadAsignada: '',
      importeUnitario: '',
      observaciones: ''
    });
    setMostrarDetalleSemana(false); // Cerrar detalle semanal
    setMostrarFormularioIndividual(true); // Abrir formulario individual
  };'''

    content = content[:match.start()] + new_func + content[match.end():]
    print("Cambio 1 aplicado exitosamente.")
else:
    print("ERROR: No se encontro el patron para abrirAsignacionParaDia")

# =============================================================================
# CAMBIO 2: Boton "Agregar Material" - preseleccionar IMPORTE_GLOBAL
# =============================================================================
# Buscar el onClick del boton "Agregar Material" en modo GLOBAL son semanas
old_click = '''                                   onClick={() => {
                                     // Resetear formulario completamente
                                     setNuevaAsignacion({
                                       tipoAsignacion: '',
                                       materialId: '',
                                       cantidadAsignada: '',
                                       importeUnitario: '',
                                       importeAsignado: '',
                                       fechaAsignacion: new Date().toISOString().slice(0, 10),
                                       observaciones: '',
                                       esManual: false
                                     });'''

new_click = '''                                   onClick={() => {
                                     // Resetear formulario - modo GLOBAL preseleccionado
                                     setNuevaAsignacion({
                                       tipoAsignacion: 'IMPORTE_GLOBAL',
                                       materialId: '',
                                       cantidadAsignada: '',
                                       importeUnitario: '',
                                       importeAsignado: '',
                                       fechaAsignacion: new Date().toISOString().slice(0, 10),
                                       observaciones: '',
                                       esManual: false
                                     });'''

if old_click in content:
    content = content.replace(old_click, new_click, 1)
    print("\nCambio 2 aplicado exitosamente.")
else:
    # Buscar version con variaciones de espacios
    alt_click = old_click.replace("                                   ", "                                  ")
    if alt_click in content:
        content = content.replace(alt_click, new_click.replace("                                   ", "                                  "), 1)
        print("\nCambio 2 aplicado (version alternativa).")
    else:
        print("\nERROR: No se encontro el patron para boton Agregar Material")
        # Mostrar contexto de busqueda
        idx = content.find("// Resetear formulario completamente")
        if idx >= 0:
            print(f"Encontrado texto parcial en posicion {idx}")
            print(repr(content[idx-100:idx+200]))

# =============================================================================
# CAMBIO 3: Selector - ocultarlo cuando solo hay una opcion
# =============================================================================
# Envolver el div del selector con condicion JSX
# Buscar: el comentario del selector seguido del div

old_selector_start = '''                {/* \U0001f195 Selector de Tipo de Asignaci'''

# Buscar el patron con diferentes posibles encodings
import sys

# Buscar el inicio del bloque del selector
selector_marker = r'Selector de Tipo de Asignaci'
selector_idx = content.find(selector_marker)
if selector_idx >= 0:
    print(f"\nEncontrado selector en posicion {selector_idx}")
    # encontrar el inicio del comentario JSX
    comment_start = content.rfind('{/*', 0, selector_idx)
    print(f"Inicio del comentario: {comment_start}")
    print(f"Contexto: {repr(content[comment_start:comment_start+100])}")

    # Buscar el cierre del div del selector (la primera </div> seguida de una linea con {/*)
    # El div del selector termina justo antes de {/* Mostrar campos segun el tipo seleccionado */}
    campos_marker = 'Mostrar campos seg'  # puede tener ?? por encoding
    campos_idx = content.find(campos_marker, selector_idx)
    if campos_idx >= 0:
        # El cierre del div esta antes de este marcador
        # Buscar el </div> mas cercano antes de campos_marker
        div_close_idx = content.rfind('</div>', 0, campos_idx)
        print(f"\nCierre </div> del selector en: {div_close_idx}")
        print(f"Contexto: {repr(content[div_close_idx:div_close_idx+50])}")

        # La condicion envolvera desde comment_start hasta div_close_idx + len('</div>')
        # Pero necesitamos el final de linea del </div>
        end_of_div_line = content.find('\n', div_close_idx) + 1

        # Construir nuevo bloque
        selector_block = content[comment_start:end_of_div_line]

        # La condicion: mostrar solo cuando hay ambas opciones
        condition_open = "                {((modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && presupuestoGlobalDisponible > 0 && materialesDisponibles.length > 0) && (\n"
        condition_close = "                )}\n"

        new_selector_block = condition_open + selector_block + condition_close

        content = content[:comment_start] + new_selector_block + content[end_of_div_line:]
        print(f"\nCambio 3 aplicado exitosamente.")
        print(f"Bloque envuelto: {repr(selector_block[:100])}")
    else:
        print(f"ERROR: No se encontro marcador 'Mostrar campos'")
else:
    print(f"ERROR: No se encontro el selector de tipo de asignacion")

# =============================================================================
# GUARDAR
# =============================================================================
with open(f, 'w', encoding='utf-8') as fp:
    fp.write(content)

print(f"\nArchivo guardado: {len(content)} chars")
print("\nScript completado exitosamente.")
