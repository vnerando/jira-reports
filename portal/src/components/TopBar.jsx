import React from 'react';

const TopBar = ({ isDark, toggleTheme }) => {
  const date = new Date().toLocaleDateString('pt-BR');
  return (
    <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 h-16 flex items-center justify-between px-6 shadow-sm z-10 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold px-3 py-1 bg-indigo-50 dark:bg-slate-700/50 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-slate-600">
          React SPA Mode
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
        <span>Acessado em: {date}</span>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition"
          title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </div>
    </header>
  );
};

export default TopBar;
