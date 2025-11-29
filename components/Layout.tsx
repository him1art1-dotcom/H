import React, { useState, useEffect, useRef, createContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Shield, Users, Clock, LayoutDashboard, Settings, UserCircle, Activity, X, Bell, AlertCircle, Calendar, CheckCircle, ChevronLeft, ChevronRight, Headphones, Sun, Moon } from 'lucide-react';
import { Role, User, STORAGE_KEYS, Notification } from '../types';
import { db } from '../services/db';
import SyncStatus from './SyncStatus';
import Footer from './Footer';

export const NotificationContext = createContext<{
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
} | null>(null);

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Default collapsed
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showToast, setShowToast] = useState<{notif: Notification, visible: boolean} | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [darkMode, setDarkMode] = useState(true); // Default dark mode
  const bellRef = useRef<HTMLButtonElement>(null);
  const lastReadKey = `hader:lastNotifSeen:${user?.id}`;

  // Load dark mode setting
  useEffect(() => {
    db.getSettings().then(settings => {
      if (settings?.darkMode !== undefined) {
        setDarkMode(settings.darkMode);
        applyDarkMode(settings.darkMode);
      }
    }).catch(console.error);
  }, []);

  // Apply dark mode to DOM
  const applyDarkMode = (isDark: boolean) => {
    if (isDark) {
      document.documentElement.classList.remove('light-mode');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light-mode');
    }
  };

  // Toggle dark mode
  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    applyDarkMode(newMode);
    
    // Save to settings
    try {
      const settings = await db.getSettings();
      await db.saveSettings({ ...settings, darkMode: newMode });
    } catch (e) {
      console.error('Failed to save dark mode setting', e);
    }
  };

  const navigate = useNavigate();
  const location = useLocation();

  // Kiosk mode for student attendance - no layout
  if (!user) return <>{children}</>;
  if (location.pathname === '/kiosk') return <>{children}</>;

  useEffect(() => {
    let unsub: {unsubscribe: () => void} | null = null;
    let mounted = true;

    // Subscribe to realtime notifications
    unsub = db.subscribeToNotifications(user, (notif: Notification) => {
      if (!mounted) return;
      setNotifications(prev => {
        // Avoid duplicates
        if (prev.find(n => n.id === notif.id)) return prev;
        return [notif, ...prev.slice(0, 49)]; // Show newest at top, limit to 50
      });
      // If isPopup: trigger toast
      if (notif.isPopup) {
        setShowToast({ notif, visible: true });
        setTimeout(() => setShowToast(null), 6000);
      }
    });
    return () => { mounted = false; unsub?.unsubscribe(); };
  }, [user]);

  useEffect(() => {
    // Compute unread count: all notifications newer than (last viewed) or with isPopup and not dismissed
    const lastSeenRaw = localStorage.getItem(lastReadKey);
    const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : 0;
    const count = notifications.filter(n => {
      const created = new Date(n.created_at).getTime();
      return created > lastSeen;
    }).length;
    setUnreadCount(count);
  }, [notifications]);

  const markAllRead = () => {
    localStorage.setItem(lastReadKey, Date.now().toString());
    setUnreadCount(0);
  };

  // Bell Icon and Popover - Neon Cyan Style
  const NotificationIcon = (
    <button ref={bellRef} onClick={() => {
      setBellOpen(o => !o);
      markAllRead();
    }} className="relative p-2 rounded-full hover:bg-cyan-500/10 transition flex items-center justify-center group mx-2 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)]" aria-label="الإشعارات">
      <Bell className="w-7 h-7 text-cyan-400 drop-shadow-lg" />
      {unreadCount > 0 && (
        <span className="absolute top-0 right-0 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 shadow-[0_0_10px_rgba(6,182,212,0.5)] animate-pulse border-2 border-slate-900" style={{fontFamily: 'Tajawal'}}> {unreadCount} </span>
      )}
    </button>
  );

  // Notification popover (RTL, Glass/Neon Cyan, animated)
  const PopoverContent = (
    bellOpen ? (
      <div className="fixed md:absolute right-5 md:right-24 xl:right-[400px] top-20 md:top-8 z-[120] w-[340px] max-h-[80vh] glass-card rounded-3xl border border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)] overflow-y-auto animate-fade-in-up backdrop-blur-xl flex flex-col rtl text-right" dir="rtl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20">
          <span className="font-bold text-lg text-white">الإشعارات</span>
          <button onClick={()=>setBellOpen(false)} className="p-1 hover:bg-cyan-500/10 rounded-full text-slate-400 hover:text-cyan-400 transition-colors"><X className="w-5 h-5"/></button>
        </div>
        <ul className="divide-y divide-cyan-500/10 py-1 px-2">
          {notifications.length === 0 && (<li className="text-center text-slate-400 py-8">لا توجد إشعارات حالياً</li>)}
          {notifications.slice(0, 12).map((notif, idx) => (
            <li key={notif.id+idx} className="flex gap-3 items-start p-4 hover:bg-cyan-500/5 rounded-2xl cursor-pointer transition-all group">
              <span>{getNotifIcon(notif)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 items-center mb-1">
                  <span className="text-sm font-bold text-white truncate">{notif.title||notif.type}</span>
                  {notif.isPopup && <span className="text-[10px] bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full px-2 py-0.5 ml-2 animate-pulse font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]">منبّه</span>}
                </div>
                <div className="text-[13px] text-slate-300 truncate">{notif.message}</div>
                <div className="text-xs text-cyan-400 mt-1 flex gap-2 items-center">
                  <Calendar className="w-3 h-3 inline opacity-60" /> {(new Date(notif.created_at)).toLocaleString('ar-SA')}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button onClick={() => { setBellOpen(false); navigate('/support'); }} className="shadow-inner px-4 py-2 text-xs font-bold font-sans mt-2 mb-4 mx-8 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:scale-105 transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]">كل الدعم الفني والتنبيهات</button>
      </div>
    ) : null
  );

  // Toast Popup (Glass/Neon Cyan, Fade-in/out)
  const Toast = showToast && showToast.visible && (
    <div className="fixed z-[140] bottom-8 right-8 md:right-10 max-w-xs w-[340px] glass-card border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_30px_rgba(6,182,212,0.2)] animate-fade-in-up backdrop-blur-2xl rounded-2xl p-5 flex items-center" dir="rtl">
      <div className="flex-shrink-0 mr-3">{getNotifIcon(showToast.notif, true)}</div>
      <div className="flex-1 text-right">
        <div className="text-lg font-bold text-white mb-1">{showToast.notif.title || "تنبيه جديد"}</div>
        <div className="text-sm text-cyan-300 mb-1">{showToast.notif.message}</div>
        <button onClick={() => setShowToast(null)} className="text-xs bg-cyan-500/10 text-cyan-400 font-bold rounded-xl px-4 py-1 mt-1 hover:bg-cyan-500/20 transition border border-cyan-500/30">إغلاق</button>
      </div>
    </div>
  );

  // Notification icons - Neon style
  function getNotifIcon(n: Notification, big=false) {
    if(n.type === 'behavior') return <AlertCircle className={big?"w-10 h-10 text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]":"w-5 h-5 text-red-400"}/>;
    if(n.type === 'attendance') return <CheckCircle className={big?"w-10 h-10 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]":"w-5 h-5 text-amber-400"}/>;
    if(n.type === 'general' || n.type === 'announcement') return <Bell className={big?"w-10 h-10 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]":"w-5 h-5 text-cyan-400"}/>
    if(n.type === 'command') return <Settings className={big?"w-10 h-10 text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]":"w-5 h-5 text-violet-400"}/>;
    return <Bell className={big?"w-10 h-10 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]":"w-5 h-5 text-cyan-400"} />;
  }

  const menuItems = [
    { label: 'الرئيسية', icon: LayoutDashboard, path: '/', roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL, Role.WATCHER, Role.SUPERVISOR_CLASS] },
    { label: 'الإدارة', icon: Settings, path: '/admin', roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN] },
    { label: 'كشك الحضور', icon: Clock, path: '/kiosk', roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.WATCHER, Role.KIOSK] },
    { label: 'المراقبة اليومية', icon: Activity, path: '/watcher', roles: [Role.SITE_ADMIN, Role.WATCHER, Role.SCHOOL_ADMIN] },
    { label: 'الإشراف', icon: Shield, path: '/supervision', roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL, Role.SUPERVISOR_CLASS] },
    { label: 'الدعم الفني', icon: Headphones, path: '/support', roles: [Role.SITE_ADMIN] },
  ];

  const allowedItems = menuItems.filter(item => item.roles.includes(user.role));

  // Dark Mode Toggle Button Component
  const DarkModeToggle = (
    <button 
      onClick={toggleDarkMode}
      className={`p-2 rounded-xl transition-all border ${
        darkMode 
          ? 'bg-white/5 border-white/10 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/30' 
          : 'bg-black/5 border-black/10 text-indigo-600 hover:bg-indigo-500/10 hover:border-indigo-500/30'
      }`}
      title={darkMode ? 'تبديل للوضع الفاتح' : 'تبديل للوضع الداكن'}
    >
      {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );

  return (
    <NotificationContext.Provider value={{notifications, unreadCount, markAllRead}}>
      <div className={`min-h-screen flex flex-col md:flex-row ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
        {/* Topbar for mobile */}
        <div className={`md:hidden ${darkMode ? 'glass' : 'bg-white/80 backdrop-blur-lg'} p-4 flex justify-between items-center z-20 border-b ${darkMode ? 'border-white/10' : 'border-gray-200'} sticky top-0`}>
          <h1 className={`text-2xl font-bold font-serif ${darkMode ? 'text-white text-glow' : 'text-gray-800'}`}>حاضر</h1>
          <div className="flex items-center gap-2">
            <SyncStatus />
            {DarkModeToggle}
            {NotificationIcon}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`p-2 rounded-lg ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-black/5 border-black/10 text-gray-700'} border`}>
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Sidebar - Collapsible on Click */}
        <aside 
          className={`
            fixed inset-y-0 right-0 z-30 glass-panel transition-all duration-300 ease-in-out transform 
            ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'} 
            md:translate-x-0 md:static md:inset-auto md:flex md:flex-col
            border-l border-white/5
            ${sidebarCollapsed ? 'md:w-20' : 'md:w-72'} w-72
          `}
        >
          {/* Logo - Click to toggle - Futuristic Neon Style */}
          <div 
            className={`border-b border-cyan-500/10 relative transition-all duration-300 cursor-pointer hover:bg-cyan-500/5 ${sidebarCollapsed ? 'p-4 md:p-3' : 'p-6'}`}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); setSidebarOpen(false); }} 
              className="md:hidden absolute top-4 left-4 p-2 rounded-full bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center">
              {/* Neon Logo Container */}
              <div className={`rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-[1px] shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all duration-300 ${sidebarCollapsed ? 'w-12 h-12 md:mb-0 mb-4' : 'w-14 h-14 mb-3'}`}>
                 <div className="w-full h-full rounded-2xl bg-[#0f172a] flex items-center justify-center">
                    <span className={`font-bold text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-400 pt-1 transition-all duration-300 ${sidebarCollapsed ? 'text-xl' : 'text-2xl'}`}>ح</span>
                 </div>
              </div>
              <div className={`overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'md:w-0 md:h-0 md:opacity-0' : 'w-full opacity-100'}`}>
                <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 text-glow whitespace-nowrap">حاضر</h2>
                <p className="text-[10px] text-cyan-400/60 mt-1 font-light tracking-widest uppercase">School System</p>
              </div>
              {/* Toggle indicator */}
              <div className={`hidden md:flex items-center justify-center mt-2 text-cyan-500/50 transition-all ${sidebarCollapsed ? 'md:mt-1' : ''}`}>
                <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </div>

          {/* User Info - Neon Style */}
          <div className={`border-b border-cyan-500/10 transition-all duration-300 ${sidebarCollapsed ? 'p-2 md:p-2' : 'p-6'}`}>
             <div className={`flex items-center rounded-xl bg-cyan-500/5 border border-cyan-500/10 transition-all duration-300 hover:border-cyan-500/30 ${sidebarCollapsed ? 'p-2 justify-center md:justify-center' : 'gap-4 p-3'}`}>
               <div className={`rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 p-[2px] flex-shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-10 h-10' : 'w-10 h-10'}`}>
                 <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                    <UserCircle className="w-5 h-5 text-cyan-400" />
                 </div>
               </div>
               <div className={`overflow-hidden transition-all duration-300 ${sidebarCollapsed ? 'md:hidden w-0' : 'flex-1'}`}>
                 <p className="text-sm font-bold text-white truncate">{user.name}</p>
                 <p className="text-[10px] text-cyan-400 uppercase tracking-wider truncate">{user.role.replace('_', ' ')}</p>
               </div>
             </div>
          </div>

          {/* Navigation - Neon Style */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className={`space-y-2 transition-all duration-300 ${sidebarCollapsed ? 'px-2' : 'px-4'}`}>
              {allowedItems.map((item) => (
                <li key={item.path}>
                  <button
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`relative w-full flex items-center rounded-xl transition-all duration-300 group overflow-hidden ${
                      sidebarCollapsed ? 'justify-center p-3' : 'gap-4 px-4 py-3.5'
                    } ${
                      location.pathname === item.path 
                        ? 'bg-cyan-500/10 text-white shadow-[0_0_25px_rgba(6,182,212,0.2)] border border-cyan-500/30' 
                        : 'text-slate-400 hover:bg-cyan-500/5 hover:text-white hover:border hover:border-cyan-500/20 border border-transparent'
                    }`}
                  >
                    {location.pathname === item.path && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full"></div>
                    )}
                    <item.icon className={`flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'} ${location.pathname === item.path ? 'text-cyan-400' : 'text-slate-500 group-hover:text-cyan-400'}`} />
                    <span className={`font-medium tracking-wide whitespace-nowrap transition-all duration-300 ${location.pathname === item.path ? 'font-bold' : ''} ${sidebarCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Logout - Neon Style */}
          <div className={`border-t border-cyan-500/10 transition-all duration-300 ${sidebarCollapsed ? 'p-2' : 'p-6'}`}>
            <button 
              onClick={onLogout}
              title={sidebarCollapsed ? 'تسجيل خروج' : undefined}
              className={`w-full flex items-center text-red-400 hover:text-white hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] group ${
                sidebarCollapsed ? 'justify-center p-3' : 'justify-center gap-2 px-4 py-3'
              }`}
            >
              <LogOut className={`group-hover:-translate-x-1 transition-transform ${sidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
              <span className={`transition-all duration-300 ${sidebarCollapsed ? 'md:hidden' : ''}`}>تسجيل خروج</span>
            </button>
          </div>
          
          {/* Footer */}
          <div className={`text-center transition-all duration-300 ${sidebarCollapsed ? 'p-2 md:p-1' : 'p-4'}`}>
             <p className={`text-[10px] text-cyan-500/40 font-light transition-all duration-300 ${sidebarCollapsed ? 'md:hidden' : ''}`}>© 2024 Hader System</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 relative z-10 scroll-smooth flex flex-col ${darkMode ? '' : 'bg-transparent'}`}>
          {/* Desktop Header Bar with Sync Status, Dark Mode Toggle and Notifications */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <div></div>
            <div className="flex items-center gap-3">
              <SyncStatus />
              {DarkModeToggle}
              {NotificationIcon}
              {PopoverContent}
            </div>
          </div>
          <div className="flex-1">
            {children}
          </div>
          {/* Footer */}
          <Footer />
        </main>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-20 md:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {/* Mobile Popover for notifications - only show on mobile */}
        <div className="md:hidden">{PopoverContent}</div>
        {/* Toast notification for popups */}
        {Toast}
      </div>
    </NotificationContext.Provider>
  );
};

export default Layout;