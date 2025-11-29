import { supabase } from './supabase';
import { Student, AttendanceRecord, ExitRecord, ViolationRecord, Notification, DashboardStats, ReportFilter, DailySummary, STORAGE_KEYS, SystemSettings, DiagnosticResult, Role, SchoolClass, User, AppTheme, AttendanceScanResult } from '../types';
import { appCache, staticCache, realtimeCache, CACHE_KEYS } from './cache';

// ... (إبقاء الإعدادات و helper function كما هي) ...
export const getLocalISODate = (): string => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

export type StorageMode = 'cloud' | 'local';
const CONFIG_KEY = 'hader:config:mode';

const CACHE_TTL = {
  STUDENTS: 5 * 60 * 1000,
  CLASSES: 30 * 60 * 1000,
  SETTINGS: 10 * 60 * 1000,
  ATTENDANCE: 30 * 1000,
  STATS: 60 * 1000,
  USERS: 5 * 60 * 1000,
};

export type SyncStatus = 'online' | 'offline' | 'syncing';

interface QueuedAttendance {
  id: string;
  studentId: string;
  date: string;
  timestamp: string;
  status: 'present' | 'late';
  minutesLate: number;
  synced: boolean;
}

interface IDatabaseProvider {
  // ... (نفس الواجهة السابقة، لا تغيير) ...
  getStudents(): Promise<Student[]>;
  getStudentsByGuardian(guardianPhone: string): Promise<Student[]>;
  getStudentById(id: string): Promise<Student | undefined>;
  saveStudents(students: Student[]): Promise<void>;
  updateStudent(student: Student): Promise<void>;
  deleteStudent(studentId: string): Promise<void>;
  getAttendance(date?: string): Promise<AttendanceRecord[]>;
  getStudentAttendance(studentId: string): Promise<AttendanceRecord[]>;
  markAttendance(id: string): Promise<AttendanceScanResult>;
  subscribeToAttendance(callback: (record: AttendanceRecord) => void): { unsubscribe: () => void };
  getDailySummary(date: string): Promise<DailySummary | null>;
  saveDailySummary(summary: DailySummary): Promise<void>;
  getDashboardStats(): Promise<DashboardStats>;
  getWeeklyStats(): Promise<any[]>;
  getClassStats(): Promise<any[]>;
  getAttendanceReport(filters: ReportFilter): Promise<{summary: any, details: any[]}>;
  addExit(record: ExitRecord): Promise<void>;
  getTodayExits(): Promise<ExitRecord[]>;
  getStudentExits(studentId: string): Promise<ExitRecord[]>;
  addViolation(record: ViolationRecord): Promise<void>;
  getViolations(studentId?: string): Promise<ViolationRecord[]>;
  getTodayViolations(): Promise<ViolationRecord[]>;
  saveNotification(notification: Notification): Promise<void>;
  getStudentNotifications(studentId: string, className: string): Promise<Notification[]>;
  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void): { unsubscribe: () => void };
  getClasses(): Promise<SchoolClass[]>;
  saveClass(schoolClass: SchoolClass): Promise<void>;
  deleteClass(classId: string): Promise<void>;
  getUsers(): Promise<User[]>;
  saveUser(user: User): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  getSettings(): Promise<SystemSettings>;
  saveSettings(settings: SystemSettings): Promise<void>;
  sendBroadcast(targetRole: string, message: string, title: string): Promise<void>;
  runDiagnostics(): Promise<DiagnosticResult[]>;
  
  // Kiosk Methods
  preloadForKiosk?(): Promise<void>;
  markAttendanceFast?(id: string): Promise<AttendanceScanResult>;
  getSyncStatus?(): SyncStatus;
  getPendingCount?(): number;
  onSyncStatusChange?(callback: (status: SyncStatus) => void): () => void;
  forceSyncNow?(): Promise<void>;
}

// --- MAPPERS (تحديث مهم جداً للربط) ---
const mapStudent = (data: any): Student => ({
  id: String(data.id),
  name: data.name,
  className: data.class_name || data.className,
  section: data.section,
  guardianPhone: data.guardian_phone || data.guardianPhone
});

const mapAttendance = (data: any): AttendanceRecord => ({
  id: data.id,
  studentId: String(data.student_id || data.studentId),
  date: data.date,
  timestamp: data.timestamp,
  status: data.status,
  minutesLate: data.minutes_late || data.minutesLate || 0
});

// ✅ تحديث: محول الاستئذان (Snake -> Camel)
const mapExit = (data: any): ExitRecord => ({
  id: data.id,
  studentId: data.student_id || data.studentId,
  reason: data.reason,
  exitTime: data.exit_time || data.exitTime, // التحويل هنا
  supervisorName: data.supervisor_name || data.supervisorName, // التحويل هنا
  notes: data.notes,
  createdBy: data.created_by || data.createdBy,
  status: data.status
});

// ✅ تحديث: محول المخالفات (Snake -> Camel)
const mapViolation = (data: any): ViolationRecord => ({
  id: data.id,
  studentId: data.student_id || data.studentId,
  type: data.type,
  level: data.level,
  description: data.description,
  actionTaken: data.action_taken || data.actionTaken, // التحويل هنا
  summonGuardian: data.summon_guardian || data.summonGuardian, // التحويل هنا
  created_at: data.created_at
});


// ------------------------------------------------------------------
// Cloud Provider (Supabase)
// ------------------------------------------------------------------
const KIOSK_CACHE_KEY = 'hader:kiosk:students';
const KIOSK_QUEUE_KEY = 'hader:kiosk:syncQueue';
const KIOSK_SETTINGS_KEY = 'hader:kiosk:settings';
const KIOSK_ATTENDANCE_KEY = 'hader:kiosk:todayAttendance';

class CloudProvider implements IDatabaseProvider {
  // ... (نفس متغيرات الكشك والمزامنة) ...
  private localStudentsCache: Student[] = [];
  private syncQueue: QueuedAttendance[] = [];
  private syncInterval: any = null;
  private _syncStatus: SyncStatus = 'online';
  private _syncStatusListeners: ((status: SyncStatus) => void)[] = [];
  private _pendingCount = 0;

  constructor() {
    this.loadLocalCache();
  }

  // ... (دوال الكشك والمزامنة loadLocalCache, saveLocalCache, ... تبقى كما هي) ...
  private loadLocalCache() {
    try {
      const cached = localStorage.getItem(KIOSK_CACHE_KEY);
      if (cached) this.localStudentsCache = JSON.parse(cached);
      const queue = localStorage.getItem(KIOSK_QUEUE_KEY);
      if (queue) this.syncQueue = JSON.parse(queue);
      this._pendingCount = this.syncQueue.filter(q => !q.synced).length;
    } catch (e) {}
  }
  private saveLocalCache() {
      localStorage.setItem(KIOSK_CACHE_KEY, JSON.stringify(this.localStudentsCache));
      localStorage.setItem(KIOSK_QUEUE_KEY, JSON.stringify(this.syncQueue));
  }
  getSyncStatus(): SyncStatus { return this._syncStatus; }
  getPendingCount(): number { return this._pendingCount; }
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this._syncStatusListeners.push(callback);
    return () => { this._syncStatusListeners = this._syncStatusListeners.filter(l => l !== callback); };
  }
  private setSyncStatus(status: SyncStatus) {
    this._syncStatus = status;
    this._syncStatusListeners.forEach(l => l(status));
  }

  // ... (دوال الكشك preloadForKiosk, markAttendanceFast, startBackgroundSync, stopBackgroundSync, forceSyncNow - تبقى كما هي) ...
  // (تم اختصارها هنا للحفاظ على المساحة، لكن يجب إبقاؤها كما في الكود السابق الذي أرسلته لك)
  async preloadForKiosk() { /* ... */ }
  async markAttendanceFast(id: string) { return {success:false, message:''} as any } // Placeholder for logic
  startBackgroundSync() {}
  stopBackgroundSync() {}
  async forceSyncNow() {}


  // --- Core Data Methods ---
  
  async getStudents(): Promise<Student[]> {
    const cached = appCache.get<Student[]>(CACHE_KEYS.STUDENTS);
    if (cached) return cached;
    const { data, error } = await supabase.from('students').select('*');
    if (error) throw error;
    const students = data.map(mapStudent);
    appCache.set(CACHE_KEYS.STUDENTS, students, CACHE_TTL.STUDENTS);
    return students;
  }

  async getStudentsByGuardian(guardianPhone: string): Promise<Student[]> {
    const all = appCache.get<Student[]>(CACHE_KEYS.STUDENTS);
    if (all) return all.filter(s => s.guardianPhone === guardianPhone);
    const { data, error } = await supabase.from('students').select('*').eq('guardian_phone', guardianPhone);
    if (error) throw error;
    return data.map(mapStudent);
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    const { data } = await supabase.from('students').select('*').eq('id', id).single();
    return data ? mapStudent(data) : undefined;
  }

  async saveStudents(students: Student[]): Promise<void> {
    const mapped = students.map(s => ({
        id: s.id,
        name: s.name,
        class_name: s.className,
        section: s.section,
        guardian_phone: s.guardianPhone
    }));
    const { error } = await supabase.from('students').upsert(mapped);
    if (error) throw error;
    appCache.delete(CACHE_KEYS.STUDENTS);
  }

  async updateStudent(student: Student): Promise<void> {
    const { error } = await supabase.from('students').update({
        name: student.name,
        class_name: student.className,
        section: student.section,
        guardian_phone: student.guardianPhone
    }).eq('id', student.id);
    if (error) throw error;
    appCache.delete(CACHE_KEYS.STUDENTS);
  }

  async deleteStudent(studentId: string): Promise<void> {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) throw error;
    appCache.delete(CACHE_KEYS.STUDENTS);
  }

  async getAttendance(date?: string): Promise<AttendanceRecord[]> {
    let query = supabase.from('attendance_logs').select('*');
    if (date) query = query.eq('date', date);
    const { data, error } = await query;
    return error ? [] : data.map(mapAttendance);
  }

  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase.from('attendance_logs').select('*').eq('student_id', studentId).order('date', { ascending: false });
    return error ? [] : data.map(mapAttendance);
  }

  // markAttendance و subscribeToAttendance تبقى كما هي

  // --- Exits (With Fixes) ---
  async addExit(record: ExitRecord): Promise<void> {
    await supabase.from('exits').insert({ 
      student_id: record.studentId, 
      reason: record.reason, 
      exit_time: record.exitTime, // ✅ Camel -> Snake
      supervisor_name: record.supervisorName, // ✅ Camel -> Snake
      notes: record.notes,
      status: record.status || 'approved'
    });
  }

  async getTodayExits(): Promise<ExitRecord[]> {
      const today = getLocalISODate();
      const { data } = await supabase.from('exits').select('*').gte('exit_time', `${today}T00:00:00`);
      return (data || []).map(mapExit); // ✅ استخدام mapExit الجديد
  }

  async getStudentExits(studentId: string): Promise<ExitRecord[]> {
      const { data } = await supabase.from('exits').select('*').eq('student_id', studentId).order('exit_time', { ascending: false });
      return (data || []).map(mapExit); // ✅ استخدام mapExit الجديد
  }

  // --- Violations (With Fixes) ---
  async addViolation(record: ViolationRecord): Promise<void> {
    await supabase.from('violations').insert({ 
      student_id: record.studentId, 
      type: record.type, 
      level: record.level, 
      description: record.description,
      action_taken: record.actionTaken, // ✅ Camel -> Snake
      summon_guardian: record.summonGuardian // ✅ Camel -> Snake
    });
  }

  async getViolations(studentId?: string): Promise<ViolationRecord[]> {
      let query = supabase.from('violations').select('*');
      if (studentId) query = query.eq('student_id', studentId);
      const { data } = await query;
      return (data || []).map(mapViolation); // ✅ استخدام mapViolation الجديد
  }

  async getTodayViolations(): Promise<ViolationRecord[]> {
    const today = getLocalISODate();
    const { data } = await supabase.from('violations').select('*').gte('created_at', `${today}T00:00:00`);
    return (data || []).map(mapViolation); // ✅ استخدام mapViolation الجديد
  }
  
  // ... (بقية الدوال saveNotification, getStudentNotifications, subscribeToNotifications تبقى كما هي في الكود السابق) ...

  // ... (بقية دوال Classes, Users, Settings تبقى كما هي) ...

  // Stub implementations for TS (Replace with real ones from previous code)
  async markAttendance(id: string): Promise<any> { return {success: false, message: ''} }
  subscribeToAttendance(cb: any): any { return {unsubscribe: () => {}} }
  async getDailySummary(d: string): Promise<any> { return null }
  async saveDailySummary(s: any): Promise<void> {}
  async getDashboardStats(): Promise<any> { return {} as any }
  async getWeeklyStats(): Promise<any[]> { return [] }
  async getClassStats(): Promise<any[]> { return [] }
  async getAttendanceReport(f: any): Promise<any> { return {summary: {}, details: []} }
  async saveNotification(n: any): Promise<void> {}
  async getStudentNotifications(id: string, c: string): Promise<any[]> { return [] }
  subscribeToNotifications(u: any, cb: any): any { return {unsubscribe: () => {}} }
  async getClasses(): Promise<any[]> { return [] }
  async saveClass(c: any): Promise<void> {}
  async deleteClass(id: string): Promise<void> {}
  async getUsers(): Promise<any[]> { return [] }
  async saveUser(u: User): Promise<void> {}
  async deleteUser(id: string): Promise<void> {}
  async getSettings(): Promise<any> { return {} }
  async saveSettings(s: any): Promise<void> {}
  async sendBroadcast(tr: string, m: string, t: string): Promise<void> {}
  async runDiagnostics(): Promise<any[]> { return [] }
}

// ... (LocalProvider و Database Facade تبقى كما هي) ...

// لتجنب تكرار الكود الطويل، قم بدمج التعديلات (Mappers و CloudProvider methods) مع الكود السابق لـ db.ts
// إذا أردت الملف كاملاً جاهزاً للنسخ مرة واحدة، أخبرني.
