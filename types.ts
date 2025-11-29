// =============================================================================
// نظام حاضر (Hader) - Type Definitions
// =============================================================================

// Enums
export enum Role {
  SITE_ADMIN = 'site_admin',
  SCHOOL_ADMIN = 'school_admin',
  SUPERVISOR_GLOBAL = 'supervisor_global',
  SUPERVISOR_CLASS = 'supervisor_class',
  WATCHER = 'watcher',
  KIOSK = 'kiosk',
  GUARDIAN = 'guardian'
}

// Storage Keys
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

// User Interface
export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: Role;
  assignedClasses?: { className: string; sections: string[] }[];
}

// Student Interface
export interface Student {
  id: string;
  name: string;
  className: string;
  section: string;
  guardianPhone?: string;
}

// School Class Interface
export interface SchoolClass {
  id: string;
  name: string;
  sections: string[];
}

// Attendance Record
export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;
  timestamp: string;
  status: 'present' | 'late';
  minutesLate: number;
}

// Exit Record
export interface ExitRecord {
  id: string;
  studentId: string;
  reason: string;
  exit_time: string;
  supervisorName?: string;
  notes?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

// Violation Record
export interface ViolationRecord {
  id: string;
  studentId: string;
  type: string;
  level: number;
  description?: string;
  action_taken?: string;
  summon_guardian?: boolean;
  created_at: string;
}

// Notification Interface
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

// Dashboard Statistics
export interface DashboardStats {
  totalStudents: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  attendanceRate: number;
}

// Report Filter
export interface ReportFilter {
  dateFrom: string;
  dateTo: string;
  className?: string;
  section?: string;
  status?: 'all' | 'present' | 'late' | 'absent';
  searchQuery?: string;
}

// Daily Summary
export interface DailySummary {
  id?: string;
  date_summary: string;
  summary_data: any;
  created_at?: string;
}

// Social Links
export interface SocialLinks {
  supportUrl?: string;
  whatsapp?: string;
  instagram?: string;
}

// App Theme
export interface AppTheme {
  primary400: string;
  primary500: string;
  primary600: string;
  secondary400: string;
  secondary500: string;
  secondary600: string;
}

// Notification Template
export interface NotificationTemplate {
  title: string;
  message: string;
}

// Notification Templates
export interface NotificationTemplates {
  late: NotificationTemplate;
  absent: NotificationTemplate;
  behavior: NotificationTemplate;
  summon: NotificationTemplate;
}

// System Settings
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
  kioskSettings?: KioskSettings;
  // School Info
  schoolName?: string;
  principalName?: string;
}

// Kiosk Display Size
export type KioskDisplaySize = 'small' | 'medium' | 'large' | 'xlarge';

// Kiosk Theme - All implemented themes in Kiosk.tsx
export type KioskTheme = 
  'dark-neon' | 'dark-gradient' | 
  'ocean-blue' | 'sunset-warm' | 'forest-green' | 'royal-purple' |
  'light-clean' | 'light-soft';

// Screensaver Custom Text Settings
export interface ScreensaverCustomText {
  enabled?: boolean;
  text?: string;
  position?: 'top' | 'center' | 'bottom';
  size?: KioskDisplaySize;
}

// Kiosk Settings
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

// Diagnostic Result
export interface DiagnosticResult {
  key: string;
  title: string;
  message: string;
  status: 'ok' | 'warning' | 'error';
  count?: number;
  hint?: string;
}

