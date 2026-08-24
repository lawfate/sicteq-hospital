import { useState, useEffect } from 'react'
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

function App() {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

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

  const handleLogout = () => {
    localStorage.removeItem('sicteq_token');
    localStorage.removeItem('sicteq_user');
    setUser(null);
  };

  if (checkingSession) {
    return null;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="bg-slate-100 font-sans text-slate-800 flex h-screen overflow-hidden">
        {/* Pasamos el usuario dinámico y la función de logout */}
        <Sidebar onLogout={handleLogout} user={user} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                
                {/* AÑADIDO EL user AQUÍ PARA QUE LA ENFERMERA QUEDE REGISTRADA */}
                <Route path="/solicitudes" element={<Solicitudes user={user} />} />
                
                <Route path="/ciclo" element={<Ciclo />} />
                {/* Importante: Pasamos el user a Vinculo para que el control de acceso funcione */}
                <Route path="/vinculo" element={<Vinculo user={user} />} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/reportes" element={<Reportes />} />
              </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App