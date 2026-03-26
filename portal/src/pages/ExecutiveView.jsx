import React from 'react';

const ExecutiveView = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📊 Visão Executiva
          </h2>
          <p className="text-gray-500 text-sm mt-1">Resumo de alto nível e SLAs da operação de JSM.</p>
        </div>
      </div>
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
          <iframe 
            src="/executive_reports/executive_dashboard.html" 
            className="w-full h-full border-0 absolute top-0 left-0"
            title="Dashboard Executivo"
          />
      </div>
    </div>
  );
};

export default ExecutiveView;
