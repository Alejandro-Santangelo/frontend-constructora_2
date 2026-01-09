import React, { useState } from 'react';
import axios from 'axios';

const DescargarPdfButton = () => {
  const [descargando, setDescargando] = useState(false);

  const handleDescargarPdf = async () => {
    setDescargando(true);
    try {
      const response = await axios.get('http://localhost:8080/pdf', {
        responseType: 'blob', // Importante para recibir el archivo como Blob
      });

      // Crear un enlace temporal para descargar el archivo
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'informe.pdf'); // Nombre del archivo
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Error al descargar el PDF:', error);
      alert('Hubo un error al intentar descargar el PDF.');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <button
      className="btn btn-primary"
      onClick={handleDescargarPdf}
      disabled={descargando}
    >
      {descargando ? 'Descargando...' : '📄 Descargar PDF'}
    </button>
  );
};

export default DescargarPdfButton;