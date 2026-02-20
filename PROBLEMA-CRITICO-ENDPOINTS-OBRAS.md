# ⚠️ PROBLEMA CRÍTICO: ENDPOINTS DE OBRAS DESHABILITADOS
**Fecha:** 20 de febrero de 2026  
**Prioridad:** 🔴 CRÍTICA - Sistema no funcional  
**Componente Afectado:** Módulo de Obras

---

## 🚨 DESCRIPCIÓN DEL PROBLEMA

El backend deshabilitó los endpoints principales de consulta de obras con el mensaje:
```
"Método temporalmente deshabilitado - pendiente arreglo MapStruct"
```

### Endpoints Deshabilitados (400 Bad Request):
- ❌ `GET /api/obras/todas?idEmpresa={id}`
- ❌ `GET /api/obras/empresa/{id}?empresaId={id}`
- ❌ `GET /api/obras/activas?empresaId={id}`
- ❌ `GET /api/obras/estado/{estado}?idEmpresa={id}`

### Impacto:
- ❌ La página de Obras muestra lista vacía
- ❌ No se pueden visualizar obras existentes en BD
- ❌ Usuarios no pueden gestionar sus 9 obras existentes
- ❌ Sistema parcialmente no funcional

---

## 📊 SITUACIÓN ACTUAL

### En Base de Datos:
- ✅ **9 obras** registradas (obras independientes, trabajos extra, obras principales)
- ✅ Datos persistentes y correctos

### En Frontend:
- ❌ **0 obras** mostradas en interfaz
- ❌ Imposibilidad de cargar listado de obras

---

## 🔍 ANÁLISIS TÉCNICO

### Endpoints Disponibles (Limitados):
Según el informe de persistencia, solo están disponibles:
- ✅ `GET /api/obras/borradores?empresaId={id}` - **Solo estado BORRADOR**
- ✅ `POST /api/obras/borrador` - Crear borrador
- ✅ `PUT /api/obras/borrador/{id}` - Actualizar borrador
- ✅ `POST /api/obras/borrador/{id}/confirmar` - Confirmar borrador

### Problema Central:
El endpoint `/api/obras/borradores` **SOLO devuelve obras en estado BORRADOR**, excluyendo:
- Obras en estado `A_ENVIAR` (confirmadas)
- Obras en estado `APROBADO`
- Obras en estado `EN_PROGRESO`
- Obras en estado `COMPLETADO`
- Obras en estado `SUSPENDIDA`
- Obras en estado `CANCELADO`
- Trabajos Extra asociados
- Obras Principales creadas desde presupuestos

---

## 💡 SOLUCIONES REQUERIDAS DEL BACKEND

### Opción 1: Habilitar Endpoint General (RECOMENDADO)
Crear o habilitar un endpoint que devuelva **TODAS las obras** de una empresa:

```java
@GetMapping("/api/obras")
public ResponseEntity<List<ObraResponseDTO>> listarTodasObras(
    @RequestParam Long empresaId
) {
    // Devolver TODAS las obras (cualquier estado) de la empresa
    List<Obra> obras = obraRepository.findByEmpresaId(empresaId);
    return ResponseEntity.ok(obraMapper.toResponseDTOList(obras));
}
```

**URL:** `GET /api/obras?empresaId={id}`  
**Response:** Array de todas las obras sin filtro de estado

### Opción 2: Endpoint por Estado (Incluir Todos los Estados)
Si se prefiere mantener filtros, habilitar endpoint que acepte múltiples estados:

```java
@GetMapping("/api/obras/buscar")
public ResponseEntity<List<ObraResponseDTO>> buscarObras(
    @RequestParam Long empresaId,
    @RequestParam(required = false) List<String> estados
) {
    List<Obra> obras;
    if (estados == null || estados.isEmpty()) {
        // Si no se especifican estados, devolver TODAS
        obras = obraRepository.findByEmpresaId(empresaId);
    } else {
        obras = obraRepository.findByEmpresaIdAndEstadoIn(empresaId, estados);
    }
    return ResponseEntity.ok(obraMapper.toResponseDTOList(obras));
}
```

**URL:** `GET /api/obras/buscar?empresaId={id}`  
**URL con filtro:** `GET /api/obras/buscar?empresaId={id}&estados=BORRADOR,A_ENVIAR,APROBADO`

### Opción 3: Ampliar Endpoint de Borradores
Renombrar y ampliar endpoint existente para incluir todos los estados:

```java
// Antes: /api/obras/borradores
// Después: /api/obras/listar

@GetMapping("/api/obras/listar")
public ResponseEntity<List<ObraResponseDTO>> listarObras(
    @RequestParam Long empresaId,
    @RequestParam(required = false) String estado  // null = todas
) {
    List<Obra> obras;
    if (estado != null) {
        obras = obraRepository.findByEmpresaIdAndEstado(empresaId, estado);
    } else {
        obras = obraRepository.findByEmpresaId(empresaId);
    }
    return ResponseEntity.ok(obraMapper.toResponseDTOList(obras));
}
```

---

## 🔧 WORKAROUND TEMPORAL IMPLEMENTADO (FRONTEND)

He implementado un parche temporal en [api.js](src/services/api.js#L667-L710) que:

```javascript
// Usa /api/obras/borradores como fallback
getAll: async (empresaId) => {
  console.warn('⚠️ /api/obras/todas deshabilitado - usando workaround temporal');
  const borradores = await apiService.get('/api/obras/borradores', { empresaId });
  return borradores; // ❌ SOLO obras en estado BORRADOR
}
```

### Limitaciones del Workaround:
- ⚠️ **Solo muestra obras en estado BORRADOR**
- ⚠️ No muestra obras confirmadas (`A_ENVIAR`)
- ⚠️ No muestra obras aprobadas (`APROBADO`)
- ⚠️ No muestra obras en progreso (`EN_PROGRESO`)
- ⚠️ No muestra trabajos extra ni obras principales
- ⚠️ Funcionalidad limitada al 10-15% del sistema

---

## 📋 CHECKLIST BACKEND (ACCIÓN REQUERIDA)

### Urgente (Hoy):
- [ ] Habilitar endpoint que devuelva TODAS las obras de una empresa
- [ ] Verificar funcionamiento con Postman/curl
- [ ] Probar con empresaId = 1 (9 obras esperadas)
- [ ] Documentar cambios realizados

### Importante (Esta semana):
- [ ] Resolver problema de MapStruct que causó deshabilitación
- [ ] Crear tests para endpoints de consulta
- [ ] Documentar estructura de response DTO
- [ ] Validar que incluye obras independientes, trabajos extra y obras principales

### Recomendado (Próximo sprint):
- [ ] Implementar paginación para empresas con muchas obras
- [ ] Agregar filtros opcionales (fechas, estado, cliente)
- [ ] Cache para consultas frecuentes
- [ ] Documentación Swagger actualizada

---

## 🧪 PRUEBAS REQUERIDAS

### Test Manual con curl:
```bash
# Verificar que devuelve las 9 obras
curl -X GET "http://localhost:8080/api/obras?empresaId=1" -H "accept: application/json"

# Response esperado: Array con 9 obras
[
  { "id": 1, "nombre": "...", "estado": "BORRADOR", ... },
  { "id": 2, "nombre": "...", "estado": "A_ENVIAR", ... },
  { "id": 3, "nombre": "...", "estado": "APROBADO", ... },
  // ... 6 obras más
]
```

### Test con Postman:
1. GET http://localhost:8080/api/obras?empresaId=1
2. Verificar status 200 OK
3. Verificar array con 9 elementos
4. Verificar que incluye obras con diferentes estados

---

## 📞 INFORMACIÓN DE CONTACTO

**Frontend Lead:** Frontend Team  
**Backend Lead:** [Completar]  
**Archivo Afectado Frontend:** `src/services/api.js` (líneas 667-710)  
**Commit con Workaround:** [Revisar git log]

---

## 📊 MÉTRICAS DE IMPACTO

| Métrica | Estado Actual | Estado Esperado |
|---------|---------------|-----------------|
| Obras visibles | 0 / 9 (0%) | 9 / 9 (100%) |
| Funcionalidad módulo | ~15% | 100% |
| Usuarios afectados | 100% | 0% |
| Prioridad fix | 🔴 CRÍTICA | - |

---

## 🎯 DEFINICIÓN DE "DONE"

Este problema se considera resuelto cuando:
- ✅ Endpoint devuelve todas las obras de la empresa (sin filtro de estado)
- ✅ Frontend muestra las 9 obras en la interfaz
- ✅ Puede filtrarse por estado si se desea (opcional)
- ✅ Incluye obras independientes, trabajos extra y principales
- ✅ Response time < 2 segundos para empresas con hasta 100 obras
- ✅ Documentación actualizada en README o Swagger
- ✅ Frontend puede remover workaround temporal

---

## 🚀 PRÓXIMOS PASOS

1. **Backend:** Implementar uno de los 3 endpoints propuestos
2. **Backend:** Notificar a frontend cuando esté listo
3. **Frontend:** Actualizar `api.js` para usar nuevo endpoint
4. **Frontend:** Remover código de workaround temporal
5. **Testing:** Pruebas end-to-end conjuntas
6. **Deploy:** Coordinar despliegue frontend + backend

---

**Estado:** 🔴 BLOQUEANTE - Sistema no funcional sin este fix  
**Última Actualización:** 20 de febrero de 2026  
**Seguimiento:** [Crear issue en sistema de tickets]
