-- =============================================================================
-- نظام حاضر (Hader) - Enterprise School Attendance System
-- Supabase Database Schema - Production Ready
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. CLEANUP: Drop existing tables (in correct order due to foreign keys)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS daily_summaries CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS violations CASCADE;
DROP TABLE IF EXISTS exits CASCADE;
DROP TABLE IF EXISTS attendance_logs CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE - System Users (Admins, Supervisors, Watchers, Kiosk)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Note: Use hashing in production (bcrypt)
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('site_admin', 'school_admin', 'supervisor', 'watcher', 'kiosk')),
    assigned_classes TEXT[], -- For supervisors: array of class names they supervise
    assigned_sections TEXT[], -- For supervisors: array of sections they supervise
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster login queries
CREATE INDEX idx_users_username ON users(username);

-- -----------------------------------------------------------------------------
-- 2. CLASSES TABLE - School Structure (Grades/Sections)
-- -----------------------------------------------------------------------------
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- e.g., "أول ثانوي"
    sections TEXT[] NOT NULL DEFAULT '{}', -- e.g., ["أ", "ب", "ج"]
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint on class name
CREATE UNIQUE INDEX idx_classes_name ON classes(name);

-- -----------------------------------------------------------------------------
-- 3. STUDENTS TABLE - Student Records
-- -----------------------------------------------------------------------------
CREATE TABLE students (
    id VARCHAR(50) PRIMARY KEY, -- Student ID (e.g., "2024001")
    name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) NOT NULL, -- References classes.name
    section VARCHAR(20) NOT NULL,
    guardian_phone VARCHAR(20), -- For parent notifications
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_students_class ON students(class_name);
CREATE INDEX idx_students_section ON students(class_name, section);
CREATE INDEX idx_students_guardian ON students(guardian_phone);

-- -----------------------------------------------------------------------------
-- 4. ATTENDANCE_LOGS TABLE - Daily Attendance Records
-- -----------------------------------------------------------------------------
CREATE TABLE attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'late')),
    minutes_late INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate attendance for same student on same day
    UNIQUE(student_id, date)
);

-- Indexes for reporting and queries
CREATE INDEX idx_attendance_date ON attendance_logs(date);
CREATE INDEX idx_attendance_student ON attendance_logs(student_id);
CREATE INDEX idx_attendance_status ON attendance_logs(date, status);

-- -----------------------------------------------------------------------------
-- 5. EXITS TABLE - Early Exit Records
-- -----------------------------------------------------------------------------
CREATE TABLE exits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    exit_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supervisor_name VARCHAR(255), -- Who authorized the exit
    notes TEXT,
    created_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_exits_student ON exits(student_id);
CREATE INDEX idx_exits_date ON exits(DATE(exit_time));

-- -----------------------------------------------------------------------------
-- 6. VIOLATIONS TABLE - Behavioral Violations
-- -----------------------------------------------------------------------------
CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL, -- e.g., "سلوك مخل", "غياب متكرر"
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5), -- Severity 1-5
    description TEXT,
    action_taken TEXT, -- What was done (e.g., "إنذار شفهي")
    summon_guardian BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_violations_student ON violations(student_id);
CREATE INDEX idx_violations_date ON violations(DATE(created_at));
CREATE INDEX idx_violations_type ON violations(type);

-- -----------------------------------------------------------------------------
-- 7. NOTIFICATIONS TABLE - System Notifications
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('announcement', 'behavior', 'general', 'command', 'alert')),
    target_audience VARCHAR(50) NOT NULL, -- 'all', 'admin', 'parent', 'supervisor', etc.
    target_id VARCHAR(255), -- Specific target (phone number, student_id, etc.)
    is_popup BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_audience ON notifications(target_audience);
CREATE INDEX idx_notifications_target ON notifications(target_id);
CREATE INDEX idx_notifications_date ON notifications(created_at DESC);

-- -----------------------------------------------------------------------------
-- 8. SETTINGS TABLE - System Configuration (Singleton)
-- -----------------------------------------------------------------------------
CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton pattern
    system_ready BOOLEAN DEFAULT TRUE,
    school_active BOOLEAN DEFAULT TRUE,
    logo_url TEXT,
    assembly_time TIME DEFAULT '07:00',
    grace_period INTEGER DEFAULT 15, -- Minutes
    dark_mode BOOLEAN DEFAULT TRUE,
    
    -- Theme colors (RGB format: "r g b")
    theme_primary_400 VARCHAR(20) DEFAULT '167 139 250',
    theme_primary_500 VARCHAR(20) DEFAULT '124 58 237',
    theme_primary_600 VARCHAR(20) DEFAULT '109 40 217',
    theme_secondary_400 VARCHAR(20) DEFAULT '244 114 182',
    theme_secondary_500 VARCHAR(20) DEFAULT '219 39 119',
    theme_secondary_600 VARCHAR(20) DEFAULT '190 24 93',
    
    -- Kiosk Settings (JSONB for flexibility)
    kiosk_settings JSONB DEFAULT '{
        "mainTitle": "نظام حاضر",
        "subTitle": "نظام الحضور والانصراف الذكي",
        "earlyMessage": "شكراً لالتزامك! استمر في التميز",
        "lateMessage": "نأمل منك الحرص على الحضور المبكر",
        "showStats": true,
        "theme": "cosmic"
    }'::JSONB,
    
    -- Notification Templates (JSONB)
    notification_templates JSONB DEFAULT '{
        "late": {"title": "تنبيه تأخر", "message": "نود إعلامكم بتأخر ابنكم/ابنتكم عن الحضور للمدرسة اليوم."},
        "absent": {"title": "تنبيه غياب", "message": "نود إعلامكم بتغيب ابنكم/ابنتكم عن المدرسة اليوم."},
        "behavior": {"title": "ملاحظة سلوكية", "message": "نود إعلامكم بتسجيل ملاحظة سلوكية على ابنكم/ابنتكم."},
        "summon": {"title": "استدعاء ولي أمر", "message": "نرجو التكرم بمراجعة إدارة المدرسة."}
    }'::JSONB,
    
    -- Social Links (JSONB)
    social_links JSONB DEFAULT '{}'::JSONB,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 9. DAILY_SUMMARIES TABLE - Cached Daily Statistics
-- -----------------------------------------------------------------------------
CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    total_students INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    late_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    attendance_rate DECIMAL(5,2) DEFAULT 0.00,
    summary_data JSONB, -- Additional statistics
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date lookups
CREATE INDEX idx_daily_summaries_date ON daily_summaries(date DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PERMISSIVE POLICIES (Using custom auth via anon key)
-- =============================================================================
-- Note: Since we use custom authentication (not Supabase Auth),
-- we create permissive policies for the anon key. In production,
-- you may want to use service_role key or implement JWT validation.

-- Users table policies
CREATE POLICY "Allow full access to users" ON users FOR ALL USING (true) WITH CHECK (true);

-- Classes table policies
CREATE POLICY "Allow full access to classes" ON classes FOR ALL USING (true) WITH CHECK (true);

-- Students table policies
CREATE POLICY "Allow full access to students" ON students FOR ALL USING (true) WITH CHECK (true);

-- Attendance logs policies
CREATE POLICY "Allow full access to attendance_logs" ON attendance_logs FOR ALL USING (true) WITH CHECK (true);

-- Exits policies
CREATE POLICY "Allow full access to exits" ON exits FOR ALL USING (true) WITH CHECK (true);

-- Violations policies
CREATE POLICY "Allow full access to violations" ON violations FOR ALL USING (true) WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Allow full access to notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- Settings policies
CREATE POLICY "Allow full access to settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- Daily summaries policies
CREATE POLICY "Allow full access to daily_summaries" ON daily_summaries FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- BOOTSTRAP DATA - Initial System Setup
-- =============================================================================

-- Insert Default Admin User (ONLY required bootstrap data)
-- Password: admin123 (in production, use proper hashing)
INSERT INTO users (id, username, password, name, role) VALUES 
    (gen_random_uuid(), 'admin', 'admin123', 'مدير النظام', 'site_admin');

-- Insert Default System Settings
INSERT INTO settings (id) VALUES (1);

-- =============================================================================
-- REALTIME SUBSCRIPTIONS - Enable for live updates
-- =============================================================================
-- Enable realtime for attendance (for live dashboard updates)
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE exits;
ALTER PUBLICATION supabase_realtime ADD TABLE violations;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON classes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_summaries_updated_at BEFORE UPDATE ON daily_summaries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================

-- Verification query (run after schema creation):
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

