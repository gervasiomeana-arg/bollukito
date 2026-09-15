import { MessageSquare, Bell, Settings, ShieldCheck, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'chat' | 'reception' | 'config';
  setActiveTab: (tab: 'chat' | 'reception' | 'config') => void;
  pendingCount: number;
}

export function Header({ activeTab, setActiveTab, pendingCount }: HeaderProps) {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Mascot */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src="/bollukito_avatar.jpg?v=5"
                alt="Bollukito Mascota Oficial"
                className="w-11 h-11 rounded-full object-cover ring-2 ring-emerald-400/80 shadow-md animate-bollukito-breathe animate-mascot-glow hover:animate-bollukito-happy transition-transform cursor-pointer"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" title="Bollukito en línea"></span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-white">Hotel Bolluk</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Sparkles className="w-3 h-3 mr-1" /> Bot con IA
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center">
                Mascota oficial: <strong className="text-slate-200 ml-1">Bollukito 🐾🛎️</strong>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              id="tab-chat-btn"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-4 h-4 mr-1.5" />
              <span>Chat WhatsApp</span>
            </button>

            <button
              id="tab-reception-btn"
              onClick={() => setActiveTab('reception')}
              className={`relative flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'reception'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Bell className="w-4 h-4 mr-1.5" />
              <span>Avisos al Humano</span>
              {pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-full animate-pulse">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              id="tab-config-btn"
              onClick={() => setActiveTab('config')}
              className={`flex items-center px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'config'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Settings className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Configuración Hotel</span>
              <span className="sm:hidden">Ajustes</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
