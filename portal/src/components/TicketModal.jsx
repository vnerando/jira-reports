import React, { useEffect } from 'react';

const JIRA_BASE_URL = 'https://grupocednet.atlassian.net/servicedesk/customer/portal/3';

const TicketModal = ({ isOpen, onClose, title, tickets = [] }) => {
  // Fechar com ESC
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Overlay escurecido */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Painel */}
      <div className="relative z-10 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 w-full max-w-lg max-h-[80vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug line-clamp-2">
              🔍 {title}
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              {tickets.length} {tickets.length === 1 ? 'chamado encontrado' : 'chamados encontrados'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 flex items-center justify-center transition-colors text-sm font-bold cursor-pointer"
            title="Fechar (ESC)"
          >
            ✕
          </button>
        </div>

        {/* Lista de tickets */}
        <div className="overflow-y-auto flex-1 p-4">
          {tickets.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm italic">
              Nenhum ticket disponível para este item.
            </p>
          ) : typeof tickets[0] === 'string' ? (
            /* Modo simples: lista de IDs */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tickets.map((key) => (
                <a
                  key={key}
                  href={`${JIRA_BASE_URL}/${key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-lg px-3 py-2 text-xs font-semibold transition-colors group"
                >
                  <span className="opacity-60 group-hover:opacity-100 transition-opacity">🔗</span>
                  <span className="truncate">{key}</span>
                </a>
              ))}
            </div>
          ) : (
            /* Modo rico: objetos {key, summary, cause} — ex: cancelamentos */
            <div className="space-y-3">
              {tickets.map((item) => (
                <a
                  key={item.key}
                  href={`${JIRA_BASE_URL}/${item.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 bg-gray-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-xl px-4 py-3 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs group-hover:underline">{item.key}</span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">🔗 Abrir no Jira</span>
                  </div>
                  {item.summary && (
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">{item.summary}</p>
                  )}
                  {item.cause && (
                    <p className="text-[11px] text-gray-500 dark:text-slate-400 line-clamp-2 leading-snug">💬 {item.cause}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[10px] text-gray-400 dark:text-slate-600">
            Clique em qualquer ticket para abrir no Jira
          </p>
          <button
            onClick={onClose}
            className="text-xs bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 px-4 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketModal;
