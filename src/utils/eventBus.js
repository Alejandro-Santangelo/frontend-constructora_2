/**
 * 🚌 Event Bus para sincronización automática entre secciones
 * 
 * Permite que diferentes componentes se comuniquen y actualicen en tiempo real
 * cuando hay cambios en pagos, cobros, o cualquier operación financiera.
 */

class EventBus {
  constructor() {
    this.events = {};
  }

  /**
   * Suscribirse a un evento
   * @param {string} eventName - Nombre del evento
   * @param {Function} callback - Función a ejecutar cuando ocurre el evento
   * @returns {Function} Función para desuscribirse
   */
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    
    this.events[eventName].push(callback);
    
    // Retornar función de cleanup
    return () => this.off(eventName, callback);
  }

  /**
   * Desuscribirse de un evento
   * @param {string} eventName - Nombre del evento
   * @param {Function} callback - Función a remover
   */
  off(eventName, callback) {
    if (!this.events[eventName]) return;
    
    this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
  }

  /**
   * Emitir un evento
   * @param {string} eventName - Nombre del evento
   * @param {*} data - Datos del evento
   */
  emit(eventName, data) {
    const listeners = this.events[eventName]?.length || 0;
    console.log(`📡 EventBus: Emitiendo "${eventName}" a ${listeners} listener(s)`, data);
    
    if (!this.events[eventName]) {
      console.warn(`⚠️ EventBus: No hay listeners para "${eventName}"`);
      return;
    }
    
    this.events[eventName].forEach((callback, index) => {
      try {
        console.log(`  → Ejecutando listener #${index + 1} de "${eventName}"`);
        callback(data);
      } catch (error) {
        console.error(`❌ Error en callback de evento "${eventName}":`, error);
      }
    });
  }

  /**
   * Limpiar todos los eventos
   */
  clear() {
    this.events = {};
  }
}

// Crear instancia única (singleton)
const eventBus = new EventBus();

// Eventos predefinidos del sistema financiero
export const FINANCIAL_EVENTS = {
  // Pagos
  PAGO_REGISTRADO: 'pago_registrado',
  PAGO_ACTUALIZADO: 'pago_actualizado',
  PAGO_ELIMINADO: 'pago_eliminado',
  PAGO_CONSOLIDADO_REGISTRADO: 'pago_consolidado_registrado',
  
  // Cobros
  COBRO_REGISTRADO: 'cobro_registrado',
  COBRO_ACTUALIZADO: 'cobro_actualizado',
  COBRO_ELIMINADO: 'cobro_eliminado',
  
  // Retiros Personales
  RETIRO_REGISTRADO: 'retiro_registrado',
  RETIRO_ANULADO: 'retiro_anulado',
  RETIRO_ELIMINADO: 'retiro_eliminado',
  
  // Caja chica
  CAJA_CHICA_ASIGNADA: 'caja_chica_asignada',
  CAJA_CHICA_ACTUALIZADA: 'caja_chica_actualizada',
  GASTO_CAJA_CHICA_REGISTRADO: 'gasto_caja_chica_registrado',
  
  // Profesionales
  PROFESIONAL_ASIGNADO: 'profesional_asignado',
  PROFESIONAL_DESASIGNADO: 'profesional_desasignado',
  PROFESIONALES_ACTUALIZADOS: 'profesionales_actualizados',
  
  // General
  DATOS_FINANCIEROS_ACTUALIZADOS: 'datos_financieros_actualizados',
  OBRA_SELECCIONADA: 'obra_seleccionada',
};

export default eventBus;
