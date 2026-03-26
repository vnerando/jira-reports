import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const [user, setUser]       = useState('');
  const [pass, setPass]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass })
      });
      const data = await res.json();

      if (data.success && data.token) {
        localStorage.setItem('noc_token', data.token);
        navigate('/analitico');
      } else {
        setError(data.error || 'Credenciais inválidas.');
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden">

      {/* Glow de fundo decorativo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/40 mb-4">
            <span className="text-3xl">📡</span>
          </div>
          <h1 className="text-2xl font-bold text-white">NOC - Grupo Cednet</h1>
          <p className="text-slate-400 text-sm mt-1">Dashboard Jira Service Management</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6">Acesso ao Portal</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Usuário */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Usuário
              </label>
              <input
                type="text"
                autoComplete="username"
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="Digite seu usuário"
                disabled={loading}
                required
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Senha
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                required
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            {/* Erro */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading || !user || !pass}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Autenticando...
                </>
              ) : 'Entrar →'}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © {new Date().getFullYear()} NOC - Grupo Cednet · Acesso restrito
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
