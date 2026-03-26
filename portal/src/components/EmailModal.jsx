import { useState } from 'react';

/**
 * Modal para enviar o relatório por e-mail.
 * Props:
 *   - isOpen: boolean
 *   - onClose: () => void
 *   - csvLabel: string  (label do relatório atual)
 */
const EmailModal = ({ isOpen, onClose, csvLabel }) => {
  const [email, setEmail]     = useState('');
  const [status, setStatus]   = useState('idle'); // idle | sending | success | error
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSend = async (format) => {
    if (!email.trim()) { setMessage('Informe um endereço de e-mail.'); return; }
    if (!csvLabel)     { setMessage('Nenhum relatório carregado para enviar.'); return; }

    setStatus('sending');
    setMessage('');

    try {
      const token = localStorage.getItem('noc_token');
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: email.trim(), format, label: csvLabel })
      });
      const data = await res.json();

      if (data.success) {
        setStatus('success');
        setMessage(`✅ ${data.message}`);
      } else {
        setStatus('error');
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setStatus('error');
      setMessage('❌ Erro ao conectar com o servidor.');
    }
  };

  const handleClose = () => {
    setEmail('');
    setStatus('idle');
    setMessage('');
    onClose();
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      {/* Modal */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">✉️ Enviar por E-mail</h2>
            <p className="text-indigo-200 text-xs mt-0.5">
              Relatório: <span className="font-semibold">{(csvLabel || '').replace(/_/g, ' ')}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-white/70 hover:text-white text-xl leading-none transition-colors cursor-pointer"
          >✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-5">
          {/* E-mail input */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Destinatário
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setMessage(''); }}
              placeholder="exemplo@empresa.com.br"
              disabled={status === 'sending' || status === 'success'}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow disabled:opacity-50"
            />
          </div>

          {/* Feedback message */}
          {message && (
            <div className={`text-sm px-4 py-2.5 rounded-lg ${
              status === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              status === 'error'   ? 'bg-red-50 text-red-600 border border-red-200' :
                                    'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {message}
            </div>
          )}

          {/* Format buttons */}
          {status !== 'success' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Escolha o formato
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSend('csv')}
                    disabled={status === 'sending'}
                    className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 text-emerald-700 font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-2xl">📊</span>
                    <span>CSV</span>
                    <span className="text-xs font-normal text-emerald-500">Dados detalhados</span>
                  </button>

                  <button
                    onClick={() => handleSend('pdf')}
                    disabled={status === 'sending'}
                    className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-400 text-red-600 font-semibold text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="text-2xl">📄</span>
                    <span>PDF</span>
                    <span className="text-xs font-normal text-red-400">Relatório executivo</span>
                  </button>
                </div>
              </div>

              {status === 'sending' && (
                <div className="flex items-center justify-center gap-3 text-indigo-600 text-sm font-medium">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-400 border-t-transparent"></div>
                  Preparando e enviando...
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <button
            onClick={handleClose}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer py-1"
          >
            {status === 'success' ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailModal;
