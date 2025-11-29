
import { supabase } from './supabase';
import { User, Role, STORAGE_KEYS } from '../types';
import { db } from './db'; // Access db to check mode

export const auth = {
  /**
   * Check connection based on mode
   */
  async checkConnection(): Promise<boolean> {
    if (db.getMode() === 'local') {
        return true; // Always connected in local mode
    }
    
    try {
      const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
      return !error;
    } catch (e) {
      console.warn("Connection check failed");
      return false;
    }
  },

  /**
   * Login function
   */
  async login(username: string, password: string, type: 'staff' | 'guardian' = 'staff'): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const mode = db.getMode();

      // ---------------------------------------------------------
      // LOCAL MODE LOGIC
      // ---------------------------------------------------------
      if (mode === 'local') {
          // 1. Try to find user in stored local users (Created via Admin Panel)
          if (type === 'staff') {
              const localUsers = await db.getUsers();
              const found = localUsers.find(u => u.username === username && u.password === password);
              if (found) {
                  this.setSession(found);
                  return { success: true, user: found };
              }
          }

          // 2. Fallback to Hardcoded Admin Credentials (ONLY site_admin is fixed)
          if (type === 'staff' && username === 'admin' && password === 'admin123') {
             const user: User = { id: 'sys-admin', username, name: 'مدير النظام', role: Role.SITE_ADMIN };
             this.setSession(user);
             return { success: true, user };
          }

          // Mock Guardian - login with phone + last 4 digits of student ID
          if (type === 'guardian') {
              const students = await db.getStudentsByGuardian(username);
              // Match using last 4 digits of student ID
              const matched = students.find(s => s.id.slice(-4) === password);
              if (matched) {
                  const user: User = { id: `g_${matched.id}`, username, name: `ولي أمر ${matched.name}`, role: Role.GUARDIAN };
                  this.setSession(user);
                  return { success: true, user };
              }
              return { success: false, message: 'بيانات غير صحيحة (محلي)' };
          }

          return { success: false, message: 'بيانات الدخول غير صحيحة (وضع محلي)' };
      }

      // ---------------------------------------------------------
      // CLOUD MODE LOGIC (SUPABASE)
      // ---------------------------------------------------------
      if (type === 'staff') {
        const { data, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (error || !data) return { success: false, message: 'اسم المستخدم غير موجود' };
        if (data.password !== password) return { success: false, message: 'كلمة المرور غير صحيحة' };

        const user: User = { id: data.id, username: data.username, name: data.full_name, role: data.role as Role };
        this.setSession(user);
        return { success: true, user };
      } else {
        const { data, error } = await supabase.from('students').select('*').eq('guardian_phone', username);
        if (error || !data || data.length === 0) return { success: false, message: 'رقم الجوال غير مسجل' };

        // Match using last 4 digits of student ID
        const matchedStudent = data.find((s: any) => String(s.id).slice(-4) === password);
        if (!matchedStudent) return { success: false, message: 'كلمة المرور غير صحيحة (آخر 4 أرقام من معرف الطالب)' };

        const user: User = { id: `guardian_${matchedStudent.id}`, username: username, name: `ولي أمر ${matchedStudent.name}`, role: Role.GUARDIAN };
        this.setSession(user);
        return { success: true, user };
      }

    } catch (e) {
        console.error("Login error:", e);
        return { success: false, message: 'حدث خطأ غير متوقع' };
    }
  },

  setSession(user: User) { localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user)); },
  getSession(): User | null { try { const session = localStorage.getItem(STORAGE_KEYS.SESSION); return session ? JSON.parse(session) : null; } catch { return null; } },
  logout() { localStorage.removeItem(STORAGE_KEYS.SESSION); window.location.reload(); },
  requireRole(allowedRoles: Role[]): User | null {
      const user = this.getSession();
      if (!user) { window.location.reload(); return null; }
      if (!allowedRoles.includes(user.role)) {
          alert('عفواً، ليس لديك صلاحية للوصول لهذه الصفحة.');
          if (user.role === Role.GUARDIAN) window.location.hash = '/parents'; else window.location.hash = '/';
          return user;
      }
      return user;
  }
};
