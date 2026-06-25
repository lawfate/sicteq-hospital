import React, { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import Solicitudes from './components/Solicitudes'
import Ciclo from './components/Ciclo'
import Vinculo from './components/Vinculo'
import Inventario from './components/Inventario'

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (role) => {
    const roleMap = {
      'Enfermera': { name: "Enf. Ana María", role: "Enfermera" },
      'TENS': { name: "TENS Juan Carlos", role: "TENS" },
      'IT': { name: "IT Matías Olguín", role: "IT" }
    };
    
    setUser(roleMap[role]);
  };


  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div className="bg-slate-100 font-sans text-slate-800 flex h-screen overflow-hidden">
        {/* Pasamos el usuario dinámico y la función de logout */}
        <Sidebar onLogout={() => setUser(null)} user={user} />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/solicitudes" element={<Solicitudes />} />
                <Route path="/ciclo" element={<Ciclo />} />
                {/* Importante: Pasamos el user a Vinculo para que el control de acceso funcione */}
                <Route path="/vinculo" element={<Vinculo user={user} />} />
                <Route path="/inventario" element={<Inventario />} />
              </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App