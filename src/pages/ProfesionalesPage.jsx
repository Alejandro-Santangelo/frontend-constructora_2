import React, { useState, useEffect } from 'react';
import eventBus, { FINANCIAL_EVENTS } from '../utils/eventBus';
import { obtenerAsignacionesSemanalPorObra } from '../services/profesionalesObraService';
import api from '../services/api';
import catalogoProfesionalesService from '../services/catalogoProfesionalesService';
import SidebarProfesionalesMenu from '../components/SidebarProfesionalesMenu';
import { getTipoProfesionalBadgeClass, ordenarPorRubro } from '../utils/badgeColors';


const ProfesionalesPage = ({ showNotification }) => {
  // Estados para el modal de actualizar % ganancia de uno
  const [gananciaStep, setGananciaStep] = useState(1);
  const [gananciaResultados, setGananciaResultados] = useState(null);
  const [gananciaPorcentaje, setGananciaPorcentaje] = useState("");

  // Estados para selección múltiple y actualización masiva
  const [seleccionados, setSeleccionados] = useState([]);
  const [mostrarModalPorcentajeVarios, setMostrarModalPorcentajeVarios] = useState(false);
  const [porcentajeVarios, setPorcentajeVarios] = useState('');

  const [activeTab, setActiveTab] = useState('lista');
  const [profesionales, setProfesionales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfesional, setSelectedProfesional] = useState(null);
  const [selectedProfesionalId, setSelectedProfesionalId] = useState(null);
  const [empresaId, setEmpresaId] = useState('1');
  const [obraProfesionales, setObraProfesionales] = useState([]);
  const [selectedObraProfesionalId, setSelectedObraProfesionalId] = useState(null);
  const [tipoFilter, setTipoFilter] = useState('todos');
  // Estado para controlar qué acción/modal está activa
  const [sidebarAction, setSidebarAction] = useState(null);
  const [detalleProfesional, setDetalleProfesional] = useState(null);
  const [resultModal, setResultModal] = useState(null);

  // Tipos de profesionales según la API
  const tiposDisponibles = [
    'ARQUITECTO',
    'INGENIERO',
    'MAESTRO MAYOR DE OBRAS',
    'ELECTRICISTA',
    'PLOMERO',
    'ALBAÑIL',
    'PINTOR',
    'CARPINTERO',
    'TÉCNICO',
    'SUPERVISOR'
  ];

  const [formData, setFormData] = useState({
    nombre: '',
    tipoProfesional: 'A Definir',
    email: '',
    telefono: '',
    especialidad: '',
    honorario_dia: '',
    idEmpresa: 1,
    fecha_creacion: new Date().toISOString().slice(0, 10)
  });

  const [tiposProfesionalesUnicos, setTiposProfesionalesUnicos] = useState([]);

  // Función para convertir rubros a gentilicios
  const convertirRubroAGentilicio = (rubro) => {
    if (!rubro) return '';

    const rubroLower = rubro.toLowerCase().trim();

    // Diccionario de conversiones específicas
    const conversiones = {
      // Albañilería y mampostería
      'albañilería': 'Albañil',
      'albañileria': 'Albañil',
      'albanileria': 'Albañil',
      'mampostería': 'Mampostero',
      'mamposteria': 'Mampostero',
      'ladrillero': 'Ladrillero',
      'bloquero': 'Bloquero',

      // Pintura y revestimientos
      'pintura': 'Pintor',
      'pinturería': 'Pintor',
      'pintureria': 'Pintor',
      'revoque': 'Revocador',
      'revestimiento': 'Revestidor',
      'enduido': 'Enduidor',
      'enchape': 'Enchapador',
      'empapelado': 'Empapelador',
      'estucado': 'Estucador',
      'yesería': 'Yesero',
      'yeseria': 'Yesero',

      // Electricidad
      'electricidad': 'Electricista',
      'eléctrico': 'Electricista',
      'electrico': 'Electricista',
      'instalación eléctrica': 'Electricista',
      'instalacion electrica': 'Electricista',

      // Plomería y gas
      'plomería': 'Plomero',
      'plomeria': 'Plomero',
      'gasfitería': 'Gasfiter',
      'gasfiteria': 'Gasfiter',
      'gasista': 'Gasista',
      'cloaca': 'Cloacista',
      'sanitario': 'Sanitarista',
      'desagüe': 'Plomero',
      'desague': 'Plomero',

      // Carpintería y madera
      'carpintería': 'Carpintero',
      'carpinteria': 'Carpintero',
      'madera': 'Carpintero',
      'ebanistería': 'Ebanista',
      'ebanisteria': 'Ebanista',
      'mueblería': 'Mueblero',
      'muebleria': 'Mueblero',
      'parquet': 'Parquetista',
      'deck': 'Deckista',

      // Herrería y metalurgia
      'herrería': 'Herrero',
      'herreria': 'Herrero',
      'soldadura': 'Soldador',
      'estructuras metálicas': 'Herrero',
      'estructuras metalicas': 'Herrero',
      'forjado': 'Forjador',
      'calderería': 'Calderero',
      'caldereria': 'Calderero',

      // Vidrios y aberturas
      'cristalería': 'Cristalero',
      'cristaleria': 'Cristalero',
      'vidriería': 'Vidriero',
      'vidrieria': 'Vidriero',
      'aberturas': 'Aberturista',
      'ventanas': 'Ventanista',
      'aluminio': 'Aluminiero',
      'pvc': 'Instalador PVC',

      // Cerrajería y seguridad
      'cerrajería': 'Cerrajero',
      'cerrajeria': 'Cerrajero',
      'portones': 'Portonero',
      'rejas': 'Rejero',

      // Techos y cubiertas
      'techado': 'Techista',
      'techo': 'Techista',
      'tejado': 'Techista',
      'cubierta': 'Techista',
      'impermeabilización': 'Impermeabilizador',
      'impermeabilizacion': 'Impermeabilizador',
      'membrana': 'Membranista',
      'chapa': 'Chapista',

      // Pisos y revestimientos
      'pisos': 'Colocador',
      'porcelanato': 'Colocador',
      'cerámica': 'Ceramista',
      'ceramica': 'Ceramista',
      'mosaico': 'Mosaiquista',
      'mármol': 'Marmolista',
      'marmol': 'Marmolista',
      'granito': 'Granitero',
      'piso flotante': 'Colocador',
      'vinílico': 'Colocador',
      'vinilico': 'Colocador',
      'baldosa': 'Baldosista',
      'calcáreo': 'Colocador',
      'calcareo': 'Colocador',

      // Drywall y placas
      'durlock': 'Durlockista',
      'drywall': 'Drywallista',
      'placa de yeso': 'Yesero',
      'cielorraso': 'Cielorrasista',
      'tabiquería': 'Tabiquero',
      'tabiqueria': 'Tabiquero',

      // Jardinería y exterior
      'jardinería': 'Jardinero',
      'jardineria': 'Jardinero',
      'paisajismo': 'Paisajista',
      'parquización': 'Parquizador',
      'parquizacion': 'Parquizador',
      'vivero': 'Viverista',
      'poda': 'Podador',
      'riego': 'Riegista',

      // Limpieza y acabados
      'limpieza': 'Limpiador',
      'demolición': 'Demoledor',
      'demolicion': 'Demoledor',
      'escombro': 'Escombrero',
      'excavación': 'Excavador',
      'excavacion': 'Excavador',
      'movimiento de suelos': 'Excavador',
      'zanjeo': 'Zanjeador',
      'nivelación': 'Nivelador',
      'nivelacion': 'Nivelador',

      // Instalaciones especiales
      'aire acondicionado': 'Instalador',
      'climatización': 'Climatizador',
      'climatizacion': 'Climatizador',
      'calefacción': 'Calefaccionista',
      'calefaccion': 'Calefaccionista',
      'ventilación': 'Ventilador',
      'ventilacion': 'Ventilador',
      'ascensor': 'Ascensorista',
      'montacargas': 'Montacargista',

      // Terminaciones
      'colocación': 'Colocador',
      'colocacion': 'Colocador',
      'instalación': 'Instalador',
      'instalacion': 'Instalador',
      'montaje': 'Montador',
      'acabado': 'Acabador',
      'terminación': 'Terminador',
      'terminacion': 'Terminador',
      'pulido': 'Pulidor',
      'lustrado': 'Lustrador',
      'hidrolaqueado': 'Hidrolaqueador',

      // Hormigón y estructuras
      'hormigón': 'Hormigonero',
      'hormigon': 'Hormigonero',
      'encofrado': 'Encofrador',
      'ferralla': 'Ferrallista',
      'hierro': 'Fierrero',
      'columnas': 'Hormigonero',
      'losa': 'Encofrador',
      'fundación': 'Fundador',
      'fundacion': 'Fundador',
      'viga': 'Hormigonero',

      // Aislaciones
      'aislación': 'Aislador',
      'aislacion': 'Aislador',
      'aislamiento térmico': 'Aislador',
      'aislamiento termico': 'Aislador',
      'telgopor': 'Aislador',
      'lana de vidrio': 'Aislador',

      // Otros oficios
      'ceramico': 'Ceramista',
      'tejido': 'Tejedor',
      'tapiceria': 'Tapicero',
      'decoracion': 'Decorador',
      'alarma': 'Alarmista',
      'cctv': 'Instalador CCTV',
      'cámara': 'Instalador',
      'camara': 'Instalador'
    };

    // Buscar coincidencia exacta primero
    if (conversiones[rubroLower]) {
      return conversiones[rubroLower];
    }

    // Reglas generales si no hay coincidencia exacta
    if (rubroLower.endsWith('ería') || rubroLower.endsWith('eria')) {
      // Eliminar el sufijo -ería/-eria
      return rubro.slice(0, -2);
    }

    if (rubroLower.endsWith('ción') || rubroLower.endsWith('cion')) {
      // instalación -> Instalador
      return rubro.slice(0, -4) + 'dor';
    }

    if (rubroLower.endsWith('dad')) {
      // electricidad -> Electricista
      return rubro.slice(0, -3) + 'ista';
    }

    // Si no hay regla, devolver el rubro tal cual
    return rubro;
  };

  // Generar opciones de rol basadas en el rubro
  const generarOpcionesRol = (rubro) => {
    if (!rubro || !rubro.trim()) return ['A Definir'];

    const gentilicio = convertirRubroAGentilicio(rubro);
    const opciones = ['A Definir'];

    if (gentilicio) {
      opciones.push(`Oficial ${gentilicio}`);
      opciones.push(`Medio Oficial ${gentilicio}`);
      opciones.push(`Ayudante ${gentilicio}`);
      opciones.push(`Aprendiz ${gentilicio}`);
    }

    opciones.push('Otro (personalizado)');

    return opciones;
  };

  const loadProfesionales = async () => {
    try {
      setLoading(true);
      let data;

      if (tipoFilter === 'todos') {
        try {
          console.log('📡 Intentando cargar: GET /api/profesionales');
          // Intentamos la llamada estándar
          data = await api.profesionales.getAll(empresaId);
        } catch (error) {
          console.warn('⚠️ Error en GET /api/profesionales:', error);

          // Fallback SIMPLE: Si falla con parametros, intentamos sin parametros (limpio)
          // A veces el backend falla al filtrar por empresa si la consulta es compleja (MultipleBagFetchException)
          try {
             console.log('🔄 Reintentando GET /api/profesionales (sin filtros explícitos)...');
             // Usamos api.get directo para controlar mejor los params
             const resClean = await api.get('/api/profesionales');
             const dClean = resClean.resultado || resClean.data || resClean || [];
             if (Array.isArray(dClean) && dClean.length > 0) {
                 console.log('✅ Recuperado con llamada limpia');
                 data = dClean;
             } else {
                 throw error; // Si no hay datos, lanzamos el error original
             }
          } catch (retryError) {
             console.error("❌ Error definitivo cargando profesionales.");
             throw error;
          }
        }
      }

      // Si data viene envuelta en .data (respuesta axios), la extraemos
      const profesionalesData = Array.isArray(data) ? data : (data?.data || data?.resultado || []);

      console.log('📋 Procesando', profesionalesData.length, 'profesionales');

      try {
        // Obtener todas las obras activas de esta empresa
        const responseObras = await api.obras.getAll(empresaId);
        const todasObras = responseObras.data || responseObras || [];

        // Contar cuántas obras tiene cada profesional
        const contadorObrasPorProfesional = new Map();

        // Consultar asignaciones de cada obra
        const promesasAsignaciones = todasObras.map(async (obra) => {
          try {
            const response = await obtenerAsignacionesSemanalPorObra(obra.id, empresaId);
            const asignaciones = response.data || response || [];

            // Set para evitar contar el mismo profesional múltiples veces en la misma obra
            const profesionalesEnEstaObra = new Set();

            // Procesar cada asignación para extraer profesionales
            asignaciones.forEach(asignacion => {
              if (asignacion.asignacionesPorSemana && Array.isArray(asignacion.asignacionesPorSemana)) {
                asignacion.asignacionesPorSemana.forEach(semana => {
                  if (semana.detallesPorDia && Array.isArray(semana.detallesPorDia)) {
                    semana.detallesPorDia.forEach(detalle => {
                      if (detalle.profesionalId && detalle.cantidad > 0) {
                        const profId = parseInt(detalle.profesionalId);
                        profesionalesEnEstaObra.add(profId);
                      }
                    });
                  }
                });
              }
            });

            // Incrementar contador para cada profesional en esta obra
            profesionalesEnEstaObra.forEach(profId => {
              contadorObrasPorProfesional.set(profId, (contadorObrasPorProfesional.get(profId) || 0) + 1);
            });

          } catch (errorObra) {
            console.warn(`⚠️ Error obteniendo asignaciones para obra ${obra.id}:`, errorObra.message);
          }
        });

        await Promise.all(promesasAsignaciones);

        // Actualizar cantidadObrasAsignadas en cada profesional
        profesionalesData.forEach(prof => {
          prof.cantidadObrasAsignadas = contadorObrasPorProfesional.get(prof.id) || 0;
        });

        console.log('✅ cantidadObrasAsignadas actualizado:', Object.fromEntries(contadorObrasPorProfesional));

      } catch (errorAsignaciones) {
        console.warn('⚠️ Error calculando asignaciones, usando datos del backend:', errorAsignaciones);
      }

      setProfesionales(profesionalesData);
    } catch (error) {
      console.error('Error cargando profesionales:', error);
      showNotification('Error cargando profesionales', 'error');
    } finally {
      setLoading(false);
    }
  }

  const loadProfesionalesPorEmpresa = async (empresaSeleccionada) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8080/api/profesionales/empresa/${empresaSeleccionada}`);
      const data = await response.json();
      setProfesionales(data.resultado || []);
      showNotification(`Profesionales de empresa ${empresaSeleccionada} cargados`, 'success');
    } catch (error) {
      console.error('Error cargando profesionales por empresa:', error);
      showNotification('Error cargando profesionales por empresa', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProfesionalesDisponibles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8080/api/profesionales/disponibles?empresaId=${empresaId}`);
      const data = await response.json();
      setProfesionales(data.resultado || []);
      showNotification('Profesionales disponibles cargados', 'success');
    } catch (error) {
      console.error('Error cargando profesionales disponibles:', error);
      showNotification('Error cargando profesionales disponibles', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProfesionalesEnObra = async (obraId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8080/api/profesionales/obra/${obraId}?empresaId=${empresaId}`);
      const data = await response.json();
      setObraProfesionales(data || []);
      showNotification(`Profesionales en obra ${obraId} cargados`, 'success');
    } catch (error) {
      console.error('Error cargando profesionales en obra:', error);
      showNotification('Error cargando profesionales en obra', 'error');
    } finally {
      setLoading(false);
    }
  };

  const crearProfesional = async () => {
    try {
      setLoading(true);

      // Convertir honorario a número o null
      const honorarioValor = formData.honorario_dia && formData.honorario_dia !== ''
        ? parseFloat(formData.honorario_dia)
        : null;

      // Si no hay nombre, usar el rol como nombre
      const dataToSend = {
        ...formData,
        nombre: formData.nombre && formData.nombre.trim() !== '' ? formData.nombre : formData.tipoProfesional,
        // Enviar ambos campos para compatibilidad con el backend
        honorarioDia: honorarioValor,
        valorHoraDefault: honorarioValor,
        empresaId: empresaId
      };

      // Eliminar campos que no debe enviar
      delete dataToSend.honorario_dia;
      delete dataToSend.idEmpresa;
      delete dataToSend.fecha_creacion;

      const response = await fetch('http://localhost:8080/api/profesionales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      });

      if (response.ok) {
        showNotification('Profesional creado exitosamente', 'success');
        setFormData({
          nombre: '',
          tipoProfesional: 'A Definir',
          email: '',
          telefono: '',
          especialidad: '',
          honorario_dia: '',
          idEmpresa: 1,
          fecha_creacion: new Date().toISOString().slice(0, 10)
        });
        loadProfesionales();
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error creando profesional:', error);
      showNotification('Error creando profesional', 'error');
    } finally {
      setLoading(false);
    }
  };

  const actualizarProfesional = async (id, data) => {
    try {
      const response = await fetch(`http://localhost:8080/api/profesionales/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        showNotification('Profesional actualizado exitosamente', 'success');
        loadProfesionales();
        setSelectedProfesional(null);
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error actualizando profesional:', error);
      showNotification('Error actualizando profesional', 'error');
    }
  };

  const eliminarProfesional = async (id) => {
    try {
      const response = await fetch(`http://localhost:8080/api/profesionales/${id}?empresaId=${empresaId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showNotification('Profesional eliminado exitosamente', 'success');
        loadProfesionales();
        return true;
      } else {
        const errorData = await response.text();
        console.error('Error del servidor:', errorData);
        throw new Error(`Error en la respuesta del servidor: ${response.status}`);
      }
    } catch (error) {
      console.error('Error eliminando profesional:', error);
      throw error;
    }
  };

  const asignarAObra = async (profesionalId, obraId) => {
    try {
      const response = await fetch(`http://localhost:8080/api/profesionales/${profesionalId}/asignar-obra/${obraId}?empresaId=${empresaId}`, {
        method: 'POST'
      });

      if (response.ok) {
        showNotification('Profesional asignado a obra exitosamente', 'success');
        loadProfesionales();
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error asignando profesional a obra:', error);
      showNotification('Error asignando profesional a obra', 'error');
    }
  };

  const desasignarDeObra = async (profesionalId, obraId) => {
    try {
      const response = await fetch(`http://localhost:8080/api/profesionales/${profesionalId}/desasignar-obra/${obraId}?empresaId=${empresaId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showNotification('Profesional desasignado de obra exitosamente', 'success');
        loadProfesionales();
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      console.error('Error desasignando profesional de obra:', error);
      showNotification('Error desasignando profesional de obra', 'error');
    }
  };

  // Usar función centralizada para colores de badges
  const getTipoBadgeClass = getTipoProfesionalBadgeClass;

  // Modal de detalles de profesional
  const renderDetalleModal = () => {
    if (!detalleProfesional) return null;
    return (
      <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
        <div className="modal-dialog modal-lg" style={{marginTop: '120px'}}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Detalles del Profesional</h5>
              <button type="button" className="btn-close" onClick={() => setDetalleProfesional(null)}></button>
            </div>
            <div className="modal-body">
              <table className="table table-bordered">
                <tbody>
                  {Object.entries(detalleProfesional).map(([key, value]) => {
                    // Mapear nombres de campos
                    let displayKey = key;
                    if (key === 'valorHoraDefault' || key === 'honorarioDia' || key === 'honorario_dia') {
                      displayKey = 'Honorarios por Jornal';
                    }
                    return (
                      <tr key={key}>
                        <th style={{width:'30%'}}>{displayKey}</th>
                        <td>{String(value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetalleProfesional(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderResultModal = () => {
    if (!resultModal) return null;
    // Si es array, mostrar como formulario vertical
    if (Array.isArray(resultModal)) {
      if (resultModal.length === 0) {
        return (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '1100px', width: '90vw'}}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Resultado</h5>
                  <button type="button" className="btn-close" onClick={() => setResultModal(null)}></button>
                </div>
                <div className="modal-body text-center text-muted">
                  <p>No se encontraron resultados.</p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setResultModal(null)}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        );
      }
      return (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '1100px', width: '90vw'}}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Resultado</h5>
                <button type="button" className="btn-close" onClick={() => setResultModal(null)}></button>
              </div>
              <div className="modal-body">
                {resultModal.map((item, idx) => (
                  <form key={idx} className="mb-4 p-3 border rounded bg-light" style={{display:'flex',flexWrap:'wrap',gap:'24px'}}>
                    {Object.entries(item).map(([key, value]) => (
                      <div className="mb-2" key={key} style={{flex:'1 1 220px', minWidth:'220px'}}>
                        <label className="form-label" style={{fontWeight:'bold'}}>{key}</label>
                        <input className="form-control" value={String(value)} disabled />
                      </div>
                    ))}
                  </form>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setResultModal(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    // Si es objeto, mostrar como formulario simple
    return (
      <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
        <div className="modal-dialog" style={{marginTop: '120px', maxWidth: '1100px', width: '90vw'}}>
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Resultado</h5>
              <button type="button" className="btn-close" onClick={() => setResultModal(null)}></button>
            </div>
            <div className="modal-body">
              <form className="p-3 border rounded bg-light" style={{display:'flex',flexWrap:'wrap',gap:'24px'}}>
                {Object.entries(resultModal).map(([key, value]) => (
                  <div className="mb-2" key={key} style={{flex:'1 1 220px', minWidth:'220px'}}>
                    <label className="form-label" style={{fontWeight:'bold'}}>{key}</label>
                    <input className="form-control" value={String(value)} disabled />
                  </div>
                ))}
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setResultModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'lista':
        return (
          <div className="row">
            <div className="col-12">
              <div className="card" onClick={(e) => e.stopPropagation()}>
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5>Lista de Profesionales</h5>
                  <div className="btn-group">
                    <button
                      type="button"
                      className="btn btn-success dropdown-toggle"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                      disabled={loading}
                    >
                      <i className="fas fa-percentage me-2"></i>
                      Actualizar % Ganancia
                    </button>
                    <ul className="dropdown-menu">
                      <li>
                        <a
                          className="dropdown-item"
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSidebarAction('actualizarPorcentajeGananciaTodos');
                          }}
                        >
                          <i className="fas fa-globe me-2"></i>
                          Todos los profesionales
                        </a>
                      </li>
                      <li>
                        <a
                          className="dropdown-item"
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSidebarAction('actualizarPorcentajeGananciaUno');
                          }}
                        >
                          <i className="fas fa-user me-2"></i>
                          Un profesional específico
                        </a>
                      </li>
                      <li>
                        <a
                          className={`dropdown-item ${seleccionados.length === 0 ? 'disabled' : ''}`}
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (seleccionados.length > 0) {
                              setMostrarModalPorcentajeVarios(true);
                            }
                          }}
                        >
                          <i className="fas fa-check-square me-2"></i>
                          Seleccionados ({seleccionados.length})
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body">
                  {loading ? (
                    <div className="text-center">
                      <div className="spinner-border" role="status">
                        <span className="visually-hidden">Cargando...</span>
                      </div>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th style={{width: '50px'}}>
                              <input
                                type="checkbox"
                                checked={seleccionados.length === profesionales.length && profesionales.length > 0}
                                onChange={() => {
                                  if (seleccionados.length === profesionales.length) {
                                    setSeleccionados([]);
                                  } else {
                                    setSeleccionados(profesionales.map(p => p.id));
                                  }
                                }}
                              />
                            </th>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Rubro</th>
                            <th>Rol</th>
                            <th>Honorarios por Jornal</th>
                            <th>Teléfono</th>
                            <th>Disponibilidad</th>
                            <th>Activo</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordenarPorRubro(profesionales).map(profesional => {
                            // Calcular disponibilidad basado en cantidadObrasAsignadas
                            const getEstadoDisponibilidad = () => {
                              if (!profesional.activo) return { texto: 'Inactivo', clase: 'bg-secondary' };
                              const obras = profesional.cantidadObrasAsignadas || 0;
                              if (obras === 0) return { texto: 'Disponible', clase: 'bg-success' };
                              if (obras === 1) return { texto: `Ocupado (1 obra)`, clase: 'bg-warning text-dark' };
                              return { texto: `Ocupado (${obras} obras)`, clase: 'bg-warning text-dark' };
                            };
                            const disponibilidad = getEstadoDisponibilidad();
                            const profesionalId = profesional.id;
                            const isSelected = selectedProfesionalId && profesionalId && selectedProfesionalId === profesionalId;

                            return (
                            <tr
                              key={profesionalId}
                              onClick={() => {
                                // Toggle: si ya está seleccionado, deseleccionar; si no, seleccionar
                                if (isSelected) {
                                  setSelectedProfesionalId(null);
                                } else {
                                  setSelectedProfesionalId(profesionalId);
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                              className={isSelected ? 'table-primary' : ''}
                            >
                              <td onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={seleccionados.includes(profesionalId)}
                                  onChange={() => {
                                    setSeleccionados(prev =>
                                      prev.includes(profesionalId)
                                        ? prev.filter(id => id !== profesionalId)
                                        : [...prev, profesionalId]
                                    );
                                  }}
                                />
                              </td>
                              <td>
                                {isSelected && <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>}
                                {profesionalId}
                              </td>
                              <td>{profesional.nombre}</td>
                              <td>{profesional.especialidad || '-'}</td>
                              <td>
                                <span className={`badge ${getTipoBadgeClass(profesional.tipoProfesional)}`}>
                                  {profesional.tipoProfesional || 'A Definir'}
                                </span>
                              </td>
                              <td>{(profesional.honorario_dia || profesional.valorHoraDefault) ? `$${Number(profesional.honorario_dia || profesional.valorHoraDefault).toLocaleString('es-AR')}` : '-'}</td>
                              <td>{profesional.telefono || '-'}</td>
                              <td>
                                <span className={`badge ${disponibilidad.clase}`}>
                                  {disponibilidad.texto}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${profesional.activo ? 'bg-success' : 'bg-danger'}`}>
                                  {profesional.activo ? 'Sí' : 'No'}
                                </span>
                              </td>
                              <td>
                                <button
                                  className="btn btn-sm btn-info"
                                  style={{color:'white'}}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDetalleProfesional(profesional);
                                  }}
                                >
                                  Detalles
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      // case 'crear' eliminado: la creación se maneja solo desde el sidebar

      case 'busqueda':
        return (
          <div className="row">
            <div className="col-md-6">
              <div className="card" onClick={(e) => e.stopPropagation()}>
                <div className="card-header">
                  <h5>Búsqueda por Empresa</h5>
                </div>
                <div className="card-body">
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ID de empresa..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          loadProfesionalesPorEmpresa(e.target.value);
                        }
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        loadProfesionalesPorEmpresa(input.value);
                      }}
                    >
                      <i className="fas fa-search me-1"></i>Buscar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card" onClick={(e) => e.stopPropagation()}>
                <div className="card-header">
                  <h5>Búsqueda por Obra</h5>
                </div>
                <div className="card-body">
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="ID de obra..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          loadProfesionalesEnObra(e.target.value);
                        }
                      }}
                    />
                    <button
                      className="btn btn-success"
                      onClick={(e) => {
                        const input = e.target.previousElementSibling;
                        loadProfesionalesEnObra(input.value);
                      }}
                    >
                      <i className="fas fa-search me-1"></i>Buscar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'obra':
        return (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5>Profesionales en Obra</h5>
                  <small className="text-muted">Use la búsqueda por obra para cargar profesionales</small>
                </div>
                <div className="card-body">
                  {obraProfesionales.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Email</th>
                            <th>Teléfono</th>
                            <th>Especialidad</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordenarPorRubro(obraProfesionales).map(profesional => (
                            <tr
                              key={profesional.id}
                              onClick={() => {
                                console.log('Click en profesional obra:', profesional.id);
                                setSelectedObraProfesionalId(profesional.id);
                              }}
                              style={{ cursor: 'pointer' }}
                              className={selectedObraProfesionalId === profesional.id ? 'table-primary' : ''}
                            >
                              <td>
                                {selectedObraProfesionalId === profesional.id && <i className="fas fa-check-circle text-success me-1" title="Seleccionado"></i>}
                                {profesional.id}
                              </td>
                              <td>{profesional.nombre}</td>
                              <td>
                                <span className={`badge ${getTipoBadgeClass(profesional.tipoProfesional)}`}>
                                  {profesional.tipoProfesional}
                                </span>
                              </td>
                              <td>{profesional.email}</td>
                              <td>{profesional.telefono}</td>
                              <td>{profesional.especialidad}</td>
                              <td>
                                <button
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const obraId = prompt('Confirme ID de obra para desasignar:');
                                    if (obraId) desasignarDeObra(profesional.id, obraId);
                                  }}
                                >
                                  <i className="fas fa-minus me-1"></i>Desasignar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-muted">
                      <i className="fas fa-user-hard-hat fa-3x mb-3"></i>
                      <p>No hay profesionales en obra o realice una búsqueda</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Sección no encontrada</div>;
    }
  };

  // Handler para acciones del sidebar
  const handleSidebarAction = (action) => {
    setSidebarAction(action);
    if (action === 'listar') {
      loadProfesionales();
    }
    // El resto de acciones abrirán su modal correspondiente
  };

  // Estado para formularios/modales de acciones
  const [modalData, setModalData] = useState({});
  // Estado para resultados de búsqueda de eliminación por nombre
  const [eliminarResultados, setEliminarResultados] = useState([]);
  const [eliminarSeleccionado, setEliminarSeleccionado] = useState(null);
  const [eliminarStep, setEliminarStep] = useState(1);
  // Estado para controlar el flujo de actualización
  const [updateStep, setUpdateStep] = useState(1);
  const [updateData, setUpdateData] = useState(null);

  // Renderizado de modales según acción
  const renderSidebarModal = () => {
    switch (sidebarAction) {
      case 'registrar':
        return (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Registrar nuevo profesional</h5>
                  <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); loadProfesionales(); }}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={e => { e.preventDefault(); crearProfesional(); setSidebarAction(null); }}>
                    <div className="row">
                      {/* 1. Campos obligatorios */}
                      <div className="col-md-4">
                        <label className="form-label">Nombre</label>
                        <input className="form-control mb-2" placeholder="Nombre" value={formData.nombre || ''} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Activo</label>
                        <select className="form-select mb-2" value={formData.activo || ''} onChange={e => setFormData({...formData, activo: e.target.value === 'true'})} required>
                          <option value="">Seleccionar</option>
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Teléfono</label>
                        <input className="form-control mb-2" placeholder="Teléfono" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value})} />
                      </div>

                      {/* 2. Rubro, Rol y Honorarios */}
                      <div className="col-md-4">
                        <label className="form-label">Rubro</label>
                        <input className="form-control mb-2" placeholder="Ej: Albañilería, Electricidad, etc." value={formData.especialidad || ''} onChange={e => {
                          const nuevoRubro = e.target.value;
                          setFormData({...formData, especialidad: nuevoRubro});
                          // Si hay rubro, establecer el primer rol disponible
                          if (nuevoRubro && nuevoRubro.trim()) {
                            const opcionesRol = generarOpcionesRol(nuevoRubro);
                            setFormData({...formData, especialidad: nuevoRubro, tipoProfesional: opcionesRol[0]});
                          } else {
                            setFormData({...formData, especialidad: nuevoRubro, tipoProfesional: 'A Definir'});
                          }
                        }} />
                        <small className="text-muted">Dato informativo del profesional</small>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Rol</label>
                        <select className="form-select mb-2" value={formData.tipoProfesional || 'A Definir'} onChange={e => setFormData({...formData, tipoProfesional: e.target.value})} required>
                          {generarOpcionesRol(formData.especialidad).map((opcion, idx) => (
                            <option key={idx} value={opcion}>{opcion}</option>
                          ))}
                        </select>
                      </div>
                      {formData.tipoProfesional === 'Otro (personalizado)' && (
                        <div className="col-md-4">
                          <label className="form-label">Nombre del Rol Completo *</label>
                          <input
                            type="text"
                            className="form-control mb-2"
                            placeholder="Ej: Medio Oficial Albañileria"
                            maxLength="100"
                            value={formData.rolPersonalizado || ''}
                            onChange={e => setFormData({...formData, rolPersonalizado: e.target.value})}
                            required
                          />
                          <small className="text-muted">Ingrese el nombre completo del rol personalizado</small>
                        </div>
                      )}
                      <div className="col-md-4">
                        <label className="form-label">Honorarios por Jornal</label>
                        <input className="form-control mb-2" type="number" placeholder="Honorarios por Jornal" value={formData.honorario_dia || ''} onChange={e => setFormData({...formData, honorario_dia: e.target.value})} />
                      </div>

                      {/* 3. Datos de contacto */}
                      <div className="col-md-4">
                        <label className="form-label">Email</label>
                        <input className="form-control mb-2" type="email" placeholder="Email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">CUIT</label>
                        <input className="form-control mb-2" placeholder="CUIT" value={formData.cuit || ''} onChange={e => setFormData({...formData, cuit: e.target.value})} />
                      </div>

                      {/* 5. Campos del sistema (solo lectura/generados automáticamente) */}
                      <div className="col-md-4">
                        <label className="form-label">ID Profesional</label>
                        <input className="form-control mb-2" type="number" placeholder="ID profesional" value={formData.id_profesional || ''} onChange={e => setFormData({...formData, id_profesional: e.target.value})} />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Fecha creación</label>
                        <input className="form-control mb-2" type="date" placeholder="Fecha creación" value={formData.fecha_creacion || ''} onChange={e => setFormData({...formData, fecha_creacion: e.target.value})} />
                      </div>
                    </div>
                    <div className="d-flex justify-content-end mt-3">
                      <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); loadProfesionales(); }}>Cancelar</button>
                      <button type="submit" className="btn btn-primary">Agregar Profesional</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      case 'eliminar':
        // Si hay un profesional seleccionado, usarlo directamente
        if (selectedProfesionalId && eliminarStep === 1) {
          const profesionalSeleccionado = profesionales.find(p => p.id === selectedProfesionalId);
          if (profesionalSeleccionado) {
            setEliminarSeleccionado(profesionalSeleccionado);
            setEliminarStep(2);
          }
        }
        // Paso 1: Elegir ID o Nombre
        if (eliminarStep === 1) {
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{selectedProfesionalId ? `Eliminar profesional seleccionado (ID: ${selectedProfesionalId})` : 'Eliminar profesional por ID o Nombre (parecido)'}</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setEliminarStep(1); setEliminarResultados([]); setEliminarSeleccionado(null); setModalData({}); }}></button>
                  </div>
                  <div className="modal-body">
                    <form onSubmit={async e => {
                      e.preventDefault();
                      setLoading(true);
                      let data = null;
                      try {
                        if (modalData.id && !modalData.nombre) {
                          // Buscar por ID y pasar a confirmación
                          const res = await fetch(`http://localhost:8080/api/profesionales/${modalData.id}`);
                          data = await res.json();
                          if (data && data.id) {
                            setEliminarSeleccionado(data);
                            setEliminarStep(2);
                          } else {
                            showNotification('Profesional no encontrado', 'error');
                          }
                        } else if (modalData.nombre && !modalData.id) {
                          // Buscar por nombre (parecido) y mostrar lista
                          const res = await fetch(`http://localhost:8080/api/profesionales/buscar?nombre=${encodeURIComponent(modalData.nombre)}`);
                          data = await res.json();
                          if (Array.isArray(data) && data.length > 0) {
                            setEliminarResultados(data);
                            setEliminarStep(3);
                          } else if (data && data.id) {
                            setEliminarResultados([data]);
                            setEliminarStep(3);
                          } else {
                            showNotification('No se encontraron profesionales con ese nombre', 'error');
                          }
                        } else {
                          showNotification('Ingrese solo ID o solo Nombre', 'warning');
                          setLoading(false);
                          return;
                        }
                      } catch (err) {
                        showNotification('Error buscando profesional', 'error');
                      } finally {
                        setLoading(false);
                      }
                    }}>
                      <input className="form-control mb-2" type="number" placeholder="ID del profesional" value={modalData.id || ''} onChange={e => setModalData({...modalData, id: e.target.value, nombre: ''})} disabled={!!modalData.nombre} />
                      <input className="form-control mb-2" type="text" placeholder="Nombre del profesional (por parecido)" value={modalData.nombre || ''} onChange={e => setModalData({...modalData, nombre: e.target.value, id: ''})} disabled={!!modalData.id} />
                      <div className="d-flex justify-content-end">
                        <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setEliminarStep(1); setEliminarResultados([]); setEliminarSeleccionado(null); setModalData({}); }}>Cancelar</button>
                        <button type="submit" className="btn btn-danger">Buscar</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        // Paso 2: Confirmar eliminación por ID
        if (eliminarStep === 2 && eliminarSeleccionado) {
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">¿Está seguro que desea eliminar este profesional?</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setEliminarStep(1); setEliminarSeleccionado(null); setModalData({}); }}></button>
                  </div>
                  <div className="modal-body">
                    <div className="mb-2"><strong>Nombre:</strong> {eliminarSeleccionado.nombre}</div>
                    <div className="mb-2"><strong>ID:</strong> {eliminarSeleccionado.id}</div>
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setEliminarStep(1); setEliminarSeleccionado(null); setModalData({}); }}>Cancelar</button>
                      <button type="button" className="btn btn-danger" onClick={async () => {
                        setLoading(true);
                        try {
                          await eliminarProfesional(eliminarSeleccionado.id);
                          showNotification('Profesional eliminado correctamente', 'success');
                          setSidebarAction(null);
                          setEliminarStep(1);
                          setEliminarSeleccionado(null);
                          setModalData({});
                          loadProfesionales();
                        } catch {
                          showNotification('Error eliminando profesional', 'error');
                        } finally {
                          setLoading(false);
                        }
                      }}>Eliminar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        // Paso 3: Mostrar lista de resultados por nombre y seleccionar uno para eliminar
        if (eliminarStep === 3 && eliminarResultados.length > 0) {
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Seleccione el profesional a eliminar</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setEliminarStep(1); setEliminarResultados([]); setEliminarSeleccionado(null); setModalData({}); }}></button>
                  </div>
                  <div className="modal-body">
                    {eliminarResultados.map((prof, idx) => (
                      <div key={prof.id} style={{borderBottom: idx < eliminarResultados.length-1 ? '1px solid #ccc' : 'none', paddingBottom:8, marginBottom:8}}>
                        <div><strong>Nombre:</strong> {prof.nombre}</div>
                        <div><strong>ID:</strong> {prof.id}</div>
                        <button className="btn btn-danger btn-sm mt-2" onClick={() => { setEliminarSeleccionado(prof); setEliminarStep(2); }}>Seleccionar para eliminar</button>
                      </div>
                    ))}
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setEliminarStep(1); setEliminarResultados([]); setEliminarSeleccionado(null); setModalData({}); }}>Cancelar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        }
      case 'consultarPorId':
        // Si hay un profesional seleccionado, consultarlo directamente
        if (selectedProfesionalId && !resultModal) {
          (async () => {
            try {
              setLoading(true);
              const res = await fetch(`http://localhost:8080/api/profesionales/${selectedProfesionalId}`);
              const data = await res.json();
              setResultModal(data);
              setSidebarAction(null);
            } catch (err) {
              showNotification('Error consultando profesional', 'error');
            } finally {
              setLoading(false);
            }
          })();
        }
        return (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog" style={{marginTop: '120px'}}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{selectedProfesionalId ? `Consultar profesional seleccionado (ID: ${selectedProfesionalId})` : 'Consultar profesional por ID o Nombre (por parecido)'}</h5>
                  <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); loadProfesionales(); }}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={async e => {
                    e.preventDefault();
                    try {
                      setLoading(true);
                      setResultModal(null); // Limpiar antes de mostrar
                      let data = null;
                      if (modalData.id && !modalData.nombre) {
                        // Buscar por ID
                        const res = await fetch(`http://localhost:8080/api/profesionales/${modalData.id}`);
                        data = await res.json();
                      } else if (modalData.nombre && !modalData.id) {
                        // Buscar por nombre (parcial, insensible a mayúsculas/minúsculas)
                        const res = await fetch(`http://localhost:8080/api/profesionales/buscar?nombre=${encodeURIComponent(modalData.nombre)}`);
                        data = await res.json();
                      } else {
                        showNotification('Por favor, ingrese solo ID o solo Nombre para la búsqueda', 'warning');
                        setLoading(false);
                        return;
                      }
                      setResultModal(data);
                      setSidebarAction(null);
                    } catch (err) {
                      showNotification('Error consultando profesional', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <input className="form-control mb-2" type="number" placeholder="ID del profesional" value={modalData.id || ''} onChange={e => setModalData({...modalData, id: e.target.value, nombre: ''})} disabled={!!modalData.nombre} />
                    <input className="form-control mb-2" type="text" placeholder="Nombre del profesional (por parecido)" value={modalData.nombre || ''} onChange={e => setModalData({...modalData, nombre: e.target.value, id: ''})} disabled={!!modalData.id} />
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); loadProfesionales(); }}>Cerrar</button>
                      <button type="submit" className="btn btn-info">Consultar</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      case 'actualizar':
        // Si hay un profesional seleccionado, pasar directo al paso 2
        if (selectedProfesionalId && updateStep === 1 && !updateData) {
          const profesionalSeleccionado = profesionales.find(p => p.id === selectedProfesionalId);
          if (profesionalSeleccionado) {
            setUpdateData(profesionalSeleccionado);
            setUpdateStep(2);
          }
        }
        if (updateStep === 1) {
          // Primer modal: pedir ID o nombre
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">{selectedProfesionalId ? `Actualizar profesional seleccionado (ID: ${selectedProfesionalId})` : 'Buscar profesional para actualizar'}</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setUpdateStep(1); setUpdateData(null); setModalData({}); }}></button>
                  </div>
                  <div className="modal-body">
                    <form onSubmit={async e => {
                      e.preventDefault();
                      setLoading(true);
                      let data = null;
                      try {
                        if (modalData.id && !modalData.nombre) {
                          const res = await fetch(`http://localhost:8080/api/profesionales/${modalData.id}`);
                          data = await res.json();
                        } else if (modalData.nombre && !modalData.id) {
                          const res = await fetch(`http://localhost:8080/api/profesionales/buscar?nombre=${encodeURIComponent(modalData.nombre)}`);
                          data = await res.json();
                          if (Array.isArray(data) && data.length > 0) {
                            setUpdateData(data);
                            setUpdateStep(2);
                            setLoading(false);
                            return;
                          } else if (data && data.id) {
                            setUpdateData([data]);
                            setUpdateStep(2);
                            setLoading(false);
                            return;
                          } else {
                            showNotification('No se encontraron profesionales con ese nombre', 'error');
                            setLoading(false);
                            return;
                          }
                        } else {
                          showNotification('Ingrese solo ID o solo Nombre', 'warning');
                          setLoading(false);
                          return;
                        }
                        if (!data || !data.id) {
                          showNotification('Profesional no encontrado', 'error');
                          setLoading(false);
                          return;
                        }
                        setUpdateData([data]);
                        setUpdateStep(2);
                      } catch (err) {
                        showNotification('Error buscando profesional', 'error');
                      } finally {
                        setLoading(false);
                      }
                    }}>
                      <input className="form-control mb-2" type="number" placeholder="ID del profesional" value={modalData.id || ''} onChange={e => setModalData({...modalData, id: e.target.value, nombre: ''})} disabled={!!modalData.nombre} />
                      <input className="form-control mb-2" type="text" placeholder="Nombre del profesional" value={modalData.nombre || ''} onChange={e => setModalData({...modalData, nombre: e.target.value, id: ''})} disabled={!!modalData.id} />
                      <div className="d-flex justify-content-end">
                        <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setUpdateStep(1); setUpdateData(null); setModalData({}); }}>Cancelar</button>
                        <button type="submit" className="btn btn-info">Buscar</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          );
        } else if (updateStep === 2 && updateData) {
          // Si hay varios profesionales, mostrar todos los formularios
          const profesionales = Array.isArray(updateData) ? updateData : [updateData];
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog modal-lg">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Editar datos del profesional</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setUpdateStep(1); setUpdateData(null); setModalData({}); }}></button>
                  </div>
                  <div className="modal-body">
                    {profesionales.map((prof, idx) => (
                      <React.Fragment key={prof.id || idx}>
                        <form onSubmit={e => {
                          e.preventDefault();
                          actualizarProfesional(prof.id, prof);
                          showNotification('Profesional actualizado', 'success');
                          setSidebarAction(null);
                          setUpdateStep(1);
                          setUpdateData(null);
                          setModalData({});
                        }}>
                          <div className="row">
                            {/* 1. Campos obligatorios */}
                            <div className="col-md-4">
                              <label className="form-label">Nombre</label>
                              <input className="form-control mb-2" placeholder="Nombre" value={prof.nombre || ''} onChange={e => {
                                const value = e.target.value;
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], nombre: value };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, nombre: value });
                                }
                              }} required />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Activo</label>
                              <select className="form-select mb-2" value={prof.activo === true || prof.activo === 'true' ? 'true' : 'false'} onChange={e => {
                                const value = e.target.value === 'true';
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], activo: value };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, activo: value });
                                }
                              }} required>
                                <option value="">Seleccionar</option>
                                <option value="true">Sí</option>
                                <option value="false">No</option>
                              </select>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Teléfono</label>
                              <input className="form-control mb-2" placeholder="Teléfono" value={prof.telefono || ''} onChange={e => {
                                const value = e.target.value;
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], telefono: value };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, telefono: value });
                                }
                              }} />
                            </div>

                            {/* 2. Rubro, Rol y Honorarios */}
                            <div className="col-md-4">
                              <label className="form-label">Rubro</label>
                              <input className="form-control mb-2" placeholder="Ej: Albañilería, Electricidad, etc." value={prof.especialidad || ''} onChange={e => {
                                const nuevoRubro = e.target.value;
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], especialidad: nuevoRubro };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, especialidad: nuevoRubro });
                                }
                              }} />
                              <small className="text-muted">Dato informativo del profesional</small>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Rol</label>
                              <select className="form-select mb-2" value={prof.tipoProfesional || 'A Definir'} onChange={e => {
                                const value = e.target.value;
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], tipoProfesional: value };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, tipoProfesional: value });
                                }
                              }} required>
                                {generarOpcionesRol(prof.especialidad).map((opcion, opIdx) => (
                                  <option key={opIdx} value={opcion}>{opcion}</option>
                                ))}
                              </select>
                            </div>
                            {prof.tipoProfesional === 'Otro (personalizado)' && (
                              <div className="col-md-4">
                                <label className="form-label">Nombre del Rol Completo *</label>
                                <input
                                  type="text"
                                  className="form-control mb-2"
                                  placeholder="Ej: Medio Oficial Albañileria"
                                  maxLength="100"
                                  value={prof.rolPersonalizado || ''}
                                  onChange={e => {
                                    const value = e.target.value;
                                    if (Array.isArray(updateData)) {
                                      const arr = [...updateData];
                                      arr[idx] = { ...arr[idx], rolPersonalizado: value };
                                      setUpdateData(arr);
                                    } else {
                                      setUpdateData({ ...updateData, rolPersonalizado: value });
                                    }
                                  }}
                                  required
                                />
                                <small className="text-muted">Ingrese el nombre completo del rol personalizado</small>
                              </div>
                            )}
                            <div className="col-md-4">
                              <label className="form-label">Honorarios por Jornal</label>
                              <input className="form-control mb-2" type="number" placeholder="Honorarios por Jornal" value={prof.honorario_dia || prof.valorHoraDefault || ''} onChange={e => {
                                const value = e.target.value;
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], honorario_dia: value, valorHoraDefault: value };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, honorario_dia: value, valorHoraDefault: value });
                                }
                              }} />
                            </div>

                            {/* 3. Datos de contacto */}
                            <div className="col-md-4">
                              <label className="form-label">Email</label>
                              <input className="form-control mb-2" type="email" placeholder="Email" value={prof.email || ''} onChange={e => {
                                const value = e.target.value;
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], email: value };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, email: value });
                                }
                              }} />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">CUIT</label>
                              <input className="form-control mb-2" placeholder="CUIT" value={prof.cuit || ''} onChange={e => {
                                const value = e.target.value;
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], cuit: value };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, cuit: value });
                                }
                              }} />
                            </div>

                            {/* 5. Campos del sistema (solo lectura/generados automáticamente) */}
                            <div className="col-md-4">
                              <label className="form-label">ID Profesional</label>
                              <input className="form-control mb-2" type="number" placeholder="ID profesional" value={prof.id_profesional || prof.id || ''} disabled />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Fecha creación</label>
                              <input className="form-control mb-2" type="date" placeholder="Fecha creación" value={prof.fecha_creacion || (prof.fechaCreacion ? prof.fechaCreacion.split('T')[0] : '')} onChange={e => {
                                const value = e.target.value;
                                if (Array.isArray(updateData)) {
                                  const arr = [...updateData];
                                  arr[idx] = { ...arr[idx], fecha_creacion: value };
                                  setUpdateData(arr);
                                } else {
                                  setUpdateData({ ...updateData, fecha_creacion: value });
                                }
                              }} />
                            </div>
                          </div>
                          <div className="d-flex justify-content-end mt-3">
                            <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setUpdateStep(1); setUpdateData(null); setModalData({}); }}>Cancelar</button>
                            <button type="submit" className="btn btn-primary"><i className="fas fa-save me-1"></i>Guardar</button>
                          </div>
                        </form>
                        {idx < profesionales.length - 1 && <hr />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      case 'tipos':
        return (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog" style={{marginTop: '120px'}}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Tipos de profesionales</h5>
                  <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); loadProfesionales(); }}></button>
                </div>
                <div className="modal-body">
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {tiposDisponibles.map(tipo => (
                      <button
                        key={tipo}
                        className="btn btn-outline-primary"
                        onClick={async () => {
                          setLoading(true);
                          setResultModal(null); // Limpiar antes de mostrar
                          try {
                            const res = await fetch(`http://localhost:8080/api/profesionales/por-tipo?tipoProfesional=${encodeURIComponent(tipo)}`);
                            const data = await res.json();
                            setResultModal(data);
                            setSidebarAction(null);
                          } catch (err) {
                            showNotification('Error buscando profesionales por tipo', 'error');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                  <div className="d-flex justify-content-end">
                    <button type="button" className="btn btn-secondary" onClick={() => { setSidebarAction(null); loadProfesionales(); }}>Cerrar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'buscarPorTipo':
        return (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog" style={{marginTop: '120px'}}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Buscar por tipo</h5>
                  <button type="button" className="btn-close" onClick={() => setSidebarAction(null)}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={async e => {
                    e.preventDefault();
                    try {
                      setLoading(true);
                      setResultModal(null); // Limpiar antes de mostrar
                      const res2 = await fetch(`http://localhost:8080/api/profesionales/por-tipo?tipoProfesional=${encodeURIComponent(modalData.tipoProfesional)}`);
                      const data2 = await res2.json();
                      setResultModal(data2);
                      setSidebarAction(null);
                    } catch (err) {
                      showNotification('Error buscando profesionales por tipo', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <select className="form-select mb-2" value={modalData.tipoProfesional || ''} onChange={e => setModalData({...modalData, tipoProfesional: e.target.value})} required>
                      <option value="">Seleccione tipo</option>
                      {tiposProfesionalesUnicos.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                    </select>
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-secondary me-2" onClick={() => setSidebarAction(null)}>Cancelar</button>
                      <button type="submit" className="btn btn-info">Buscar</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      case 'actualizarValorHoraTodos':
        return (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Actualizar valor jornal de todos</h5>
                  <button type="button" className="btn-close" onClick={() => setSidebarAction(null)}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={async e => {
                    e.preventDefault();
                    try {
                      setLoading(true);
                      await fetch(`http://localhost:8080/api/profesionales/actualizar-valor-hora-todos?porcentaje=${modalData.porcentaje}`, { method: 'PUT' });
                      loadProfesionales();
                    } catch (err) {
                      alert('Error actualizando valor jornal de todos');
                    } finally {
                      setLoading(false);
                      setSidebarAction(null);
                    }
                  }}>
                    <input className="form-control mb-2" type="number" placeholder="Porcentaje" value={modalData.porcentaje || ''} onChange={e => setModalData({...modalData, porcentaje: e.target.value})} required />
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-secondary me-2" onClick={() => setSidebarAction(null)}>Cancelar</button>
                      <button type="submit" className="btn btn-dark">Actualizar</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      case 'actualizarValorHoraUno':
        const [valorHoraStep, setValorHoraStep] = useState(1);
        const [valorHoraResultados, setValorHoraResultados] = useState(null);
        const [valorHoraPorcentaje, setValorHoraPorcentaje] = useState("");
        // Primer paso: buscar profesional por ID o nombre
        if (valorHoraStep === 1) {
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Buscar profesional para actualizar valor jornal</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setValorHoraStep(1); setValorHoraResultados(null); setModalData({}); setValorHoraPorcentaje(""); }}></button>
                  </div>
                  <div className="modal-body">
                    <form onSubmit={async e => {
                      e.preventDefault();
                      setLoading(true);
                      let data = null;
                      try {
                        if (modalData.id && !modalData.nombre) {
                          const res = await fetch(`http://localhost:8080/api/profesionales/${modalData.id}`);
                          data = await res.json();
                          if (data && data.id) {
                            setValorHoraResultados([data]);
                            setValorHoraStep(2);
                          } else {
                            showNotification('No se encontró profesional con ese ID', 'error');
                          }
                        } else if (modalData.nombre && !modalData.id) {
                          const res = await fetch(`http://localhost:8080/api/profesionales/buscar?nombre=${encodeURIComponent(modalData.nombre)}`);
                          data = await res.json();
                          if (Array.isArray(data) && data.length > 0) {
                            setValorHoraResultados(data);
                            setValorHoraStep(2);
                          } else {
                            showNotification('No se encontraron profesionales con ese nombre', 'error');
                          }
                        } else {
                          showNotification('Ingrese solo ID o solo Nombre', 'warning');
                        }
                      } catch (err) {
                        showNotification('Error buscando profesional', 'error');
                      } finally {
                        setLoading(false);
                      }
                    }}>
                      <input className="form-control mb-2" type="number" placeholder="ID profesional" value={modalData.id || ''} onChange={e => setModalData({...modalData, id: e.target.value, nombre: ''})} disabled={!!modalData.nombre} />
                      <input className="form-control mb-2" type="text" placeholder="Nombre profesional (parecido)" value={modalData.nombre || ''} onChange={e => setModalData({...modalData, nombre: e.target.value, id: ''})} disabled={!!modalData.id} />
                      <div className="d-flex justify-content-end">
                        <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setValorHoraStep(1); setValorHoraResultados(null); setModalData({}); setValorHoraPorcentaje(""); }}>Cancelar</button>
                        <button type="submit" className="btn btn-info">Buscar</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          );
        } else if (valorHoraStep === 2 && valorHoraResultados) {
          // Segundo paso: mostrar formularios para actualizar valor hora
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog modal-lg">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Actualizar valor jornal</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setValorHoraStep(1); setValorHoraResultados(null); setModalData({}); setValorHoraPorcentaje(""); }}></button>
                  </div>
                  <div className="modal-body">
                    {valorHoraResultados.map((prof, idx) => (
                      <React.Fragment key={prof.id || idx}>
                        <form onSubmit={async e => {
                          e.preventDefault();
                          try {
                            setLoading(true);
                            await fetch(`http://localhost:8080/api/profesionales/${prof.id}/actualizar-valor-hora?porcentaje=${valorHoraPorcentaje}`, { method: 'PUT' });
                            showNotification('Valor jornal actualizado', 'success');
                            setSidebarAction(null);
                            setValorHoraStep(1);
                            setValorHoraResultados(null);
                            setModalData({});
                            setValorHoraPorcentaje("");
                            loadProfesionales();
                          } catch (err) {
                            showNotification('Error actualizando valor jornal', 'error');
                          } finally {
                            setLoading(false);
                          }
                        }}>
                          <div className="row">
                            <div className="col-md-6 mb-3">
                              <label className="form-label">ID</label>
                              <input type="text" className="form-control" value={prof.id || ''} disabled />
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Nombre</label>
                              <input type="text" className="form-control" value={prof.nombre || ''} disabled />
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="form-label">Porcentaje</label>
                            <input className="form-control" type="number" placeholder="Porcentaje" value={valorHoraPorcentaje} onChange={e => setValorHoraPorcentaje(e.target.value)} required />
                          </div>
                          <div className="d-flex justify-content-end mb-4">
                            <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setValorHoraStep(1); setValorHoraResultados(null); setModalData({}); setValorHoraPorcentaje(""); }}>Cancelar</button>
                            <button type="submit" className="btn btn-dark">Actualizar</button>
                          </div>
                        </form>
                        {idx < valorHoraResultados.length - 1 && <hr />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      case 'actualizarPorcentajeGananciaTodos':
        return (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Actualizar % ganancia de todos</h5>
                  <button type="button" className="btn-close" onClick={() => setSidebarAction(null)}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={async e => {
                    e.preventDefault();
                    try {
                      setLoading(true);
                      await fetch(`http://localhost:8080/api/profesionales/actualizar-porcentaje-ganancia-todos?porcentaje=${modalData.porcentaje}`, { method: 'PUT' });
                      loadProfesionales();
                    } catch (err) {
                      alert('Error actualizando porcentaje ganancia');
                    } finally {
                      setLoading(false);
                      setSidebarAction(null);
                    }
                  }}>
                    <input className="form-control mb-2" type="number" placeholder="Porcentaje" value={modalData.porcentaje || ''} onChange={e => setModalData({...modalData, porcentaje: e.target.value})} required />
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-secondary me-2" onClick={() => setSidebarAction(null)}>Cancelar</button>
                      <button type="submit" className="btn btn-dark">Actualizar</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      case 'actualizarPorcentajeGananciaUno':
        if (gananciaStep === 1) {
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Buscar profesional para actualizar % ganancia</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setGananciaStep(1); setGananciaResultados(null); setModalData({}); setGananciaPorcentaje(""); }}></button>
                  </div>
                  <div className="modal-body">
                    <form onSubmit={async e => {
                      e.preventDefault();
                      setLoading(true);
                      let data = null;
                      try {
                        if (modalData.id && !modalData.nombre) {
                          const res = await fetch(`http://localhost:8080/api/profesionales/${modalData.id}`);
                          data = await res.json();
                          if (data && data.id) {
                            setGananciaResultados([data]);
                            setGananciaStep(2);
                          } else {
                            showNotification('No se encontró profesional con ese ID', 'error');
                          }
                        } else if (modalData.nombre && !modalData.id) {
                          const res = await fetch(`http://localhost:8080/api/profesionales/buscar?nombre=${encodeURIComponent(modalData.nombre)}`);
                          data = await res.json();
                          if (Array.isArray(data) && data.length > 0) {
                            setGananciaResultados(data);
                            setGananciaStep(2);
                          } else {
                            showNotification('No se encontraron profesionales con ese nombre', 'error');
                          }
                        } else {
                          showNotification('Ingrese solo ID o solo Nombre', 'warning');
                        }
                      } catch (err) {
                        showNotification('Error buscando profesional', 'error');
                      } finally {
                        setLoading(false);
                      }
                    }}>
                      <input className="form-control mb-2" type="number" placeholder="ID profesional" value={modalData.id || ''} onChange={e => setModalData({...modalData, id: e.target.value, nombre: ''})} disabled={!!modalData.nombre} />
                      <input className="form-control mb-2" type="text" placeholder="Nombre profesional (parecido)" value={modalData.nombre || ''} onChange={e => setModalData({...modalData, nombre: e.target.value, id: ''})} disabled={!!modalData.id} />
                      <div className="d-flex justify-content-end">
                        <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setGananciaStep(1); setGananciaResultados(null); setModalData({}); setGananciaPorcentaje(""); }}>Cancelar</button>
                        <button type="submit" className="btn btn-info">Buscar</button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          );
        } else if (gananciaStep === 2 && gananciaResultados) {
          return (
            <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
              <div className="modal-dialog modal-lg">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Actualizar % ganancia</h5>
                    <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); setGananciaStep(1); setGananciaResultados(null); setModalData({}); setGananciaPorcentaje(""); }}></button>
                  </div>
                  <div className="modal-body">
                    {gananciaResultados.map((prof, idx) => (
                      <React.Fragment key={prof.id || idx}>
                        <form onSubmit={async e => {
                          e.preventDefault();
                          try {
                            setLoading(true);
                            await fetch(`http://localhost:8080/api/profesionales/${prof.id}/actualizar-porcentaje-ganancia?porcentaje=${gananciaPorcentaje}`, { method: 'PUT' });
                            showNotification('% ganancia actualizado', 'success');
                            setSidebarAction(null);
                            setGananciaStep(1);
                            setGananciaResultados(null);
                            setModalData({});
                            setGananciaPorcentaje("");
                            loadProfesionales();
                          } catch (err) {
                            showNotification('Error actualizando % ganancia', 'error');
                          } finally {
                            setLoading(false);
                          }
                        }}>
                          <div className="row">
                            <div className="col-md-6 mb-3">
                              <label className="form-label">ID</label>
                              <input type="text" className="form-control" value={prof.id || ''} disabled />
                            </div>
                            <div className="col-md-6 mb-3">
                              <label className="form-label">Nombre</label>
                              <input type="text" className="form-control" value={prof.nombre || ''} disabled />
                            </div>
                          </div>
                          <div className="mb-3">
                            <label className="form-label">Porcentaje</label>
                            <input className="form-control" type="number" placeholder="Porcentaje" value={gananciaPorcentaje} onChange={e => setGananciaPorcentaje(e.target.value)} required />
                          </div>
                          <div className="d-flex justify-content-end mb-4">
                            <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); setGananciaStep(1); setGananciaResultados(null); setModalData({}); setGananciaPorcentaje(""); }}>Cancelar</button>
                            <button type="submit" className="btn btn-dark">Actualizar</button>
                          </div>
                        </form>
                        {idx < gananciaResultados.length - 1 && <hr />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      case 'buscarPorEspecialidad':
        return (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog" style={{marginTop: '120px'}}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Buscar por especialidad</h5>
                  <button type="button" className="btn-close" onClick={() => { setSidebarAction(null); loadProfesionales(); }}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={async e => {
                    e.preventDefault();
                    try {
                      setLoading(true);
                      setResultModal(null); // Limpiar antes de mostrar
                      // Normaliza el texto para buscar de forma permisiva
                      const especialidad = (modalData.especialidad || '').toLowerCase().replace(/a|á/g, '[aá]').replace(/e|é/g, '[eé]').replace(/i|í/g, '[ií]').replace(/o|ó/g, '[oó]').replace(/u|ú/g, '[uú]').replace(/profesional|profesionala|profesionalo|profesionalx/g, 'profesional');
                      const res = await fetch(`http://localhost:8080/api/profesionales/buscar-por-especialidad?especialidad=${encodeURIComponent(especialidad)}`);
                      const data = await res.json();
                      setResultModal(data);
                      setSidebarAction(null);
                    } catch (err) {
                      showNotification('Error buscando por especialidad', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}>
                    <input className="form-control mb-2" type="text" placeholder="Especialidad (mayúsculas/minúsculas, femenino/masculino)" value={modalData.especialidad || ''} onChange={e => setModalData({...modalData, especialidad: e.target.value})} required />
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-secondary me-2" onClick={() => { setSidebarAction(null); loadProfesionales(); }}>Cancelar</button>
                      <button type="submit" className="btn btn-info">Buscar</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Cargar la lista automáticamente al montar
  useEffect(() => {
    console.log('🎬 ProfesionalesPage: Montando componente y registrando listeners de eventos');
    loadProfesionales();

    // Escuchar actualizaciones de profesionales desde otros componentes
    const unsubscribeActualizados = eventBus.on(FINANCIAL_EVENTS.PROFESIONALES_ACTUALIZADOS, (data) => {
      console.log('🔔 ProfesionalesPage: Recibido evento PROFESIONALES_ACTUALIZADOS', data);
      if (data.profesionales && Array.isArray(data.profesionales)) {
        // Crear copia nueva del array para forzar re-render
        const profesionalesActualizados = data.profesionales.map(prof => ({...prof}));
        console.log('📋 Actualizando profesionales en tabla:', profesionalesActualizados.length);
        setProfesionales(profesionalesActualizados);
      } else {
        // Si no vienen los profesionales en el evento, recargar
        console.log('⚠️ No hay profesionales en el evento, recargando...');
        loadProfesionales();
      }
    });
    console.log('✅ Listener registrado: PROFESIONALES_ACTUALIZADOS');

    // Escuchar cuando se asigna un profesional
    const unsubscribeAsignado = eventBus.on(FINANCIAL_EVENTS.PROFESIONAL_ASIGNADO, () => {
      console.log('🔔 ProfesionalesPage: Profesional asignado, recargando lista...');
      loadProfesionales();
    });
    console.log('✅ Listener registrado: PROFESIONAL_ASIGNADO');

    // Escuchar cuando se desasigna un profesional
    const unsubscribeDesasignado = eventBus.on(FINANCIAL_EVENTS.PROFESIONAL_DESASIGNADO, () => {
      console.log('🔔 ProfesionalesPage: Profesional desasignado, recargando lista...');
      loadProfesionales();
    });
    console.log('✅ Listener registrado: PROFESIONAL_DESASIGNADO');

    return () => {
      console.log('🔴 ProfesionalesPage: Desmontando y removiendo listeners');
      unsubscribeActualizados();
      unsubscribeAsignado();
      unsubscribeDesasignado();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    async function fetchTiposUnicos() {
      if (sidebarAction === 'buscarPorTipo') {
        try {
          setLoading(true);
          const res = await fetch('http://localhost:8080/api/profesionales');
          const data = await res.json();
          const tiposUnicos = [...new Set((data.resultado || data || []).map(p => p.tipoProfesional))].filter(Boolean);
          setTiposProfesionalesUnicos(tiposUnicos);
        } catch (err) {
          showNotification('Error buscando tipos de profesional', 'error');
        } finally {
          setLoading(false);
        }
      }
    }
    fetchTiposUnicos();
    // eslint-disable-next-line
  }, [sidebarAction]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'rgb(246, 247, 249)' }}>
      <aside
        style={{
          top: 56,
          left: 0,
          zIndex: 1000,
          minHeight: 'calc(100vh - 56px)',
          position: 'fixed',
          transition: 'left 0.3s',
          background: '#0d6efd',
          color: 'white',
          width: 300,
          minWidth: 300,
          maxWidth: 300,
          boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
        }}
      >
        <SidebarProfesionalesMenu onAction={handleSidebarAction} />
      </aside>
      <main className="main-content px-md-4" style={{flex: '1 1 0%', minWidth: 0, minHeight: '100vh', background: 'rgb(246, 247, 249)', overflowX: 'hidden', marginLeft: 300, padding: '40px 0 0 0', width: 'calc(100% - 300px)'}} onClick={() => setSelectedProfesionalId(null)}>
        <div className="d-sm-flex align-items-center justify-content-between mb-4">
          <h1 className="h3 mb-0 text-gray-800">
            <i className="fas fa-user-hard-hat me-2"></i>
            Gestión de Profesionales - Todos los Endpoints
          </h1>
          <button
            className="btn btn-info ms-3"
            style={{ color: 'white', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(8,102,198,0.08)' }}
            onClick={loadProfesionales}
          >
            <i className="fas fa-list me-2"></i>Lista de Profesionales
          </button>
        </div>

        {/* Contenido de las pestañas */}
        {renderTabContent()}

        {/* Modales de acciones del sidebar */}
        {renderSidebarModal()}

        {/* Modal de detalles de profesional */}
        {renderDetalleModal()}

        {/* Modal de resultados */}
        {renderResultModal()}

        {/* Modal para editar profesional */}
        {selectedProfesional && (
          <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Editar Profesional</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setSelectedProfesional(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    actualizarProfesional(selectedProfesional.id, selectedProfesional);
                  }}>
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Nombre</label>
                        <input
                          type="text"
                          className="form-control"
                          value={selectedProfesional.nombre || ''}
                          onChange={(e) => setSelectedProfesional({...selectedProfesional, nombre: e.target.value})}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Tipo</label>
                        <select
                          className="form-select"
                          value={selectedProfesional.tipoProfesional || ''}
                          onChange={(e) => setSelectedProfesional({...selectedProfesional, tipoProfesional: e.target.value})}
                        >
                          {tiposDisponibles.map(tipo => (
                            <option key={tipo} value={tipo}>{tipo}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Email</label>
                        <input
                          type="email"
                          className="form-control"
                          value={selectedProfesional.email || ''}
                          onChange={(e) => setSelectedProfesional({...selectedProfesional, email: e.target.value})}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Teléfono</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={selectedProfesional.telefono || ''}
                          onChange={(e) => setSelectedProfesional({...selectedProfesional, telefono: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Especialidad</label>
                      <input
                        type="text"
                        className="form-control"
                        value={selectedProfesional.especialidad || ''}
                        onChange={(e) => setSelectedProfesional({...selectedProfesional, especialidad: e.target.value})}
                      />
                    </div>

                    <div className="d-flex justify-content-end">
                      <button
                        type="button"
                        className="btn btn-secondary me-2"
                        onClick={() => setSelectedProfesional(null)}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="btn btn-primary">
                        <i className="fas fa-save me-1"></i>Guardar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actualizar Porcentaje de Varios */}
        {mostrarModalPorcentajeVarios && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header bg-success text-white">
                  <h5 className="modal-title">
                    <i className="fas fa-percentage me-2"></i>
                    Actualizar % Ganancia - Seleccionados
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => {
                      setMostrarModalPorcentajeVarios(false);
                      setPorcentajeVarios('');
                    }}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-info">
                    <i className="fas fa-info-circle me-2"></i>
                    Ingrese el porcentaje de ganancia a establecer para los profesionales seleccionados.
                    <br />
                    <strong>Ejemplo:</strong> 15 para establecer 15% de ganancia
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Porcentaje de Ganancia (%)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={porcentajeVarios}
                      onChange={(e) => setPorcentajeVarios(e.target.value)}
                      placeholder="Ej: 15"
                      step="0.01"
                      min="0"
                    />
                  </div>

                  {porcentajeVarios && (
                    <div className="alert alert-secondary">
                      <strong>Preview:</strong> Se establecerá{' '}
                      <strong>{porcentajeVarios}%</strong> de ganancia para{' '}
                      <strong>{seleccionados.length}</strong> profesional(es) seleccionado(s)
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setMostrarModalPorcentajeVarios(false);
                      setPorcentajeVarios('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={async () => {
                      const porcentajeNum = parseFloat(porcentajeVarios);
                      if (isNaN(porcentajeNum) || porcentajeNum < 0) {
                        alert('Ingrese un porcentaje válido');
                        return;
                      }

                      setLoading(true);
                      try {
                        await catalogoProfesionalesService.actualizarPorcentajeVarios(
                          seleccionados,
                          porcentajeNum,
                          empresaId
                        );
                        showNotification?.(`✅ Porcentaje de ganancia actualizado para ${seleccionados.length} profesionales`, 'success');
                        setMostrarModalPorcentajeVarios(false);
                        setPorcentajeVarios('');
                        setSeleccionados([]);
                        loadProfesionales();
                      } catch (error) {
                        console.error('Error actualizando porcentaje:', error);
                        alert('Error al actualizar porcentaje de ganancia');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || !porcentajeVarios}
                  >
                    {loading ? 'Aplicando...' : 'Aplicar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfesionalesPage;
