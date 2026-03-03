#!/usr/bin/env python3
# Script to fix JSX selector condition in AsignarMaterialObraModal.jsx
import sys

f = r'c:\Users\Usuario\Desktop\AppConstructoras\frontend-constructora_2\src\components\AsignarMaterialObraModal.jsx'

with open(f, 'r', encoding='utf-8') as fp:
    lines = fp.readlines()

print(f'Total lineas: {len(lines)}')

# Verificar las líneas que vamos a modificar
print('=== Líneas 2944-2952 (índ. 2943-2951):')
for i in range(2943, 2952):
    print(f'{i+1}: {repr(lines[i])}')

print('\n=== Líneas 2997-3003 (índ. 2996-3002):')
for i in range(2996, 3003):
    print(f'{i+1}: {repr(lines[i])}')

# El plan:
# 1. Líneas 2945-2949 (índices 2944-2948): reemplazar con una sola línea correcta
# 2. Línea 3001 (índice 3000): cambiar '                )}\n' por '                </>)}\n'

# Nuevo bloque de apertura (reemplaza índices 2944-2948, que son 5 líneas)
new_open_line = "                {((modoPresupuesto === 'GLOBAL' || modoPresupuesto === 'MIXTO') && presupuestoGlobalDisponible > 0 && materialesDisponibles.length > 0) && (<>\n"

# Construir nuevo archivo
before = lines[:2944]          # líneas 1-2944 (índices 0-2943)
removed = lines[2944:2949]     # líneas 2945-2949 a eliminar (5 líneas)
selector_block = lines[2949:3000]  # bloque del selector (líneas 2950-3000, índices 2949-2999)
old_close = lines[3000]        # línea 3001: ')}'  (índice 3000)
after_close = lines[3001:]     # resto del archivo

new_close = '                </>)}\n'

print(f'\nLíneas a quitar (5):')
for l in removed:
    print(f'  {repr(l.strip())}')
print(f'\nNueva línea de apertura: {repr(new_open_line.strip())}')
print(f'Línea de cierre actual: {repr(old_close.strip())}')
print(f'Nueva línea de cierre: {repr(new_close.strip())}')

result = before + [new_open_line] + selector_block + [new_close] + after_close

with open(f, 'w', encoding='utf-8') as fp:
    fp.writelines(result)

print(f'\nArchivo guardado. Total lineas: {len(result)}')

# Verificar resultado
print('\n=== VERIFICACIÓN: Líneas 2944-2958 después del cambio:')
for i in range(2943, 2958):
    print(f'{i+1}: {repr(result[i])}')

print('\n=== VERIFICACIÓN: Líneas 2997-3003 después del cambio:')
for i in range(2996, 3003):
    print(f'{i+1}: {repr(result[i])}')
