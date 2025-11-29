import React, { useState } from 'react';
import { User } from '../types';
import { auth } from '../services/auth';
import { Loader2 } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'staff' | 'guardian'>('staff');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      
      <div className="glass-card w-full max-w-md rounded-3xl overflow-hidden relative z-10 animate-fade-in-up">
        {/* Decorative Top Gradient */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-secondary-500"></div>
        <div className="absolute top-1 left-0 w-full h-32 bg-gradient-to-b from-primary-900/20 to-transparent pointer-events-none"></div>
        
        <div className="p-10 text-center relative">
          <h1 className="text-6xl font-bold font-serif text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 mb-2 text-glow pb-2">حاضر</h1>
          <p className="text-primary-300 font-light tracking-widest text-sm uppercase">Cloud School System</p>
        </div>

        <div className="px-8">
          <div className="flex p-1.5 gap-2 bg-black/40 rounded-2xl border border-white/5">
            <button
              type="button"
              className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 text-sm ${activeTab === 'staff' ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-900/50' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              onClick={() => setActiveTab('staff')}
            >
              الموظفين
            </button>
            <button
              type="button"
              className={`flex-1 py-3 rounded-xl font-bold transition-all duration-300 text-sm ${activeTab === 'guardian' ? 'bg-gradient-to-r from-secondary-600 to-secondary-500 text-white shadow-lg shadow-secondary-900/50' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
              onClick={() => setActiveTab('guardian')}
            >
              أولياء الأمور
            </button>
          </div>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-500/10 text-red-200 p-4 rounded-xl text-sm border border-red-500/20 backdrop-blur-sm flex items-center justify-center animate-pulse">
              {error}
            </div>
          )}

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-gray-400 group-focus-within:text-primary-400 transition-colors">
              {activeTab === 'staff' ? 'اسم المستخدم' : 'رقم الجوال (بدون 0)'}
            </label>
            <input
              type="text"
              required
              className="w-full px-5 py-4 rounded-xl input-glass transition-all placeholder-gray-600 text-lg"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={activeTab === 'staff' ? 'admin' : '5xxxxxxxxx'}
            />
          </div>

          <div className="space-y-2 group">
            <label className="block text-sm font-medium text-gray-400 group-focus-within:text-secondary-400 transition-colors">
              {activeTab === 'staff' ? 'كلمة المرور' : 'آخر 4 أرقام من معرف الطالب'}
            </label>
            <input
              type="password"
              required
              className="w-full px-5 py-4 rounded-xl input-glass transition-all placeholder-gray-600 text-lg"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-lg border border-white/10 mt-6 relative overflow-hidden group
              ${activeTab === 'staff' 
                ? 'bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-500 hover:to-purple-500 shadow-primary-900/30' 
                : 'bg-gradient-to-r from-secondary-600 to-pink-600 hover:from-secondary-500 hover:to-pink-500 shadow-secondary-900/30'
              }
              ${loading ? 'opacity-70 cursor-wait' : ''}
            `}
          >
            {loading ? (
                <div className="flex items-center justify-center gap-2">
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
            <p className="text-[10px] text-gray-600 font-mono tracking-wider uppercase">
              Secure Access • Supabase Powered
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;