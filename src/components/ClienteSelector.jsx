import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchClientes } from '../store/slices/clientesSlice';
import { fetchEmpresasActivas } from '../store/slices/empresasSlice';

const ClienteSelector = ({ 
  value, 
  onChange, 
  onClick,
  empresaId = '1', 
  placeholder = "Seleccionar cliente...",
  required = false,
  className = "form-select",
  style,
  disabled
}) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  
  // Redux state
  const clientes = useSelector(state => state.clientes.clientes);
  const empresasActivas = useSelector(state => state.empresas.empresasActivas);
  
  useEffect(() => {
    loadClientesAndEmpresas();
  }, [empresaId]);

  const loadClientesAndEmpresas = async () => {
    try {
      setLoading(true);
      // Cargar clientes y empresas en paralelo
      await Promise.all([
        dispatch(fetchClientes({ 
          empresaId, 
          page: 0, 
          size: 100, // Cargar más clientes para el selector
          sort: 'nombre', 
          direction: 'ASC' 
        })).unwrap(),
        dispatch(fetchEmpresasActivas()).unwrap()
      ]);
    } catch (error) {
      console.error('Error cargando datos para ClienteSelector:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEmpresaName = (cliente) => {
    if (cliente.empresas && cliente.empresas.length > 0) {
      return cliente.empresas.map(emp => emp.nombre || emp.razonSocial).join(', ');
    }
    
    // Fallback: buscar por empresaId si no está en la relación
    if (cliente.empresaId) {
      const empresa = empresasActivas.find(emp => emp.id === cliente.empresaId);
      return empresa ? empresa.nombreEmpresa : `Empresa ${cliente.empresaId}`;
    }
    
    return 'Sin empresa';
  };

  const handleChange = (e) => {
    const selectedId = e.target.value;
    // Devolver solo el ID como número (o null si está vacío)
    onChange(selectedId ? parseInt(selectedId, 10) : null);
  };

  if (loading) {
    return (
      <select className={className} disabled>
        <option>Cargando clientes...</option>
      </select>
    );
  }

  // Solo aplicar el value cuando ya se cargaron los clientes
  const valorActual = (loading || clientes.length === 0) ? '' : (value ? String(value) : '');

  return (
    <select 
      className={className}
      value={valorActual}
      onChange={handleChange}
      onClick={onClick}
      required={required}
      disabled={disabled}
      style={style}
    >
      <option value="">{placeholder}</option>
      {clientes.filter(cliente => cliente && (cliente.id_cliente || cliente.id)).map(cliente => {
        const clienteId = cliente.id_cliente || cliente.id;
        return (
          <option key={`cliente-${clienteId}`} value={String(clienteId)}>
            {cliente.nombre} - {getEmpresaName(cliente)} (ID: {clienteId})
          </option>
        );
      })}
    </select>
  );
};

export default ClienteSelector;