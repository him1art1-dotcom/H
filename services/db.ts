import { supabase } from './supabase';
import { Student, AttendanceRecord, ExitRecord, ViolationRecord, Notification, DashboardStats, ReportFilter, DailySummary, STORAGE_KEYS, SystemSettings, DiagnosticResult, Role, SchoolClass, User, AppTheme, AttendanceScanResult } from '../types';
import { appCache, staticCache, realtimeCache, CACHE_KEYS } from './cache';

// Configuration
export type StorageMode = 'cloud' | 'local';
const CONFIG_KEY = 'hader:config:mode';

// Cache TTL configurations (in milliseconds)
const CACHE_TTL = {
  STUDENTS: 5 * 60 * 1000,      // 5 minutes
  CLASSES: 30 * 60 * 1000,      // 30 minutes
  SETTINGS: 10 * 60 * 1000,     // 10 minutes
  ATTENDANCE: 30 * 1000,        // 30 seconds
  STATS: 60 * 1000,             // 1 minute
  USERS: 5 * 60 * 1000,         // 5 minutes
};

export const getLocalISODate = (): string => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

// Sync status type for UI
export type SyncStatus = 'online' | 'offline' | 'syncing';

// Queued attendance record for offline sync
interface QueuedAttendance {
  id: string;
  studentId: string;
  date: string;
  timestamp: string;
  status: 'present' | 'late';
  minutesLate: number;
  synced: boolean;
}

// ------------------------------------------------------------------
// 1. Interface Definition (The Contract)
// ------------------------------------------------------------------
interface IDatabaseProvider {
  getStudents(): Promise<Student[]>;
  getStudentsByGuardian(guardianPhone: string): Promise<Student[]>;
  getStudentById(id: string): Promise<Student | undefined>;
  saveStudents(students: Student[]): Promise<void>;
  updateStudent(student: Student): Promise<void>;
  deleteStudent(studentId: string): Promise<void>;
  
  getAttendance(date?: string): Promise<AttendanceRecord[]>;
  getStudentAttendance(studentId: string): Promise<AttendanceRecord[]>;
  markAttendance(id: string): Promise<{ 
    success: boolean, 
    message: string, 
    record?: AttendanceRecord,
    student?: Student,
    stats?: { lateCount: number, todayMinutes: number, totalMinutes: number }
  }>;
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
  
  // ✅ FIX: Updated signature to accept User | 'kiosk'
  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void): { unsubscribe: () => void };

  // Structure & Users
  getClasses(): Promise<SchoolClass[]>;
  saveClass(schoolClass: SchoolClass): Promise<void>;
  deleteClass(classId: string): Promise<void>;
  
  getUsers(): Promise<User[]>;
  saveUser(user: User): Promise<void>;
  deleteUser(userId: string): Promise<void>;

  // Support Extensions
  getSettings(): Promise<SystemSettings>;
  saveSettings(settings: SystemSettings): Promise<void>;
  sendBroadcast(targetRole: string, message: string, title: string): Promise<void>;
  runDiagnostics(): Promise<DiagnosticResult[]>;
}

// Mappers
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

// ------------------------------------------------------------------
// 2. Cloud Provider (Supabase) with Offline-First Support
// ------------------------------------------------------------------
const KIOSK_CACHE_KEY = 'hader:kiosk:students';
const KIOSK_QUEUE_KEY = 'hader:kiosk:syncQueue';
const KIOSK_SETTINGS_KEY = 'hader:kiosk:settings';
const KIOSK_ATTENDANCE_KEY = 'hader:kiosk:todayAttendance';

class CloudProvider implements IDatabaseProvider {
  // Offline-First: Local cache for instant kiosk access
  private localStudentsCache: Student[] = [];
  private syncQueue: QueuedAttendance[] = [];
  private syncInterval: any = null;
  private _syncStatus: SyncStatus = 'online';
  private _syncStatusListeners: ((status: SyncStatus) => void)[] = [];
  private _pendingCount = 0;

  constructor() {
    this.loadLocalCache();
  }

  // Load cached data from localStorage
  private loadLocalCache() {
    try {
      const cached = localStorage.getItem(KIOSK_CACHE_KEY);
      if (cached) this.localStudentsCache = JSON.parse(cached);
      
      const queue = localStorage.getItem(KIOSK_QUEUE_KEY);
      if (queue) this.syncQueue = JSON.parse(queue);
      
      this._pendingCount = this.syncQueue.filter(q => !q.synced).length;
    } catch (e) {
      console.warn('Failed to load kiosk cache:', e);
    }
  }

  // Save cache to localStorage
  private saveLocalCache() {
    try {
      localStorage.setItem(KIOSK_CACHE_KEY, JSON.stringify(this.localStudentsCache));
      localStorage.setItem(KIOSK_QUEUE_KEY, JSON.stringify(this.syncQueue));
    } catch (e) {
      console.warn('Failed to save kiosk cache:', e);
    }
  }

  // Get sync status
  getSyncStatus(): SyncStatus { return this._syncStatus; }
  getPendingCount(): number { return this._pendingCount; }

  // Subscribe to sync status changes
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    this._syncStatusListeners.push(callback);
    return () => {
      this._syncStatusListeners = this._syncStatusListeners.filter(l => l !== callback);
    };
  }

  private setSyncStatus(status: SyncStatus) {
    this._syncStatus = status;
    this._syncStatusListeners.forEach(l => l(status));
  }

  // Preload students for Kiosk (call on Kiosk mount)
  async preloadForKiosk(): Promise<void> {
    console.log('[Kiosk] Preloading students...');
    try {
      const { data, error } = await supabase.from('students').select('*');
      if (!error && data) {
        this.localStudentsCache = data.map(mapStudent);
        this.saveLocalCache();
        console.log(`[Kiosk] Cached ${this.localStudentsCache.length} students`);
      }

      const settings = await this.getSettings();
      localStorage.setItem(KIOSK_SETTINGS_KEY, JSON.stringify(settings));

      const today = getLocalISODate();
      const { data: todayLogs } = await supabase.from('attendance_logs').select('student_id').eq('date', today);
      if (todayLogs) {
        localStorage.setItem(KIOSK_ATTENDANCE_KEY, JSON.stringify({
          date: today,
          studentIds: todayLogs.map(l => String(l.student_id))
        }));
      }

      this.setSyncStatus('online');
      this.startBackgroundSync();
    } catch (e) {
      console.warn('[Kiosk] Preload failed, using cached data:', e);
      this.setSyncStatus('offline');
    }
  }

  // Fast attendance marking (Offline-First)
  async markAttendanceFast(id: string): Promise<{ 
    success: boolean, 
    message: string, 
    record?: AttendanceRecord,
    student?: Student,
    stats?: { lateCount: number, todayMinutes: number, totalMinutes: number }
  }> {
    // 1. Check local cache IMMEDIATELY
    const student = this.localStudentsCache.find(s => s.id === id);
    if (!student) {
      return { success: false, message: 'رقم الطالب غير صحيح' };
    }

    // 2. Check if already registered today (local check)
    const today = getLocalISODate();
    const todayCache = localStorage.getItem(KIOSK_ATTENDANCE_KEY);
    if (todayCache) {
      const { date, studentIds } = JSON.parse(todayCache);
      if (date === today && studentIds.includes(id)) {
        return { success: false, message: 'تم تسجيل الدخول مسبقاً لهذا اليوم' };
      }
    }

    const inQueue = this.syncQueue.some(q => q.studentId === id && q.date === today);
    if (inQueue) {
      return { success: false, message: 'تم تسجيل الدخول مسبقاً لهذا اليوم' };
    }

    // 3. Calculate late status locally
    const now = new Date();
    let settings: any = {};
    try {
      const cached = localStorage.getItem(KIOSK_SETTINGS_KEY);
      if (cached) settings = JSON.parse(cached);
    } catch (e) {}
    
    const assemblyTime = settings?.assemblyTime || '07:30';
    const gracePeriod = settings?.gracePeriod ?? 0;
    const [h, m] = assemblyTime.split(':').map(Number);
    const cutoff = new Date(now);
    cutoff.setHours(h, m + gracePeriod, 0, 0);
    const isLate = now.getTime() > cutoff.getTime();
    const minutesLate = isLate ? Math.floor((now.getTime() - cutoff.getTime()) / 60000) : 0;

    // 4. Create local record
    const recordId = `local_${Date.now()}_${id}`;
    const record: AttendanceRecord = {
      id: recordId,
      studentId: id,
      date: today,
      timestamp: now.toISOString(),
      status: isLate ? 'late' : 'present',
      minutesLate
    };

    // 5. Add to sync queue
    this.syncQueue.push({
      id: recordId,
      studentId: id,
      date: today,
      timestamp: now.toISOString(),
      status: isLate ? 'late' : 'present',
      minutesLate,
      synced: false
    });
    this._pendingCount = this.syncQueue.filter(q => !q.synced).length;
    this.saveLocalCache();

    // 6. Update local today cache
    try {
      const todayCache = localStorage.getItem(KIOSK_ATTENDANCE_KEY);
      if (todayCache) {
        const data = JSON.parse(todayCache);
        if (data.date === today) {
          data.studentIds.push(id);
          localStorage.setItem(KIOSK_ATTENDANCE_KEY, JSON.stringify(data));
        }
      }
    } catch (e) {}

    // 7. Calculate stats from queue + any cached logs
    const queueLogs = this.syncQueue.filter(q => q.studentId === id);
    const lateCount = queueLogs.filter(q => q.status === 'late').length;
    const totalMinutes = queueLogs.reduce((sum, q) => sum + q.minutesLate, 0);

    return {
      success: true,
      message: isLate 
        ? (settings?.lateMessage || 'لقد تأخرت عن التجمع') 
        : (settings?.earlyMessage || 'أهلاً بك! وصلت في الوقت المناسب'),
      record,
      student,
      stats: { lateCount, todayMinutes: minutesLate, totalMinutes }
    };
  }

  // Background sync (runs every 5 seconds)
  startBackgroundSync() {
    if (this.syncInterval) return; // Already running
    
    console.log('[Sync] Starting background sync...');
    
    this.syncInterval = setInterval(async () => {
      const pending = this.syncQueue.filter(q => !q.synced);
      if (pending.length === 0) return;

      this.setSyncStatus('syncing');
      console.log(`[Sync] Processing ${pending.length} pending records...`);

      for (const item of pending) {
        try {
          const { error } = await supabase
            .from('attendance_logs')
            .insert({
              student_id: item.studentId,
              date: item.date,
              timestamp: item.timestamp,
              status: item.status,
              minutes_late: item.minutesLate
            });

          if (error) {
            if (error.code === '23505') {
              item.synced = true;
            } else {
              console.warn(`[Sync] Failed to sync ${item.id}:`, error);
            }
          } else {
            item.synced = true;
            console.log(`[Sync] Successfully synced ${item.studentId}`);
          }
        } catch (e) {
          console.warn(`[Sync] Network error for ${item.id}:`, e);
          this.setSyncStatus('offline');
          break;
        }
      }

      this.syncQueue = this.syncQueue.filter(q => !q.synced || this.syncQueue.indexOf(q) > this.syncQueue.length - 100);
      this._pendingCount = this.syncQueue.filter(q => !q.synced).length;
      this.saveLocalCache();
      
      if (this._pendingCount === 0) {
        this.setSyncStatus('online');
      }
    }, 5000);
  }

  stopBackgroundSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Force sync now (for Admin refresh button)
  async forceSyncNow(): Promise<void> {
    this.setSyncStatus('syncing');
    try {
      const pending = this.syncQueue.filter(q => !q.synced);
      for (const item of pending) {
        try {
          const { error } = await supabase
            .from('attendance_logs')
            .insert({
              student_id: item.studentId,
              date: item.date,
              timestamp: item.timestamp,
              status: item.status,
              minutes_late: item.minutesLate
            });
          
          if (!error || error.code === '23505') {
            item.synced = true;
          }
        } catch (e) {}
      }

      this.syncQueue = this.syncQueue.filter(q => !q.synced);
      this._pendingCount = this.syncQueue.length;
      this.saveLocalCache();
      await this.preloadForKiosk();
      this.setSyncStatus('online');
    } catch (e) {
      console.error('[Sync] Force sync failed:', e);
      this.setSyncStatus('offline');
    }
  }

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
    const allStudents = appCache.get<Student[]>(CACHE_KEYS.STUDENTS);
    if (allStudents) {
      return allStudents.filter(s => s.guardianPhone === guardianPhone);
    }

    const { data, error } = await supabase.from('students').select('*').eq('guardian_phone', guardianPhone);
    if (error) throw error;
    return data.map(mapStudent);
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    const allStudents = appCache.get<Student[]>(CACHE_KEYS.STUDENTS);
    if (allStudents) {
      return allStudents.find(s => s.id === id);
    }

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

  async markAttendance(id: string): Promise<{ success: boolean, message: string, record?: AttendanceRecord, student?: Student, stats?: { lateCount: number, todayMinutes: number, totalMinutes: number } }> {
    try {
        const { data: studentData, error: studentError } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
        if (studentError || !studentData) return { success: false, message: 'رقم الطالب غير صحيح' };
        
        const student = mapStudent(studentData);
        const now = new Date();
        const today = getLocalISODate();
        const settings = await this.getSettings();
        const assemblyTime = (settings as any)?.assemblyTime || '07:30';
        const gracePeriod = (settings as any)?.gracePeriod ?? 0;
        const [h, m] = assemblyTime.split(':').map(Number);
        const t = new Date(now);
        t.setHours(h, m + (gracePeriod || 0), 0, 0);
        let isLate = now.getTime() > t.getTime();
        let minutesLate = isLate ? Math.floor((now.getTime() - t.getTime()) / 60000) : 0;
        
        const { data, error } = await supabase
            .from('attendance_logs')
            .insert({ student_id: id, date: today, timestamp: now.toISOString(), status: isLate ? 'late' : 'present', minutes_late: minutesLate })
            .select().single();

        if (error) {
            if (error.code === '23505') return { success: false, message: `تم تسجيل الدخول مسبقاً لهذا اليوم` };
            console.error("Attendance Error", error);
            return { success: false, message: 'حدث خطأ أثناء التسجيل' };
        }

        const { data: allLogs } = await supabase.from('attendance_logs').select('*').eq('student_id', id);
        const studentLogs = allLogs || [];
        const lateCount = studentLogs.filter(l => l.status === 'late').length;
        const totalMinutes = studentLogs.reduce((sum, l) => sum + (l.minutes_late || 0), 0);
        const stats = { lateCount, todayMinutes: minutesLate, totalMinutes };

        return { 
            success: true, 
            message: isLate ? (settings as any)?.lateMessage || 'لقد تأخرت عن التجمع' : (settings as any)?.earlyMessage || 'أهلاً بك! وصلت في الوقت المناسب',
            record: mapAttendance(data),
            student,
            stats
        };
    } catch (e) {
        console.error(e);
        return { success: false, message: 'حدث خطأ في الاتصال' };
    }
  }

  // ✅ FIX: Separated Logic for User vs 'kiosk'
  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void): { unsubscribe: () => void } {
    const sub = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as Notification;
        let isRelevant = false;

        if (user === 'kiosk') {
            isRelevant = n.target_audience === 'kiosk';
        } else {
            const currentUser = user as User;
            isRelevant = 
                n.target_audience === 'all' ||
                (n.target_audience === 'student' && n.target_id === currentUser.id) ||
                (n.target_audience === 'class' && n.target_id && currentUser.assignedClasses?.some(c => c.className === n.target_id)) ||
                (n.target_audience === currentUser.role);
        }

        if (isRelevant) {
          callback(n);
        }
      })
      .subscribe();
    return { unsubscribe: () => supabase.removeChannel(sub) };
  }

  async getClasses(): Promise<SchoolClass[]> {
    const cached = staticCache.get<SchoolClass[]>(CACHE_KEYS.CLASSES);
    if (cached) return cached;

    try {
        const { data } = await supabase.from('classes').select('*');
        const classes = data || [];
        staticCache.set(CACHE_KEYS.CLASSES, classes, CACHE_TTL.CLASSES);
        return classes;
    } catch { return []; }
  }
  
  async saveClass(schoolClass: SchoolClass): Promise<void> {
    await supabase.from('classes').upsert(schoolClass);
    staticCache.delete(CACHE_KEYS.CLASSES);
  }

  async deleteClass(classId: string): Promise<void> {
    await supabase.from('classes').delete().eq('id', classId);
    staticCache.delete(CACHE_KEYS.CLASSES);
  }

  async getUsers(): Promise<User[]> {
    const cached = appCache.get<User[]>(CACHE_KEYS.USERS);
    if (cached) return cached;

    const { data } = await supabase.from('users').select('*');
    const users = (data || []).map((u: any) => ({ 
      id: u.id, 
      username: u.username, 
      name: u.name || u.full_name, 
      role: u.role, 
      password: u.password 
    }));
    appCache.set(CACHE_KEYS.USERS, users, CACHE_TTL.USERS);
    return users;
  }

  async saveUser(user: User): Promise<void> {
    await supabase.from('users').upsert({ 
      id: user.id, 
      username: user.username, 
      name: user.name, 
      role: user.role, 
      password: user.password 
    });
    appCache.delete(CACHE_KEYS.USERS);
  }

  async deleteUser(userId: string): Promise<void> {
    await supabase.from('users').delete().eq('id', userId);
    appCache.delete(CACHE_KEYS.USERS);
  }

  async getSettings(): Promise<SystemSettings> {
    const cached = staticCache.get<SystemSettings>(CACHE_KEYS.SETTINGS);
    if (cached) return cached;

    const { data } = await supabase.from('settings').select('*').single();
    if (data) {
      staticCache.set(CACHE_KEYS.SETTINGS, data as SystemSettings, CACHE_TTL.SETTINGS);
      return data as SystemSettings;
    }
    return { systemReady: true, schoolActive: true, logoUrl: '' };
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    try {
        const payload: any = { id: 1, ...settings };
        await supabase.from('settings').upsert(payload);
        staticCache.delete(CACHE_KEYS.SETTINGS);
    } catch(e) { console.error("Settings table might be missing", e); }
  }

  async sendBroadcast(targetRole: string, message: string, title: string): Promise<void> {
     const notification: Notification = {
         id: '',
         title: title,
         message: message,
         type: 'general',
         target_audience: 'all',
         created_at: new Date().toISOString()
     };
     await this.saveNotification(notification);
  }

  async runDiagnostics(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    const today = getLocalISODate();

    try {
        const { count: userCount, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true });
        results.push({
            key: 'connection',
            title: 'اتصال قاعدة البيانات',
            status: userError ? 'error' : 'ok',
            message: userError ? 'فشل الاتصال بـ Supabase' : 'الاتصال السحابي نشط ومستقر',
            hint: userError ? 'تحقق من مفاتيح API في الإعدادات' : undefined
        });

        const { count: missingPhoneCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).or('guardian_phone.is.null,guardian_phone.eq.""');
        results.push({
            key: 'integrity',
            title: 'نزاهة البيانات (أولياء الأمور)',
            status: (missingPhoneCount || 0) > 0 ? 'warning' : 'ok',
            message: (missingPhoneCount || 0) > 0 ? `يوجد ${missingPhoneCount} طالب بدون رقم جوال ولي الأمر` : 'سجلات الطلاب مكتملة',
            count: missingPhoneCount || 0,
            hint: 'استخدم لوحة الإدارة لتحديث بيانات الطلاب الناقصة'
        });

        const summary = await this.getDailySummary(today);
        results.push({
            key: 'operations',
            title: 'التشغيل اليومي',
            status: summary ? 'ok' : 'warning',
            message: summary ? 'تم رفع التقرير اليومي بنجاح' : 'لم يتم رفع تقرير الحضور اليومي بعد',
            hint: !summary ? 'يجب على المراقب اعتماد السجلات من لوحة المتابعة' : undefined
        });

    } catch (e) {
        results.push({ key: 'fatal', title: 'خطأ حرج', status: 'error', message: 'حدث خطأ أثناء تشغيل التشخيص' });
    }

    return results;
  }
}

// ------------------------------------------------------------------
// 3. Local Provider (LocalStorage)
// ------------------------------------------------------------------
class LocalProvider implements IDatabaseProvider {
  private listeners: (() => void)[] = [];

  constructor() {
    this.seed();
  }

  private seed() {
    if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.EXITS)) {
      localStorage.setItem(STORAGE_KEYS.EXITS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.VIOLATIONS)) {
      localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      const defaultSettings: SystemSettings = {
        systemReady: true,
        schoolActive: true,
        logoUrl: '',
        mode: 'dark',
        assemblyTime: '07:00',
        gracePeriod: 15
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      const bootstrapUsers: User[] = [
        { 
          id: 'bootstrap-admin', 
          username: 'admin', 
          password: 'admin123', 
          name: 'مدير النظام', 
          role: Role.SITE_ADMIN 
        }
      ];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(bootstrapUsers));
    }
  }

  private get<T>(key: string): T[] {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  }

  private set<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  async getStudents(): Promise<Student[]> {
    return Promise.resolve(this.get<Student>(STORAGE_KEYS.STUDENTS));
  }

  async getStudentsByGuardian(guardianPhone: string): Promise<Student[]> {
    const all = this.get<Student>(STORAGE_KEYS.STUDENTS);
    return Promise.resolve(all.filter(s => s.guardianPhone === guardianPhone));
  }

  async getStudentById(id: string): Promise<Student | undefined> {
    const all = this.get<Student>(STORAGE_KEYS.STUDENTS);
    return Promise.resolve(all.find(s => s.id === id));
  }

  async saveStudents(students: Student[]): Promise<void> {
    const existing = this.get<Student>(STORAGE_KEYS.STUDENTS);
    const newIds = new Set(students.map(s => s.id));
    const kept = existing.filter(s => !newIds.has(s.id));
    this.set(STORAGE_KEYS.STUDENTS, [...kept, ...students]);
    return Promise.resolve();
  }

  async updateStudent(student: Student): Promise<void> {
    const existing = this.get<Student>(STORAGE_KEYS.STUDENTS);
    const index = existing.findIndex(s => s.id === student.id);
    if (index !== -1) {
      existing[index] = student;
      this.set(STORAGE_KEYS.STUDENTS, existing);
    }
    return Promise.resolve();
  }

  async deleteStudent(studentId: string): Promise<void> {
    const existing = this.get<Student>(STORAGE_KEYS.STUDENTS);
    const filtered = existing.filter(s => s.id !== studentId);
    this.set(STORAGE_KEYS.STUDENTS, filtered);
    return Promise.resolve();
  }

  async getAttendance(date?: string): Promise<AttendanceRecord[]> {
    const all = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    if (!date) return Promise.resolve(all);
    return Promise.resolve(all.filter(a => a.date === date));
  }

  async getStudentAttendance(studentId: string): Promise<AttendanceRecord[]> {
    const all = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    return Promise.resolve(all.filter(a => a.studentId === studentId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }

  async markAttendance(id: string): Promise<{ success: boolean, message: string, record?: AttendanceRecord, student?: Student, stats?: { lateCount: number, todayMinutes: number, totalMinutes: number } }> {
    const students = await this.getStudents();
    const student = students.find(s => s.id === id);
    if (!student) return Promise.resolve({ success: false, message: 'رقم الطالب غير صحيح' });

    const now = new Date();
    const today = getLocalISODate();
    const allLogs = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    
    const exists = allLogs.find(l => l.studentId === id && l.date === today);
    if (exists) return Promise.resolve({ success: false, message: 'تم تسجيل الدخول مسبقاً لهذا اليوم' });

    const settings = await this.getSettings();
    const assemblyTime = (settings as any)?.assemblyTime || '07:30';
    const gracePeriod = (settings as any)?.gracePeriod ?? 0;
    const [h, m] = assemblyTime.split(':').map(Number);
    const t = new Date(now);
    t.setHours(h, m + (gracePeriod || 0), 0, 0);
    let isLate = now.getTime() > t.getTime();
    let minutesLate = isLate ? Math.floor((now.getTime() - t.getTime()) / 60000) : 0;
    const newRecord: AttendanceRecord = {
        id: Math.random().toString(36).substr(2, 9),
        studentId: id,
        date: today,
        timestamp: now.toISOString(),
        status: isLate ? 'late' : 'present',
        minutesLate: minutesLate
    };
    
    const updatedLogs = [...allLogs, newRecord];
    this.set(STORAGE_KEYS.ATTENDANCE, updatedLogs);
    this.notifyListeners();

    window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEYS.ATTENDANCE,
        newValue: JSON.stringify(updatedLogs)
    }));

    const studentLogs = updatedLogs.filter(l => l.studentId === id);
    const lateCount = studentLogs.filter(l => l.status === 'late').length;
    const totalMinutes = studentLogs.reduce((sum, l) => sum + (l.minutesLate || 0), 0);
    const stats = { lateCount, todayMinutes: minutesLate, totalMinutes };

    return Promise.resolve({ 
        success: true, 
        message: isLate ? (settings as any)?.lateMessage || 'لقد تأخرت عن التجمع' : (settings as any)?.earlyMessage || 'أهلاً بك! وصلت في الوقت المناسب',
        record: newRecord,
        student,
        stats
    });
  }

  // ✅ FIX: Separated Logic for User vs 'kiosk'
  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void): { unsubscribe: () => void } {
    const localListener = () => {
      const all = this.get<Notification>(STORAGE_KEYS.NOTIFICATIONS);
      const last = all[all.length - 1];
      if (!last) return;
      
      let isRelevant = false;
      if (user === 'kiosk') {
          isRelevant = last.target_audience === 'kiosk';
      } else {
          const currentUser = user as User;
          isRelevant = 
            last.target_audience === 'all' ||
            (last.target_audience === 'student' && last.target_id === currentUser.id) ||
            (last.target_audience === 'class' && last.target_id && currentUser.assignedClasses?.some(c => c.className === last.target_id)) ||
            (last.target_audience === currentUser.role);
      }

      if (isRelevant) {
        callback(last);
      }
    };
    this.listeners.push(localListener);
    const storageListener = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.NOTIFICATIONS && e.newValue) {
        localListener();
      }
    };
    window.addEventListener('storage', storageListener);
    return {
      unsubscribe: () => {
        window.removeEventListener('storage', storageListener);
        this.listeners = this.listeners.filter(l => l !== localListener);
      },
    };
  }

  getClasses(): Promise<SchoolClass[]> { 
    const classes = this.get<SchoolClass>(STORAGE_KEYS.CLASSES);
    if (classes.length === 0) {
      const defaultClasses: SchoolClass[] = [
        { id: '1', name: 'أول ثانوي', sections: ['أ', 'ب', 'ج'] },
        { id: '2', name: 'ثاني ثانوي', sections: ['أ', 'ب'] },
        { id: '3', name: 'ثالث ثانوي', sections: ['أ', 'ب', 'ج', 'د'] }
      ];
      this.set(STORAGE_KEYS.CLASSES, defaultClasses);
      return Promise.resolve(defaultClasses);
    }
    return Promise.resolve(classes); 
  }
  
  saveClass(schoolClass: SchoolClass): Promise<void> { 
    const classes = this.get<SchoolClass>(STORAGE_KEYS.CLASSES);
    const idx = classes.findIndex(c => c.id === schoolClass.id);
    if (idx >= 0) {
      classes[idx] = schoolClass;
    } else {
      classes.push({ ...schoolClass, id: schoolClass.id || Math.random().toString(36).substr(2, 9) });
    }
    this.set(STORAGE_KEYS.CLASSES, classes);
    return Promise.resolve(); 
  }
  
  deleteClass(classId: string): Promise<void> { 
    const classes = this.get<SchoolClass>(STORAGE_KEYS.CLASSES).filter(c => c.id !== classId);
    this.set(STORAGE_KEYS.CLASSES, classes);
    return Promise.resolve(); 
  }
  
  getUsers(): Promise<User[]> { 
    const users = this.get<User>(STORAGE_KEYS.USERS);
    if (users.length === 0) {
      const bootstrapAdmin: User[] = [
        { id: 'bootstrap-admin', username: 'admin', name: 'مدير النظام', role: Role.SITE_ADMIN, password: 'admin123' }
      ];
      this.set(STORAGE_KEYS.USERS, bootstrapAdmin);
      return Promise.resolve(bootstrapAdmin);
    }
    return Promise.resolve(users); 
  }
  
  saveUser(user: User): Promise<void> { 
    const users = this.get<User>(STORAGE_KEYS.USERS);
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push({ ...user, id: user.id || Math.random().toString(36).substr(2, 9) });
    }
    this.set(STORAGE_KEYS.USERS, users);
    return Promise.resolve(); 
  }
  
  deleteUser(userId: string): Promise<void> { 
    const users = this.get<User>(STORAGE_KEYS.USERS).filter(u => u.id !== userId);
    this.set(STORAGE_KEYS.USERS, users);
    return Promise.resolve(); 
  }
  
  getSettings(): Promise<SystemSettings> { 
    const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (settings) {
      return Promise.resolve(JSON.parse(settings));
    }
    const defaults: SystemSettings = { 
      systemReady: true, 
      schoolActive: true, 
      logoUrl: '',
      assemblyTime: '07:30',
      gracePeriod: 10
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaults));
    return Promise.resolve(defaults); 
  }
  
  saveSettings(settings: SystemSettings): Promise<void> { 
    try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        return Promise.resolve(); 
    } catch (e: any) {
        console.error('Error saving settings:', e);
        return Promise.reject(e);
    }
  }
  
  sendBroadcast(targetRole: string, message: string, title: string): Promise<void> { 
    const notification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      type: 'announcement',
      target_audience: targetRole as any,
      created_at: new Date().toISOString(),
      isPopup: true
    };
    const notifications = this.get<Notification>(STORAGE_KEYS.NOTIFICATIONS);
    this.set(STORAGE_KEYS.NOTIFICATIONS, [...notifications, notification]);
    this.notifyListeners();
    return Promise.resolve(); 
  }
  
  runDiagnostics(): Promise<DiagnosticResult[]> { 
    const students = this.get<Student>(STORAGE_KEYS.STUDENTS);
    const users = this.get<User>(STORAGE_KEYS.USERS);
    const classes = this.get<SchoolClass>(STORAGE_KEYS.CLASSES);
    const attendance = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
    
    const results: DiagnosticResult[] = [
      {
        key: 'storage_mode',
        title: 'وضع التخزين',
        status: 'ok',
        message: 'النظام يعمل في الوضع المحلي (Local Storage)'
      },
      {
        key: 'students_count',
        title: 'قاعدة بيانات الطلاب',
        status: students.length > 0 ? 'ok' : 'warning',
        message: students.length > 0 ? `يوجد ${students.length} طالب مسجل` : 'لا يوجد طلاب مسجلين',
        count: students.length,
        hint: students.length === 0 ? 'قم بإضافة طلاب من لوحة الإدارة' : undefined
      }
    ];
    return Promise.resolve(results); 
  }
}

// ------------------------------------------------------------------
// 4. Facade (Main Database Class)
// ------------------------------------------------------------------
class Database implements IDatabaseProvider {
  private provider: IDatabaseProvider;
  private mode: StorageMode;

  constructor() {
    const storedMode = localStorage.getItem(CONFIG_KEY) as StorageMode;
    this.mode = storedMode || 'local';
    console.log(`Initializing Database in [${this.mode.toUpperCase()}] mode.`);
    
    if (this.mode === 'cloud') {
      this.provider = new CloudProvider();
    } else {
      this.provider = new LocalProvider();
    }

    this.getSettings().then(s => {
        if (s.theme) this.applyTheme(s.theme);
    });
  }

  getMode(): StorageMode {
      return this.mode;
  }

  setMode(mode: StorageMode) {
      localStorage.setItem(CONFIG_KEY, mode);
      window.location.reload(); 
  }

  applyTheme(theme: AppTheme) {
    const root = document.documentElement;
    root.style.setProperty('--color-primary-400', theme.primary400);
    root.style.setProperty('--color-primary-500', theme.primary500);
    root.style.setProperty('--color-primary-600', theme.primary600);
    root.style.setProperty('--color-secondary-400', theme.secondary400);
    root.style.setProperty('--color-secondary-500', theme.secondary500);
    root.style.setProperty('--color-secondary-600', theme.secondary600);
  }

  // --- Delegate all calls to provider ---
  getStudents() { return this.provider.getStudents(); }
  getStudentsByGuardian(p: string) { return this.provider.getStudentsByGuardian(p); }
  getStudentById(id: string) { return this.provider.getStudentById(id); }
  saveStudents(s: Student[]) { return this.provider.saveStudents(s); }
  updateStudent(s: Student) { return this.provider.updateStudent(s); }
  deleteStudent(id: string) { return this.provider.deleteStudent(id); }
  getAttendance(d?: string) { return this.provider.getAttendance(d); }
  getStudentAttendance(id: string) { return this.provider.getStudentAttendance(id); }
  markAttendance(id: string) { return this.provider.markAttendance(id); }
  subscribeToAttendance(cb: (r: AttendanceRecord) => void) { return this.provider.subscribeToAttendance(cb); }
  getDailySummary(d: string) { return this.provider.getDailySummary(d); }
  saveDailySummary(s: DailySummary) { return this.provider.saveDailySummary(s); }
  getDashboardStats() { return this.provider.getDashboardStats(); }
  getWeeklyStats() { return this.provider.getWeeklyStats(); }
  getClassStats() { return this.provider.getClassStats(); }
  getAttendanceReport(f: ReportFilter) { return this.provider.getAttendanceReport(f); }
  addExit(r: ExitRecord) { return this.provider.addExit(r); }
  getTodayExits() { return this.provider.getTodayExits(); }
  getStudentExits(id: string) { return this.provider.getStudentExits(id); }
  addViolation(r: ViolationRecord) { return this.provider.addViolation(r); }
  getViolations(id?: string) { return this.provider.getViolations(id); }
  getTodayViolations() { return this.provider.getTodayViolations(); }
  saveNotification(n: Notification) { return this.provider.saveNotification(n); }
  getStudentNotifications(id: string, c: string) { return this.provider.getStudentNotifications(id, c); }
  
  // ✅ FIX: Accepts User | 'kiosk'
  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void) { return this.provider.subscribeToNotifications(user, callback); }
  
  getClasses() { return this.provider.getClasses(); }
  saveClass(c: SchoolClass) { return this.provider.saveClass(c); }
  deleteClass(cid: string) { return this.provider.deleteClass(cid); }
  getUsers() { return this.provider.getUsers(); }
  saveUser(u: User) { return this.provider.saveUser(u); }
  deleteUser(uid: string) { return this.provider.deleteUser(uid); }

  getSettings() { return this.provider.getSettings(); }
  saveSettings(s: SystemSettings) { 
      if (s.theme) this.applyTheme(s.theme);
      return this.provider.saveSettings(s); 
  }
  sendBroadcast(tr: string, m: string, t: string) { return this.provider.sendBroadcast(tr, m, t); }
  runDiagnostics() { return this.provider.runDiagnostics(); }

  // Offline-First Kiosk Methods
  preloadForKiosk(): Promise<void> {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).preloadForKiosk();
    }
    return Promise.resolve();
  }

  markAttendanceFast(id: string) {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).markAttendanceFast(id);
    }
    return this.provider.markAttendance(id);
  }

  getSyncStatus(): SyncStatus {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).getSyncStatus();
    }
    return 'online';
  }

  getPendingCount(): number {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).getPendingCount();
    }
    return 0;
  }

  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).onSyncStatusChange(callback);
    }
    return () => {};
  }

  forceSyncNow(): Promise<void> {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).forceSyncNow();
    }
    return Promise.resolve();
  }
}

export const db = new Database();
