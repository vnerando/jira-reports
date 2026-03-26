import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import AnalyticView from './pages/AnalyticView';
import HistoryView from './pages/HistoryView';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';

// Helper: retorna o token ou null
export const getToken = () => localStorage.getItem('noc_token');

// Helper: monta headers com Authorization (usado no AnalyticView e EmailModal)
export const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
});

function App() {
  const [months, setMonths] = useState([]);

  const loadMonths = () => {
    const token = getToken();
    if (!token) return;
    fetch('/api/history', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setMonths(Array.isArray(data) ? data : []))
      .catch(err => console.error('Erro ao carregar histórico', err));
  };

  useEffect(() => { loadMonths(); }, []);

  const isPdfMode = window.location.search.includes('pdfMode=true');

  return (
    <BrowserRouter>
      {isPdfMode ? (
        <main className="p-0 bg-white min-h-screen">
          <Routes>
            <Route path="/" element={<Navigate to="/analitico" replace />} />
            <Route path="/analitico" element={<AnalyticView months={months} onGenerateSuccess={loadMonths} />} />
            <Route path="/analitico/:monthLabel" element={<AnalyticView months={months} onGenerateSuccess={loadMonths} />} />
          </Routes>
        </main>
      ) : (
        <Routes>
          {/* Rota pública */}
          <Route path="/login" element={<LoginPage />} />

          {/* Rotas protegidas */}
          <Route path="/*" element={
            <ProtectedRoute>
              <div className="flex h-screen bg-gray-50 font-sans text-gray-800">
                <Sidebar className="w-64 flex-none" months={months} />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <TopBar />
                  <main className="flex-1 overflow-y-auto p-4 bg-slate-50">
                    <Routes>
                      <Route path="/" element={<Navigate to="/analitico" replace />} />
                      <Route path="/analitico" element={<AnalyticView months={months} onGenerateSuccess={loadMonths} />} />
                      <Route path="/analitico/:monthLabel" element={<AnalyticView months={months} onGenerateSuccess={loadMonths} />} />
                      <Route path="/historico" element={<HistoryView months={months} />} />
                    </Routes>
                  </main>
                </div>
              </div>
            </ProtectedRoute>
          } />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
