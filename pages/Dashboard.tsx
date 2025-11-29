import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Role, SystemSettings } from '../types';
import { Settings, Clock, Activity, Shield, Headphones, ArrowLeft } from 'lucide-react';
import { db } from '../services/db';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    db.getSettings().then(s => setSettings(s)).catch(console.error);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 🎨 Card Configuration - Futuristic Glass & Dark Neon Theme
  // ═══════════════════════════════════════════════════════════════
  const cards = [
    {
      title: 'الإدارة',
      desc: 'إعدادات النظام والطلاب',
      icon: Settings,
      path: '/admin',
      roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN],
      color: 'from-cyan-400 to-blue-500', // Primary neon gradient
      border: 'hover:border-cyan-400/50',
      glow: 'group-hover:shadow-[0_0_40px_rgba(6,182,212,0.3)]'
    },
    {
      title: 'كشك الحضور',
      desc: 'شاشة تسجيل الطلاب',
      icon: Clock,
      path: '/kiosk',
      roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.WATCHER, Role.KIOSK],
      color: 'from-emerald-400 to-teal-500',
      border: 'hover:border-emerald-400/50',
      glow: 'group-hover:shadow-[0_0_40px_rgba(16,185,129,0.3)]'
    },
    {
      title: 'المتابعة اليومية',
      desc: 'إحصائيات الحضور اليومي',
      icon: Activity,
      path: '/watcher',
      roles: [Role.SITE_ADMIN, Role.WATCHER, Role.SCHOOL_ADMIN],
      color: 'from-amber-400 to-orange-500',
      border: 'hover:border-amber-400/50',
      glow: 'group-hover:shadow-[0_0_40px_rgba(245,158,11,0.3)]'
    },
    {
      title: 'بوابة الإشراف',
      desc: 'متابعة السلوك والاستئذان',
      icon: Shield,
      path: '/supervision',
      roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL, Role.SUPERVISOR_CLASS],
      color: 'from-violet-400 to-purple-500',
      border: 'hover:border-violet-400/50',
      glow: 'group-hover:shadow-[0_0_40px_rgba(139,92,246,0.3)]'
    },
    {
      title: 'الدعم الفني',
      desc: 'حالة النظام والصيانة',
      icon: Headphones,
      path: '/support',
      roles: [Role.SITE_ADMIN],
      color: 'from-pink-400 to-rose-500',
      border: 'hover:border-pink-400/50',
      glow: 'group-hover:shadow-[0_0_40px_rgba(236,72,153,0.3)]'
    }
  ];

  const allowedCards = cards.filter(c => c.roles.includes(user.role));

  return (
    <div className="max-w-7xl mx-auto py-8">
      {/* ═══════════════════════════════════════════════════════════════
          ✨ Welcome Header - Futuristic Neon Style
          ═══════════════════════════════════════════════════════════════ */}
      <header className="mb-16 relative">
        {/* Ambient Glow Effect */}
        <div className="absolute -left-20 -top-20 w-80 h-80 bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none animate-pulse-slow"></div>
        <div className="absolute right-20 -top-10 w-64 h-64 bg-blue-600/15 rounded-full blur-[80px] pointer-events-none animate-pulse-slow animation-delay-2000"></div>
        
        <h1 className="text-5xl font-bold text-white mb-4 relative z-10">
          مرحباً، <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 text-glow">{user.name}</span>
        </h1>
        
        {settings?.schoolName ? (
          <div className="space-y-2">
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
              {settings.schoolName}
            </p>
            {settings.principalName && (
              <p className="text-slate-400 font-light text-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                مدير المدرسة: <span className="text-cyan-400 font-medium">{settings.principalName}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-slate-400 font-light text-lg max-w-2xl">
            نظام حاضر الذكي لإدارة شؤون الطلاب والمتابعة اليومية. اختر البوابة المناسبة للبدء.
          </p>
        )}
      </header>

      {/* ═══════════════════════════════════════════════════════════════
          🃏 Navigation Cards - Glassmorphism with Neon Glow
          ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {allowedCards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className={`group relative overflow-hidden rounded-[2rem] glass-card p-1 text-right transition-all duration-500 hover:-translate-y-3 ${card.border} ${card.glow}`}
          >
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="relative h-full glass-card rounded-[1.8rem] p-8 overflow-hidden border border-white/5 group-hover:border-white/10 transition-all">
               {/* Animated Gradient Blob on Hover */}
               <div className={`absolute -right-10 -top-10 w-48 h-48 bg-gradient-to-br ${card.color} opacity-10 blur-[60px] group-hover:opacity-40 transition-all duration-700 group-hover:scale-150`}></div>
               
               <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-8">
                    {/* Icon with neon glow effect */}
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${card.color} shadow-lg text-white ring-1 ring-white/20 group-hover:ring-white/40 transition-all group-hover:scale-110 duration-300`}>
                      <card.icon className="w-8 h-8" />
                    </div>
                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500 bg-white/5">
                      <ArrowLeft className="w-5 h-5 text-slate-400" />
                    </div>
                  </div>
                  
                  <div className="mt-auto">
                    <h3 className="text-3xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-slate-300 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-slate-400 font-light text-sm group-hover:text-slate-300 transition-colors">
                      {card.desc}
                    </p>
                  </div>
               </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;