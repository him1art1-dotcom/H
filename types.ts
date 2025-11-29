// src/types.ts

export enum Role {
  SITE_ADMIN = 'site_admin',
  SCHOOL_ADMIN = 'school_admin',
  SUPERVISOR_GLOBAL = 'supervisor_global',
  SUPERVISOR_CLASS = 'supervisor_class',
  WATCHER = 'watcher',
  GUARDIAN = 'guardian',
  KIOSK = 'kiosk'
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: Role;
  password?: string;
  assignedClasses?: ClassAssignment[];
}

export interface ClassAssignment {
  className: string;
  sections: string[];
}

export interface Student {
  id: string;
  name: string;
  className: string;
  section: string;
  guardianPhone: string;
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
  status: 'present' | 'late' | 'absent'; // ✅ إصلاح خطأ Parents.tsx
  minutesLate?: number;
}

export interface AttendanceScanResult {
  success: boolean;
  message: string;
  record?: AttendanceRecord;
  student?: Student;
  stats?: {
      lateCount: number;
      minutesLateToday: number;
      totalMinutesLate: number;
  };
}

export interface ExitRecord {
  id: string;
  studentId: string;
  reason: string;
  exitTime: string;        // ✅ تم التوحيد (كان exit_time)
  createdBy?: string;      // ✅ تم التوحيد
  supervisorName?: string; // ✅ تم التوحيد (كان supervisor_name)
  notes?: string;
  status?: string;
}

export interface ViolationRecord {
  id: string;
  studentId: string;
  type: string;
  level: string; // أو number حسب استخدامك
  description: string;
  actionTaken?: string;    // ✅ تم التوحيد (كان action_taken)
  summonGuardian?: boolean; // ✅ تم التوحيد
  createdAt: string;       // ✅ تم التوحيد
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
  screensaverCustomText?: { enabled: boolean; text: string; position: 'top'|'center'|'bottom'; size: 'small'|'medium'|'large'|'xlarge' };
  displaySettings?: { clockSize: string; titleSize: string; cardSize: string; inputSize: string; };
  theme?: string;
  assemblyTime?: string;
  gracePeriod?: number;
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
  id?: number;
  systemReady: boolean;
  schoolActive: boolean;
  logoUrl: string;
  mode?: 'dark' | 'light';
  theme?: AppTheme;
  schoolName?: string;
  schoolManager?: string;
  assemblyTime?: string;
  gracePeriod?: number;
  kiosk?: KioskSettings;
  notificationTemplates?: NotificationTemplates;
  socialLinks?: { supportUrl?: string; whatsapp?: string; instagram?: string; };
}

export interface AppTheme {
  primary400: string;
  primary500: string;
  primary600: string;
  secondary400: string;
  secondary500: string;
  secondary600: string;
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
  className: string;
  section: string;
  status?: 'all' | 'present' | 'late' | 'absent';
  searchQuery?: string;
}

export interface DailySummary {
  date_summary: string;
  summary_data: any;
}

export interface DiagnosticResult {
  key: string;
  title: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  count?: number;
  hint?: string;
}

export const STORAGE_KEYS = {
  SESSION: 'hader_session',
  STUDENTS: 'hader_students',
  ATTENDANCE: 'hader_attendance',
  EXITS: 'hader_exits',
  VIOLATIONS: 'hader_violations',
  NOTIFICATIONS: 'hader_notifications',
  USERS: 'hader_users',
  CLASSES: 'hader_classes',
  SETTINGS: 'hader_settings',
  DAILY_SHARE: 'hader_daily_share'
};
