import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Plus, 
  LogOut, 
  Users, 
  FileText, 
  ExternalLink, 
  Sparkles,
  Loader2,
  ChevronLeft,
  Save,
  Eye
} from 'lucide-react';
import { User, LandingPage, LandingPageContent, GeneratorParams } from './types';

// --- API CLIENT ---

const api = {
  getToken: () => localStorage.getItem('pg_token'),
  setToken: (token: string) => localStorage.setItem('pg_token', token),
  removeToken: () => localStorage.removeItem('pg_token'),
  
  headers: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('pg_token')}`
  }),

  async login(email: string, password: string): Promise<{ accessToken: string; user: User }> {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async register(email: string, password: string) {
    const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getPages(): Promise<LandingPage[]> {
    const res = await fetch('/pages', { headers: api.headers() });
    if (!res.ok) throw new Error('Falha ao buscar páginas');
    return res.json();
  },

  async generatePage(params: GeneratorParams): Promise<LandingPage> {
    const res = await fetch('/pages/generate', {
      method: 'POST',
      headers: api.headers(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Falha na geração');
    return res.json();
  },

  async updatePage(id: number, content: LandingPageContent): Promise<LandingPage> {
      const res = await fetch(`/pages/${id}`, {
          method: 'PUT',
          headers: api.headers(),
          body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error('Falha ao salvar');
      return res.json();
  },

  async getAdminStats() {
    const res = await fetch('/admin/stats', { headers: api.headers() });
    if (!res.ok) throw new Error('Falha ao buscar estatísticas');
    return res.json();
  }
};

// --- COMPONENTS ---

const LandingPageRenderer: React.FC<{ content: LandingPageContent; mode?: 'preview' | 'live' }> = ({ content, mode = 'preview' }) => {
  const { colors } = content;
  
  return (
    <div className="w-full min-h-screen font-sans" style={{ backgroundColor: colors.background, color: colors.text }}>
      {/* Hero Section */}
      <header className="py-20 px-6 md:px-12 text-center" style={{ backgroundColor: `${colors.primary}10` }}>
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight" style={{ color: colors.primary }}>
            {content.headline}
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-80 max-w-2xl mx-auto">
            {content.subheadline}
          </p>
          <button 
            className="px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-transform hover:scale-105"
            style={{ backgroundColor: colors.secondary, color: '#fff' }}
          >
            {content.ctaText}
          </button>
        </div>
      </header>

      {/* Benefits Section */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          {content.benefits.map((benefit, idx) => (
            <div key={idx} className="p-6 rounded-xl border border-gray-100 shadow-sm bg-white/50 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 text-white font-bold text-xl" style={{ backgroundColor: colors.primary }}>
                {idx + 1}
              </div>
              <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
              <p className="opacity-70">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-6" style={{ backgroundColor: `${colors.secondary}05` }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">O que dizem nossos clientes</h2>
          <div className="grid md:grid-cols-1 gap-6">
            {content.testimonials.map((t, idx) => (
              <div key={idx} className="bg-white p-8 rounded-2xl shadow-md">
                <p className="text-lg italic mb-6">"{t.quote}"</p>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                    {t.name[0]}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">{t.name}</p>
                    <p className="text-xs opacity-60">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 text-center text-sm opacity-50 border-t border-gray-200">
        Gerado por PageGenius IA
      </footer>
    </div>
  );
};

// --- MAIN APPLICATION ---

interface AdminStatsState {
    totalUsers: number;
    totalPages: number;
    users: User[];
}

export default function App() {
  // Navigation State
  const [view, setView] = useState<'login' | 'register' | 'dashboard' | 'admin' | 'create' | 'editor'>('login');
  
  // Data State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<LandingPage | null>(null);
  const [authError, setAuthError] = useState('');
  
  // Admin State
  const [adminStats, setAdminStats] = useState<AdminStatsState>({ totalUsers: 0, totalPages: 0, users: [] });

  // Generator Form State
  const [genParams, setGenParams] = useState<GeneratorParams>({
    companyName: '',
    niche: '',
    targetAudience: '',
    goal: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // --- Effects ---
  useEffect(() => {
    const storedUser = localStorage.getItem('pg_user');
    const token = api.getToken();
    if (storedUser && token) {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);
      setView(user.role === 'admin' ? 'admin' : 'dashboard');
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    if (view === 'dashboard') {
      api.getPages().then(setPages).catch(console.error);
    } else if (view === 'admin' && currentUser.role === 'admin') {
      api.getAdminStats().then(setAdminStats).catch(console.error);
    }
  }, [currentUser, view]);

  // --- Handlers ---

  const handleAuth = async (e: React.FormEvent, type: 'login' | 'register') => {
    e.preventDefault();
    setAuthError('');
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;

    try {
        let data;
        if (type === 'register') {
            await api.register(email, password);
            data = await api.login(email, password);
        } else {
            data = await api.login(email, password);
        }

        api.setToken(data.accessToken);
        localStorage.setItem('pg_user', JSON.stringify(data.user));
        setCurrentUser(data.user);
        setView(data.user.role === 'admin' ? 'admin' : 'dashboard');
    } catch (err: any) {
        setAuthError(err.message || "Erro na autenticação");
    }
  };

  const handleLogout = () => {
    api.removeToken();
    localStorage.removeItem('pg_user');
    setCurrentUser(null);
    setView('login');
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsGenerating(true);

    try {
      const newPage = await api.generatePage(genParams);
      setSelectedPage(newPage);
      setView('editor');
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar página. Tente novamente mais tarde.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    if(selectedPage) {
        try {
            const updated = await api.updatePage(selectedPage.id, selectedPage.content);
            setSelectedPage(updated);
            alert("Alterações salvas com sucesso!");
        } catch(e) {
            alert("Erro ao salvar.");
        }
    }
  };

  // --- Views ---

  if (view === 'login' || view === 'register') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
              PageGenius IA
            </h1>
            <p className="text-gray-400 mt-2">
                {view === 'login' ? 'Faça login para continuar' : 'Crie sua conta gratuitamente'}
            </p>
          </div>
          
          {authError && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg mb-4 text-sm text-center">
                  {authError}
              </div>
          )}

          <form onSubmit={(e) => handleAuth(e, view)} className="space-y-6">
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">Email</label>
              <input type="email" name="email" required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="user@example.com" />
            </div>
            <div>
              <label className="block text-gray-400 text-sm font-medium mb-2">Senha</label>
              <input type="password" name="password" required className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors">
              {view === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
            <div className="text-center text-xs text-gray-500 mt-4">
              {view === 'login' ? (
                  <>Não tem uma conta? <button type="button" onClick={() => setView('register')} className="text-indigo-400 hover:underline">Cadastre-se</button></>
              ) : (
                  <>Já tem conta? <button type="button" onClick={() => setView('login')} className="text-indigo-400 hover:underline">Faça Login</button></>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  const Sidebar = () => (
    <div className="w-64 bg-gray-800 border-r border-gray-700 hidden md:flex flex-col h-screen fixed left-0 top-0 z-10">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="text-indigo-400" />
          PageGenius
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {currentUser?.role === 'admin' ? (
          <button onClick={() => setView('admin')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'admin' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
            <LayoutDashboard size={20} /> Painel Admin
          </button>
        ) : (
          <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
            <LayoutDashboard size={20} /> Minhas Páginas
          </button>
        )}
        
        <button onClick={() => setView('create')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'create' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
            <Plus size={20} /> Nova Página
        </button>
      </nav>
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 text-gray-400 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-200 font-bold">
             {currentUser?.email[0].toUpperCase()}
          </div>
          <div className="text-sm truncate w-32">{currentUser?.email}</div>
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm">
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );

  // --- ADMIN VIEW ---
  if (view === 'admin') {
    return (
      <div className="bg-gray-900 min-h-screen pl-0 md:pl-64 text-white">
        <Sidebar />
        <main className="p-8">
          <h2 className="text-3xl font-bold mb-8">Painel Administrativo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400">Total Usuários</h3>
                <Users className="text-indigo-400" />
              </div>
              <p className="text-3xl font-bold">{adminStats.totalUsers}</p>
            </div>
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-400">Páginas Geradas</h3>
                <FileText className="text-cyan-400" />
              </div>
              <p className="text-3xl font-bold">{adminStats.totalPages}</p>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-700">
              <h3 className="font-bold">Usuários Cadastrados (Últimos 50)</h3>
            </div>
            <div className="p-6 text-gray-400 text-center">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                   <thead>
                     <tr className="border-b border-gray-700 text-gray-500">
                       <th className="pb-3">ID</th>
                       <th className="pb-3">Email</th>
                       <th className="pb-3">Cargo</th>
                       <th className="pb-3">Criado em</th>
                     </tr>
                   </thead>
                   <tbody>
                      {Array.isArray(adminStats.users) && adminStats.users.map((u: User) => (
                          <tr key={u.id} className="border-b border-gray-700/50">
                            <td className="py-3">#{u.id}</td>
                            <td className="py-3 text-white">{u.email}</td>
                            <td className="py-3">
                                <span className={`px-2 py-1 rounded text-xs ${u.role === 'admin' ? 'bg-purple-900 text-purple-300' : 'bg-gray-700 text-gray-300'}`}>
                                    {u.role}
                                </span>
                            </td>
                            {/* @ts-ignore */}
                            <td className="py-3">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                          </tr>
                      ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- USER DASHBOARD ---
  if (view === 'dashboard') {
    return (
      <div className="bg-gray-900 min-h-screen pl-0 md:pl-64 text-white">
        <Sidebar />
        <main className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">Minhas Landing Pages</h2>
            <button onClick={() => setView('create')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors">
              <Plus size={20} /> Criar Nova
            </button>
          </div>

          {pages.length === 0 ? (
            <div className="text-center py-20 bg-gray-800/50 rounded-2xl border border-dashed border-gray-700">
              <Sparkles className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-300 mb-2">Nenhuma página criada ainda</h3>
              <p className="text-gray-500 mb-6">Use nossa IA para gerar sua primeira página de alta conversão.</p>
              <button onClick={() => setView('create')} className="text-indigo-400 hover:text-indigo-300 font-medium">Começar a Gerar &rarr;</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pages.map(page => (
                <div key={page.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-indigo-500/50 transition-colors group">
                  <div className="h-32 bg-gray-700 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-purple-900/20"></div>
                    <FileText className="text-gray-600 w-12 h-12" />
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg mb-1">{page.title}</h3>
                    <p className="text-xs text-gray-500 mb-4">/{page.slug}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setSelectedPage(page); setView('editor'); }}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-sm transition-colors"
                      >
                        Editar
                      </button>
                      <button className="px-3 bg-gray-700 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors">
                        <ExternalLink size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // --- CREATE GENERATOR ---
  if (view === 'create') {
    return (
      <div className="bg-gray-900 min-h-screen pl-0 md:pl-64 text-white">
        <Sidebar />
        <main className="p-8 max-w-4xl mx-auto">
          <button onClick={() => setView('dashboard')} className="flex items-center text-gray-400 hover:text-white mb-6">
            <ChevronLeft size={20} className="mr-1" /> Voltar ao Dashboard
          </button>
          
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 shadow-xl relative overflow-hidden">
            {isGenerating && (
              <div className="absolute inset-0 bg-gray-900/90 z-50 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                <h3 className="text-2xl font-bold animate-pulse">Consultando a IA...</h3>
                <p className="text-gray-400 mt-2">Escrevendo textos, criando layout e escolhendo cores.</p>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-3xl font-bold mb-2">Criar Nova Landing Page</h2>
              <p className="text-gray-400">Descreva seu negócio e a PageGenius fará o resto.</p>
            </div>

            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-300 font-medium mb-2">Nome da Empresa/Produto</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: FitLife Pro"
                    value={genParams.companyName}
                    onChange={(e) => setGenParams({...genParams, companyName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-medium mb-2">Nicho / Indústria</label>
                  <input 
                    type="text" 
                    required
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ex: Coaching de Fitness"
                    value={genParams.niche}
                    onChange={(e) => setGenParams({...genParams, niche: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 font-medium mb-2">Público Alvo</label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ex: Profissionais ocupados que querem perder peso"
                  value={genParams.targetAudience}
                  onChange={(e) => setGenParams({...genParams, targetAudience: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">Objetivo Principal</label>
                <textarea 
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                  placeholder="Ex: Fazer com que o usuário agende uma consultoria gratuita."
                  value={genParams.goal}
                  onChange={(e) => setGenParams({...genParams, goal: e.target.value})}
                ></textarea>
              </div>

              <div className="pt-4 border-t border-gray-700 flex justify-end">
                <button type="submit" className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform hover:-translate-y-1 transition-all flex items-center gap-2">
                  <Sparkles size={20} /> Gerar Mágica
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // --- EDITOR VIEW ---
  if (view === 'editor' && selectedPage) {
    return (
      <div className="h-screen flex flex-col">
        {/* Editor Toolbar */}
        <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center text-white">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('dashboard')} className="text-gray-400 hover:text-white">
              <ChevronLeft />
            </button>
            <div>
              <h3 className="font-bold">{selectedPage.title}</h3>
              <p className="text-xs text-gray-500">Modo de Edição</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={handleSaveEdit} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm">
               <Save size={16} /> Salvar
             </button>
             <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm text-gray-300">
               <ExternalLink size={16} /> Publicar
             </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Editor Sidebar */}
          <aside className="w-80 bg-gray-900 border-r border-gray-700 overflow-y-auto p-6 hidden md:block">
            <h4 className="text-gray-400 uppercase text-xs font-bold tracking-wider mb-6">Editor de Conteúdo</h4>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Título Principal (H1)</label>
                <textarea 
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm p-3 rounded"
                  rows={3}
                  value={selectedPage.content.headline}
                  onChange={(e) => setSelectedPage({
                    ...selectedPage, 
                    content: { ...selectedPage.content, headline: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Subtítulo (H2)</label>
                <textarea 
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm p-3 rounded"
                  rows={3}
                  value={selectedPage.content.subheadline}
                  onChange={(e) => setSelectedPage({
                    ...selectedPage, 
                    content: { ...selectedPage.content, subheadline: e.target.value }
                  })}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Botão de Ação (CTA)</label>
                <input 
                  className="w-full bg-gray-800 border border-gray-700 text-white text-sm p-3 rounded"
                  value={selectedPage.content.ctaText}
                  onChange={(e) => setSelectedPage({
                    ...selectedPage, 
                    content: { ...selectedPage.content, ctaText: e.target.value }
                  })}
                />
              </div>
              
              <div className="border-t border-gray-700 pt-4">
                 <h5 className="text-xs text-indigo-400 font-bold mb-2">Cores</h5>
                 <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-gray-500">Primária</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={selectedPage.content.colors.primary} 
                                   onChange={(e) => setSelectedPage({
                                    ...selectedPage, 
                                    content: { ...selectedPage.content, colors: { ...selectedPage.content.colors, primary: e.target.value } }
                                  })}
                                   className="w-6 h-6 rounded cursor-pointer bg-transparent" />
                            <span className="text-xs text-gray-400">{selectedPage.content.colors.primary}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-gray-500">Secundária</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input type="color" value={selectedPage.content.colors.secondary} 
                                   onChange={(e) => setSelectedPage({
                                    ...selectedPage, 
                                    content: { ...selectedPage.content, colors: { ...selectedPage.content.colors, secondary: e.target.value } }
                                  })}
                                   className="w-6 h-6 rounded cursor-pointer bg-transparent" />
                            <span className="text-xs text-gray-400">{selectedPage.content.colors.secondary}</span>
                        </div>
                    </div>
                 </div>
              </div>
            </div>
          </aside>

          {/* Live Preview */}
          <main className="flex-1 overflow-y-auto bg-gray-100 relative">
             <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold shadow text-gray-600 flex items-center gap-1 z-10">
                <Eye size={12} /> Visualização Real
             </div>
             <LandingPageRenderer content={selectedPage.content} />
          </main>
        </div>
      </div>
    );
  }

  return <div>Carregando...</div>;
}