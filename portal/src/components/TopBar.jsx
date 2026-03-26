import React from 'react';

const TopBar = () => {
  const date = new Date().toLocaleDateString('pt-BR');
  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shadow-sm z-10">
      <div className="flex items-center gap-4">
        <div className="text-sm font-semibold px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
          React SPA Mode
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-500 font-medium">
        <span>Acessado em: {date}</span>
      </div>
    </header>
  );
};

export default TopBar;
