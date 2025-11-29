import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Role } from '../types';
import { Settings, Clock, Activity, Shield, Headphones, ArrowLeft } from 'lucide-react';

const Dashboard: React.FC<{ user: User }> = ({ user }) => {
  const navigate = useNavigate();

  const cards = [
    {
      title: 'الإدارة',
      desc: 'إعدادات النظام والطلاب',
      icon: Settings,
      path: '/admin',
      roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN],
      color: 'from-blue-500 to-cyan-500',
      border: 'hover:border-blue-400/50'
    },
    {
      title: 'كشك الحضور',
      desc: 'شاشة تسجيل الطلاب',
      icon: Clock,
      path: '/kiosk',
      roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.WATCHER, Role.KIOSK],
      color: 'from-emerald-500 to-teal-500',
      border: 'hover:border-emerald-400/50'
    },
    {
      title: 'المتابعة اليومية',
      desc: 'إحصائيات الحضور اليومي',
      icon: Activity,
      path: '/watcher',
      roles: [Role.SITE_ADMIN, Role.WATCHER, Role.SCHOOL_ADMIN],
      color: 'from-amber-500 to-orange-500',
      border: 'hover:border-amber-400/50'
    },
    {
      title: 'بوابة الإشراف',
      desc: 'متابعة السلوك والاستئذان',
      icon: Shield,
      path: '/supervision',
      roles: [Role.SITE_ADMIN, Role.SCHOOL_ADMIN, Role.SUPERVISOR_GLOBAL, Role.SUPERVISOR_CLASS],
      color: 'from-violet-500 to-purple-500',
      border: 'hover:border-violet-400/50'
    },
    {
      title: 'الدعم الفني',
      desc: 'حالة النظام والصيانة',
      icon: Headphones,
      path: '/support',
      roles: [Role.SITE_ADMIN],
      color: 'from-pink-500 to-rose-500',
      border: 'hover:border-pink-400/50'
    }
  ];

  const allowedCards = cards.filter(c => c.roles.includes(user.role));

  return (
    <div className="max-w-7xl mx-auto py-8">
      <header className="mb-16 relative">
        <div className="absolute -left-20 -top-20 w-64 h-64 bg-primary-500/20 rounded-full blur-[80px] pointer-events-none"></div>
        <h1 className="text-5xl font-bold font-serif text-white mb-4 relative z-10">
          مرحباً، <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-secondary-400 text-glow">{user.name}</span>
        </h1>
        <p className="text-gray-400 font-light text-lg max-w-2xl">
          نظام حاضر الذكي لإدارة شؤون الطلاب والمتابعة اليومية. اختر البوابة المناسبة للبدء.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {allowedCards.map((card) => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className={`group relative overflow-hidden rounded-[2rem] glass-card p-1 text-right transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] ${card.border}`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="relative h-full glass-card rounded-[1.8rem] p-8 overflow-hidden">
               {/* Animated Gradient Blob on Hover */}
               <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${card.color} opacity-10 blur-[50px] group-hover:opacity-30 transition-all duration-700 group-hover:scale-150`}></div>
               
               <div className="relative z-10 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-8">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${card.color} shadow-lg text-white ring-1 ring-white/20 group-hover:ring-white/40 transition-all`}>
                      <card.icon className="w-8 h-8" />
                    </div>
                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                      <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="mt-auto">
                    <h3 className="text-3xl font-bold text-white font-serif mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-300 transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-gray-400 font-light text-sm group-hover:text-gray-300 transition-colors">
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