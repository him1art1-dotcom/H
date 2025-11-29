// src/types.ts

// =============================================================================
// نظام حاضر (Hader) - Type Definitions (Standardized)
// =============================================================================

export enum Role {
  SITE_ADMIN = 'site_admin',
  SCHOOL_ADMIN = 'school_admin',
  SUPERVISOR_GLOBAL = 'supervisor_global',
  SUPERVISOR_CLASS = 'supervisor_class',
  WATCHER = 'watcher',
  KIOSK = 'kiosk',
  GUARDIAN = 'guardian'
}

export const STORAGE_KEYS = {
  STUDENTS: 'hader:students',
  ATTENDANCE: 'hader:attendance',
  EXITS: 'hader:exits',
  VIOLATIONS: 'hader:violations',
  NOTIFICATIONS: 'hader:notifications',
  SETTINGS: 'hader:settings',
  CLASSES: 'hader:classes',
  USERS: 'hader:users',
  SESSION: 'hader:session',
  DAILY_SHARE: 'hader:daily_share'
};

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: Role;
  assignedClasses?: { className: string; sections: string[] }[];
}

export interface Student {
  id: string;
  name: string;
  className: string;
  section: string;
  guardianPhone?: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  sections: string[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  timestamp: string;
  status: 'present' | 'late' | 'absent'; // ✅ تم إضافة absent لإصلاح الأخطاء
  minutesLate: number;
}

export interface ExitRecord {
  id: string;
  studentId: string;
  reason: string;
  exitTime: string;        // ✅ تم التوحيد إلى camelCase
  supervisorName?: string; // ✅ تم التوحيد
  notes?: string;
  createdBy?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface ViolationRecord {
  id: string;
  studentId: string;
  type: string;
  level: number;
  description?: string;
  actionTaken?: string;    // ✅ تم التوحيد
  summonGuardian?: boolean;// ✅ تم التوحيد
  created_at: string;      // سنبقي هذا كما هو لأنه يأتي تلقائياً
}

export interface Notification {
  id: string;
  title?: string;
  message: string;
  type: 'announcement' | 'behavior' | 'general' | 'command' | 'alert' | 'attendance';
  target_audience: 'all' | 'admin' | 'supervisor' | 'guardian' | 'kiosk' | 'class' | 'student';
  target_id?: string;
  isPopup?: boolean;
  created_at: string;
}

export interface DashboardStats {
  totalStudents: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendanceRate: number;
}

export interface ReportFilter {
  dateFrom: string;
  dateTo: string;
  className?: string;
  section?: string;
  status?: 'all' | 'present' | 'late' | 'absent';
  searchQuery?: string;
}

export interface DailySummary {
  id?: string;
  date_summary: string;
  summary_data: any;
  created_at?: string;
}

export interface SocialLinks {
  supportUrl?: string;
  whatsapp?: string;
  instagram?: string;
}

export interface AppTheme {
  primary400: string;
  primary500: string;
  primary600: string;
  secondary400: string;
  secondary500: string;
  secondary600: string;
}

export interface NotificationTemplate {
  title: string;
  message: string;
}

export interface NotificationTemplates {
  late: NotificationTemplate;
  absent: NotificationTemplate;
  behavior: NotificationTemplate;
  summon: NotificationTemplate;
}

export interface SystemSettings {
  systemReady?: boolean;
  schoolActive?: boolean;
  logoUrl?: string;
  darkMode?: boolean;
  theme?: AppTheme;
  assemblyTime?: string;
  gracePeriod?: number;
  notificationTemplates?: NotificationTemplates;
  socialLinks?: SocialLinks;
  kiosk?: KioskSettings; // ✅ تم التوحيد (بدل kioskSettings)
  kioskSettings?: KioskSettings; // إبقاء الاسم القديم كخيار احتياطي
  schoolName?: string;
  principalName?: string;
}

export type KioskDisplaySize = 'small' | 'medium' | 'large' | 'xlarge';

export type KioskTheme = 
  'dark-neon' | 'dark-gradient' | 
  'ocean-blue' | 'sunset-warm' | 'forest-green' | 'royal-purple' |
  'light-clean' | 'light-soft';

export interface ScreensaverCustomText {
  enabled?: boolean;
  text?: string;
  position?: 'top' | 'center' | 'bottom';
  size?: KioskDisplaySize;
}

export interface KioskSettings {
  mainTitle?: string;
  subTitle?: string;
  earlyMessage?: string;
  lateMessage?: string;
  showStats?: boolean;
  screensaverEnabled?: boolean;
  screensaverTimeout?: number;
  screensaverImages?: string[];
  screensaverPhrases?: string[];
  screensaverCustomText?: ScreensaverCustomText;
  headerImage?: string;
  assemblyTime?: string;
  gracePeriod?: number;
  theme?: KioskTheme;
  displaySettings?: {
    clockSize?: KioskDisplaySize;
    titleSize?: KioskDisplaySize;
    cardSize?: KioskDisplaySize;
    inputSize?: KioskDisplaySize;
  };
}

export interface AttendanceScanResult {
    success: boolean;
    message: string;
    record?: AttendanceRecord;
    student?: Student;
    stats?: { lateCount: number, todayMinutes: number, totalMinutes: number };
}

export interface DiagnosticResult {
  key: string;
  title: string;
  message: string;
  status: 'ok' | 'warning' | 'error';
  count?: number;
  hint?: string;
}
