
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { Scan, Sparkles, Loader2, Wifi, Home, CheckCircle, AlertTriangle, Clock, Calendar, Timer, X, LogOut } from 'lucide-react';
import { KioskSettings, KioskTheme, Student, KioskDisplaySize } from '../types';

// Enhanced attendance result type
interface AttendanceResult {
  type: 'success' | 'error';
  message: string;
  student?: Student;
  isLate?: boolean;
  stats?: { lateCount: number; todayMinutes: number; totalMinutes: number };
}

// Size configuration helpers
const CLOCK_SIZE_CLASSES: Record<KioskDisplaySize, string> = {
  small: 'text-4xl md:text-6xl',
  medium: 'text-5xl md:text-7xl',
  large: 'text-7xl md:text-9xl',
  xlarge: 'text-8xl md:text-[10rem]'
};

const TITLE_SIZE_CLASSES: Record<KioskDisplaySize, string> = {
  small: 'text-3xl md:text-4xl',
  medium: 'text-4xl md:text-5xl',
  large: 'text-6xl md:text-7xl',
  xlarge: 'text-7xl md:text-8xl'
};

const INPUT_SIZE_CLASSES: Record<KioskDisplaySize, { text: string; padding: string }> = {
  small: { text: 'text-3xl md:text-4xl', padding: 'py-4' },
  medium: { text: 'text-4xl md:text-5xl', padding: 'py-6' },
  large: { text: 'text-5xl md:text-6xl', padding: 'py-8' },
  xlarge: { text: 'text-6xl md:text-7xl', padding: 'py-10' }
};

const CARD_SIZE_CLASSES: Record<KioskDisplaySize, { padding: string; text: string; icon: string }> = {
  small: { padding: 'p-4', text: 'text-sm', icon: 'w-4 h-4' },
  medium: { padding: 'p-5', text: 'text-base', icon: 'w-5 h-5' },
  large: { padding: 'p-6', text: 'text-lg', icon: 'w-6 h-6' },
  xlarge: { padding: 'p-8', text: 'text-xl', icon: 'w-8 h-8' }
};

// Theme configurations
const KIOSK_THEMES: Record<KioskTheme, {
  bg: string;
  blob1: string;
  blob2: string;
  accent: string;
  text: string;
  subText: string;
  inputBg: string;
  inputBorder: string;
  glowFrom: string;
  glowTo: string;
  isDark: boolean;
}> = {
  'dark-neon': {
    bg: 'bg-[#0a0f1a]',
    blob1: 'bg-cyan-500/20',
    blob2: 'bg-fuchsia-500/20',
    accent: 'text-cyan-400',
    text: 'text-white',
    subText: 'text-cyan-300',
    inputBg: 'bg-slate-900/60',
    inputBorder: 'border-cyan-500/30',
    glowFrom: 'from-cyan-400',
    glowTo: 'to-fuchsia-400',
    isDark: true
  },
  'dark-gradient': {
    bg: 'bg-gradient-to-br from-violet-950 via-purple-900 to-fuchsia-950',
    blob1: 'bg-violet-500/30',
    blob2: 'bg-pink-500/20',
    accent: 'text-violet-300',
    text: 'text-white',
    subText: 'text-purple-200',
    inputBg: 'bg-purple-950/60',
    inputBorder: 'border-violet-400/30',
    glowFrom: 'from-violet-400',
    glowTo: 'to-pink-400',
    isDark: true
  },
  'light-clean': {
    bg: 'bg-gradient-to-br from-gray-100 via-white to-blue-50',
    blob1: 'bg-blue-400/20',
    blob2: 'bg-indigo-400/20',
    accent: 'text-blue-600',
    text: 'text-gray-800',
    subText: 'text-blue-500',
    inputBg: 'bg-white/90',
    inputBorder: 'border-blue-300',
    glowFrom: 'from-blue-400',
    glowTo: 'to-indigo-400',
    isDark: false
  },
  'light-soft': {
    bg: 'bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50',
    blob1: 'bg-rose-300/30',
    blob2: 'bg-amber-300/30',
    accent: 'text-rose-500',
    text: 'text-gray-700',
    subText: 'text-rose-400',
    inputBg: 'bg-white/80',
    inputBorder: 'border-rose-200',
    glowFrom: 'from-rose-300',
    glowTo: 'to-amber-300',
    isDark: false
  },
  'ocean-blue': {
    bg: 'bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900',
    blob1: 'bg-sky-400/30',
    blob2: 'bg-blue-400/20',
    accent: 'text-sky-200',
    text: 'text-white',
    subText: 'text-sky-300',
    inputBg: 'bg-blue-900/60',
    inputBorder: 'border-sky-400/30',
    glowFrom: 'from-sky-300',
    glowTo: 'to-blue-400',
    isDark: true
  },
  'sunset-warm': {
    bg: 'bg-gradient-to-br from-orange-500 via-rose-500 to-purple-700',
    blob1: 'bg-yellow-400/30',
    blob2: 'bg-rose-400/30',
    accent: 'text-yellow-200',
    text: 'text-white',
    subText: 'text-orange-200',
    inputBg: 'bg-orange-900/50',
    inputBorder: 'border-yellow-400/30',
    glowFrom: 'from-yellow-300',
    glowTo: 'to-rose-400',
    isDark: true
  },
  'forest-green': {
    bg: 'bg-gradient-to-br from-emerald-700 via-green-800 to-teal-900',
    blob1: 'bg-emerald-400/30',
    blob2: 'bg-teal-400/20',
    accent: 'text-emerald-300',
    text: 'text-white',
    subText: 'text-emerald-200',
    inputBg: 'bg-green-950/60',
    inputBorder: 'border-emerald-400/30',
    glowFrom: 'from-emerald-300',
    glowTo: 'to-teal-400',
    isDark: true
  },
  'royal-purple': {
    bg: 'bg-gradient-to-br from-purple-800 via-fuchsia-800 to-pink-900',
    blob1: 'bg-fuchsia-400/30',
    blob2: 'bg-pink-400/20',
    accent: 'text-fuchsia-300',
    text: 'text-white',
    subText: 'text-pink-200',
    inputBg: 'bg-purple-950/60',
    inputBorder: 'border-fuchsia-400/30',
    glowFrom: 'from-fuchsia-300',
    glowTo: 'to-pink-400',
    isDark: true
  }
};

const Kiosk: React.FC = () => {
  const navigate = useNavigate();
  const [inputId, setInputId] = useState('');
  const [attendanceResult, setAttendanceResult] = useState<AttendanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLateTime, setIsLateTime] = useState(false);
  const [screensaverActive, setScreensaverActive] = useState(false);
  const [commandPopup, setCommandPopup] = useState<string | null>(null);
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [screensaverIndex, setScreensaverIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle exit to main system
  const handleExit = () => {
    if (window.confirm('هل تريد الخروج من وضع الكشك؟')) {
      navigate('/');
    }
  };

  // Handle logout
  const handleLogout = () => {
    if (window.confirm('هل تريد تسجيل الخروج من النظام؟')) {
      auth.logout();
      window.location.href = '/';
    }
  };

  // Load kiosk settings and preload students for offline-first on mount
  useEffect(() => {
    // Silently preload students for instant attendance
    db.preloadForKiosk().catch(console.warn);

    db.getSettings().then(s => {
      // Merge SystemSettings with default KioskSettings (in case DB doesn't have all fields yet)
      const kioskDefaults: KioskSettings = {
        mainTitle: 'مرحباً في نظام الحضور الذكي',
        subTitle: 'لطفاً انتظر التعليمات أو مرر البطاقة',
        earlyMessage: 'أهلًا بك! وصلت في الوقت المناسب',
        lateMessage: 'لقد تأخرت عن التجمع، راجع الإدارة',
        showStats: true,
        theme: 'dark-neon',
        displaySettings: {
          clockSize: 'large',
          titleSize: 'large',
          cardSize: 'medium',
          inputSize: 'large'
        }
      };
      // Convert through unknown to handle different theme types
      setSettings({ ...kioskDefaults, ...(s as unknown as Partial<KioskSettings>) });
    });
  }, []);

  // Real-time clock and late status check
  useEffect(() => {
    const checkLateStatus = () => {
      const now = new Date();
      setCurrentTime(now);
      
      if (settings) {
        const assemblyTime = settings.assemblyTime || '07:30';
        const gracePeriod = settings.gracePeriod || 0;
        const [h, m] = assemblyTime.split(':').map(Number);
        const cutoffTime = new Date(now);
        cutoffTime.setHours(h, m + gracePeriod, 0, 0);
        setIsLateTime(now.getTime() > cutoffTime.getTime());
      }
    };
    
    checkLateStatus(); // Initial check
    const timer = setInterval(checkLateStatus, 1000); // Update every second
    
    return () => clearInterval(timer);
  }, [settings]);

  // Screensaver image rotation effect
  useEffect(() => {
    let timer: any = null;
    if (screensaverActive && settings?.screensaverImages && settings.screensaverImages.length > 0) {
      timer = setInterval(() => {
        setScreensaverIndex(prev => (prev + 1) % settings.screensaverImages!.length);
      }, 4000);
    }
    return () => timer && clearInterval(timer);
  }, [screensaverActive, settings]);

  // Screensaver phrases rotation effect
  useEffect(() => {
    let timer: any = null;
    if (screensaverActive && settings?.screensaverPhrases && settings.screensaverPhrases.length > 0) {
      timer = setInterval(() => {
        setPhraseIndex(prev => (prev + 1) % settings.screensaverPhrases!.length);
      }, 5000); // Change phrase every 5 seconds
    }
    return () => timer && clearInterval(timer);
  }, [screensaverActive, settings]);

  // Screensaver inactivity detection effect
  useEffect(() => {
    if (!settings?.screensaverEnabled || !settings.screensaverTimeout) return;
    let timer: NodeJS.Timeout | null = null;
    const resetTimeout = () => {
      setScreensaverActive(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScreensaverActive(true), settings.screensaverTimeout!);
    }
    // Reset timer on activities
    window.addEventListener('keydown', resetTimeout);
    window.addEventListener('mousedown', resetTimeout);
    window.addEventListener('touchstart', resetTimeout);
    resetTimeout();
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('keydown', resetTimeout);
      window.removeEventListener('mousedown', resetTimeout);
      window.removeEventListener('touchstart', resetTimeout);
    }
  }, [settings]);

  useEffect(() => {
    // Initial focus
    inputRef.current?.focus();
  }, [loading]);

  // Subscribe to admin remote control for the kiosk
  useEffect(() => {
    const unsub = db.subscribeToNotifications('kiosk', notif => {
      // force screensaver
      if (notif.type === 'command' && /force screensaver/i.test(notif.message)) {
        setScreensaverActive(true);
      }
      // popup command
      else if (notif.type === 'command' && /popup/i.test(notif.message)) {
        setCommandPopup(notif.message);
        setTimeout(() => setCommandPopup(null), 8000);
      }
      // Play audio/simple beep
      else if (notif.type === 'command' && /play audio/i.test(notif.message)) {
        try { new Audio('/beep.mp3').play(); } catch(e) { /* fallback beep */ window.navigator.vibrate?.(200); }
      }
    });
    const handleDismiss = (e: KeyboardEvent | MouseEvent) => screensaverActive && setScreensaverActive(false);
    window.addEventListener('keydown', handleDismiss);
    window.addEventListener('mousedown', handleDismiss);
    return () => {
      unsub.unsubscribe();
      window.removeEventListener('keydown', handleDismiss);
      window.removeEventListener('mousedown', handleDismiss);
    };
  }, [screensaverActive]);

  const handleBlur = () => {
      // Gentle Re-focus logic
      if (!loading) {
          setTimeout(() => inputRef.current?.focus(), 100);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputId || loading) return;

    setLoading(true);
    // Use markAttendanceFast for instant response (Offline-First)
    const result = await db.markAttendanceFast(inputId);
    setLoading(false);
    
    if (result.success && result.student) {
      const isLate = result.record?.status === 'late';
      setAttendanceResult({
        type: 'success',
        message: result.message,
        student: result.student,
        isLate,
        stats: result.stats
      });
    } else {
      setAttendanceResult({
        type: 'error',
        message: result.message
      });
    }

    setInputId('');
    // Keep focus after submission
    inputRef.current?.focus();
    
    // Auto-dismiss after 8 seconds for success, 5 for error
    setTimeout(() => setAttendanceResult(null), result.success ? 8000 : 5000);
  };
  
  // Dismiss result card
  const dismissResult = () => setAttendanceResult(null);

  // --- Screensaver overlay UI ---
  const screensaver = screensaverActive && (
    <div className="fixed inset-0 z-[160] overflow-hidden flex flex-col items-center justify-center bg-gradient-to-br from-primary-900 via-slate-900 to-secondary-900" onClick={()=>setScreensaverActive(false)} dir="rtl">
      
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-primary-500 rounded-full blur-[160px] opacity-30 animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-secondary-500 rounded-full blur-[140px] opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full p-8">
        
        {/* Header Image if exists */}
        {settings?.headerImage && (
          <img src={settings.headerImage} alt="header" className="max-h-28 md:max-h-36 mx-auto mb-6 drop-shadow-2xl rounded-2xl border border-white/10 bg-white/10 animate-fade-in" />
        )}

        {/* Screensaver images slider */}
        {settings?.screensaverImages && settings.screensaverImages.length > 0 && (
          <div className="relative w-[90vw] max-w-[800px] aspect-video mx-auto mb-6 rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            {settings.screensaverImages.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`slider_${idx}`}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
                  idx === screensaverIndex 
                    ? 'opacity-100 scale-100' 
                    : 'opacity-0 scale-105'
                }`}
              />
            ))}
            {/* Image indicators */}
            {settings.screensaverImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {settings.screensaverImages.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      idx === screensaverIndex 
                        ? 'bg-white w-6' 
                        : 'bg-white/40'
                    }`} 
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom Text - Top Position */}
        {settings?.screensaverCustomText?.enabled && 
         settings.screensaverCustomText.text && 
         settings.screensaverCustomText.position === 'top' && (
          <div className={`
            absolute top-8 inset-x-0 text-center px-4 animate-fade-in
            ${settings.screensaverCustomText.size === 'small' ? 'text-xl md:text-2xl' : ''}
            ${settings.screensaverCustomText.size === 'medium' ? 'text-2xl md:text-4xl' : ''}
            ${settings.screensaverCustomText.size === 'large' ? 'text-4xl md:text-6xl' : ''}
            ${settings.screensaverCustomText.size === 'xlarge' ? 'text-5xl md:text-8xl' : ''}
            font-bold text-white drop-shadow-2xl font-serif
          `}>
            {settings.screensaverCustomText.text}
          </div>
        )}

        {/* Text content - Center */}
        <div className="text-center mt-4 max-w-4xl mx-auto">
          
          {/* Custom Text - Center Position */}
          {settings?.screensaverCustomText?.enabled && 
           settings.screensaverCustomText.text && 
           settings.screensaverCustomText.position === 'center' && (
            <h1 className={`
              mb-6 font-bold text-white drop-shadow-2xl font-serif animate-fade-in
              ${settings.screensaverCustomText.size === 'small' ? 'text-2xl md:text-3xl' : ''}
              ${settings.screensaverCustomText.size === 'medium' ? 'text-3xl md:text-5xl' : ''}
              ${settings.screensaverCustomText.size === 'large' ? 'text-5xl md:text-7xl' : ''}
              ${settings.screensaverCustomText.size === 'xlarge' ? 'text-6xl md:text-9xl' : ''}
            `}>
              {settings.screensaverCustomText.text}
            </h1>
          )}

          {/* Rotating Phrases */}
          {settings?.screensaverPhrases && settings.screensaverPhrases.length > 0 && (
            <div className="relative h-20 md:h-24 flex items-center justify-center overflow-hidden my-6">
              {settings.screensaverPhrases.map((phrase, idx) => (
                <p 
                  key={idx}
                  className={`absolute text-2xl md:text-4xl font-bold transition-all duration-700 ease-in-out ${
                    idx === phraseIndex 
                      ? 'opacity-100 translate-y-0 text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-pink-400 to-secondary-400' 
                      : 'opacity-0 translate-y-8'
                  }`}
                >
                  ✨ {phrase} ✨
                </p>
              ))}
              {/* Phrase indicators */}
              {settings.screensaverPhrases.length > 1 && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {settings.screensaverPhrases.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        idx === phraseIndex 
                          ? 'bg-primary-400' 
                          : 'bg-white/20'
                      }`} 
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Time */}
          <div className="text-4xl md:text-6xl font-mono text-white/80 font-bold mt-6 mb-4">
            {new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          {/* Exit hint */}
          <div className="mt-6 text-pink-300 text-lg bg-black/30 inline-block px-6 py-2 rounded-2xl backdrop-blur-sm animate-pulse">
            المس الشاشة أو اضغط أي زر للخروج
          </div>
        </div>

        {/* Custom Text - Bottom Position */}
        {settings?.screensaverCustomText?.enabled && 
         settings.screensaverCustomText.text && 
         settings.screensaverCustomText.position === 'bottom' && (
          <div className={`
            absolute bottom-24 inset-x-0 text-center px-4 animate-fade-in
            ${settings.screensaverCustomText.size === 'small' ? 'text-xl md:text-2xl' : ''}
            ${settings.screensaverCustomText.size === 'medium' ? 'text-2xl md:text-4xl' : ''}
            ${settings.screensaverCustomText.size === 'large' ? 'text-4xl md:text-6xl' : ''}
            ${settings.screensaverCustomText.size === 'xlarge' ? 'text-5xl md:text-8xl' : ''}
            font-bold text-white drop-shadow-2xl font-serif
          `}>
            {settings.screensaverCustomText.text}
          </div>
        )}
      </div>
    </div>
  );
  
  // --- Command popup overlay ---
  const popupOverlay = commandPopup && (
    <div className="fixed top-8 inset-x-0 z-[170] flex justify-center pointer-events-none animate-fade-in-up">
      <div className="glass-card border border-pink-400/40 bg-primary-900/90 px-12 py-6 rounded-3xl shadow-2xl backdrop-blur-2xl text-center text-3xl text-white font-bold pointer-events-auto animate-pulse-slow">
        {commandPopup.replace(/popup:/i, '')}
        <button className="block mx-auto mt-8 text-xs bg-white/10 text-pink-400 font-bold rounded-xl px-4 py-1 hover:bg-pink-600/10 transition" onClick={()=>setCommandPopup(null)}>إغلاق</button>
      </div>
    </div>
  );

  // Get current theme configuration
  const theme = useMemo(() => {
    const themeKey = settings?.theme || 'dark-neon';
    return KIOSK_THEMES[themeKey] || KIOSK_THEMES['dark-neon'];
  }, [settings?.theme]);

  return (
    <div 
      className={`min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden relative ${theme.bg}`} 
      onClick={() => inputRef.current?.focus()}
    >
      {screensaver}
      {popupOverlay}
      
      {/* Exit Button - Top Right */}
      {/* Control Buttons */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        {/* Home Button */}
        <button 
          onClick={handleExit}
          className={`p-3 ${theme.isDark ? 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-400 hover:text-white' : 'bg-black/5 hover:bg-black/10 border-black/10 text-gray-600 hover:text-gray-900'} border rounded-xl transition-all group backdrop-blur-md`}
          title="الرئيسية"
        >
          <Home className="w-5 h-5" />
        </button>
        
        {/* Logout Button */}
        <button 
          onClick={handleLogout}
          className={`p-3 ${theme.isDark ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400 hover:text-red-300' : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600 hover:text-red-700'} border rounded-xl transition-all group backdrop-blur-md`}
          title="تسجيل الخروج"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Header Image (if exists) */}
      {settings?.headerImage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40">
          <img 
            src={settings.headerImage} 
            alt="Header" 
            className={`max-h-16 md:max-h-20 rounded-xl ${theme.isDark ? 'border-white/20' : 'border-black/10'} border shadow-lg`}
          />
        </div>
      )}

      {/* Dynamic Background Blobs */}
      <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
          <div className={`absolute top-1/4 left-1/4 w-[800px] h-[800px] ${theme.blob1} rounded-full blur-[120px] mix-blend-screen animate-pulse-slow`}></div>
          <div className={`absolute bottom-1/4 right-1/4 w-[600px] h-[600px] ${theme.blob2} rounded-full blur-[100px] mix-blend-screen animate-blob`}></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className={`absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] ${theme.isDark ? 'opacity-20' : 'opacity-10'} z-[1]`}></div>
      
      <div className="w-full max-w-4xl text-center space-y-16 relative z-10">
        <div className="space-y-4">
           <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full ${theme.isDark ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'} border backdrop-blur-md mb-8`}>
             <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
             <span className={`${theme.isDark ? 'text-gray-300' : 'text-gray-600'} text-sm font-mono tracking-widest uppercase flex items-center gap-2`}>
                Cloud Connected <Wifi className="w-3 h-3" />
             </span>
           </div>
           
           {/* Dynamic Title Size */}
           <h1 className={`font-bold font-serif ${theme.text} mb-2 tracking-wide ${TITLE_SIZE_CLASSES[settings?.displaySettings?.titleSize || 'large']} ${theme.isDark ? 'drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]' : 'drop-shadow-md'}`}>
             {settings?.mainTitle || 'تسجيل الحضور'}
           </h1>
           <p className={`${theme.subText} font-light tracking-wide flex items-center justify-center gap-2 mb-8 ${
             settings?.displaySettings?.titleSize === 'small' ? 'text-sm md:text-base' :
             settings?.displaySettings?.titleSize === 'xlarge' ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'
           }`}>
             <Sparkles className="w-5 h-5" />
             {settings?.subTitle || 'يرجى تمرير البطاقة أو إدخال الرقم المعرف'}
             <Sparkles className="w-5 h-5" />
           </p>
        </div>

        {/* Large Clock Display - Dynamic Size */}
        <div className={`w-full mx-auto mb-8 ${
          settings?.displaySettings?.cardSize === 'small' ? 'max-w-md' :
          settings?.displaySettings?.cardSize === 'xlarge' ? 'max-w-4xl' : 'max-w-2xl'
        }`}>
          <div className={`
            relative text-center rounded-3xl backdrop-blur-xl border transition-all duration-500
            ${CARD_SIZE_CLASSES[settings?.displaySettings?.cardSize || 'medium'].padding}
            ${isLateTime 
              ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_40px_rgba(239,68,68,0.2)]' 
              : 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]'
            }
          `}>
            {/* Status indicator */}
            <div className={`
              absolute top-4 right-4 flex items-center gap-2 px-3 py-1 rounded-full font-bold
              ${CARD_SIZE_CLASSES[settings?.displaySettings?.cardSize || 'medium'].text}
              ${isLateTime 
                ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }
            `}>
              <span className={`w-2 h-2 rounded-full ${isLateTime ? 'bg-red-400' : 'bg-emerald-400'} animate-pulse`}></span>
              {isLateTime ? 'وقت التأخير' : 'وقت الحضور'}
            </div>

            {/* Time Display - Dynamic Size */}
            <div className={`
              font-mono font-bold tracking-wider
              ${CLOCK_SIZE_CLASSES[settings?.displaySettings?.clockSize || 'large']}
              ${isLateTime 
                ? 'text-red-400 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]' 
                : 'text-emerald-400 drop-shadow-[0_0_30px_rgba(16,185,129,0.5)]'
              }
            `}>
              {currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>

            {/* Date Display */}
            <div className={`mt-2 ${CARD_SIZE_CLASSES[settings?.displaySettings?.cardSize || 'medium'].text} ${theme.isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {currentTime.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>

            {/* Assembly Time Info */}
            {settings?.assemblyTime && (
              <div className={`mt-3 text-sm ${isLateTime ? 'text-red-300/70' : 'text-emerald-300/70'}`}>
                موعد الطابور: {settings.assemblyTime} 
                {settings.gracePeriod ? ` • مهلة السماح: ${settings.gracePeriod} دقيقة` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Input Form - Dynamic Size */}
        <form onSubmit={handleSubmit} className={`w-full mx-auto relative group perspective-1000 ${
          settings?.displaySettings?.inputSize === 'small' ? 'max-w-md' :
          settings?.displaySettings?.inputSize === 'xlarge' ? 'max-w-4xl' : 'max-w-2xl'
        }`}>
          <div className={`absolute -inset-1 bg-gradient-to-r ${theme.glowFrom} via-white ${theme.glowTo} rounded-[2rem] blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200`}></div>
          
          <div className={`relative ${theme.inputBg} backdrop-blur-xl rounded-[1.9rem] p-2 ${theme.inputBorder} border shadow-2xl`}>
             <div className={`absolute left-8 top-1/2 -translate-y-1/2 ${theme.isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {loading ? <Loader2 className={`${CARD_SIZE_CLASSES[settings?.displaySettings?.inputSize || 'large'].icon} animate-spin ${theme.accent}`} /> : <Scan className={`${CARD_SIZE_CLASSES[settings?.displaySettings?.inputSize || 'large'].icon} animate-pulse`} />}
             </div>
             <input
                ref={inputRef}
                type="text"
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                onBlur={handleBlur}
                disabled={loading}
                className={`w-full bg-transparent ${theme.text} text-center font-mono ${INPUT_SIZE_CLASSES[settings?.displaySettings?.inputSize || 'large'].text} ${INPUT_SIZE_CLASSES[settings?.displaySettings?.inputSize || 'large'].padding} outline-none ${theme.isDark ? 'placeholder-gray-700' : 'placeholder-gray-300'} tracking-[0.5em] disabled:opacity-50`}
                placeholder="ID"
                autoComplete="off"
              />
          </div>
        </form>

        {/* Enhanced Attendance Result Card */}
        {attendanceResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={dismissResult}>
            <div 
              className={`
                w-full max-w-lg transform transition-all duration-500 ease-out animate-fade-in-up
                rounded-3xl shadow-2xl backdrop-blur-xl border overflow-hidden
                ${attendanceResult.type === 'success' 
                  ? attendanceResult.isLate 
                    ? 'bg-gradient-to-br from-amber-900/90 to-orange-900/90 border-amber-500/40 shadow-[0_0_60px_rgba(245,158,11,0.3)]'
                    : 'bg-gradient-to-br from-emerald-900/90 to-green-900/90 border-emerald-500/40 shadow-[0_0_60px_rgba(16,185,129,0.3)]'
                  : 'bg-gradient-to-br from-red-900/90 to-rose-900/90 border-red-500/40 shadow-[0_0_60px_rgba(239,68,68,0.3)]'
                }
              `}
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={dismissResult}
                className="absolute top-4 left-4 p-2 rounded-full bg-black/20 hover:bg-black/40 text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {attendanceResult.type === 'success' && attendanceResult.student ? (
                <>
                  {/* Success Header */}
                  <div className="p-6 pb-4 text-center">
                    {/* Status Icon */}
                    <div className={`
                      w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center
                      ${attendanceResult.isLate 
                        ? 'bg-amber-500/20 ring-4 ring-amber-500/30' 
                        : 'bg-emerald-500/20 ring-4 ring-emerald-500/30'
                      }
                    `}>
                      {attendanceResult.isLate 
                        ? <AlertTriangle className="w-10 h-10 text-amber-400" />
                        : <CheckCircle className="w-10 h-10 text-emerald-400" />
                      }
                    </div>

                    {/* Status Badge */}
                    <div className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4
                      ${attendanceResult.isLate 
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }
                    `}>
                      <span className={`w-2 h-2 rounded-full ${attendanceResult.isLate ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`}></span>
                      {attendanceResult.isLate ? 'متأخر' : 'حضور مبكر'}
                    </div>

                    {/* Student Name */}
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 font-serif">
                      {attendanceResult.student.name}
                    </h2>

                    {/* Class & Section */}
                    <p className="text-lg text-white/70">
                      {attendanceResult.student.className} - {attendanceResult.student.section}
                    </p>
                  </div>

                  {/* Motivational Message */}
                  <div className={`
                    mx-6 p-4 rounded-2xl text-center mb-4
                    ${attendanceResult.isLate 
                      ? 'bg-amber-500/10 border border-amber-500/20' 
                      : 'bg-emerald-500/10 border border-emerald-500/20'
                    }
                  `}>
                    <p className={`text-lg font-medium ${attendanceResult.isLate ? 'text-amber-200' : 'text-emerald-200'}`}>
                      {attendanceResult.message}
                    </p>
                  </div>

                  {/* Stats Section */}
                  {settings?.showStats && attendanceResult.stats && (
                    <div className="p-6 pt-2 border-t border-white/10">
                      <p className="text-xs text-white/40 text-center mb-3 uppercase tracking-wider">إحصائيات الانضباط</p>
                      <div className="grid grid-cols-3 gap-3">
                        {/* Late Count */}
                        <div className="p-3 rounded-xl bg-black/20 border border-white/10 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Calendar className="w-4 h-4 text-amber-400" />
                          </div>
                          <p className="text-2xl font-bold text-white font-mono">{attendanceResult.stats.lateCount}</p>
                          <p className="text-xs text-white/50">مرات التأخر</p>
                        </div>

                        {/* Today Minutes */}
                        <div className="p-3 rounded-xl bg-black/20 border border-white/10 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Clock className="w-4 h-4 text-blue-400" />
                          </div>
                          <p className="text-2xl font-bold text-white font-mono">{attendanceResult.stats.todayMinutes}</p>
                          <p className="text-xs text-white/50">تأخر اليوم (د)</p>
                        </div>

                        {/* Total Minutes */}
                        <div className="p-3 rounded-xl bg-black/20 border border-white/10 text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Timer className="w-4 h-4 text-purple-400" />
                          </div>
                          <p className="text-2xl font-bold text-white font-mono">{attendanceResult.stats.totalMinutes}</p>
                          <p className="text-xs text-white/50">إجمالي (د)</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Time */}
                  <div className="px-6 pb-4 text-center">
                    <p className="text-sm text-white/40">
                      {new Date().toLocaleTimeString('ar-SA')} • {new Date().toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </>
              ) : (
                /* Error Card */
                <div className="p-8 text-center">
                  {/* Error Icon */}
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 ring-4 ring-red-500/30 flex items-center justify-center">
                    <X className="w-10 h-10 text-red-400" />
                  </div>

                  {/* Error Title */}
                  <h2 className="text-2xl font-bold text-white mb-2">خطأ في التسجيل</h2>

                  {/* Error Message */}
                  <p className="text-lg text-red-200 mb-4">{attendanceResult.message}</p>

                  {/* Instructions */}
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-300">
                      يرجى المحاولة مرة أخرى أو مراجعة الإدارة
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Kiosk;
