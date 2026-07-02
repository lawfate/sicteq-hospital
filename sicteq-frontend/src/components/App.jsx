import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Importación de tus componentes
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Solicitudes from './components/Solicitudes';
import Ciclo from './components/Ciclo';
import Vinculo from './components/Vinculo';
import Inventario from './components/Inventario';

export default function App() {
  // Estados globales de la aplicación
  const [user, setUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Lógica simple de Login (Adaptada de tu Login.jsx)
  const handleLogin = (role) => {
    setUser({ 
      name: role === 'Enfermera' ? 'Ana María' : role === 'IT' ? 'Carlos' : 'Juan Carlos', 
      role: role 
    });
  };

  const handleLogout = () => {
    setUser(null);
  };

  // Si no hay usuario, mostramos el login a pantalla completa
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Estructura principal con el cascarón responsivo
  return (
    <Router>
      {/* Contenedor principal: Ocupa toda la pantalla y oculta el desbordamiento general */}
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
        
        {/* Tu Sidebar Responsivo */}
        <Sidebar 
          user={user} 
          onLogout={handleLogout} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
        />

        {/* Columna Derecha: Header + Contenido Dinámico */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* Header Superior (Recibe la función para abrir el menú móvil) */}
          <Header onMenuClick={() => setIsSidebarOpen(true)} />

          {/* Área principal donde cambian las pantallas. Aquí ocurre el scroll vertical. */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/solicitudes" element={<Solicitudes />} />
              <Route path="/ciclo" element={<Ciclo />} />
              <Route path="/vinculo" element={<Vinculo user={user} />} />
              <Route path="/inventario" element={<Inventario />} />
            </Routes>
          </main>

        </div>
      </div>
    </Router>
  );
}