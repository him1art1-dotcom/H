
import React, { useEffect, useState } from 'react';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Role, SystemSettings, DiagnosticResult, AppTheme, SocialLinks } from '../types';
import { Activity, CheckCircle, Server, RefreshCw, Power, Database, Cloud, HardDrive, ToggleLeft, ToggleRight, Save, ShieldCheck, AlertTriangle, XCircle, Megaphone, Send, Loader2, Image, Palette, X, Check, Headset, MessageCircle, Instagram, Link } from 'lucide-react';

// Theme configurations
const THEME_CONFIG: Record<string, { name: string; nameEn: string; emoji: string; gradient: string; colors: string[] }> = {
    default: { name: 'بنفسجي ملكي', nameEn: 'Royal Violet', emoji: '✨', gradient: 'from-violet-500 to-pink-500', colors: ['bg-violet-500', 'bg-pink-500'] },
    ocean: { name: 'أزرق محيطي', nameEn: 'Ocean Blue', emoji: '🌊', gradient: 'from-sky-500 to-teal-500', colors: ['bg-sky-500', 'bg-teal-500'] },
    nature: { name: 'أخضر طبيعي', nameEn: 'Forest Green', emoji: '🌿', gradient: 'from-emerald-500 to-lime-500', colors: ['bg-emerald-500', 'bg-lime-500'] },
    sunset: { name: 'غروب دافئ', nameEn: 'Sunset Warm', emoji: '🌅', gradient: 'from-orange-500 to-rose-500', colors: ['bg-orange-500', 'bg-rose-500'] },
    midnight: { name: 'ليلي أنيق', nameEn: 'Midnight', emoji: '🌙', gradient: 'from-indigo-600 to-slate-700', colors: ['bg-indigo-600', 'bg-slate-500'] }
};

const Support: React.FC = () => {
  const currentMode = db.getMode();
  const [loading, setLoading] = useState(true);
  const [diagLoading, setDiagLoading] = useState(false);
  
  // State
  const [settings, setSettings] = useState<SystemSettings>({ systemReady: true, schoolActive: true, logoUrl: '', darkMode: true });
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  
  // Social Links State
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({ supportUrl: '', whatsapp: '', instagram: '' });
  
  // Theme confirmation state
  const [pendingTheme, setPendingTheme] = useState<string | null>(null);
  
  // Broadcast Form
  const [broadcast, setBroadcast] = useState({ 
    role: 'all', 
    message: '', 
    title: '',
    type: 'announcement' as 'announcement' | 'general' | 'command',
    isPopup: false
  });
  
  // System Stats
  const [systemStats, setSystemStats] = useState<any>(null);

  useEffect(() => {
      auth.requireRole([Role.SITE_ADMIN]);
      loadData();
  }, []);

  const loadData = async () => {
      setLoading(true);
      try {
          const [s, stats] = await Promise.all([
              db.getSettings(),
              fetchSystemStats()
          ]);
          setSettings(s);
          // Load social links if available
          if (s.socialLinks) {
              setSocialLinks(s.socialLinks);
          }
          // Apply saved theme on load
          if (s.theme) {
              applyThemeToDOM(s.theme);
          }
          await runDiagnostics();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  // Apply theme colors to DOM CSS variables
  const applyThemeToDOM = (theme: AppTheme) => {
      document.documentElement.style.setProperty('--color-primary-400', theme.primary400);
      document.documentElement.style.setProperty('--color-primary-500', theme.primary500);
      document.documentElement.style.setProperty('--color-primary-600', theme.primary600);
      document.documentElement.style.setProperty('--color-secondary-400', theme.secondary400);
      document.documentElement.style.setProperty('--color-secondary-500', theme.secondary500);
      document.documentElement.style.setProperty('--color-secondary-600', theme.secondary600);
  };

  const fetchSystemStats = async () => {
      try {
          const [students, attendance, violations, exits, users] = await Promise.all([
              db.getStudents(),
              db.getAttendance(),
              db.getViolations(),
              db.getTodayExits(),
              db.getUsers()
          ]);
          const today = new Date().toISOString().split('T')[0];
          const todayAttendance = attendance.filter(a => a.date === today);
          const stats = {
              totalStudents: students.length,
              totalUsers: users.length,
              todayAttendance: todayAttendance.length,
              totalViolations: violations.length,
              todayExits: exits.length,
              systemStatus: settings.systemReady && settings.schoolActive ? 'نشط' : 'معطل',
              storageMode: db.getMode()
          };
          setSystemStats(stats);
          return stats;
      } catch (e) {
          console.error(e);
          return null;
      }
  };

  const runDiagnostics = async () => {
      setDiagLoading(true);
      try {
          const results = await db.runDiagnostics();
          setDiagnostics(results);
      } catch(e) { console.error(e); }
      finally { setDiagLoading(false); }
  };

  const toggleSetting = async (key: keyof SystemSettings) => {
      const newSettings = { ...settings, [key]: !settings[key as any] };
      setSettings(newSettings);
      await db.saveSettings(newSettings);
      // Re-run diagnostics if school active status changes (optional logic)
      if (key === 'schoolActive') runDiagnostics();
  };

  const saveLogo = async () => {
      await db.saveSettings(settings);
      alert('تم حفظ رابط الشعار');
  };

  const saveSocialLinks = async () => {
      const updatedSettings = { ...settings, socialLinks };
      setSettings(updatedSettings);
      await db.saveSettings(updatedSettings);
      alert('تم حفظ روابط التواصل ✓');
  };

  // Show confirmation dialog for theme selection
  const selectTheme = (themeName: string) => {
      setPendingTheme(themeName);
  };

  // Cancel theme change
  const cancelThemeChange = () => {
      setPendingTheme(null);
  };

  // Confirm and apply theme
  const confirmThemeChange = async () => {
      if (!pendingTheme) return;
      await changeTheme(pendingTheme);
      setPendingTheme(null);
  };

  const changeTheme = async (themeName: string) => {
      let theme: AppTheme;

      switch(themeName) {
          case 'ocean':
              theme = {
                  primary400: '56 189 248', primary500: '14 165 233', primary600: '2 132 199', // Sky/Blue
                  secondary400: '45 212 191', secondary500: '20 184 166', secondary600: '13 148 136' // Teal
              };
              break;
          case 'nature':
              theme = {
                  primary400: '52 211 153', primary500: '16 185 129', primary600: '5 150 105', // Emerald
                  secondary400: '163 230 53', secondary500: '132 204 22', secondary600: '101 163 13' // Lime
              };
              break;
          case 'sunset':
              theme = {
                  primary400: '251 146 60', primary500: '249 115 22', primary600: '234 88 12', // Orange
                  secondary400: '251 113 133', secondary500: '244 63 94', secondary600: '225 29 72' // Rose
              };
              break;
          case 'midnight':
              theme = {
                  primary400: '129 140 248', primary500: '99 102 241', primary600: '79 70 229', // Indigo
                  secondary400: '148 163 184', secondary500: '100 116 139', secondary600: '71 85 105' // Slate
              };
              break;
          default: // Default / Violet
              theme = {
                  primary400: '167 139 250', primary500: '124 58 237', primary600: '109 40 217',
                  secondary400: '244 114 182', secondary500: '219 39 119', secondary600: '190 24 93'
              };
              break;
      }
      
      const newSettings = { ...settings, theme };
      setSettings(newSettings);
      await db.saveSettings(newSettings);

      // Apply theme to CSS variables immediately
      applyThemeToDOM(theme);
  };

  const handleBroadcast = async () => {
      if (!broadcast.message || !broadcast.title) {
          alert('يرجى إدخال العنوان والرسالة');
          return;
      }
      
      const notification = {
          id: '',
          title: broadcast.title,
          message: broadcast.message,
          type: broadcast.type,
          target_audience: broadcast.role === 'all' ? 'all' : 
                          broadcast.role === 'admin' ? 'admin' :
                          broadcast.role === 'supervisor' ? 'supervisor' :
                          'guardian' as any,
          created_at: new Date().toISOString(),
          isPopup: broadcast.isPopup
      };
      
      await db.saveNotification(notification);
      alert('تم إرسال الرسالة بنجاح');
      setBroadcast({ role: 'all', message: '', title: '', type: 'announcement', isPopup: false });
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-white w-10 h-10" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div>
            <h2 className="text-4xl font-bold mb-2 text-white font-serif">لوحة تحكم الدعم الفني</h2>
            <p className="text-gray-400">مراقبة النظام، التشخيص الذكي، وإدارة البث والإعلانات</p>
          </div>
          <div className="flex gap-3">
              <button onClick={fetchSystemStats} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-300" title="تحديث الإحصائيات">
                  <RefreshCw className="w-5 h-5" />
              </button>
              <button onClick={() => window.location.reload()} className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-300" title="إعادة تحميل النظام">
                  <RefreshCw className="w-5 h-5" />
              </button>
          </div>
      </header>

      {/* System Stats Dashboard */}
      {systemStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-5 rounded-2xl border border-white/10">
                  <div className="text-xs text-gray-400 mb-2">حالة النظام</div>
                  <div className={`text-2xl font-bold font-mono ${
                      settings.systemReady && settings.schoolActive ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                      {systemStats.systemStatus}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">وضع التخزين: {systemStats.storageMode === 'cloud' ? 'سحابي' : 'محلي'}</div>
              </div>
              <div className="glass-card p-5 rounded-2xl border border-white/10">
                  <div className="text-xs text-gray-400 mb-2">إجمالي الطلاب</div>
                  <div className="text-2xl font-bold font-mono text-white">{systemStats.totalStudents}</div>
                  <div className="text-xs text-gray-500 mt-1">حضور اليوم: {systemStats.todayAttendance}</div>
              </div>
              <div className="glass-card p-5 rounded-2xl border border-white/10">
                  <div className="text-xs text-gray-400 mb-2">المستخدمين</div>
                  <div className="text-2xl font-bold font-mono text-primary-400">{systemStats.totalUsers}</div>
                  <div className="text-xs text-gray-500 mt-1">مخالفات: {systemStats.totalViolations}</div>
              </div>
              <div className="glass-card p-5 rounded-2xl border border-white/10">
                  <div className="text-xs text-gray-400 mb-2">الاستئذان اليوم</div>
                  <div className="text-2xl font-bold font-mono text-amber-400">{systemStats.todayExits}</div>
                  <div className="text-xs text-gray-500 mt-1">طلبات خروج</div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 1. System Controls & Theme */}
          <div className="lg:col-span-1 space-y-6">
              <div className="glass-card p-6 rounded-[2rem] border border-white/10">
                  <h3 className="font-bold flex items-center gap-2 mb-6 text-white text-lg font-serif">
                     <Power className="text-primary-400 w-5 h-5" /> تحكم النظام
                  </h3>
                  
                  <div className="space-y-4">
                      {/* Toggle 1 - System Ready */}
                      <div className={`p-5 rounded-2xl border transition-all ${
                          settings.systemReady 
                          ? 'bg-emerald-500/10 border-emerald-500/30' 
                          : 'bg-red-500/10 border-red-500/30'
                      }`}>
                          <div className="flex items-center justify-between mb-2">
                              <div>
                                  <div className="font-bold text-white">حالة النظام</div>
                                  <div className="text-xs text-gray-400">System Ready</div>
                              </div>
                              <button 
                                  onClick={() => toggleSetting('systemReady')} 
                                  className={`hover:scale-110 transition-transform ${
                                      settings.systemReady ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                              >
                                  {settings.systemReady ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                              </button>
                          </div>
                          <div className={`text-xs mt-2 p-2 rounded-lg ${
                              settings.systemReady 
                              ? 'bg-emerald-500/20 text-emerald-300' 
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                              {settings.systemReady ? '✓ النظام نشط وجاهز للعمل' : '⚠ النظام معطل - جميع الوظائف متوقفة'}
                          </div>
                      </div>

                      {/* Toggle 2 - School Active */}
                      <div className={`p-5 rounded-2xl border transition-all ${
                          settings.schoolActive 
                          ? 'bg-blue-500/10 border-blue-500/30' 
                          : 'bg-amber-500/10 border-amber-500/30'
                      }`}>
                          <div className="flex items-center justify-between mb-2">
                              <div>
                                  <div className="font-bold text-white">تفعيل المدرسة</div>
                                  <div className="text-xs text-gray-400">School Active</div>
                              </div>
                              <button 
                                  onClick={() => toggleSetting('schoolActive')} 
                                  className={`hover:scale-110 transition-transform ${
                                      settings.schoolActive ? 'text-blue-400' : 'text-amber-400'
                                  }`}
                              >
                                  {settings.schoolActive ? <ToggleRight className="w-10 h-10" /> : <ToggleLeft className="w-10 h-10" />}
                              </button>
                          </div>
                          <div className={`text-xs mt-2 p-2 rounded-lg ${
                              settings.schoolActive 
                              ? 'bg-blue-500/20 text-blue-300' 
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                              {settings.schoolActive ? '✓ المدرسة نشطة - الحضور مفعّل' : '⚠ المدرسة معطلة - لا يمكن تسجيل الحضور'}
                          </div>
                      </div>

                       {/* Storage Mode Switcher (Existing Logic) */}
                       <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                          <div className="font-bold text-gray-200 mb-2 flex items-center gap-2">
                              <Database className="w-4 h-4" /> وضع التخزين
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => db.setMode('local')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentMode === 'local' ? 'bg-emerald-600 text-white' : 'bg-white/5 text-gray-500'}`}
                              >
                                  Local
                              </button>
                              <button 
                                onClick={() => db.setMode('cloud')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentMode === 'cloud' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500'}`}
                              >
                                  Cloud
                              </button>
                          </div>
                       </div>
                  </div>
              </div>
              
              {/* Theme Settings - Enhanced */}
              <div className="glass-card p-6 rounded-[2rem] border border-white/10">
                  <h3 className="font-bold flex items-center gap-2 mb-4 text-white text-lg font-serif">
                     <Palette className="text-secondary-400 w-5 h-5" /> ثيمات النظام
                  </h3>
                  <p className="text-xs text-gray-400 mb-4">اختر ثيم لتغيير مظهر النظام بالكامل</p>
                  
                  <div className="space-y-3">
                      {Object.entries(THEME_CONFIG).map(([key, config]) => (
                          <button 
                              key={key}
                              onClick={() => selectTheme(key)} 
                              className={`w-full p-4 rounded-xl border transition-all group text-right ${
                                  pendingTheme === key 
                                      ? 'border-primary-500 bg-primary-500/20 ring-2 ring-primary-500/30' 
                                      : 'border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10'
                              }`}
                          >
                              <div className="flex items-center gap-3">
                                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg group-hover:scale-110 transition-transform flex items-center justify-center`}>
                                      <span className="text-white text-lg">{config.emoji}</span>
                                  </div>
                                  <div className="flex-1">
                                      <div className="font-bold text-white group-hover:text-primary-300 transition-colors">{config.name}</div>
                                      <div className="text-xs text-gray-500">{config.nameEn}</div>
                                  </div>
                                  <div className="flex gap-1">
                                      <div className={`w-4 h-4 rounded-full ${config.colors[0]}`}></div>
                                      <div className={`w-4 h-4 rounded-full ${config.colors[1]}`}></div>
                                  </div>
                                  {pendingTheme === key && (
                                      <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                                          <Check className="w-4 h-4 text-white" />
                                      </div>
                                  )}
                              </div>
                          </button>
                      ))}
                  </div>

                  {/* Confirmation Buttons */}
                  {pendingTheme && (
                      <div className="mt-4 p-4 bg-primary-500/10 border border-primary-500/30 rounded-xl animate-fade-in">
                          <div className="flex items-center gap-3 mb-3">
                              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${THEME_CONFIG[pendingTheme].gradient} flex items-center justify-center`}>
                                  <span className="text-white">{THEME_CONFIG[pendingTheme].emoji}</span>
                              </div>
                              <div>
                                  <p className="text-white font-bold">تأكيد تغيير الثيم</p>
                                  <p className="text-xs text-gray-400">سيتم تطبيق ثيم "{THEME_CONFIG[pendingTheme].name}" على النظام</p>
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button 
                                  onClick={confirmThemeChange}
                                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                              >
                                  <Check className="w-5 h-5" /> تأكيد
                              </button>
                              <button 
                                  onClick={cancelThemeChange}
                                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-gray-300 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                              >
                                  <X className="w-5 h-5" /> إلغاء
                              </button>
                          </div>
                      </div>
                  )}

                  {!pendingTheme && (
                      <div className="mt-4 p-3 bg-black/20 rounded-xl border border-white/5">
                          <p className="text-xs text-gray-500 text-center">
                              💡 اضغط على الثيم المطلوب ثم أكّد الاختيار
                          </p>
                      </div>
                  )}
              </div>

              {/* Logo Settings */}
              <div className="glass-card p-6 rounded-[2rem] border border-white/10">
                  <h3 className="font-bold flex items-center gap-2 mb-4 text-white text-lg font-serif">
                     <Image className="text-primary-400 w-5 h-5" /> هوية المدرسة
                  </h3>
                  <div className="space-y-2">
                      <label className="text-xs text-gray-400">رابط الشعار (Logo URL)</label>
                      <div className="flex gap-2">
                          <input 
                            type="text" 
                            className="w-full input-glass p-3 rounded-xl text-sm" 
                            placeholder="https://..."
                            value={settings.logoUrl}
                            onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                          />
                          <button onClick={saveLogo} className="p-3 bg-white/10 rounded-xl hover:bg-primary-600 transition-colors">
                              <Save className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              </div>

              {/* Social Links Management */}
              <div className="glass-card p-6 rounded-[2rem] border border-white/10">
                  <h3 className="font-bold flex items-center gap-2 mb-4 text-white text-lg font-serif">
                     <Link className="text-cyan-400 w-5 h-5" /> روابط التواصل (الفوتر)
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">هذه الروابط ستظهر كأيقونات في أسفل صفحات النظام</p>
                  
                  <div className="space-y-4">
                      {/* Support URL */}
                      <div className="space-y-2">
                          <label className="text-xs text-gray-400 flex items-center gap-2">
                            <Headset className="w-3 h-3 text-blue-400" /> رابط الدعم الفني
                          </label>
                          <input 
                            type="text" 
                            className="w-full input-glass p-3 rounded-xl text-sm" 
                            placeholder="https://support.example.com"
                            value={socialLinks.supportUrl || ''}
                            onChange={(e) => setSocialLinks({...socialLinks, supportUrl: e.target.value})}
                          />
                      </div>
                      
                      {/* WhatsApp */}
                      <div className="space-y-2">
                          <label className="text-xs text-gray-400 flex items-center gap-2">
                            <MessageCircle className="w-3 h-3 text-emerald-400" /> رقم واتساب
                          </label>
                          <input 
                            type="text" 
                            className="w-full input-glass p-3 rounded-xl text-sm font-mono" 
                            placeholder="966501234567 أو https://wa.me/..."
                            value={socialLinks.whatsapp || ''}
                            onChange={(e) => setSocialLinks({...socialLinks, whatsapp: e.target.value})}
                          />
                          <p className="text-[10px] text-gray-600">أدخل الرقم مع رمز الدولة بدون + أو رابط كامل</p>
                      </div>
                      
                      {/* Instagram */}
                      <div className="space-y-2">
                          <label className="text-xs text-gray-400 flex items-center gap-2">
                            <Instagram className="w-3 h-3 text-pink-400" /> حساب انستجرام
                          </label>
                          <input 
                            type="text" 
                            className="w-full input-glass p-3 rounded-xl text-sm" 
                            placeholder="@username أو https://instagram.com/..."
                            value={socialLinks.instagram || ''}
                            onChange={(e) => setSocialLinks({...socialLinks, instagram: e.target.value})}
                          />
                      </div>
                      
                      {/* Save Button */}
                      <button 
                        onClick={saveSocialLinks} 
                        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                      >
                          <Save className="w-4 h-4" />
                          حفظ روابط التواصل
                      </button>
                      
                      {/* Preview */}
                      {(socialLinks.supportUrl || socialLinks.whatsapp || socialLinks.instagram) && (
                        <div className="pt-4 border-t border-white/10">
                            <p className="text-xs text-gray-500 mb-3">معاينة الأيقونات:</p>
                            <div className="flex items-center justify-center gap-4 p-4 bg-black/20 rounded-xl">
                                {socialLinks.supportUrl && (
                                    <span className="text-gray-500 hover:text-blue-400 transition-all cursor-pointer hover:scale-110" title="الدعم الفني">
                                        <Headset className="w-5 h-5" />
                                    </span>
                                )}
                                {socialLinks.whatsapp && (
                                    <span className="text-gray-500 hover:text-emerald-400 transition-all cursor-pointer hover:scale-110" title="واتساب">
                                        <MessageCircle className="w-5 h-5" />
                                    </span>
                                )}
                                {socialLinks.instagram && (
                                    <span className="text-gray-500 hover:text-pink-400 transition-all cursor-pointer hover:scale-110" title="انستجرام">
                                        <Instagram className="w-5 h-5" />
                                    </span>
                                )}
                            </div>
                        </div>
                      )}
                  </div>
              </div>
          </div>

          {/* 2. Smart Diagnostics Dashboard */}
          <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-8 rounded-[2rem] border border-white/10">
                  <div className="flex justify-between items-center mb-6">
                      <div>
                          <h3 className="font-bold flex items-center gap-3 text-white text-xl font-serif mb-1">
                             <ShieldCheck className="text-emerald-400 w-6 h-6" /> لوحة تحليل الأخطاء
                          </h3>
                          <p className="text-xs text-gray-400">فحص شامل لحالة النظام والبيانات</p>
                      </div>
                      <button 
                          onClick={runDiagnostics} 
                          disabled={diagLoading} 
                          className="px-4 py-2 bg-primary-600/20 border border-primary-500/30 rounded-xl text-primary-300 hover:bg-primary-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
                      >
                          {diagLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          فحص الآن
                      </button>
                  </div>

                  {diagnostics.length === 0 && !diagLoading && (
                      <div className="text-center py-12 text-gray-500">
                          <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                          <p>لم يتم تشغيل الفحص بعد. اضغط "فحص الآن" للبدء.</p>
                      </div>
                  )}

                  {diagLoading && (
                      <div className="text-center py-12">
                          <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary-400 animate-spin" />
                          <p className="text-gray-400">جاري فحص النظام...</p>
                      </div>
                  )}

                  {diagnostics.length > 0 && !diagLoading && (
                      <>
                          <div className="mb-4 flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                  <span className="text-gray-400">سليم ({diagnostics.filter(d => d.status === 'ok').length})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                  <span className="text-gray-400">تحذير ({diagnostics.filter(d => d.status === 'warning').length})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                  <span className="text-gray-400">خطأ ({diagnostics.filter(d => d.status === 'error').length})</span>
                              </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {diagnostics.map((diag) => (
                                  <div 
                                    key={diag.key} 
                                    className={`p-5 rounded-2xl border backdrop-blur-sm transition-all hover:scale-[1.02] ${
                                        diag.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-500/10' :
                                        diag.status === 'warning' ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/10' :
                                        'bg-red-500/10 border-red-500/30 shadow-red-500/10'
                                    }`}
                                  >
                                      <div className="flex justify-between items-start mb-3">
                                          <h4 className={`font-bold text-lg ${
                                              diag.status === 'ok' ? 'text-emerald-400' :
                                              diag.status === 'warning' ? 'text-amber-400' : 'text-red-400'
                                          }`}>{diag.title}</h4>
                                          
                                          {diag.status === 'ok' ? <CheckCircle className="w-6 h-6 text-emerald-500" /> :
                                           diag.status === 'warning' ? <AlertTriangle className="w-6 h-6 text-amber-500" /> :
                                           <XCircle className="w-6 h-6 text-red-500" />}
                                      </div>
                                      <p className="text-sm text-gray-300 mb-3 leading-relaxed">{diag.message}</p>
                                      {diag.count !== undefined && (
                                          <div className="text-xs bg-black/20 px-2 py-1 rounded-lg text-gray-400 inline-block mb-2">
                                              العدد: {diag.count}
                                          </div>
                                      )}
                                      {diag.hint && (
                                          <div className="text-xs bg-black/30 p-3 rounded-lg text-gray-300 border border-white/10 flex items-start gap-2 mt-3">
                                              <span className="text-primary-400 font-bold text-base">💡</span>
                                              <div>
                                                  <div className="font-bold text-primary-400 mb-1">اقتراح الإصلاح:</div>
                                                  <div>{diag.hint}</div>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              ))}
                          </div>
                      </>
                  )}
              </div>

              {/* 3. Broadcast Center - Enhanced */}
              <div className="glass-card p-8 rounded-[2rem] border border-white/10">
                  <h3 className="font-bold flex items-center gap-3 mb-6 text-white text-xl font-serif">
                     <Megaphone className="text-secondary-400 w-6 h-6" /> مركز البث والإعلانات
                  </h3>
                  
                  <div className="space-y-6">
                      {/* Message Type Selection */}
                      <div className="grid grid-cols-3 gap-3">
                          <button
                              onClick={() => setBroadcast({...broadcast, type: 'announcement'})}
                              className={`p-4 rounded-xl border transition-all ${
                                  broadcast.type === 'announcement' 
                                  ? 'bg-primary-500/20 border-primary-500 text-primary-400' 
                                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                              }`}
                          >
                              <div className="font-bold mb-1">إعلان</div>
                              <div className="text-xs">إعلانات عامة</div>
                          </button>
                          <button
                              onClick={() => setBroadcast({...broadcast, type: 'general'})}
                              className={`p-4 rounded-xl border transition-all ${
                                  broadcast.type === 'general' 
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-400' 
                                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                              }`}
                          >
                              <div className="font-bold mb-1">تنبيه</div>
                              <div className="text-xs">تنبيهات مهمة</div>
                          </button>
                          <button
                              onClick={() => setBroadcast({...broadcast, type: 'command'})}
                              className={`p-4 rounded-xl border transition-all ${
                                  broadcast.type === 'command' 
                                  ? 'bg-red-500/20 border-red-500 text-red-400' 
                                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                              }`}
                          >
                              <div className="font-bold mb-1">أمر</div>
                              <div className="text-xs">أوامر تنفيذية</div>
                          </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm text-gray-400 mb-2">الجمهور المستهدف</label>
                              <select 
                                  className="w-full input-glass p-4 rounded-xl"
                                  value={broadcast.role}
                                  onChange={(e) => setBroadcast({...broadcast, role: e.target.value})}
                              >
                                  <option value="all">الجميع (All Users)</option>
                                  <option value="admin">الإدارة (Admins)</option>
                                  <option value="supervisor">المشرفين (Supervisors)</option>
                                  <option value="guardian">أولياء الأمور (Guardians)</option>
                                  <option value="kiosk">كشك الحضور (Kiosk)</option>
                              </select>
                          </div>
                          <div className="flex items-end">
                              <label className="flex items-center gap-2 p-4 bg-white/5 rounded-xl border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
                                  <input 
                                      type="checkbox" 
                                      checked={broadcast.isPopup}
                                      onChange={(e) => setBroadcast({...broadcast, isPopup: e.target.checked})}
                                      className="w-4 h-4 rounded"
                                  />
                                  <span className="text-sm text-gray-300">إظهار كمنبّه فوري (Popup)</span>
                              </label>
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-sm text-gray-400 mb-2">عنوان الرسالة</label>
                          <input
                              type="text"
                              className="w-full input-glass p-4 rounded-xl"
                              placeholder="مثال: إعلان مهم / تنبيه عاجل / تذكير"
                              value={broadcast.title}
                              onChange={(e) => setBroadcast({...broadcast, title: e.target.value})}
                          />
                      </div>
                      
                      <div>
                          <label className="block text-sm text-gray-400 mb-2">نص الرسالة</label>
                          <textarea 
                              className="w-full input-glass p-4 rounded-xl h-32 resize-none"
                              placeholder="اكتب محتوى الرسالة هنا..."
                              value={broadcast.message}
                              onChange={(e) => setBroadcast({...broadcast, message: e.target.value})}
                          />
                      </div>
                      
                      <button 
                          onClick={handleBroadcast}
                          disabled={!broadcast.message || !broadcast.title}
                          className="w-full py-4 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl font-bold text-white shadow-lg hover:shadow-primary-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <Send className="w-5 h-5" /> إرسال الرسالة
                      </button>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};

export default Support;