import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from './api'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { pantallaDe, puedeVer } from './navegacion'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import Solicitudes from './components/Solicitudes'
import Ciclo from './components/Ciclo'
import Vinculo from './components/Vinculo'
import Entrega from './components/Entrega'
import CambiarClave from './components/CambiarClave'
import Guia from './components/Guia'
import Usuarios from './components/Usuarios'
import Catalogo from './components/Catalogo'
import Inventario from './components/Inventario'
import Reportes from './components/Reportes'
import Autoclave from './components/Autoclave'
import Auditoria from './components/Auditoria'
import Indicadores from './components/Indicadores'
import Etiquetas from './components/Etiquetas'
import { Button } from '@/components/ui/button'

function restaurarUsuario() {
  try {
    const token = localStorage.getItem('sicteq_token');
    const storedUser = localStorage.getItem('sicteq_user');
    return token && storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

function App() {
  const [user, setUser] = useState(restaurarUsuario);
  const [menuAbierto, setMenuAbierto] = useState(false); // menú lateral en pantallas chicas
  const [guia, setGuia] = useState(false);

  // Si el usuario guardado está dañado, se descarta también su token.
  useEffect(() => {
    const storedUser = localStorage.getItem('sicteq_user');
    if (storedUser) {
      try {
        JSON.parse(storedUser);
      } catch {
        localStorage.removeItem('sicteq_token');
        localStorage.removeItem('sicteq_user');
      }
    }
  }, []);

  // La guía se abre sola la primera vez que cada persona entra en este equipo.
  const claveGuia = (u) => `sicteq_guia_vista_${u?.id}`;
  const guiaVista = (u) => { try { return localStorage.getItem(claveGuia(u)) === '1'; } catch { return true; } };
  const cerrarGuia = () => { try { localStorage.setItem(claveGuia(user), '1'); } catch { /* sin almacenamiento */ } setGuia(false); };

  const handleLogin = (userData) => {
    setUser(userData);
    setGuia(!guiaVista(userData));
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

  // Una pantalla que el rol no usa no existe para él: se vuelve al Panel.
  const soloSiPuede = (ruta, pantalla) => (puedeVer(pantallaDe(ruta), user?.role) ? pantalla : <Navigate to="/" replace />);

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  if (user.debeCambiarClave) {
    const listo = () => {
      const u = { ...user, debeCambiarClave: false };
      localStorage.setItem('sicteq_user', JSON.stringify(u));
      setUser(u);
    };
    return <CambiarClave obligatoria onListo={listo} onSalir={handleLogout} />;
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
          <Header onMenuClick={() => setMenuAbierto(true)} onAyuda={() => setGuia(true)} />
          {guia && <Guia rol={user.role} onCerrar={cerrarGuia} />}
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
              <Routes>
                <Route path="/" element={<Dashboard user={user} />} />
                
                <Route path="/solicitudes" element={soloSiPuede('/solicitudes', <Solicitudes user={user} />)} />
                
                <Route path="/ciclo" element={<Ciclo />} />
                <Route path="/entrega" element={soloSiPuede('/entrega', <Entrega />)} />
                <Route path="/vinculo" element={soloSiPuede('/vinculo', <Vinculo user={user} />)} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/reportes" element={soloSiPuede('/reportes', <Reportes user={user} />)} />
                <Route path="/autoclave" element={<Autoclave user={user} />} />
                <Route path="/auditoria" element={soloSiPuede('/auditoria', <Auditoria />)} />
                <Route path="/indicadores" element={<Indicadores />} />
                <Route path="/etiquetas" element={<Etiquetas />} />
                <Route path="/catalogo" element={soloSiPuede('/catalogo', <Catalogo />)} />
                <Route path="/usuarios" element={soloSiPuede('/usuarios', <Usuarios />)} />
                <Route path="/clave" element={<CambiarClave />} />
              </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
