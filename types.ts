
export enum Role {
  SITE_ADMIN = 'site_admin',
  SCHOOL_ADMIN = 'school_admin',
  SUPERVISOR_GLOBAL = 'supervisor_global',
  SUPERVISOR_CLASS = 'supervisor_class',
  WATCHER = 'watcher',
  KIOSK = 'kiosk',
  GUARDIAN = 'guardian',
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  password?: string;
  assignedClasses?: { className: string; sections: string[] }[];
}

export interface Student {
  id: string; // The student ID (used for attendance and parent login)
  name: string;
  className: string;
  section: string;
  guardianPhone: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  status: 'present' | 'late' | 'absent' | 'excused';
  minutesLate?: number; // عدد دقائق التأخير
}

export interface ExitRecord {
  id: string;
  studentId: string;
  reason: string;
  exit_time: string; // ISO string
  created_by?: string;
  supervisor_name?: string; // اسم المشرف المصرح
  notes?: string; // ملاحظات إضافية
  status?: 'pending' | 'approved' | 'rejected'; // حالة الاستئذان
}

export interface ViolationRecord {
  id: string;
  studentId: string;
  type: string;
  description: string; // Mapped from 'notes' in app logic if needed, or sql 'description'
  level: 'low' | 'medium' | 'high' | number; // 1-5 scale support
  action_taken?: string; // الإجراء المتخذ
  summon_guardian?: boolean; // استدعاء ولي الأمر
  created_at: string;
}

export interface Notification {
  id: string;
  title?: string;
  message: string;
  type: 'behavior' | 'attendance' | 'general' | 'command' | 'announcement';
  target_audience: 'guardian' | 'all' | 'class' | 'student' | 'admin' | 'supervisor' | 'kiosk';
  target_id?: string;
  created_at: string;
  isPopup?: boolean;
}

// أنماط الكشك المتاحة
export type KioskTheme = 
  | 'dark-neon'      // داكن مع تأثيرات نيون
  | 'dark-gradient'  // داكن مع تدرجات
  | 'light-clean'    // فاتح نظيف
  | 'light-soft'     // فاتح ناعم
  | 'ocean-blue'     // أزرق محيطي
  | 'sunset-warm'    // غروب دافئ
  | 'forest-green'   // أخضر طبيعي
  | 'royal-purple';  // بنفسجي ملكي

// موضع النص في شاشة التوقف
export type ScreensaverTextPosition = 'top' | 'center' | 'bottom';

// حجم النص في شاشة التوقف
export type ScreensaverTextSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface ScreensaverCustomText {
  text: string;
  position: ScreensaverTextPosition;
  size: ScreensaverTextSize;
  enabled: boolean;
}

// أحجام العرض في الكشك
export type KioskDisplaySize = 'small' | 'medium' | 'large' | 'xlarge';

export interface KioskDisplaySettings {
  clockSize: KioskDisplaySize;      // حجم الساعة
  titleSize: KioskDisplaySize;      // حجم العناوين
  cardSize: KioskDisplaySize;       // حجم البطاقات
  inputSize: KioskDisplaySize;      // حجم حقل الإدخال
}

export interface KioskSettings {
  mainTitle: string;
  subTitle: string;
  earlyMessage: string;
  lateMessage: string;
  showStats: boolean;
  headerImage?: string;
  screensaverEnabled?: boolean;
  screensaverTimeout?: number;
  screensaverImages?: string[];
  screensaverPhrases?: string[];
  // إعدادات التوقيت
  assemblyTime?: string;    // موعد الطابور (HH:MM)
  gracePeriod?: number;     // مهلة السماح بالدقائق
  // نمط الكشك
  theme?: KioskTheme;
  // نص مخصص لشاشة التوقف
  screensaverCustomText?: ScreensaverCustomText;
  // إعدادات أحجام العرض
  displaySettings?: KioskDisplaySettings;
}

export interface DashboardStats {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    attendanceRate: number;
}

export interface ReportFilter {
    dateFrom: string;
    dateTo: string;
    className?: string;
    section?: string;
    status?: 'all' | 'present' | 'late' | 'absent';  // فلتر الحالة
    studentId?: string;  // فلتر طالب محدد
    searchQuery?: string;  // بحث بالاسم
}

export interface DailySummary {
    id?: string;
    date_summary: string;
    summary_data: {
        stats: {
            total: number;
            present: number;
            late: number;
            absent: number;
        };
        details: {
            present: { id: string; name: string }[];
            late: { id: string; name: string }[];
            absent: { id: string; name: string }[];
        };
        shared_by: string;
        shared_at: string;
    };
}

// Structure Management
export interface SchoolClass {
  id: string;
  name: string; // e.g. "الصف الأول الثانوي"
  sections: string[]; // e.g. ["أ", "ب", "ج"]
}

// New Types for Support & Diagnostics
export interface AppTheme {
  primary400: string;
  primary500: string;
  primary600: string;
  secondary400: string;
  secondary500: string;
  secondary600: string;
}

// قوالب الإشعارات
export interface NotificationTemplate {
    title: string;
    message: string;
}

export interface NotificationTemplates {
    late: NotificationTemplate;
    absent: NotificationTemplate;
    behavior: NotificationTemplate;
    summon: NotificationTemplate;
    custom?: NotificationTemplate[];
}

// روابط التواصل الاجتماعي
export interface SocialLinks {
    supportUrl?: string;   // رابط الدعم الفني
    whatsapp?: string;     // رابط واتساب
    instagram?: string;    // رابط انستجرام
}

export interface SystemSettings {
    systemReady: boolean;
    schoolActive: boolean;
    logoUrl: string;
    theme?: AppTheme;
    assemblyTime?: string;  // وقت التجمع (مثل "07:30")
    gracePeriod?: number;   // فترة السماح بالدقائق
    darkMode?: boolean;     // النمط الداكن/الفاتح
    notificationTemplates?: NotificationTemplates; // قوالب الإشعارات
    socialLinks?: SocialLinks; // روابط التواصل الاجتماعي
}

export interface DiagnosticResult {
    key: string;
    title: string;
    status: 'ok' | 'warning' | 'error';
    message: string;
    hint?: string;
    count?: number;
}

export const STORAGE_KEYS = {
  SESSION: 'hader:session',
  THEME: 'hader:theme',
  STUDENTS: 'hader:students',
  USERS: 'hader:users',
  ATTENDANCE: 'hader:attendance',
  EXITS: 'hader:exits',
  VIOLATIONS: 'hader:violations',
  NOTIFICATIONS: 'hader:notifications',
  DAILY_SHARE: 'hader:daily-share', // prefix
  SETTINGS: 'hader:settings',
  CLASSES: 'hader:classes', // New key
};