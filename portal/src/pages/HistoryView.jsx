import React from 'react';
import { useNavigate } from 'react-router-dom';

const HistoryView = ({ months = [] }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          📚 Histórico de Relatórios
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Lista de todos os relatórios analíticos gerados no workspace.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {months.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-2">📁</div>
            <div>Nenhum relatório histórico encontrado.</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {months.map((m) => (
              <div 
                key={m.label} 
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 text-lg">
                    📊
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {m.label.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-xs text-gray-400">
                      Período: {m.startDate} até {m.endDate}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => navigate(`/analitico/${m.label}`)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  Visualizar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
