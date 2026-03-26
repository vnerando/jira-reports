import React, { useState } from 'react';

const PRESETS = [
  { label: 'Semana Passada', type: 'semana' },
  { label: 'Mês Passado',   type: 'last_month' },
  { label: 'Bimestre',      type: 'bimestre' },
  { label: 'Trimestre',     type: 'trimestre' },
  { label: 'Semestre',      type: 'semestre' },
  { label: 'Ano Corrente',  type: 'ano_corrente' },
];

const ReportGenerator = ({ onGenerateSuccess }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [label, setLabel]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState(null);
  // 'semana' = default because AnalyticView auto-loads it on mount
  const [activePreset, setActivePreset] = useState('semana');

  const calcPreset = (type) => {
    const today = new Date();
    const fmt = (d) => d.toISOString().split('T')[0];
    let start, end, nameSuffix;

    if (type === 'last_month') {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end   = new Date(today.getFullYear(), today.getMonth(), 0);
      nameSuffix = start.toLocaleString('pt-BR', { month: 'long' }) + '_' + start.getFullYear();
      nameSuffix = nameSuffix.charAt(0).toUpperCase() + nameSuffix.slice(1);
    } else if (type === 'semana') {
      const day = today.getDay();
      const daysToLastMonday = day === 0 ? 13 : day + 6;
      start = new Date(today); start.setDate(today.getDate() - daysToLastMonday);
      end   = new Date(start); end.setDate(start.getDate() + 6);
      nameSuffix = 'Semana_Passada';
    } else if (type === 'bimestre') {
      start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      end   = new Date(); nameSuffix = 'Bimestre';
    } else if (type === 'trimestre') {
      start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      end   = new Date(); nameSuffix = 'Trimestre';
    } else if (type === 'semestre') {
      start = new Date(today.getFullYear(), today.getMonth() - 6, 1);
      end   = new Date(); nameSuffix = 'Semestre';
    } else if (type === 'ano_corrente') {
      start = new Date(today.getFullYear(), 0, 1);
      end   = new Date(); nameSuffix = 'Ano_Corrente_' + today.getFullYear();
    }
    return { startDate: fmt(start), endDate: fmt(end), label: nameSuffix };
  };

  const callGenerate = async (s, e, l) => {
    setLoading(true); setMessage(null);
    try {
      const token = localStorage.getItem('noc_token');
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ startDate: s, endDate: e, label: l.replace(/ /g, '_') })
      });
      const result = await response.json();
      if (result.success) {
        if (onGenerateSuccess) onGenerateSuccess(result);
        setMessage({ type: 'success', text: `✅ Relatório "${l.replace(/_/g,' ')}" carregado!` });
      } else {
        setMessage({ type: 'error', text: `Erro: ${result.error || 'Falha ao gerar.'}` });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = (type) => {
    const { startDate: s, endDate: e, label: l } = calcPreset(type);
    setStartDate(s); setEndDate(e); setLabel(l);
    setActivePreset(type);
    // Dispara a geração automaticamente
    callGenerate(s, e, l);
  };

  // When user types manually in any field, mark as custom
  const handleManualChange = (setter) => (ev) => {
    setter(ev.target.value);
    setActivePreset('custom');
  };

  const handleGenerate = async (ev) => {
    ev.preventDefault();
    if (!startDate || !endDate || !label) {
      setMessage({ type: 'error', text: 'Preencha todos os campos antes de gerar.' });
      return;
    }
    await callGenerate(startDate, endDate, label);
  };

  const btnClass = (type) => {
    const isActive = activePreset === type;
    if (isActive) return 'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors cursor-pointer bg-indigo-600 text-white border-indigo-600 shadow-sm';
    return 'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors cursor-pointer bg-slate-100 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200';
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-4 transition-all duration-300">
      <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
        ⚡ Gerar Novo Relatório Sob Demanda
      </h3>

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-400 self-center mr-1 uppercase">Atalhos:</span>
        {PRESETS.map(p => (
          <button key={p.type} type="button" onClick={() => applyPreset(p.type)} className={btnClass(p.type)}>
            {p.label}
          </button>
        ))}
        {activePreset === 'custom' && (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200">
            🎯 Personalizado
          </span>
        )}
      </div>

      <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Data Início</label>
          <input
            type="date" value={startDate}
            onChange={handleManualChange(setStartDate)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Data Fim</label>
          <input
            type="date" value={endDate}
            onChange={handleManualChange(setEndDate)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Nome do Relatório</label>
          <input
            type="text" placeholder="Ex: Q1_2026" value={label}
            onChange={handleManualChange(setLabel)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold text-sm rounded-lg px-4 py-2.5 shadow-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? 'Gerando...' : 'Iniciar Geração'}
        </button>
      </form>

      {message && (
        <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default ReportGenerator;
