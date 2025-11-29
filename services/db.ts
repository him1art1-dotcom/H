
import { supabase } from './supabase';
import { Student, AttendanceRecord, ExitRecord, ViolationRecord, Notification, DashboardStats, ReportFilter, DailySummary, STORAGE_KEYS, SystemSettings, DiagnosticResult, Role, SchoolClass, User, AppTheme } from '../types';

// Configuration
export type StorageMode = 'cloud' | 'local';
const CONFIG_KEY = 'hader:config:mode';

// Helper for Local Timezone Date String (YYYY-MM-DD)
// EXPORTED NOW to be used across pages for consistency
export const getLocalISODate = (): string => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split('T')[0];
};

// ------------------------------------------------------------------
// 1. Interface Definition (The Contract)
// ------------------------------------------------------------------

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
  id: String(data.id), // Ensure string - used for attendance and parent login
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
  status: data.status
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
    // Load cache from localStorage on init
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
      // Fetch fresh students from Supabase
      const { data, error } = await supabase.from('students').select('*');
      if (!error && data) {
        this.localStudentsCache = data.map(mapStudent);
        this.saveLocalCache();
        console.log(`[Kiosk] Cached ${this.localStudentsCache.length} students`);
      }

      // Also cache settings for late calculation
      const settings = await this.getSettings();
      localStorage.setItem(KIOSK_SETTINGS_KEY, JSON.stringify(settings));

      // Load today's attendance for duplicate check
      const today = getLocalISODate();
      const { data: todayLogs } = await supabase.from('attendance_logs').select('student_id').eq('date', today);
      if (todayLogs) {
        localStorage.setItem(KIOSK_ATTENDANCE_KEY, JSON.stringify({
          date: today,
          studentIds: todayLogs.map(l => String(l.student_id))
        }));
      }

      this.setSyncStatus('online');
      
      // Start background sync silently
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

    // Also check sync queue
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
      status: isLate ? 'late' : 'present'
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

    // 8. Return SUCCESS instantly (no await!)
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
              // Duplicate - mark as synced anyway
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

      // Clean up synced items (keep last 100 for stats)
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
      // Sync pending attendance
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
        } catch (e) {
          // Continue with next
        }
      }

      this.syncQueue = this.syncQueue.filter(q => !q.synced);
      this._pendingCount = this.syncQueue.length;
      this.saveLocalCache();

      // Refresh student cache
      await this.preloadForKiosk();
      
      this.setSyncStatus('online');
    } catch (e) {
      console.error('[Sync] Force sync failed:', e);
      this.setSyncStatus('offline');
    }
  }

  async getStudents(): Promise<Student[]> {
    const { data, error } = await supabase.from('students').select('*');
    if (error) throw error;
    return data.map(mapStudent);
  }

  async getStudentsByGuardian(guardianPhone: string): Promise<Student[]> {
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
  }

  async updateStudent(student: Student): Promise<void> {
    const { error } = await supabase.from('students').update({
        name: student.name,
        class_name: student.className,
        section: student.section,
        guardian_phone: student.guardianPhone
    }).eq('id', student.id);
    if (error) throw error;
  }

  async deleteStudent(studentId: string): Promise<void> {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) throw error;
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
        // We use maybeSingle to avoid 406 error if ID format is wrong (e.g. text vs uuid)
        const { data: studentData, error: studentError } = await supabase.from('students').select('*').eq('id', id).maybeSingle();
        
        if (studentError || !studentData) return { success: false, message: 'رقم الطالب غير صحيح' };
        
        const student = mapStudent(studentData);
        const now = new Date();
        const today = getLocalISODate(); // Use local date
        const settings = await this.getSettings();
        // Default fallback for time: 07:30, grace: 0
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

        // Fetch student's attendance stats for the display card
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

  subscribeToAttendance(callback: (record: AttendanceRecord) => void): { unsubscribe: () => void } {
    const subscription = supabase
      .channel('attendance_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        (payload) => {
          if (payload.new) {
            callback(mapAttendance(payload.new));
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(subscription);
      }
    };
  }

  async getDailySummary(date: string): Promise<DailySummary | null> {
    const { data } = await supabase.from('daily_summaries').select('*').eq('date_summary', date).maybeSingle();
    return data as DailySummary;
  }

  async saveDailySummary(summary: DailySummary): Promise<void> {
    await supabase.from('daily_summaries').upsert({ date_summary: summary.date_summary, summary_data: summary.summary_data });
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const students = await this.getStudents();
    const today = getLocalISODate();
    const attendance = await this.getAttendance(today);
    const totalStudents = students.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    const absentCount = totalStudents - (presentCount + lateCount);
    const attendanceRate = totalStudents > 0 ? ((presentCount + lateCount) / totalStudents) * 100 : 0;
    return { totalStudents, presentCount, lateCount, absentCount, attendanceRate: Math.round(attendanceRate) };
  }

  async getWeeklyStats(): Promise<any[]> {
    // Calculate real weekly stats from attendance data
    const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    const { data: students } = await supabase.from('students').select('id');
    const totalStudents = students?.length || 0;
    if (totalStudents === 0) return days.map(day => ({ day, presence: 0 }));

    const result: any[] = [];
    const today = new Date();
    
    for (let i = 4; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayIndex = date.getDay(); // 0 = Sunday
      
      const { data: logs } = await supabase.from('attendance_logs').select('*').eq('date', dateStr);
      const attendedCount = logs?.length || 0;
      const presence = totalStudents > 0 ? Math.round((attendedCount / totalStudents) * 100) : 0;
      
      result.push({ day: days[dayIndex] || days[0], presence });
    }
    return result;
  }

  async getClassStats(): Promise<any[]> {
    // Calculate real class stats
    const { data: classes } = await supabase.from('classes').select('*');
    const { data: students } = await supabase.from('students').select('*');
    const today = getLocalISODate();
    const { data: attendance } = await supabase.from('attendance_logs').select('*').eq('date', today);
    
    if (!classes || classes.length === 0) return [];
    
    const attendedIds = new Set((attendance || []).map(a => a.student_id));
    
    return (classes || []).map(cls => {
      const classStudents = (students || []).filter(s => s.class_name === cls.name);
      const absentCount = classStudents.filter(s => !attendedIds.has(s.id)).length;
      return { name: cls.name, absent: absentCount };
    });
  }

  async getAttendanceReport(filters: ReportFilter): Promise<{summary: any, details: any[]}> {
      let query = supabase.from('attendance_logs').select('*').gte('date', filters.dateFrom).lte('date', filters.dateTo);
      const { data: logs } = await query;
      const allLogs = (logs || []).map(mapAttendance);

      let studentQuery = supabase.from('students').select('*');
      if (filters.className) studentQuery = studentQuery.eq('class_name', filters.className);
      if (filters.section) studentQuery = studentQuery.eq('section', filters.section);

      const { data: studentData } = await studentQuery;
      const students = (studentData || []).map(mapStudent);

      const details = allLogs.map(log => {
          const student = students.find(s => s.id === log.studentId);
          if (!student) return null;
          return { studentId: log.studentId, studentName: student.name, className: student.className, date: log.date, time: log.timestamp, status: log.status };
      }).filter(Boolean);

      return {
          summary: { totalRecords: details.length, late: details.filter(d => d!.status === 'late').length, present: details.filter(d => d!.status === 'present').length },
          details: details as any[]
      };
  }

  async addExit(record: ExitRecord): Promise<void> {
    await supabase.from('exits').insert({ 
      student_id: record.studentId, 
      reason: record.reason, 
      exit_time: record.exit_time, 
      created_by: record.created_by,
      supervisor_name: record.supervisor_name,
      notes: record.notes,
      status: record.status || 'approved'
    });
  }

  async getTodayExits(): Promise<ExitRecord[]> {
      const today = getLocalISODate();
      const { data } = await supabase.from('exits').select('*').gte('exit_time', `${today}T00:00:00`);
      return (data || []).map((d: any) => ({ 
        id: d.id, 
        studentId: d.student_id, 
        reason: d.reason, 
        exit_time: d.exit_time, 
        created_by: d.created_by,
        supervisor_name: d.supervisor_name,
        notes: d.notes,
        status: d.status
      }));
  }

  async getStudentExits(studentId: string): Promise<ExitRecord[]> {
      const { data } = await supabase.from('exits').select('*').eq('student_id', studentId).order('exit_time', { ascending: false });
      return (data || []).map((d: any) => ({ id: d.id, studentId: d.student_id, reason: d.reason, exit_time: d.exit_time, created_by: d.created_by }));
  }

  async addViolation(record: ViolationRecord): Promise<void> {
    await supabase.from('violations').insert({ 
      student_id: record.studentId, 
      type: record.type, 
      level: record.level, 
      description: record.description,
      action_taken: record.action_taken,
      summon_guardian: record.summon_guardian
    });
  }

  async getViolations(studentId?: string): Promise<ViolationRecord[]> {
      let query = supabase.from('violations').select('*');
      if (studentId) query = query.eq('student_id', studentId);
      const { data } = await query;
      return (data || []).map((d: any) => ({ 
        id: d.id, 
        studentId: d.student_id, 
        type: d.type, 
        description: d.description, 
        level: d.level, 
        action_taken: d.action_taken,
        summon_guardian: d.summon_guardian,
        created_at: d.created_at 
      }));
  }

  async getTodayViolations(): Promise<ViolationRecord[]> {
    const today = getLocalISODate();
    const { data } = await supabase.from('violations').select('*').gte('created_at', `${today}T00:00:00`);
    return (data || []).map((d: any) => ({ id: d.id, studentId: d.student_id, type: d.type, description: d.description, level: d.level, created_at: d.created_at }));
  }

  async saveNotification(notification: Notification): Promise<void> {
      await supabase.from('notifications').insert({ message: notification.message, target_audience: notification.target_audience, target_id: notification.target_id, type: notification.type });
  }

  async getStudentNotifications(studentId: string, className: string): Promise<Notification[]> {
      const { data, error } = await supabase.from('notifications').select('*').or(`target_audience.eq.all,and(target_audience.eq.class,target_id.eq.${className}),and(target_audience.eq.student,target_id.eq.${studentId})`).order('created_at', { ascending: false });
      if (error) return [];
      return data.map((d: any) => ({ id: d.id, message: d.message, target_audience: d.target_audience, target_id: d.target_id, type: d.type, created_at: d.created_at }));
  }

  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void): { unsubscribe: () => void } {
    let filter = '';
    if (user === 'kiosk') {
      filter = `target_audience=eq.kiosk`;
    } else {
      filter = `or(target_audience.eq.all,and(target_audience.eq.class,target_id.eq.${user.assignedClasses?.[0]?.className || ''}),and(target_audience.eq.student,target_id.eq.${user.id}),target_audience.eq.${user.role})`;
    }
    const sub = supabase
      .channel('notifications_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as Notification;
        if (
          (user === 'kiosk' && n.target_audience === 'kiosk') ||
          (user !== 'kiosk' &&
            (n.target_audience === 'all' ||
              (n.target_audience === 'student' && n.target_id === user.id) ||
              (n.target_audience === 'class' && n.target_id && user.assignedClasses?.some(c => c.className === n.target_id)) ||
              (n.target_audience === user.role))
          )
        ) {
          callback(n);
        }
      })
      .subscribe();
    return { unsubscribe: () => supabase.removeChannel(sub) };
  }

  // --- Structure & Users (Cloud) ---
  async getClasses(): Promise<SchoolClass[]> {
    try {
        const { data } = await supabase.from('classes').select('*');
        return data || [];
    } catch { return []; }
  }
  
  async saveClass(schoolClass: SchoolClass): Promise<void> {
    await supabase.from('classes').upsert(schoolClass);
  }

  async deleteClass(classId: string): Promise<void> {
    await supabase.from('classes').delete().eq('id', classId);
  }

  async getUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*');
    return (data || []).map((u: any) => ({ id: u.id, username: u.username, name: u.full_name, role: u.role, password: u.password }));
  }

  async saveUser(user: User): Promise<void> {
    await supabase.from('users').upsert({ id: user.id, username: user.username, full_name: user.name, role: user.role, password: user.password });
  }

  async deleteUser(userId: string): Promise<void> {
    await supabase.from('users').delete().eq('id', userId);
  }


  // Support Extensions (Cloud)
  async getSettings(): Promise<SystemSettings> {
    const { data } = await supabase.from('settings').select('*').single();
    if (data) return data as SystemSettings;
    return { systemReady: true, schoolActive: true, logoUrl: '' };
  }

  async saveSettings(settings: SystemSettings): Promise<void> {
    try {
        const payload: any = { id: 1, ...settings };
        await supabase.from('settings').upsert(payload);
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
        // 1. Check System Connection
        const { count: userCount, error: userError } = await supabase.from('users').select('*', { count: 'exact', head: true });
        results.push({
            key: 'connection',
            title: 'اتصال قاعدة البيانات',
            status: userError ? 'error' : 'ok',
            message: userError ? 'فشل الاتصال بـ Supabase' : 'الاتصال السحابي نشط ومستقر',
            hint: userError ? 'تحقق من مفاتيح API في الإعدادات' : undefined
        });

        // 2. Integrity: Students without Guardian Phone
        const { count: missingPhoneCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).or('guardian_phone.is.null,guardian_phone.eq.""');
        results.push({
            key: 'integrity',
            title: 'نزاهة البيانات (أولياء الأمور)',
            status: (missingPhoneCount || 0) > 0 ? 'warning' : 'ok',
            message: (missingPhoneCount || 0) > 0 ? `يوجد ${missingPhoneCount} طالب بدون رقم جوال ولي الأمر` : 'سجلات الطلاب مكتملة',
            count: missingPhoneCount || 0,
            hint: 'استخدم لوحة الإدارة لتحديث بيانات الطلاب الناقصة'
        });

        // 3. Communication: Students without Guardian Phones (re-use count from integrity check)
        results.push({
            key: 'communication',
            title: 'قنوات التواصل',
            status: (missingPhoneCount || 0) > 0 ? 'warning' : 'ok',
            message: (missingPhoneCount || 0) > 0 ? `يوجد ${missingPhoneCount} طالب بدون رقم تواصل` : 'جميع الطلاب لديهم أرقام تواصل',
            count: missingPhoneCount || 0,
            hint: 'لن تصل رسائل الواتساب أو الإشعارات لهؤلاء الطلاب'
        });

        // 4. Operations: Daily Summary
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

  /**
   * Bootstrap: Initialize empty data structures with only essential defaults.
   * No dummy/test data - production ready.
   */
  private seed() {
    // Initialize empty students array (no dummy data)
    if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([]));
    }

    // Initialize empty attendance logs
    if (!localStorage.getItem(STORAGE_KEYS.ATTENDANCE)) {
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify([]));
    }

    // Initialize empty exits
    if (!localStorage.getItem(STORAGE_KEYS.EXITS)) {
      localStorage.setItem(STORAGE_KEYS.EXITS, JSON.stringify([]));
    }

    // Initialize empty violations
    if (!localStorage.getItem(STORAGE_KEYS.VIOLATIONS)) {
      localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify([]));
    }

    // Initialize empty notifications
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
    }

    // Default System Settings (Required for app to function)
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      const defaultSettings: SystemSettings = {
        systemReady: true,
        schoolActive: true,
        logoUrl: '',
        darkMode: true,
        assemblyTime: '07:00',
        gracePeriod: 15
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
    }

    // Initialize empty classes (admin will add them)
    if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
      localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify([]));
    }

    // Bootstrap Admin User (Required for initial access)
    // Only the Site Admin is pre-created; other users are managed via Admin panel
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
    const today = getLocalISODate(); // Use local date
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

    // Calculate student stats
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

  subscribeToAttendance(callback: (record: AttendanceRecord) => void): { unsubscribe: () => void } {
    const localListener = () => {
        const allLogs = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE);
        const lastLog = allLogs[allLogs.length - 1];
        if (lastLog) callback(lastLog);
    };
    this.listeners.push(localListener);

    const storageListener = (e: StorageEvent) => {
        if (e.key === STORAGE_KEYS.ATTENDANCE && e.newValue) {
            const newLogs = JSON.parse(e.newValue) as AttendanceRecord[];
            const lastLog = newLogs[newLogs.length - 1];
            const today = getLocalISODate();
            if (lastLog && lastLog.date === today) {
                callback(lastLog);
            }
        }
    };
    window.addEventListener('storage', storageListener);
    
    return { 
        unsubscribe: () => {
            window.removeEventListener('storage', storageListener);
            this.listeners = this.listeners.filter(l => l !== localListener);
        }
    };
  }

  async getDailySummary(date: string): Promise<DailySummary | null> {
    const key = `${STORAGE_KEYS.DAILY_SHARE}:${date}`;
    const item = localStorage.getItem(key);
    return Promise.resolve(item ? JSON.parse(item) : null);
  }

  async saveDailySummary(summary: DailySummary): Promise<void> {
    const key = `${STORAGE_KEYS.DAILY_SHARE}:${summary.date_summary}`;
    localStorage.setItem(key, JSON.stringify(summary));
    return Promise.resolve();
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const students = await this.getStudents();
    const today = getLocalISODate();
    const logs = await this.getAttendance(today);
    const total = students.length;
    const present = logs.filter(l => l.status === 'present').length;
    const late = logs.filter(l => l.status === 'late').length;
    const absent = total - (present + late);
    const rate = total > 0 ? ((present + late) / total) * 100 : 0;
    return Promise.resolve({ totalStudents: total, presentCount: present, lateCount: late, absentCount: absent, attendanceRate: Math.round(rate) });
  }

  async getWeeklyStats(): Promise<any[]> {
    return Promise.resolve([
        { day: 'الأحد', presence: 80 }, { day: 'الإثنين', presence: 85 }, { day: 'الثلاثاء', presence: 90 }, { day: 'الأربعاء', presence: 82 }, { day: 'الخميس', presence: 88 }
    ]);
  }

  async getClassStats(): Promise<any[]> {
    return Promise.resolve([
        { name: 'أول ثانوي', absent: 3 }, { name: 'ثاني ثانوي', absent: 5 }, { name: 'ثالث ثانوي', absent: 1 }
    ]);
  }

  async getAttendanceReport(filters: ReportFilter): Promise<{summary: any, details: any[]}> {
      const allLogs = this.get<AttendanceRecord>(STORAGE_KEYS.ATTENDANCE).filter(l => l.date >= filters.dateFrom && l.date <= filters.dateTo);
      let students = await this.getStudents();
      if (filters.className) students = students.filter(s => s.className === filters.className);
      if (filters.section) students = students.filter(s => s.section === filters.section);

      const details = allLogs.map(log => {
          const s = students.find(st => st.id === log.studentId);
          if (!s) return null;
          return { studentId: log.studentId, studentName: s.name, className: s.className, date: log.date, time: log.timestamp, status: log.status };
      }).filter(Boolean);

      return Promise.resolve({
          summary: { totalRecords: details.length, late: details.filter(d => d!.status === 'late').length, present: details.filter(d => d!.status === 'present').length },
          details: details as any[]
      });
  }

  async addExit(record: ExitRecord): Promise<void> {
    const exits = this.get<ExitRecord>(STORAGE_KEYS.EXITS);
    this.set(STORAGE_KEYS.EXITS, [...exits, { ...record, id: Math.random().toString() }]);
    return Promise.resolve();
  }

  async getTodayExits(): Promise<ExitRecord[]> {
      const today = getLocalISODate();
      const exits = this.get<ExitRecord>(STORAGE_KEYS.EXITS).filter(e => e.exit_time.startsWith(today));
      return Promise.resolve(exits);
  }

  async getStudentExits(studentId: string): Promise<ExitRecord[]> {
      const exits = this.get<ExitRecord>(STORAGE_KEYS.EXITS).filter(e => e.studentId === studentId);
      return Promise.resolve(exits);
  }

  async addViolation(record: ViolationRecord): Promise<void> {
      const v = this.get<ViolationRecord>(STORAGE_KEYS.VIOLATIONS);
      this.set(STORAGE_KEYS.VIOLATIONS, [...v, { ...record, id: Math.random().toString() }]);
      return Promise.resolve();
  }

  async getViolations(studentId?: string): Promise<ViolationRecord[]> {
      let v = this.get<ViolationRecord>(STORAGE_KEYS.VIOLATIONS);
      if (studentId) v = v.filter(i => i.studentId === studentId);
      return Promise.resolve(v);
  }

  async getTodayViolations(): Promise<ViolationRecord[]> {
      const today = getLocalISODate();
      const v = this.get<ViolationRecord>(STORAGE_KEYS.VIOLATIONS).filter(i => i.created_at.startsWith(today));
      return Promise.resolve(v);
  }

  async saveNotification(notification: Notification): Promise<void> {
      const n = this.get<Notification>(STORAGE_KEYS.NOTIFICATIONS);
      this.set(STORAGE_KEYS.NOTIFICATIONS, [...n, { ...notification, id: Math.random().toString() }]);
      return Promise.resolve();
  }

  async getStudentNotifications(studentId: string, className: string): Promise<Notification[]> {
      const n = this.get<Notification>(STORAGE_KEYS.NOTIFICATIONS);
      const filtered = n.filter(item => 
          item.target_audience === 'all' || 
          (item.target_audience === 'class' && item.target_id === className) ||
          (item.target_audience === 'student' && item.target_id === studentId)
      );
      return Promise.resolve(filtered);
  }

  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void): { unsubscribe: () => void } {
    const localListener = () => {
      const all = this.get<Notification>(STORAGE_KEYS.NOTIFICATIONS);
      const last = all[all.length - 1];
      if (!last) return;
      if (
        (user === 'kiosk' && last.target_audience === 'kiosk') ||
        (user !== 'kiosk' &&
          (last.target_audience === 'all' ||
            (last.target_audience === 'student' && last.target_id === user.id) ||
            (last.target_audience === 'class' && last.target_id && user.assignedClasses?.some(c => c.className === last.target_id)) ||
            (last.target_audience === user.role)))
      ) {
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

  // Classes Management (LocalProvider)
  getClasses(): Promise<SchoolClass[]> { 
    const classes = this.get<SchoolClass>(STORAGE_KEYS.CLASSES);
    // Return default classes if empty
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
  
  // Users Management (LocalProvider)
  getUsers(): Promise<User[]> { 
    const users = this.get<User>(STORAGE_KEYS.USERS);
    // Bootstrap: Create only admin user if none exist
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
  
  // Settings Management (LocalProvider)
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
        if (e?.name === 'QuotaExceededError' || e?.code === 22) {
            return Promise.reject(new Error('QuotaExceededError: Storage is full'));
        }
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
      },
      {
        key: 'users_count',
        title: 'المستخدمين',
        status: users.length > 1 ? 'ok' : 'warning',
        message: `يوجد ${users.length} مستخدم`,
        count: users.length
      },
      {
        key: 'classes_count',
        title: 'الصفوف الدراسية',
        status: classes.length > 0 ? 'ok' : 'warning',
        message: classes.length > 0 ? `يوجد ${classes.length} صف` : 'لا يوجد صفوف',
        count: classes.length
      },
      {
        key: 'attendance_records',
        title: 'سجلات الحضور',
        status: 'ok',
        message: `إجمالي ${attendance.length} سجل حضور`,
        count: attendance.length
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
    // Read Config
    const storedMode = localStorage.getItem(CONFIG_KEY) as StorageMode;
    this.mode = storedMode || 'local'; // Default to Local for offline-first operation
    
    console.log(`Initializing Database in [${this.mode.toUpperCase()}] mode.`);
    
    if (this.mode === 'cloud') {
      this.provider = new CloudProvider();
    } else {
      this.provider = new LocalProvider();
    }

    // Apply saved theme on boot
    this.getSettings().then(s => {
        if (s.theme) this.applyTheme(s.theme);
    });
  }

  getMode(): StorageMode {
      return this.mode;
  }

  setMode(mode: StorageMode) {
      localStorage.setItem(CONFIG_KEY, mode);
      window.location.reload(); // Reload to re-initialize the correct provider
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
  subscribeToNotifications(user: User | 'kiosk', callback: (n: Notification) => void) { return this.provider.subscribeToNotifications(user, callback); }
  
  // Structure & Users
  getClasses() { return this.provider.getClasses(); }
  saveClass(c: SchoolClass) { return this.provider.saveClass(c); }
  deleteClass(cid: string) { return this.provider.deleteClass(cid); }
  getUsers() { return this.provider.getUsers(); }
  saveUser(u: User) { return this.provider.saveUser(u); }
  deleteUser(uid: string) { return this.provider.deleteUser(uid); }

  // Support Extensions
  getSettings() { return this.provider.getSettings(); }
  saveSettings(s: SystemSettings) { 
      // Also apply theme immediately
      if (s.theme) this.applyTheme(s.theme);
      return this.provider.saveSettings(s); 
  }
  sendBroadcast(tr: string, m: string, t: string) { return this.provider.sendBroadcast(tr, m, t); }
  runDiagnostics() { return this.provider.runDiagnostics(); }

  // ------------------------------------------------------------------
  // Offline-First Kiosk Methods (Only work with CloudProvider)
  // ------------------------------------------------------------------
  preloadForKiosk(): Promise<void> {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).preloadForKiosk();
    }
    return Promise.resolve(); // No-op for LocalProvider
  }

  markAttendanceFast(id: string) {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).markAttendanceFast(id);
    }
    // Fallback to normal for LocalProvider
    return this.provider.markAttendance(id);
  }

  getSyncStatus(): SyncStatus {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).getSyncStatus();
    }
    return 'online'; // LocalProvider is always "online"
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
    return () => {}; // No-op for LocalProvider
  }

  forceSyncNow(): Promise<void> {
    if (this.provider instanceof CloudProvider) {
      return (this.provider as CloudProvider).forceSyncNow();
    }
    return Promise.resolve();
  }
}

export const db = new Database();
