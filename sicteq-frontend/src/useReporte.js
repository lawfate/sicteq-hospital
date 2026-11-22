import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

// Los filtros se consultan al aplicar; editar un campo no dispara peticiones.
export function useReporte(ruta) {
  const [consulta, setConsulta] = useState({ params: '' });
  const [resultado, setResultado] = useState({ data: null, loading: true, error: '' });

  useEffect(() => {
    const controller = new AbortController();
    apiFetch(`${ruta}?${consulta.params}`, { signal: controller.signal })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo cargar el reporte.');
        return data;
      })
      .then(data => {
        if (!controller.signal.aborted) setResultado({ data, loading: false, error: '' });
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setResultado(prev => ({ ...prev, loading: false, error: err.message }));
        }
      });
    // Al cambiar de pestaña o filtros, una respuesta anterior deja de servir.
    return () => controller.abort();
  }, [ruta, consulta]);

  const cargar = useCallback((params = new URLSearchParams()) => {
    setResultado(prev => ({ ...prev, loading: true, error: '' }));
    setConsulta({ params: params.toString() });
  }, []);

  return { ...resultado, cargar };
}
