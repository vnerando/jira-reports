import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Sidebar = ({ months = [] }) => {
  const location = useLocation();
  const navigate  = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  const handleLogout = () => {
    localStorage.removeItem('noc_token');
    navigate('/login');
  };

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full shadow-xl">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-8 h-8 rounded bg-indigo-500 flex items-center justify-center text-white font-bold">R</div>
        <h1 className="text-xl font-bold text-white tracking-wide">Relatórios JSM</h1>
      </div>
      
      <div className="p-4 flex-1">
        <div className="text-xs font-semibold text-slate-500 mb-4 px-2 uppercase tracking-wider">Dashboards</div>
        <nav className="space-y-2">
          
          <div>
            <Link
              to="/analitico"
              className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                location.pathname === '/analitico' 
                  ? 'bg-indigo-600/20 text-indigo-300 font-medium' 
                  : 'hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">🔬</span>
                <span>Dashboard - JSM</span>
              </div>
            </Link>

          <Link
            to="/historico"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              location.pathname === '/historico' 
                ? 'bg-indigo-600/20 text-indigo-300 font-medium' 
                : 'hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            <span className="text-lg">📚</span>
            Históricos
          </Link>
          </div>

        </nav>
      </div>
      
      <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-lg py-2 transition-all cursor-pointer"
        >
          🚪 Sair
        </button>
        <div className="text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} NOC - Grupo Cednet
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

