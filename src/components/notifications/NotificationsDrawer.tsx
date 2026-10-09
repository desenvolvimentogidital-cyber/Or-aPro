import React from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Bell, CheckCheck, X, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export const NotificationsDrawer: React.FC = () => {
  const {
    isNotificationsOpen,
    setIsNotificationsOpen,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    pushPermission,
    requestPushPermission,
    sendSystemNotification,
    setActiveQuoteForPreview,
    quotes
  } = useApp();

  const { theme } = useTheme();

  if (!isNotificationsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-sm h-full bg-[#12151d] border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-[#161a24]">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: `${theme.primaryColor}25`, color: theme.primaryColor }}
            >
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Notificações</h2>
              <p className="text-xs text-slate-400">Atualizações de orçamentos e clientes</p>
            </div>
          </div>
          <button
            onClick={() => setIsNotificationsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Native browser alerts, not a background push subscription */}
        <div className="p-3 bg-[#181d28] border-b border-white/5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 mt-0.5" style={{ color: theme.primaryColor }} />
              <div>
                <p className="text-xs font-semibold text-white">Notificações neste dispositivo</p>
                <p className="text-[11px] text-slate-400 leading-tight">
                  {pushPermission === 'granted'
                    ? '✓ Alertas locais permitidos enquanto o aplicativo estiver aberto'
                    : 'Avisos locais de alterações no aplicativo; sem push remoto configurado'}
                </p>
              </div>
            </div>
            {pushPermission === 'default' ? (
              <button
                onClick={requestPushPermission}
                className="text-xs px-3 py-1.5 rounded-lg font-bold text-white transition-all active:scale-95 whitespace-nowrap shadow-md"
                style={{ background: theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)' }}
              >
                Ativar
              </button>
            ) : (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                {pushPermission === 'granted' ? 'Ativo' : pushPermission === 'denied' ? 'Bloqueado' : 'Indisponível'}
              </span>
            )}
          </div>
        </div>

        {/* Actions bar */}
        <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between text-xs text-slate-400 bg-[#12151d]">
          <span>{notifications.length} notificações</span>
          <div className="flex items-center gap-3">
            <button
              onClick={markAllNotificationsAsRead}
              className="hover:text-slate-200 flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Lidas
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center p-4">
              <Bell className="w-10 h-10 stroke-[1.5] mb-2 opacity-40" />
              <p className="text-sm font-medium text-slate-400">Nenhuma notificação</p>
              <p className="text-xs text-slate-600 mt-1">Os eventos registrados nesta conta aparecem aqui</p>
            </div>
          ) : (
            notifications.map(notif => {
              const icon =
                notif.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : notif.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : notif.type === 'alert' ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                );

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    markNotificationAsRead(notif.id);
                    if (notif.quoteId) {
                      const found = quotes.find(q => q.id === notif.quoteId);
                      if (found) {
                        setActiveQuoteForPreview(found);
                        setIsNotificationsOpen(false);
                      }
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    notif.read
                      ? 'bg-[#151923] border-white/5 opacity-80'
                      : 'bg-[#1a202d] border-white/10 shadow-md ring-1 ring-white/5'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-white truncate">{notif.title}</h4>
                        <span className="text-[10px] text-slate-400 ml-2 whitespace-nowrap">{Number.isNaN(Date.parse(notif.timestamp)) ? notif.timestamp : new Date(notif.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 leading-relaxed">{notif.message}</p>
                      {notif.quoteId && (
                        <span
                          className="inline-block mt-2 text-[11px] font-semibold"
                          style={{ color: theme.primaryColor }}
                        >
                          Ver orçamento →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
