import React, { useState, useEffect } from 'react';
import { User, SystemSettings } from '../types';
import { auth } from '../services/auth';
import { db } from '../services/db';
import { Loader2, Building, UserCircle, Sparkles } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'guardian'>('staff');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    db.getSettings().then(s => setSettings(s)).catch(console.error);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        const result = await auth.login(username, password, activeTab);

        if (result.success && result.user) {
            onLogin(result.user);
        } else {
            setError(result.message || 'بيانات الدخول غير صحيحة');
        }
    } catch (err) {
        setError('حدث خطأ غير متوقع');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* ═══════════════════════════════════════════════════════════════
          ✨ Login Card - Futuristic Glass & Dark Neon Theme
          ═══════════════════════════════════════════════════════════════ */}
      <div className="glass-card w-full max-w-md rounded-3xl overflow-hidden relative z-10 animate-fade-in-up border border-white/10 hover:border-cyan-500/30 transition-all duration-500">
        
        {/* Decorative Top Gradient - Neon Cyan to Blue */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500"></div>
        <div className="absolute top-1 left-0 w-full h-32 bg-gradient-to-b from-cyan-900/20 to-transparent pointer-events-none"></div>
        
        {/* Ambient glow effect */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-[80px] pointer-events-none animate-pulse-slow"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none animate-pulse-slow animation-delay-2000"></div>
        
        {/* ═══════════════════════════════════════════════════════════════
            🏷️ Header Section - System Name & School Info
            ═══════════════════════════════════════════════════════════════ */}
        <div className="p-8 pb-6 text-center relative">
          {/* System Name - Always on top */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-slate-400 text-glow pb-1">حاضر</h1>
            <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
          </div>
          <p className="text-cyan-400/80 font-light tracking-widest text-xs uppercase mb-5">نظام إدارة الحضور الذكي</p>
          
          {/* School Name & Principal - Below system name */}
          {(settings?.schoolName || settings?.principalName) && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-900/20 via-slate-900/40 to-blue-900/20 border border-cyan-500/20 backdrop-blur-sm neon-border">
              {settings?.schoolName && (
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Building className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-bold text-white">{settings.schoolName}</h2>
                </div>
              )}
              {settings?.principalName && (
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                  <UserCircle className="w-4 h-4 text-blue-400" />
                  <span>مدير المدرسة: <span className="text-cyan-300 font-medium">{settings.principalName}</span></span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            🔘 Tab Switcher - Staff / Guardian
            ═══════════════════════════════════════════════════════════════ */}
        <div className="px-8">
          <div className="flex p-1.5 gap-2 bg-slate-900/60 rounded-2xl border border-white/5">
            <button
              type="button"
              className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 text-sm ${
                activeTab === 'staff' 
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-900/50 neon-glow' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
              onClick={() => setActiveTab('staff')}
            >
              الموظفين
            </button>
            <button
              type="button"
              className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 text-sm ${
                activeTab === 'guardian' 
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-900/50' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
              onClick={() => setActiveTab('guardian')}
            >
              أولياء الأمور
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            📝 Login Form
            ═══════════════════════════════════════════════════════════════ */}
        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 text-red-300 p-4 rounded-xl text-sm border border-red-500/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
              {error}
            </div>
          )}

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-slate-400 group-focus-within:text-cyan-400 transition-colors">
              {activeTab === 'staff' ? 'اسم المستخدم' : 'رقم الجوال (بدون 0)'}
            </label>
            <input
              type="text"
              required
              className="w-full px-5 py-4 rounded-xl input-glass transition-all placeholder-slate-600 text-lg focus:border-cyan-500/60 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={activeTab === 'staff' ? 'admin' : '5xxxxxxxxx'}
            />
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-slate-400 group-focus-within:text-cyan-400 transition-colors">
              {activeTab === 'staff' ? 'كلمة المرور' : 'آخر 4 أرقام من معرف الطالب'}
            </label>
            <input
              type="password"
              required
              className="w-full px-5 py-4 rounded-xl input-glass transition-all placeholder-slate-600 text-lg focus:border-cyan-500/60 focus:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg border border-white/10 mt-6 relative overflow-hidden group hover-glow
              ${activeTab === 'staff' 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-900/30' 
                : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 shadow-violet-900/30'
              }
              ${loading ? 'opacity-70 cursor-wait' : ''}
            `}
          >
            {loading ? (
                <div className="flex items-center justify-center gap-2 text-white">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    جاري التحقق...
                </div>
            ) : (
                <>
                    <span className="relative z-10 text-white">تسجيل الدخول</span>
                    <div className="absolute inset-0 bg-white/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </>
            )}
          </button>

          <div className="text-center pt-4">
            <p className="text-[10px] text-slate-600 font-mono tracking-wider uppercase flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></span>
              Secure Access • Supabase Powered
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></span>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
