import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ReportGenerator from '../components/ReportGenerator';
import EmailModal from '../components/EmailModal';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(...registerables);

const COLORS = ['#6366f1','#a855f7','#ec4899','#f43f5e','#f97316','#eab308','#22c55e','#0ea5e9','#64748b'];

const kpiCard = (title, value, color = 'text-indigo-600') => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-1">
    <p className="text-xs text-gray-400 uppercase font-semibold">{title}</p>
    <div className={`text-4xl font-black ${color}`}>{value}</div>
  </div>
);

const AnalyticView = ({ months = [], onGenerateSuccess }) => {
  const { monthLabel } = useParams();
  const [data,           setData]          = useState(null);
  const [loading,        setLoading]       = useState(false);
  const [error,          setError]         = useState(null);
  const [csvLabel,       setCsvLabel]      = useState(null);
  const [viewMode,       setViewMode]      = useState('executive');
  const [fromCache,      setFromCache]     = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const downloadCSV = () => {
    if (!csvLabel) return;
    const filename = `Relatorio_Analitico_${csvLabel}.csv`;
    const a = document.createElement('a');
    a.href = `/${filename}`;
    a.download = filename;
    a.click();
  };

  const downloadPDF = async () => {
    if (!csvLabel) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('noc_token');
      const res = await fetch(`/api/download-pdf/${csvLabel}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Não autorizado para gerar PDF.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const filename = `Relatorio_Executivo_${csvLabel}.pdf`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Calcula datas da semana passada (segunda a domingo)
  const getLastWeekRange = () => {
    const today = new Date();
    const day = today.getDay();
    const daysToLastMonday = day === 0 ? 13 : day + 6;
    const start = new Date(today);
    start.setDate(today.getDate() - daysToLastMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d) => d.toISOString().split('T')[0];
    return { startDate: fmt(start), endDate: fmt(end), label: 'Semana_Passada' };
  };

  const fetchData = (startDate, endDate, label, force = false) => {
    setLoading(true); setError(null); setData(null); setFromCache(false);
    const token = localStorage.getItem('noc_token');
    fetch(`/api/generate${force ? '?force=true' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ startDate, endDate, label })
    })
      .then(r => r.json())
      .then(r => {
        if (r.success && r.data) {
          setData(r.data);
          setFromCache(!!r.fromCache);
          const resolvedLabel = (r.label || label).replace(/ /g, '_');
          setCsvLabel(resolvedLabel);
        } else {
          setError(r.error || 'Falha.');
        }
      })
      .catch(() => setError('Erro ao conectar.'))
      .finally(() => setLoading(false));
  };

  // Efeito 1: Carrega a semana passada APENAS na primeira renderização (sem monthLabel na URL)
  useEffect(() => {
    if (!monthLabel) {
      const { startDate, endDate, label } = getLastWeekRange();
      fetchData(startDate, endDate, label);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Efeito 2: Quando um histórico específico é selecionado via URL, aguarda a lista carregar
  useEffect(() => {
    if (monthLabel && months.length > 0) {
      const stored = months.find(m => m.label === monthLabel);
      if (stored) fetchData(stored.startDate, stored.endDate, monthLabel);
    }
  }, [monthLabel, months]);

  const handleGenerateSuccess = (result) => {
    if (result?.data) setData(result.data);
    if (result?.label) setCsvLabel(result.label.replace(/ /g,'_'));
    if (onGenerateSuccess) onGenerateSuccess();
  };

  const topN = (obj = {}, n = 5) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);

  const barData = (entries, label = '', horizontal = false) => ({
    labels: entries.map(e => (Array.isArray(e) ? e[0] : e).replace('[System] ','').substring(0, 28)),
    datasets: [{ label, data: entries.map(e => Array.isArray(e) ? e[1] : e), backgroundColor: 'rgba(99,102,241,0.8)', borderRadius: 4 }]
  });

  const barOpts = (horizontal = false) => ({
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: horizontal ? { x: { beginAtZero: true } } : { y: { beginAtZero: true } }
  });

  const pieData = (entries) => ({
    labels: entries.map(e => (Array.isArray(e) ? e[0] : e).replace('[System] ','').substring(0, 22)),
    datasets: [{ data: entries.map(e => Array.isArray(e) ? e[1] : e), backgroundColor: COLORS, borderWidth: 1 }]
  });

  const lineData = (labels, datasets) => ({
    labels,
    datasets: datasets.map((d, i) => ({
      label: d.label, data: d.data,
      borderColor: [COLORS[2], COLORS[5]][i % 2],
      backgroundColor: ['rgba(34,197,94,0.1)', 'rgba(249,115,22,0.1)'][i % 2],
      borderWidth: 2, fill: true, tension: 0.3, pointRadius: 2
    }))
  });

  const lineOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Horas' } } }
  };

  const pctLabel = (met, breached) => {
    const total = met + breached;
    if (!total) return '-';
    return `${Math.round((met/total)*100)}%`;
  };

  const pctVal = (met, breached) => {
    const total = met + breached;
    return total > 0 ? (met / total) * 100 : 0;
  };

  const getTrafficLight = (pct) => {
    if (pct >= 85) return { color: 'text-green-600 bg-green-50 border-green-200', text: '🟢 ÓTIMO', score: 'Dentro do esperado' };
    if (pct >= 70) return { color: 'text-amber-600 bg-amber-50 border-amber-200', text: '🟡 ATENÇÃO', score: 'Abaixo da meta' };
    return { color: 'text-red-600 bg-red-50 border-red-200', text: '🔴 CRÍTICO', score: 'Requer intervenção' };
  };

  const isPdfMode = window.location.search.includes('pdfMode=true');

  return (
    <div className={`flex flex-col gap-4 pb-8 ${isPdfMode ? 'p-10 bg-white' : ''}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              {viewMode === 'executive' ? '👔 Visão Executiva' : '🔬 Visão Analítica'}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">
              {monthLabel ? `Exibindo: ${monthLabel.replace(/_/g,' ')}` : 'Gere um novo relatório ou selecione um histórico.'}
            </p>
          </div>
          
          {/* Toggle de Visão (Esconde no PDF) */}
          {data && !isPdfMode && (
            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 ml-2">
              <button 
                onClick={() => setViewMode('executive')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'executive' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                👔 Executivo
              </button>
              <button 
                onClick={() => setViewMode('analytic')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'analytic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                🔬 Analítico
              </button>
            </div>
          )}
        </div>

        {data && !isPdfMode && (
          <div className="flex gap-2 items-center">
            {fromCache && (
              <span
                title="Dados servidos do cache. Clique em 🔄 para buscar novamente do Jira."
                className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-md font-medium cursor-default"
              >
                📦 Cache
              </span>
            )}
            {fromCache && (
              <button
                onClick={() => {
                  const range = csvLabel
                    ? months.find(m => m.label === csvLabel) || getLastWeekRange()
                    : getLastWeekRange();
                  const { startDate, endDate, label } = range.startDate
                    ? { startDate: range.startDate, endDate: range.endDate, label: range.label }
                    : getLastWeekRange();
                  fetchData(startDate, endDate, label, true);
                }}
                className="text-xs bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-200 px-3 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                title="Forçar nova busca no Jira ignorando cache"
              >
                🔄 Atualizar
              </button>
            )}
            <button onClick={downloadCSV} className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-sm px-4 py-2 rounded-lg border border-emerald-200 transition-colors cursor-pointer mt-1">
              ⬇️ Baixar CSV
            </button>
            <button onClick={downloadPDF} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm px-4 py-2 rounded-lg border border-red-200 transition-colors cursor-pointer mt-1">
              📄 Gerar PDF
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold text-sm px-4 py-2 rounded-lg border border-indigo-200 transition-colors cursor-pointer mt-1"
            >
              ✉️ Enviar por E-mail
            </button>
          </div>
        )}

      </div>

      {!isPdfMode && <ReportGenerator onGenerateSuccess={handleGenerateSuccess} />}

      <EmailModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        csvLabel={csvLabel}
      />

      {loading && (
        <div className="w-full h-56 flex flex-col items-center justify-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent mb-3"></div>
          <div className="font-medium">Calculando relatório via Jira...</div>
          <p className="text-xs text-gray-400 mt-1">Isso pode levar alguns segundos.</p>
        </div>
      )}

      {error && <div className="p-10 text-center text-red-500 bg-white rounded-xl shadow-sm border border-red-100">⚠️ {error}</div>}

      {!loading && !error && !data && (
        <div className="w-full h-56 flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="text-4xl mb-2">📄</div>
          <div className="font-medium">Nenhum dado carregado</div>
          <p className="text-xs mt-1">Preencha os campos acima ou selecione um histórico lateral.</p>
        </div>
      )}

      {!loading && !error && data && (() => {
        const typeEntries = topN(data.volumeByType, 10);
        const causeEntries = [...(data.topIncidents || []), ...(data.topProblems || [])].sort((a,b)=>b[1]-a[1]).slice(0,5);
        const cityEntries = data.topCities || topN(data.byCity, 5);
        const offenderEntries = data.topOffenders || topN(data.slaOffenders, 5);
        const creatorEntries = topN(data.byCreator, 8);
        const { slaSummary = {}, avgResolutionHoursByType = {}, dailyLabels = [], dailyFrAvg = [], dailyResAvg = [], timeline = {} } = data;
        const hasTimeline = timeline && Object.keys(timeline).length > 0;

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── KPIs ── */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {kpiCard('Total de Chamados', data.totalIssues || 0, 'text-indigo-600')}
              {kpiCard('Resolvidos', data.resolvedIssues || 0, 'text-emerald-600')}
              {kpiCard('SLA 1ª Resp. Cumprido', pctLabel(slaSummary.frMet||0, slaSummary.frBreached||0), 'text-sky-600')}
              {kpiCard('SLA Resolução Cumprido', pctLabel(slaSummary.resMet||0, slaSummary.resBreached||0), 'text-violet-600')}
            </div>

            {viewMode === 'executive' ? (
              <>
                {/* ── VISÃO EXECUTIVA ── */}
                {/* 🚦 Farol de Saúde do SLA */}
                {(() => {
                  const frPct = pctVal(slaSummary.frMet||0, slaSummary.frBreached||0);
                  const resPct = pctVal(slaSummary.resMet||0, slaSummary.resBreached||0);
                  const avgPct = (frPct + resPct) / 2;
                  const light = getTrafficLight(avgPct);
                  return (
                    <div className={`lg:col-span-2 p-6 rounded-xl border ${light.color} flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm`}>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider opacity-75">Status Geral do Período</span>
                        <h3 className="text-3xl font-black mt-1 flex items-center gap-2">{light.text}</h3>
                        <p className="text-sm mt-1">{light.score} (SLA Médio: {Math.round(avgPct)}%)</p>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-center bg-white bg-opacity-60 px-4 py-2 rounded-lg backdrop-blur-sm border">
                          <p className="text-xs text-gray-500">1ª Resp.</p>
                          <p className={`text-xl font-bold ${frPct >= 85 ? 'text-green-600' : frPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(frPct)}%</p>
                        </div>
                        <div className="text-center bg-white bg-opacity-60 px-4 py-2 rounded-lg backdrop-blur-sm border">
                          <p className="text-xs text-gray-500">Resolução</p>
                          <p className={`text-xl font-bold ${resPct >= 85 ? 'text-green-600' : resPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(resPct)}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Gráfico Simplificado de Volume */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 mb-3">Volume por Categoria</h3>
                  <div className="h-56">
                    {typeEntries.length > 0 ? <Bar data={barData(typeEntries, 'Chamados')} options={barOpts(true)} /> : <p className="text-sm text-gray-400">Sem dados.</p>}
                  </div>
                </div>

                {/* MTTR Simplificado */}
                {hasTimeline && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-3">MTTR — Ciclo de Vida (h)</h3>
                    <div className="h-56">
                      <Bar
                        data={{
                          labels: ['Incidente', 'Mudança', 'Problema'],
                          datasets: [
                            { label: 'Triage', data: [timeline.incident?.mttrResponse||0, timeline.change?.mttrResponse||0, timeline.problem?.mttrResponse||0], backgroundColor: '#6366f1', borderRadius: 3 },
                            { label: 'Reparo', data: [timeline.incident?.mttrRepair||0, timeline.change?.mttrRepair||0, timeline.problem?.mttrRepair||0], backgroundColor: '#22c55e', borderRadius: 3 },
                          ]
                        }}
                        options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, title: { display: true, text: 'Horas' } }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' } } }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* ── VISÃO ANALÍTICA (O que já tínhamos) ── */}
                {/* ── Volume por Categoria ── */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 mb-3">Volume por Categoria</h3>
                  <div className="h-52">
                    {typeEntries.length > 0 ? <Bar data={barData(typeEntries, 'Chamados')} options={barOpts(true)} /> : <p className="text-sm text-gray-400">Sem dados.</p>}
                  </div>
                </div>

                {/* ── SLA Detalhado ── */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 mb-4">Resumo de SLA</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['1ª Resp. OK', slaSummary.frMet||0, 'bg-green-50 text-green-600'],
                      ['1ª Resp. Violada', slaSummary.frBreached||0, 'bg-red-50 text-red-500'],
                      ['Resolução OK', slaSummary.resMet||0, 'bg-green-50 text-green-600'],
                      ['Resolução Violada', slaSummary.resBreached||0, 'bg-red-50 text-red-500'],
                    ].map(([label, val, cls], i) => (
                      <div key={i} className={`${cls} rounded-xl p-3 text-center`}>
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        <p className="text-2xl font-black">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}


            {viewMode === 'analytic' && (
              <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 mb-3">Top 5 Causas / Motivadores</h3>
                  <div className="space-y-2.5">
                    {causeEntries.length > 0 ? causeEntries.map(([lbl, cnt], i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 truncate mr-2 flex-1">• {lbl}</span>
                        <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full text-xs">{cnt}</span>
                      </div>
                    )) : <p className="text-sm text-gray-400">Sem incidentes/problemas registrados.</p>}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 mb-3">Mapeamento Geográfico (Top 5)</h3>
                  <div className="space-y-2.5">
                    {cityEntries.length > 0 ? cityEntries.map(([city, cnt], i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 truncate mr-2 flex-1">📍 {city}</span>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full text-xs">{cnt}</span>
                      </div>
                    )) : <p className="text-sm text-gray-400">Sem dados geográficos.</p>}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="font-bold text-gray-700 mb-3">Top 5 Ofensores de SLA</h3>
                  <div className="space-y-2.5">
                    {offenderEntries.length > 0 ? offenderEntries.map(([lbl, cnt], i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 truncate mr-2 flex-1">⚠️ {lbl}</span>
                        <span className="font-bold text-red-500 bg-red-50 px-2.5 py-0.5 rounded-full text-xs">{cnt}</span>
                      </div>
                    )) : <p className="text-sm text-gray-400">Nenhum SLA violado.</p>}
                  </div>
                </div>
              </div>
            )}

            {viewMode === 'analytic' && (
              <>
                {/* ── Tempo Médio de Resolução + Top Criadores (row) ── */}
                <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.keys(avgResolutionHoursByType).length > 0 ? (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                      <h3 className="font-bold text-gray-700 mb-3">Tempo Médio de Resolução (h)</h3>
                      <div className="h-52">
                        <Bar data={barData(Object.entries(avgResolutionHoursByType), 'Horas')} options={barOpts(true)} />
                      </div>
                    </div>
                  ) : <div />}
                  {creatorEntries.length > 0 ? (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                      <h3 className="font-bold text-gray-700 mb-3">Top Criadores</h3>
                      <div className="h-52">
                        <Pie data={pieData(creatorEntries)} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} />
                      </div>
                    </div>
                  ) : <div />}
                </div>

                {/* ── MTTR Ciclo de Vida (Timeline) ── HORIZONTAL */}
                {hasTimeline && (
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-3">MTTR — Ciclo de Vida por Tipo (h)</h3>
                    <div className="h-52">
                      <Bar
                        data={{
                          labels: ['Incidente', 'Mudança', 'Problema'],
                          datasets: [
                            { label: 'Triage / Resposta', data: [timeline.incident?.mttrResponse||0, timeline.change?.mttrResponse||0, timeline.problem?.mttrResponse||0], backgroundColor: '#6366f1', borderRadius: 3 },
                            { label: 'Reparo', data: [timeline.incident?.mttrRepair||0, timeline.change?.mttrRepair||0, timeline.problem?.mttrRepair||0], backgroundColor: '#22c55e', borderRadius: 3 },
                            { label: 'Espera', data: [timeline.incident?.mttrWaiting||0, timeline.change?.mttrWaiting||0, timeline.problem?.mttrWaiting||0], backgroundColor: '#8b5cf6', borderRadius: 3 },
                          ]
                        }}
                        options={{ indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, title: { display: true, text: 'Horas' } }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' } } }}
                      />
                    </div>
                  </div>
                )}

                {/* ── Tendência Diária de SLA ── */}
                {dailyLabels.length > 0 && (
                  <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-3">Tendência Diária de SLA (Média por Dia)</h3>
                    <div className="h-64">
                      <Line
                        data={lineData(dailyLabels, [
                          { label: '1ª Resposta (Horas)', data: dailyFrAvg },
                          { label: 'Resolução (Horas)', data: dailyResAvg }
                        ])}
                        options={lineOpts}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default AnalyticView;
