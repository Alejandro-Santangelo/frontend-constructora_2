import React, { useEffect, useState } from 'react';
import EliminarPresupuestoPorEmpresaObraVersionModal from './EliminarPresupuestoPorEmpresaObraVersionModal';
import { useDispatch, useSelector } from 'react-redux';
import { fetchPresupuestos } from '../store/slices/presupuestosSlice';
import { fetchAllEmpresas } from '../store/slices/empresasSlice';
import { fetchTodasObras } from '../store/slices/obrasSlice';

const PresupuestosList = ({ onOpenSidebar, sidebarCollapsed }) => {
  const dispatch = useDispatch();
  const loading = useSelector(state => state.presupuestos.loadingLista);
  const error = useSelector(state => state.presupuestos.errorLista);
  const lista = useSelector(state => state.presupuestos.lista);
  const empresas = useSelector(state => state.empresas.empresas);
  const obras = useSelector(state => state.obras.obras);

  const [showEliminarModal, setShowEliminarModal] = useState(false);
  const [eliminarData, setEliminarData] = useState(null);

  useEffect(() => {
    dispatch(fetchPresupuestos());
    dispatch(fetchTodasObras());
  }, [dispatch]);

  // Log para depuración de estados
  if (lista && lista.length > 0) {
    console.log('Estados de presupuestos:', lista.map(p => ({id: p.id, estado: p.estado})));
  }
  // Mostrar todos los presupuestos para pruebas
  const listaFiltrada = lista;

  // Funciones para obtener el nombre por id
  const getNombreEmpresa = id => {
    const empresa = empresas.find(e => e.id === Number(id));
    return empresa ? empresa.nombre_empresa : id;
  };
  // Usar selector robusto para obtener nombre de obra
  // Si el presupuesto tiene el campo nombre_obra, usarlo directamente
  const getNombreObra = (id, p) => {
    if (p && p.nombre_obra) return p.nombre_obra;
    if (!id) return '-';
    const obra = obras.find(o => Number(o.id) === Number(id));
    return obra && obra.nombre ? obra.nombre : '-';
  };

  return (
    <div>
      <div style={{ width: '100%', paddingLeft: '30px', marginRight: 0, position: 'relative' }}>
        {sidebarCollapsed && typeof onOpenSidebar === 'function' && (
          <button
            className="btn btn-primary"
            style={{
              position: 'absolute',
              top: 0,
              left: -0.5,
              zIndex: 10,
              borderRadius: '50%',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 0,
              marginTop: '-10px'
            }}
            title="Abrir acciones"
            onClick={onOpenSidebar}
          >
            <i className="fas fa-bars"></i>
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 40 }}>
          <h3 style={{ textAlign: 'left', marginBottom: 0 }}>Listado de Presupuestos para Enviar</h3>
        </div>
        {loading && <div className="alert alert-info">Cargando presupuestos...</div>}
        {error && <div className="alert alert-danger">Error: {error}</div>}
        {!loading && !error && listaFiltrada.length === 0 && (
          <div className="d-flex align-items-center">
            <div className="alert alert-warning mb-0">No hay presupuestos "A enviar" para mostrar.</div>
          </div>
        )}
        {!loading && !error && listaFiltrada.length > 0 && (
          <div className="table-responsive" style={{ width: '100%', marginLeft: 0, paddingLeft: 0 }}>
            <table className="table table-bordered table-hover" style={{ width: '100%', marginLeft: 0, paddingLeft: 0, tableLayout: 'auto' }}>
              <thead className="table-dark">
                <tr>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 60}}>ID</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 180}}>DESCRIPCIÓN</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 140}}>DIRECCIÓN COMPLETA</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 140}}>NOMBRE DE OBRA</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 110}}>ESTADO</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 140}}>FECHA DE CREACIÓN</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 120}}>EMPRESA</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 160}}>OBRA</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 140}}>MONTO TOTAL</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 140}}>VÁLIDO HASTA</th>
                  <th style={{background:'#e3e3e3', color:'#222', minWidth: 100}}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.descripcion}</td>
                    <td>{p.direccionObraCalle} {p.direccionObraAltura} {p.direccionObraBarrio}</td>
                    <td>{getNombreObra(p.idObra, p)}</td>
                    <td>
                      {p.estado === 'A enviar' ? (
                        <span style={{ background: '#ffe066', color: '#222', fontWeight: 'bold', padding: '4px 10px', borderRadius: '6px', boxShadow: '0 0 4px #ccc' }}>
                          {p.estado}
                        </span>
                      ) : (
                        p.estado
                      )}
                    </td>
                    <td>{p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString() : '-'}</td>
                    <td>{getNombreEmpresa(p.idEmpresa)}</td>
                    <td>{getNombreObra(p.idObra, p)}</td>
                    <td>${p.montoTotal?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td>{p.fechaValidez ? new Date(p.fechaValidez).toLocaleDateString() : '-'}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" style={{marginRight:4}} onClick={() => { console.log('Click eliminar', p); setEliminarData(p); setShowEliminarModal(true); }}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {showEliminarModal && (
          <EliminarPresupuestoPorEmpresaObraVersionModal
            show={showEliminarModal}
            onClose={() => setShowEliminarModal(false)}
            onEliminar={() => {
              setShowEliminarModal(false);
              dispatch(fetchPresupuestos());
            }}
            initialValues={eliminarData}
          />
        )}
      </div>
    </div>
  );
};

export default PresupuestosList;
