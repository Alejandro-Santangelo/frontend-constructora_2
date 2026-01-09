import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';

const GenerarPdfButton = () => {
  const [generando, setGenerando] = useState(false);

  // Obtén los datos del estado de Redux
  const datosPresupuesto = useSelector((state) => state.presupuesto); // Ajusta el selector según tu estado

  const handleGenerarPdf = async () => {
    setGenerando(true);
    try {
      const response = await axios.post(
        'http://localhost:8080/api/pdf/generar', // URL del endpoint
        datosPresupuesto, // Datos del presupuesto en formato JSON
        {
          headers: {
            'Content-Type': 'application/json', // Asegura el formato correcto
          },
          responseType: 'blob', // Recibe la respuesta como un Blob
        }
      );

      // Crear un enlace temporal para descargar el archivo
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'presupuesto.pdf'); // Nombre del archivo
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Error al generar el PDF:', error);
      alert('Hubo un error al generar el PDF. Por favor, inténtalo de nuevo.');
    } finally {
      setGenerando(false);
    }
  };

  return (
    <button
      className="btn btn-primary"
      onClick={handleGenerarPdf}
      disabled={generando}
    >
      {generando ? 'Generando PDF...' : '📄 Generar PDF'}
    </button>
  );
};

export default GenerarPdfButton;