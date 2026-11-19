import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from './api'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import Solicitudes from './components/Solicitudes'
import Ciclo from './components/Ciclo'
import Vinculo from './components/Vinculo'
import Inventario from './components/Inventario'
import Reportes from './components/Reportes'
import Autoclave from './components/Autoclave'
import Auditoria from './components/Auditoria'
import Indicadores from './components/Indicadores'
import Etiquetas from './components/Etiquetas'
import { Button } from '@/components/ui/button'

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(false); // menú lateral en pantallas chicas

  // Antes la sesión vivía solo en useState: un F5, o abrir un link en
  // pestaña nueva, botaba al login sin ninguna razón real. El token y el
  // usuario quedan en localStorage (los guarda Login.jsx), así que acá solo
  // hay que releerlos al montar.
  useEffect(() => {
    const token = localStorage.getItem('sicteq_token');
    const storedUser = localStorage.getItem('sicteq_user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('sicteq_token');
        localStorage.removeItem('sicteq_user');
      }
    }
    setCheckingSession(false);
  }, []);

  // Lógica de Login actualizada para recibir los datos reales desde la BD
  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = useCallback(() => {
    // Cierra también la sesión en el servidor (si falla, igual se limpia local).
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('sicteq_token');
    localStorage.removeItem('sicteq_user');
    setUser(null);
  }, []);

  // PB-02: aviso a los 25 min sin uso y cierre a los 30 (el backend aplica la
  // misma regla). La actividad local renueva la sesión del servidor como mucho
  // cada 5 min, porque el servidor solo ve peticiones, no movimientos del mouse.
  const [avisoInactividad, setAvisoInactividad] = useState(false);
  const ultimaActividad = useRef(0);
  const ultimoPing = useRef(0);

  const seguirConectado = useCallback(() => {
    ultimaActividad.current = Date.now();
    ultimoPing.current = Date.now();
    setAvisoInactividad(false);
    apiFetch('/api/areas').catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    ultimaActividad.current = Date.now();
    ultimoPing.current = Date.now();
    const MIN = 60 * 1000;
    const onActividad = () => {
      ultimaActividad.current = Date.now();
      if (Date.now() - ultimoPing.current > 5 * MIN) {
        ultimoPing.current = Date.now();
        apiFetch('/api/areas').catch(() => {});
      }
    };
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach(ev => window.addEventListener(ev, onActividad, { passive: true }));
    const timer = setInterval(() => {
      const inactivo = Date.now() - ultimaActividad.current;
      if (inactivo >= 30 * MIN) {
        sessionStorage.setItem('sicteq_motivo_salida', 'Sesión cerrada por 30 minutos de inactividad.');
        handleLogout();
      } else {
        setAvisoInactividad(inactivo >= 25 * MIN);
      }
    }, 15 * 1000);
    return () => {
      eventos.forEach(ev => window.removeEventListener(ev, onActividad));
      clearInterval(timer);
    };
  }, [user, handleLogout]);

  if (checkingSession) {
    return null;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="flex h-full overflow-hidden bg-background text-foreground">
        <Sidebar onLogout={handleLogout} user={user} isOpen={menuAbierto} setIsOpen={setMenuAbierto} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {avisoInactividad && (
            <div role="alert" className="flex items-center justify-between gap-4 border-b border-warn/40 bg-warn/15 px-6 py-3 text-sm font-bold text-warn">
              <span><i className="fa-solid fa-clock mr-2" aria-hidden="true"></i>Tu sesión se cerrará en 5 minutos por inactividad.</span>
              <Button size="sm" onClick={seguirConectado} className="bg-warn text-primary-foreground hover:bg-warn/90">Seguir conectado</Button>
            </div>
          )}
          <Header onMenuClick={() => setMenuAbierto(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                
                {/* AÑADIDO EL user AQUÍ PARA QUE LA ENFERMERA QUEDE REGISTRADA */}
                <Route path="/solicitudes" element={<Solicitudes user={user} />} />
                
                <Route path="/ciclo" element={<Ciclo />} />
                {/* Importante: Pasamos el user a Vinculo para que el control de acceso funcione */}
                <Route path="/vinculo" element={<Vinculo user={user} />} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/autoclave" element={<Autoclave user={user} />} />
                <Route path="/auditoria" element={<Auditoria user={user} />} />
                <Route path="/indicadores" element={<Indicadores />} />
                <Route path="/etiquetas" element={<Etiquetas />} />
              </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App