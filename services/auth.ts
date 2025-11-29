/**
 * ═══════════════════════════════════════════════════════════════
 * 🔐 AuthService - Authentication with Security Enhancements
 * ═══════════════════════════════════════════════════════════════
 * 
 * Features:
 * - Password hashing (PBKDF2)
 * - Rate limiting protection
 * - Session management
 * - Auto password migration
 */

import { supabase } from './supabase';
import { User, Role, STORAGE_KEYS } from '../types';
import { db } from './db';
import { 
  verifyPassword, 
  hashPassword, 
  needsHashMigration,
  loginRateLimiter,
  generateSessionToken
} from './security';
import { appCache } from './cache';

// Session configuration
const SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours

export const auth = {
  /**
   * Check connection based on mode
   */
  async checkConnection(): Promise<boolean> {
    if (db.getMode() === 'local') {
      return true;
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
   * 🔐 Login with security checks
   */
  async login(
    username: string, 
    password: string, 
    type: 'staff' | 'guardian' = 'staff'
  ): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const mode = db.getMode();
      const identifier = `${type}:${username}`;

      // ═══════════════════════════════════════════════════════════════
      // 🚧 Rate Limiting Check
      // ═══════════════════════════════════════════════════════════════
      const rateCheck = loginRateLimiter.isAllowed(identifier);
      if (!rateCheck.allowed) {
        return { 
          success: false, 
          message: `تم تجاوز عدد المحاولات المسموحة. انتظر ${rateCheck.retryAfter} ثانية` 
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // 🏠 LOCAL MODE LOGIC
      // ═══════════════════════════════════════════════════════════════
      if (mode === 'local') {
        // 1. Try to find user in stored local users
        if (type === 'staff') {
          const localUsers = await db.getUsers();
          const found = localUsers.find(u => u.username === username);
          
          if (found) {
            // Check password (support both hashed and plain text)
            const isValid = await this.verifyUserPassword(found.password || '', password);
            
            if (isValid) {
              // Migrate password if needed
              if (needsHashMigration(found.password || '')) {
                await this.migrateUserPassword(found, password);
              }
              
              loginRateLimiter.recordSuccess(identifier);
              this.setSession(found);
              return { success: true, user: found };
            }
          }
        }

        // 2. Fallback to Hardcoded Admin Credentials (ONLY site_admin is fixed)
        if (type === 'staff' && username === 'admin' && password === 'admin123') {
          const user: User = { 
            id: 'sys-admin', 
            username, 
            name: 'مدير النظام', 
            role: Role.SITE_ADMIN 
          };
          loginRateLimiter.recordSuccess(identifier);
          this.setSession(user);
          return { success: true, user };
        }

        // 3. Guardian login with phone + last 4 digits of student ID
        if (type === 'guardian') {
          const students = await db.getStudentsByGuardian(username);
          const matched = students.find(s => s.id.slice(-4) === password);
          
          if (matched) {
            const user: User = { 
              id: `g_${matched.id}`, 
              username, 
              name: `ولي أمر ${matched.name}`, 
              role: Role.GUARDIAN 
            };
            loginRateLimiter.recordSuccess(identifier);
            this.setSession(user);
            return { success: true, user };
          }
          return { success: false, message: 'بيانات غير صحيحة' };
        }

        return { success: false, message: 'بيانات الدخول غير صحيحة' };
      }

      // ═══════════════════════════════════════════════════════════════
      // ☁️ CLOUD MODE LOGIC (SUPABASE)
      // ═══════════════════════════════════════════════════════════════
      if (type === 'staff') {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();
        
        if (error || !data) {
          return { success: false, message: 'اسم المستخدم غير موجود' };
        }

        // Check if account is locked
        if (data.locked_until && new Date(data.locked_until) > new Date()) {
          const remainingMinutes = Math.ceil(
            (new Date(data.locked_until).getTime() - Date.now()) / 60000
          );
          return { 
            success: false, 
            message: `الحساب مغلق مؤقتاً. حاول بعد ${remainingMinutes} دقيقة` 
          };
        }

        // Verify password
        const isValid = await this.verifyUserPassword(data.password, password);
        
        if (!isValid) {
          // Increment login attempts
          const attempts = (data.login_attempts || 0) + 1;
          const updates: any = { login_attempts: attempts };
          
          // Lock account after 5 failed attempts
          if (attempts >= 5) {
            updates.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          }
          
          await supabase.from('users').update(updates).eq('id', data.id);
          
          if (attempts >= 5) {
            return { success: false, message: 'تم إغلاق الحساب مؤقتاً لمدة 30 دقيقة' };
          }
          
          return { 
            success: false, 
            message: `كلمة المرور غير صحيحة (${5 - attempts} محاولات متبقية)` 
          };
        }

        // Migrate password if using old format
        if (needsHashMigration(data.password)) {
          const hashedPassword = await hashPassword(password);
          await supabase
            .from('users')
            .update({ 
              password: hashedPassword, 
              password_hash_version: 1 
            })
            .eq('id', data.id);
        }

        // Reset login attempts and update last login
        await supabase
          .from('users')
          .update({ 
            login_attempts: 0, 
            locked_until: null,
            last_login: new Date().toISOString() 
          })
          .eq('id', data.id);

        const user: User = { 
          id: data.id, 
          username: data.username, 
          name: data.name, 
          role: data.role as Role 
        };
        
        loginRateLimiter.recordSuccess(identifier);
        this.setSession(user);
        return { success: true, user };

      } else {
        // Guardian login
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('guardian_phone', username);
        
        if (error || !data || data.length === 0) {
          return { success: false, message: 'رقم الجوال غير مسجل' };
        }

        const matchedStudent = data.find((s: any) => String(s.id).slice(-4) === password);
        
        if (!matchedStudent) {
          return { success: false, message: 'كلمة المرور غير صحيحة (آخر 4 أرقام من معرف الطالب)' };
        }

        const user: User = { 
          id: `guardian_${matchedStudent.id}`, 
          username: username, 
          name: `ولي أمر ${matchedStudent.name}`, 
          role: Role.GUARDIAN 
        };
        
        loginRateLimiter.recordSuccess(identifier);
        this.setSession(user);
        return { success: true, user };
      }

    } catch (e) {
      console.error("Login error:", e);
      return { success: false, message: 'حدث خطأ غير متوقع' };
    }
  },

  /**
   * 🔑 Verify password (supports both hashed and plain text)
   */
  async verifyUserPassword(storedPassword: string, inputPassword: string): Promise<boolean> {
    if (!storedPassword) return false;
    
    // Check if password is hashed (contains PBKDF2 format)
    if (storedPassword.includes(':')) {
      return await verifyPassword(inputPassword, storedPassword);
    }
    
    // Legacy plain text comparison
    return storedPassword === inputPassword;
  },

  /**
   * 🔄 Migrate user password to hashed format
   */
  async migrateUserPassword(user: User, plainPassword: string): Promise<void> {
    try {
      const hashedPassword = await hashPassword(plainPassword);
      
      if (db.getMode() === 'local') {
        // Update in local storage
        const users = await db.getUsers();
        const userIndex = users.findIndex(u => u.id === user.id);
        if (userIndex >= 0) {
          users[userIndex].password = hashedPassword;
          // Save updated users list
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      } else {
        // Update in Supabase
        await supabase
          .from('users')
          .update({ password: hashedPassword, password_hash_version: 1 })
          .eq('id', user.id);
      }
      
      console.log(`[Auth] Migrated password for user: ${user.username}`);
    } catch (e) {
      console.warn('[Auth] Failed to migrate password:', e);
    }
  },

  /**
   * 💾 Set session with token
   */
  setSession(user: User) {
    const session = {
      user,
      token: generateSessionToken(),
      expiresAt: Date.now() + SESSION_TIMEOUT,
      createdAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  },

  /**
   * 📖 Get current session
   */
  getSession(): User | null {
    try {
      const sessionStr = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (!sessionStr) return null;
      
      const session = JSON.parse(sessionStr);
      
      // Check if session expired
      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.logout();
        return null;
      }
      
      return session.user || session; // Support old format
    } catch {
      return null;
    }
  },

  /**
   * 🔄 Refresh session (extend timeout)
   */
  refreshSession() {
    const user = this.getSession();
    if (user) {
      this.setSession(user);
    }
  },

  /**
   * 🚪 Logout
   */
  logout() {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    appCache.clear(); // Clear cache on logout
    window.location.reload();
  },

  /**
   * 🛡️ Require specific roles
   */
  requireRole(allowedRoles: Role[]): User | null {
    const user = this.getSession();
    
    if (!user) {
      window.location.reload();
      return null;
    }
    
    if (!allowedRoles.includes(user.role)) {
      alert('عفواً، ليس لديك صلاحية للوصول لهذه الصفحة.');
      
      if (user.role === Role.GUARDIAN) {
        window.location.hash = '/parents';
      } else {
        window.location.hash = '/';
      }
      return user;
    }
    
    // Refresh session on activity
    this.refreshSession();
    
    return user;
  },

  /**
   * 🔐 Check if current user has role
   */
  hasRole(role: Role): boolean {
    const user = this.getSession();
    return user?.role === role;
  },

  /**
   * 🔐 Check if current user has any of the roles
   */
  hasAnyRole(roles: Role[]): boolean {
    const user = this.getSession();
    return user ? roles.includes(user.role) : false;
  },

  /**
   * 📊 Get rate limiter stats
   */
  getRateLimitStats() {
    return loginRateLimiter.getStats();
  }
};
