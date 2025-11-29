
import React, { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Kiosk from './pages/Kiosk';
import Watcher from './pages/Watcher';
import Supervision from './pages/Supervision';
import Parents from './pages/Parents';
import Support from './pages/Support';
import NotFound from './pages/NotFound';
import Layout from './components/Layout';
import { auth } from './services/auth';
import { db } from './services/db';
import { User, AppTheme } from './types';

// Apply theme colors to DOM CSS variables
const applyThemeToDOM = (theme: AppTheme) => {
    document.documentElement.style.setProperty('--color-primary-400', theme.primary400);
    document.documentElement.style.setProperty('--color-primary-500', theme.primary500);
    document.documentElement.style.setProperty('--color-primary-600', theme.primary600);
    document.documentElement.style.setProperty('--color-secondary-400', theme.secondary400);
    document.documentElement.style.setProperty('--color-secondary-500', theme.secondary500);
    document.documentElement.style.setProperty('--color-secondary-600', theme.secondary600);
};

// Apply dark/light mode to DOM
const applyDarkMode = (isDark: boolean) => {
    if (isDark) {
        document.documentElement.classList.remove('light-mode');
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light-mode');
    }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sync Check for speed
    const sessionUser = auth.getSession();
    if (sessionUser) {
      setUser(sessionUser);
    }
    
    // Load and apply saved theme and dark mode
    db.getSettings().then(settings => {
        if (settings?.theme) {
            applyThemeToDOM(settings.theme);
        }
        // Apply dark mode setting (default to dark if not set)
        applyDarkMode(settings?.darkMode !== false);
    }).catch(console.error);
    
    // Async Connection Check with Timeout Race
    Promise.race([
        auth.checkConnection(),
        new Promise(resolve => setTimeout(() => resolve(false), 5000))
    ]).then((connected) => {
        console.log("Supabase Connection Status:", connected ? "Connected" : "Disconnected/Timeout");
        setLoading(false);
    });
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
  };

  const handleLogout = () => {
    auth.logout();
    setUser(null);
  };

  if (loading) return (
      <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white">
          <div className="animate-pulse flex flex-col items-center">
              <div className="w-12 h-12 rounded-full border-4 border-primary-500 border-t-transparent animate-spin mb-4"></div>
              جاري الاتصال بالنظام السحابي...
          </div>
      </div>
  );

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="/" element={<Login onLogin={handleLogin} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      ) : (
        <Routes>
          {/* Kiosk - Full Screen without Layout */}
          <Route path="/kiosk" element={<Kiosk />} />
          
          {/* All other pages with Layout */}
          <Route path="*" element={
            <Layout user={user} onLogout={handleLogout}>
              <Routes>
                <Route path="/" element={
                   user.role === 'guardian' ? <Parents user={user} /> : 
                   user.role === 'kiosk' ? <Navigate to="/kiosk" /> : 
                   <Dashboard user={user} />
                } />
                <Route path="/admin" element={<Admin />} />
                <Route path="/watcher" element={<Watcher />} />
                <Route path="/supervision" element={<Supervision />} />
                <Route path="/parents" element={<Parents user={user} />} />
                <Route path="/support" element={<Support />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      )}
    </Router>
  );
};

export default App;
