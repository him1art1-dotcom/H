
import React, { useState, useEffect, useMemo } from 'react';
import { db, getLocalISODate } from '../services/db';
import { auth } from '../services/auth';
import { 
  Role, Student, DailySummary, ExitRecord, ViolationRecord, 
  Notification, AttendanceRecord, User, SchoolClass, NotificationTemplates 
} from '../types';
import { 
  Search, AlertTriangle, DoorOpen, Bell, LayoutDashboard, MessageCircle, 
  X, Check, Loader2, Calendar, RefreshCcw, Users, FileText, Download, 
  Printer, Eye, Send, CheckSquare, Square, Filter, ChevronDown, 
  Clock, UserCheck, UserX, TrendingUp, AlertCircle, Shield, Phone,
  ChevronRight, BarChart3, FileSpreadsheet, GraduationCap, FileDown
} from 'lucide-react';

// Violation Types
const VIOLATION_TYPES = [
  { value: 'disruptive', label: 'سلوك مشاغب' },
  { value: 'uniform', label: 'مخالفة الزي' },
  { value: 'fighting', label: 'مشاجرة' },
  { value: 'late_class', label: 'تأخر عن الحصة' },
  { value: 'phone', label: 'استخدام الجوال' },
  { value: 'absence', label: 'تغيب بدون إذن' },
  { value: 'other', label: 'أخرى' }
];

// Exit Reasons
const EXIT_REASONS = [
  { value: 'sick', label: 'مرض' },
  { value: 'appointment', label: 'موعد طبي' },
  { value: 'family', label: 'ظرف عائلي' },
  { value: 'emergency', label: 'حالة طارئة' },
  { value: 'other', label: 'أخرى' }
];

// Default Notification Templates
const DEFAULT_TEMPLATES: NotificationTemplates = {
  late: {
    title: 'تنبيه تأخر',
    message: 'نود إعلامكم بتأخر ابنكم/ابنتكم عن الحضور للمدرسة اليوم. نأمل الحرص على الالتزام بالمواعيد.'
  },
  absent: {
    title: 'تنبيه غياب',
    message: 'نود إعلامكم بتغيب ابنكم/ابنتكم عن المدرسة اليوم. يرجى تبرير الغياب في أقرب وقت.'
  },
  behavior: {
    title: 'ملاحظة سلوكية',
    message: 'نود إعلامكم بتسجيل ملاحظة سلوكية على ابنكم/ابنتكم. يرجى مراجعة الإدارة للمتابعة.'
  },
  summon: {
    title: 'استدعاء ولي أمر',
    message: 'نرجو التكرم بمراجعة إدارة المدرسة لمناقشة موضوع يخص ابنكم/ابنتكم.'
  }
};

interface Props {
  user?: User;
}

const Supervision: React.FC<Props> = ({ user: propUser }) => {
  // Get user from props or auth
  const currentUser = propUser || auth.getSession();
  
  // Core State
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [todayExits, setTodayExits] = useState<ExitRecord[]>([]);
  const [todayViolations, setTodayViolations] = useState<ViolationRecord[]>([]);
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplates>(DEFAULT_TEMPLATES);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'attendance' | 'exits' | 'violations' | 'students'>('attendance');
  
  // Filters
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'late' | 'absent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Student Selection Filters (for forms)
  const [formFilterClass, setFormFilterClass] = useState('');
  const [formFilterSection, setFormFilterSection] = useState('');
  const [formSearchQuery, setFormSearchQuery] = useState('');
  
  // Bulk Selection
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTemplate, setBulkTemplate] = useState<'late' | 'absent'>('late');
  const [bulkMessage, setBulkMessage] = useState('');
  
  // Export Modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'all' | 'late' | 'absent' | 'present'>('all');
  const [exportFormat, setExportFormat] = useState<'excel' | 'print'>('excel');
  const [exportSortBy, setExportSortBy] = useState<'name' | 'id'>('name'); // ترتيب التصدير
  const [exportFilterClass, setExportFilterClass] = useState(''); // فلتر الصف للتصدير
  const [exportFilterSection, setExportFilterSection] = useState(''); // فلتر الفصل للتصدير
  
  // Exit Form
  const [exitForm, setExitForm] = useState({
    studentId: '',
    reason: '',
    reasonType: '',
    notes: ''
  });
  
  // Violation Form
  const [violationForm, setViolationForm] = useState({
    studentId: '',
    type: '',
    level: 3,
    description: '',
    actionTaken: '',
    summonGuardian: false
  });
  
  // Student Profile Modal
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);
  const [profileData, setProfileData] = useState<{
    attendance: AttendanceRecord[];
    exits: ExitRecord[];
    violations: ViolationRecord[];
  } | null>(null);
  
  // Message Modal
  const [messageStudent, setMessageStudent] = useState<Student | null>(null);
  const [messageText, setMessageText] = useState('');
  
  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  // Load Data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const today = getLocalISODate();
      
      const [allStudents, allClasses, sum, exits, violations, todayAttendance, settings] = await Promise.all([
        db.getStudents(),
        db.getClasses(),
        db.getDailySummary(today),
        db.getTodayExits(),
        db.getTodayViolations(),
        db.getAttendance(today),
        db.getSettings()
      ]);
      
      setStudents(allStudents);
      setClasses(allClasses);
      setSummary(sum);
      setTodayExits(exits);
      setTodayViolations(violations);
      setAttendance(todayAttendance);
      
      // Load custom notification templates from settings
      if (settings?.notificationTemplates) {
        setNotificationTemplates({ ...DEFAULT_TEMPLATES, ...settings.notificationTemplates });
      }
    } catch (e) {
      console.error(e);
      showToast('حدث خطأ في تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Get unique classes and sections
  const uniqueClasses = useMemo(() => Array.from(new Set(students.map(s => s.className))), [students]);
  const uniqueSections = useMemo(() => {
    if (!filterClass) return Array.from(new Set(students.map(s => s.section)));
    return Array.from(new Set(students.filter(s => s.className === filterClass).map(s => s.section)));
  }, [students, filterClass]);

  // Form-specific sections based on formFilterClass
  const formSections = useMemo(() => {
    if (!formFilterClass) return Array.from(new Set(students.map(s => s.section)));
    return Array.from(new Set(students.filter(s => s.className === formFilterClass).map(s => s.section)));
  }, [students, formFilterClass]);

  // Filtered students for forms (exit/violation)
  const filteredFormStudents = useMemo(() => {
    let list = students;
    if (formFilterClass) list = list.filter(s => s.className === formFilterClass);
    if (formFilterSection) list = list.filter(s => s.section === formFilterSection);
    if (formSearchQuery) {
      const query = formSearchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(query) || s.id.includes(formSearchQuery));
    }
    return list;
  }, [students, formFilterClass, formFilterSection, formSearchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = students.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    const absentCount = total - (presentCount + lateCount);
    const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
    
    return { total, presentCount, lateCount, absentCount, rate };
  }, [students, attendance]);

  // Filter students for attendance tab
  const filteredAttendanceList = useMemo(() => {
    let list = students;
    
    // Class filter
    if (filterClass) list = list.filter(s => s.className === filterClass);
    if (filterSection) list = list.filter(s => s.section === filterSection);
    
    // Status filter
    if (filterStatus !== 'all') {
      const studentIds = attendance
        .filter(a => a.status === filterStatus || (filterStatus === 'present' && a.status === 'present'))
        .map(a => a.studentId);
      
      if (filterStatus === 'absent') {
        const presentIds = attendance.map(a => a.studentId);
        list = list.filter(s => !presentIds.includes(s.id));
      } else {
        list = list.filter(s => studentIds.includes(s.id));
      }
    }
    
    // Search
    if (searchQuery) {
      list = list.filter(s => 
        s.name.includes(searchQuery) || 
        s.id.includes(searchQuery)
      );
    }
    
    return list.map(student => {
      const record = attendance.find(a => a.studentId === student.id);
      return {
        ...student,
        attendanceStatus: record?.status || 'absent',
        timestamp: record?.timestamp,
        minutesLate: record?.minutesLate || 0
      };
    });
  }, [students, attendance, filterClass, filterSection, filterStatus, searchQuery]);

  // Handle bulk selection
  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredAttendanceList.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredAttendanceList.map(s => s.id)));
    }
  };

  const toggleSelectStudent = (id: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStudents(newSet);
  };

  // Send bulk notifications
  const sendBulkNotifications = async () => {
    if (selectedStudents.size === 0) return;
    
    const template = notificationTemplates[bulkTemplate];
    const message = bulkMessage || template.message;
    
    try {
      for (const studentId of selectedStudents) {
        const student = students.find(s => s.id === studentId);
        if (!student) continue;
        
        await db.saveNotification({
          id: '',
          title: template.title,
          message: `${student.name}: ${message}`,
          type: 'attendance',
          target_audience: 'guardian',
          target_id: studentId,
          created_at: new Date().toISOString(),
          isPopup: true
        });
      }
      
      showToast(`تم إرسال ${selectedStudents.size} إشعار بنجاح`, 'success');
      setShowBulkModal(false);
      setSelectedStudents(new Set());
      setBulkMessage('');
    } catch (e) {
      showToast('حدث خطأ في إرسال الإشعارات', 'error');
    }
  };

  // Handle Exit Form
  const handleSaveExit = async () => {
    if (!exitForm.studentId || !exitForm.reason) {
      showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      return;
    }
    
    try {
      await db.addExit({
        id: '',
        studentId: exitForm.studentId,
        reason: exitForm.reason,
        exit_time: new Date().toISOString(),
        supervisor_name: currentUser?.name || 'مشرف', // Saved but not displayed
        notes: exitForm.notes,
        status: 'approved'
      });
      
      showToast('تم تسجيل الخروج بنجاح', 'success');
      setExitForm({ studentId: '', reason: '', reasonType: '', notes: '' });
      setFormFilterClass('');
      setFormFilterSection('');
      setFormSearchQuery('');
      setTodayExits(await db.getTodayExits());
    } catch (e) {
      showToast('حدث خطأ في حفظ البيانات', 'error');
    }
  };

  // Handle Violation Form
  const handleSaveViolation = async () => {
    if (!violationForm.studentId || !violationForm.type) {
      showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      return;
    }
    
    try {
      const student = students.find(s => s.id === violationForm.studentId);
      
      await db.addViolation({
        id: '',
        studentId: violationForm.studentId,
        type: VIOLATION_TYPES.find(v => v.value === violationForm.type)?.label || violationForm.type,
        description: violationForm.description,
        level: violationForm.level as any,
        action_taken: violationForm.actionTaken,
        summon_guardian: violationForm.summonGuardian,
        created_at: new Date().toISOString()
      });
      
      // Send notification if summon guardian is checked
      if (violationForm.summonGuardian && student) {
        await db.saveNotification({
          id: '',
          title: notificationTemplates.summon.title,
          message: `${student.name}: ${notificationTemplates.summon.message}`,
          type: 'behavior',
          target_audience: 'guardian',
          target_id: violationForm.studentId,
          created_at: new Date().toISOString(),
          isPopup: true
        });
      }
      
      showToast('تم تسجيل المخالفة بنجاح', 'success');
      setViolationForm({
        studentId: '',
        type: '',
        level: 3,
        description: '',
        actionTaken: '',
        summonGuardian: false
      });
      setFormFilterClass('');
      setFormFilterSection('');
      setFormSearchQuery('');
      setTodayViolations(await db.getTodayViolations());
    } catch (e) {
      showToast('حدث خطأ في حفظ البيانات', 'error');
    }
  };

  // Open student profile
  const openStudentProfile = async (student: Student) => {
    setProfileStudent(student);
    try {
      const [studentAttendance, studentExits, studentViolations] = await Promise.all([
        db.getStudentAttendance(student.id),
        db.getStudentExits(student.id),
        db.getViolations(student.id)
      ]);
      setProfileData({
        attendance: studentAttendance,
        exits: studentExits,
        violations: studentViolations
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Send direct message
  const sendDirectMessage = async () => {
    if (!messageStudent || !messageText) return;
    
    try {
      await db.saveNotification({
        id: '',
        title: 'رسالة من الإدارة',
        message: `${messageStudent.name}: ${messageText}`,
        type: 'general',
        target_audience: 'guardian',
        target_id: messageStudent.id,
        created_at: new Date().toISOString(),
        isPopup: true
      });
      
      showToast('تم إرسال الرسالة بنجاح', 'success');
      setMessageStudent(null);
      setMessageText('');
    } catch (e) {
      showToast('حدث خطأ في إرسال الرسالة', 'error');
    }
  };

  // WhatsApp function
  const openWhatsApp = (student: Student, type: 'absent' | 'late' | 'violation') => {
    if (!student.guardianPhone) {
      showToast('لا يوجد رقم هاتف لولي الأمر', 'error');
      return;
    }
    
    let phone = student.guardianPhone.replace(/\D/g, '');
    if (phone.startsWith('0')) phone = phone.substring(1);
    if (!phone.startsWith('966')) phone = '966' + phone;

    const messages = {
      absent: `السلام عليكم ولي أمر الطالب ${student.name}، نود إشعاركم بأن ابنكم تغيب عن المدرسة اليوم.`,
      late: `السلام عليكم ولي أمر الطالب ${student.name}، نود إشعاركم بأن ابنكم وصل متأخراً للمدرسة اليوم.`,
      violation: `السلام عليكم ولي أمر الطالب ${student.name}، نود إشعاركم بتسجيل ملاحظة سلوكية اليوم.`
    };
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(messages[type])}`, '_blank');
  };

  // Get data for export based on type, filters and sort
  const getExportData = (type: 'all' | 'late' | 'absent' | 'present', sortBy: 'name' | 'id' = 'name') => {
    // Start with all students (not pre-filtered) so we can apply export-specific filters
    let list = students.map(student => {
      const record = attendance.find(a => a.studentId === student.id);
      return {
        ...student,
        attendanceStatus: record?.status || 'absent',
        timestamp: record?.timestamp,
        minutesLate: record?.minutesLate || 0
      };
    });
    
    // Apply export-specific class/section filters
    if (exportFilterClass) {
      list = list.filter(s => s.className === exportFilterClass);
    }
    if (exportFilterSection) {
      list = list.filter(s => s.section === exportFilterSection);
    }
    
    // Apply status filter
    if (type !== 'all') {
      list = list.filter(s => s.attendanceStatus === type);
    }
    
    // Sort the data
    list = list.sort((a, b) => {
      // First sort by class
      const classCompare = a.className.localeCompare(b.className, 'ar');
      if (classCompare !== 0) return classCompare;
      
      // Then by section
      const sectionCompare = a.section.localeCompare(b.section, 'ar');
      if (sectionCompare !== 0) return sectionCompare;
      
      // Finally by name or id
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name, 'ar');
      } else {
        return a.id.localeCompare(b.id);
      }
    });
    
    return list;
  };

  // Export functions
  const exportToExcel = (type: 'all' | 'late' | 'absent' | 'present' = 'all', sortBy: 'name' | 'id' = 'name') => {
    const exportData = getExportData(type, sortBy);
    const statusLabels: Record<string, string> = {
      all: 'الكل',
      present: 'الحضور',
      late: 'المتأخرون',
      absent: 'الغائبون'
    };
    
    const filterLabel = exportFilterClass 
      ? `${exportFilterClass}${exportFilterSection ? `-${exportFilterSection}` : ''}_`
      : '';
    
    const data = exportData.map((s, i) => ({
      '#': i + 1,
      'الاسم': s.name,
      'المعرف': s.id,
      'الصف': s.className,
      'الفصل': s.section,
      'الحالة': s.attendanceStatus === 'present' ? 'حاضر' : s.attendanceStatus === 'late' ? 'متأخر' : 'غائب',
      'وقت الحضور': s.timestamp ? new Date(s.timestamp).toLocaleTimeString('ar-SA') : '-',
      'دقائق التأخر': s.minutesLate || 0
    }));
    
    const ws = (window as any).XLSX.utils.json_to_sheet(data);
    const wb = (window as any).XLSX.utils.book_new();
    (window as any).XLSX.utils.book_append_sheet(wb, ws, statusLabels[type]);
    (window as any).XLSX.writeFile(wb, `حضور_${filterLabel}${statusLabels[type]}_${getLocalISODate()}.xlsx`);
    showToast('تم تصدير الملف بنجاح', 'success');
    setShowExportModal(false);
    // Reset export filters
    setExportFilterClass('');
    setExportFilterSection('');
  };

  const printReport = (type: 'all' | 'late' | 'absent' | 'present' = 'all', sortBy: 'name' | 'id' = 'name') => {
    const exportData = getExportData(type, sortBy);
    const statusLabels: Record<string, string> = {
      all: 'جميع الطلاب',
      present: 'الحاضرون',
      late: 'المتأخرون',
      absent: 'الغائبون'
    };
    
    const filterLabel = exportFilterClass || 'جميع الصفوف';
    const sectionLabel = exportFilterSection ? ` - ${exportFilterSection}` : '';
    
    // Calculate stats for filtered data
    const filteredStats = {
      present: exportData.filter(s => s.attendanceStatus === 'present').length,
      late: exportData.filter(s => s.attendanceStatus === 'late').length,
      absent: exportData.filter(s => s.attendanceStatus === 'absent').length
    };
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('فشل فتح نافذة الطباعة', 'error');
      return;
    }
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>تقرير ${statusLabels[type]} - ${getLocalISODate()}</title>
        <style>
          * { font-family: 'Tajawal', Arial, sans-serif; }
          body { padding: 20px; }
          h1 { text-align: center; color: #333; margin-bottom: 10px; }
          h2 { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
          .sort-info { text-align: center; color: #888; font-size: 12px; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background-color: #7c3aed; color: white; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .status-present { color: #10b981; font-weight: bold; }
          .status-late { color: #f59e0b; font-weight: bold; }
          .status-absent { color: #ef4444; font-weight: bold; }
          .summary { display: flex; justify-content: center; gap: 30px; margin-bottom: 20px; }
          .summary-item { text-align: center; padding: 10px 20px; border-radius: 8px; }
          .summary-item.present { background: #d1fae5; }
          .summary-item.late { background: #fef3c7; }
          .summary-item.absent { background: #fee2e2; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>تقرير ${statusLabels[type]}</h1>
        <h2>التاريخ: ${new Date().toLocaleDateString('ar-SA')} | ${filterLabel}${sectionLabel}</h2>
        <p class="sort-info">مرتب حسب: الصف > الفصل > ${sortBy === 'name' ? 'الاسم أبجدياً' : 'رقم المعرف'}</p>
        
        <div class="summary">
          <div class="summary-item present"><strong>${filteredStats.present}</strong><br>حاضر</div>
          <div class="summary-item late"><strong>${filteredStats.late}</strong><br>متأخر</div>
          <div class="summary-item absent"><strong>${filteredStats.absent}</strong><br>غائب</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم</th>
              <th>المعرف</th>
              <th>الصف</th>
              <th>الفصل</th>
              <th>الحالة</th>
              <th>وقت الحضور</th>
              <th>دقائق التأخر</th>
            </tr>
          </thead>
          <tbody>
            ${exportData.map((s, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${s.name}</td>
                <td>${s.id}</td>
                <td>${s.className}</td>
                <td>${s.section}</td>
                <td class="status-${s.attendanceStatus}">${s.attendanceStatus === 'present' ? 'حاضر' : s.attendanceStatus === 'late' ? 'متأخر' : 'غائب'}</td>
                <td>${s.timestamp ? new Date(s.timestamp).toLocaleTimeString('ar-SA') : '-'}</td>
                <td>${s.minutesLate || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    setShowExportModal(false);
    // Reset export filters
    setExportFilterClass('');
    setExportFilterSection('');
  };

  // Student Select Component (reusable for forms)
  const StudentSelectComponent = ({ 
    value, 
    onChange,
    label = 'الطالب *'
  }: { 
    value: string; 
    onChange: (id: string) => void;
    label?: string;
  }) => (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      
      {/* Filters Row */}
      <div className="grid grid-cols-2 gap-2">
        <select
          value={formFilterClass}
          onChange={e => { setFormFilterClass(e.target.value); setFormFilterSection(''); }}
          className="input-glass p-2 rounded-xl text-sm"
        >
          <option value="">كل الصفوف</option>
          {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        
        <select
          value={formFilterSection}
          onChange={e => setFormFilterSection(e.target.value)}
          className="input-glass p-2 rounded-xl text-sm"
        >
          <option value="">كل الفصول</option>
          {formSections.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="بحث بالاسم أو المعرف..."
          value={formSearchQuery}
          onChange={e => setFormSearchQuery(e.target.value)}
          className="w-full input-glass pr-10 p-2.5 rounded-xl text-sm"
        />
      </div>
      
      {/* Student Dropdown */}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full input-glass p-3 rounded-xl"
        size={5}
      >
        <option value="">اختر الطالب...</option>
        {filteredFormStudents.map(s => (
          <option key={s.id} value={s.id}>
            {s.name} | {s.id} | {s.className}/{s.section}
          </option>
        ))}
      </select>
      
      <p className="text-xs text-gray-500">{filteredFormStudents.length} طالب</p>
    </div>
  );

  // Loading State
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="animate-spin w-12 h-12 text-primary-500 mx-auto mb-4" />
          <p className="text-gray-400">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 print:bg-white">
      
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl print:hidden">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-serif text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary-400" />
              بوابة الإشراف
            </h1>
            <p className="text-gray-400 mt-1">مركز القيادة لإدارة شؤون الطلاب</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchData}
              className="p-3 bg-white/5 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              title="تحديث"
            >
              <RefreshCcw className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowExportModal(true)}
              className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-bold text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
            >
              <FileDown className="w-5 h-5" />
              تصدير / طباعة
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 print:hidden">
        {[
          { id: 'attendance', label: 'المتابعة', icon: LayoutDashboard, color: 'from-violet-600 to-purple-600' },
          { id: 'exits', label: 'الاستئذان', icon: DoorOpen, color: 'from-blue-600 to-cyan-600' },
          { id: 'violations', label: 'المخالفات', icon: AlertTriangle, color: 'from-red-600 to-orange-600' },
          { id: 'students', label: 'الطلاب والتقارير', icon: Users, color: 'from-emerald-600 to-teal-600' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl whitespace-nowrap font-bold transition-all ${
              activeTab === tab.id 
              ? `bg-gradient-to-r ${tab.color} text-white shadow-lg` 
              : 'glass text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===================== TAB 1: ATTENDANCE ===================== */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">نسبة الحضور</span>
                  <TrendingUp className="w-5 h-5 text-violet-400" />
                </div>
                <p className="text-3xl font-bold text-white">{stats.rate}%</p>
                <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${stats.rate}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">الحضور</span>
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-3xl font-bold text-emerald-400">{stats.presentCount}</p>
                <p className="text-xs text-gray-500 mt-1">طالب حاضر</p>
              </div>
            </div>
            
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">المتأخرون</span>
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-3xl font-bold text-amber-400">{stats.lateCount}</p>
                <p className="text-xs text-gray-500 mt-1">طالب متأخر</p>
              </div>
            </div>
            
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">الغياب</span>
                  <UserX className="w-5 h-5 text-red-400" />
                </div>
                <p className="text-3xl font-bold text-red-400">{stats.absentCount}</p>
                <p className="text-xs text-gray-500 mt-1">طالب غائب</p>
              </div>
            </div>
          </div>

          {/* Filters & Actions */}
          <div className="glass-card p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو المعرف..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full input-glass pr-10 py-2.5 rounded-xl text-sm"
                />
              </div>
              
              {/* Class Filter */}
              <select
                value={filterClass}
                onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }}
                className="input-glass py-2.5 px-4 rounded-xl text-sm min-w-[140px]"
              >
                <option value="">كل الصفوف</option>
                {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              
              {/* Section Filter */}
              <select
                value={filterSection}
                onChange={e => setFilterSection(e.target.value)}
                className="input-glass py-2.5 px-4 rounded-xl text-sm min-w-[120px]"
              >
                <option value="">كل الفصول</option>
                {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              
              {/* Status Filter */}
              <div className="flex gap-1 bg-black/20 p-1 rounded-xl">
                {[
                  { value: 'all', label: 'الكل' },
                  { value: 'present', label: 'حضور' },
                  { value: 'late', label: 'متأخر' },
                  { value: 'absent', label: 'غائب' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterStatus(opt.value as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterStatus === opt.value 
                        ? 'bg-primary-600 text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              
              {/* Bulk Action Button */}
              {selectedStudents.size > 0 && (
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl text-white font-bold text-sm flex items-center gap-2 shadow-lg animate-pulse"
                >
                  <Bell className="w-4 h-4" />
                  إشعار أولياء الأمور ({selectedStudents.size})
                </button>
              )}
            </div>
          </div>

          {/* Student Table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-gradient-to-r from-primary-900/50 to-secondary-900/50 text-white">
                  <tr>
                    <th className="p-4 w-12">
                      <button onClick={toggleSelectAll} className="text-gray-400 hover:text-white">
                        {selectedStudents.size === filteredAttendanceList.length && filteredAttendanceList.length > 0
                          ? <CheckSquare className="w-5 h-5 text-primary-400" />
                          : <Square className="w-5 h-5" />
                        }
                      </button>
                    </th>
                    <th className="p-4">الطالب</th>
                    <th className="p-4">الصف</th>
                    <th className="p-4">وقت الحضور</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAttendanceList.map(student => (
                    <tr key={student.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <button onClick={() => toggleSelectStudent(student.id)}>
                          {selectedStudents.has(student.id)
                            ? <CheckSquare className="w-5 h-5 text-primary-400" />
                            : <Square className="w-5 h-5 text-gray-600" />
                          }
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
                            <GraduationCap className="w-5 h-5 text-primary-400" />
                          </div>
                          <div>
                            <p className="font-bold text-white">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-300">{student.className} - {student.section}</td>
                      <td className="p-4 font-mono text-gray-400">
                        {student.timestamp 
                          ? new Date(student.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                          : '-'
                        }
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
                          student.attendanceStatus === 'present' 
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : student.attendanceStatus === 'late'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}>
                          {student.attendanceStatus === 'present' && <Check className="w-3 h-3" />}
                          {student.attendanceStatus === 'late' && <Clock className="w-3 h-3" />}
                          {student.attendanceStatus === 'absent' && <X className="w-3 h-3" />}
                          {student.attendanceStatus === 'present' ? 'حاضر' : student.attendanceStatus === 'late' ? `متأخر ${student.minutesLate}د` : 'غائب'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openStudentProfile(student)}
                            className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                            title="الملف الشخصي"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => openWhatsApp(student, student.attendanceStatus === 'absent' ? 'absent' : 'late')}
                            className="p-2 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-all"
                            title="واتساب"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => { setExitForm({ ...exitForm, studentId: student.id }); setActiveTab('exits'); }}
                            className="p-2 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-all"
                            title="تسجيل خروج"
                          >
                            <DoorOpen className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAttendanceList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>لا توجد بيانات مطابقة</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: EXITS ===================== */}
      {activeTab === 'exits' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Exit Form */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <DoorOpen className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-serif">تسجيل خروج</h3>
                <p className="text-sm text-gray-400">إصدار إذن خروج للطالب</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Enhanced Student Select */}
              <StudentSelectComponent
                value={exitForm.studentId}
                onChange={(id) => setExitForm({ ...exitForm, studentId: id })}
              />
              
              {/* Reason Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">السبب *</label>
                <select
                  value={exitForm.reasonType}
                  onChange={e => {
                    const value = e.target.value;
                    const selectedReason = EXIT_REASONS.find(r => r.value === value);
                    setExitForm({ 
                      ...exitForm, 
                      reasonType: value, 
                      reason: value === 'other' ? '' : (selectedReason?.label || '')
                    });
                  }}
                  className="w-full input-glass p-3 rounded-xl"
                >
                  <option value="">اختر السبب...</option>
                  {EXIT_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Custom Reason - Only show when "other" is selected */}
              {exitForm.reasonType === 'other' && (
                <div className="animate-fade-in">
                  <label className="block text-sm font-medium text-gray-300 mb-2">حدد السبب *</label>
                  <input
                    type="text"
                    value={exitForm.reason}
                    onChange={e => setExitForm({ ...exitForm, reason: e.target.value })}
                    placeholder="أدخل سبب الخروج..."
                    className="w-full input-glass p-3 rounded-xl"
                    autoFocus
                  />
                </div>
              )}
              
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">ملاحظات</label>
                <textarea
                  value={exitForm.notes}
                  onChange={e => setExitForm({ ...exitForm, notes: e.target.value })}
                  placeholder="ملاحظات إضافية..."
                  className="w-full input-glass p-3 rounded-xl h-20 resize-none"
                />
              </div>
              
              <button
                onClick={handleSaveExit}
                disabled={!exitForm.studentId || !exitForm.reason}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl text-white font-bold shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-5 h-5 inline ml-2" />
                حفظ وتسجيل الخروج
              </button>
            </div>
          </div>
          
          {/* Today's Exits */}
          <div className="lg:col-span-2 glass-card p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                سجلات خروج اليوم
              </h3>
              <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-bold">
                {todayExits.length} سجل
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-gray-500 border-b border-white/10">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">الطالب</th>
                    <th className="p-3">الوقت</th>
                    <th className="p-3">السبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {todayExits.map((exit, idx) => {
                    const student = students.find(s => s.id === exit.studentId);
                    return (
                      <tr key={exit.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-gray-500">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-white">{student?.name || exit.studentId}</p>
                          <p className="text-xs text-gray-500">{student?.className} - {student?.section}</p>
                        </td>
                        <td className="p-3 font-mono text-gray-400">
                          {new Date(exit.exit_time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 text-gray-300">{exit.reason}</td>
                      </tr>
                    );
                  })}
                  {todayExits.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-gray-500">
                        <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>لا توجد سجلات خروج اليوم</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: VIOLATIONS ===================== */}
      {activeTab === 'violations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Violation Form */}
          <div className="glass-card p-6 rounded-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white font-serif">تسجيل مخالفة</h3>
                <p className="text-sm text-gray-400">توثيق السلوكيات المخالفة</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Enhanced Student Select */}
              <StudentSelectComponent
                value={violationForm.studentId}
                onChange={(id) => setViolationForm({ ...violationForm, studentId: id })}
              />
              
              {/* Violation Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">نوع المخالفة *</label>
                <select
                  value={violationForm.type}
                  onChange={e => setViolationForm({ ...violationForm, type: e.target.value })}
                  className="w-full input-glass p-3 rounded-xl"
                >
                  <option value="">اختر النوع...</option>
                  {VIOLATION_TYPES.map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
              
              {/* Severity Level */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">مستوى الخطورة: {violationForm.level}</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(level => (
                    <button
                      key={level}
                      onClick={() => setViolationForm({ ...violationForm, level })}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        violationForm.level >= level
                          ? level <= 2 ? 'bg-emerald-500 text-white' : level <= 3 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                          : 'bg-white/10 text-gray-500'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  {violationForm.level <= 2 ? 'بسيط' : violationForm.level <= 3 ? 'متوسط' : 'خطير'}
                </p>
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">وصف المخالفة</label>
                <textarea
                  value={violationForm.description}
                  onChange={e => setViolationForm({ ...violationForm, description: e.target.value })}
                  placeholder="وصف تفصيلي للمخالفة..."
                  className="w-full input-glass p-3 rounded-xl h-16 resize-none"
                />
              </div>
              
              {/* Action Taken */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">الإجراء المتخذ</label>
                <textarea
                  value={violationForm.actionTaken}
                  onChange={e => setViolationForm({ ...violationForm, actionTaken: e.target.value })}
                  placeholder="مثال: تنبيه شفهي، إحالة للمرشد..."
                  className="w-full input-glass p-3 rounded-xl h-16 resize-none"
                />
              </div>
              
              {/* Summon Guardian */}
              <label className="flex items-center gap-3 p-4 bg-red-500/10 rounded-xl border border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-all">
                <input
                  type="checkbox"
                  checked={violationForm.summonGuardian}
                  onChange={e => setViolationForm({ ...violationForm, summonGuardian: e.target.checked })}
                  className="w-5 h-5 rounded text-red-500"
                />
                <div>
                  <p className="text-red-300 font-bold">استدعاء ولي الأمر</p>
                  <p className="text-xs text-red-400/70">سيتم إرسال إشعار فوري لولي الأمر</p>
                </div>
              </label>
              
              <button
                onClick={handleSaveViolation}
                disabled={!violationForm.studentId || !violationForm.type}
                className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl text-white font-bold shadow-lg hover:shadow-red-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-5 h-5 inline ml-2" />
                حفظ المخالفة
              </button>
            </div>
          </div>
          
          {/* Today's Violations */}
          <div className="lg:col-span-2 glass-card p-6 rounded-3xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                مخالفات اليوم
              </h3>
              <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-sm font-bold">
                {todayViolations.length} مخالفة
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-gray-500 border-b border-white/10">
                  <tr>
                    <th className="p-3">الطالب</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">المستوى</th>
                    <th className="p-3">الإجراء</th>
                    <th className="p-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {todayViolations.map(v => {
                    const student = students.find(s => s.id === v.studentId);
                    const level = typeof v.level === 'number' ? v.level : v.level === 'low' ? 1 : v.level === 'medium' ? 3 : 5;
                    return (
                      <tr key={v.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <p className="font-bold text-white">{student?.name}</p>
                          <p className="text-xs text-gray-500">{student?.className} - {student?.section}</p>
                        </td>
                        <td className="p-3 text-red-300">{v.type}</td>
                        <td className="p-3">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(l => (
                              <div 
                                key={l} 
                                className={`w-2 h-4 rounded-sm ${
                                  level >= l
                                    ? l <= 2 ? 'bg-emerald-500' : l <= 3 ? 'bg-amber-500' : 'bg-red-500'
                                    : 'bg-white/10'
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-gray-400 text-xs max-w-[200px] truncate">
                          {v.action_taken || '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => student && openWhatsApp(student, 'violation')}
                              className="p-2 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-all"
                              title="إبلاغ ولي الأمر"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            {v.summon_guardian && (
                              <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded text-xs">
                                استدعاء
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {todayViolations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-gray-500">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>لا توجد مخالفات مسجلة اليوم</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 4: STUDENTS & REPORTS ===================== */}
      {activeTab === 'students' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Filter */}
          <div className="glass-card p-6 rounded-3xl h-fit">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-emerald-400" />
              تصفية الصفوف
            </h3>
            
            {/* All Students */}
            <button
              onClick={() => { setFilterClass(''); setFilterSection(''); }}
              className={`w-full text-right p-3 rounded-xl mb-2 transition-all flex items-center justify-between ${
                !filterClass ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                جميع الطلاب
              </span>
              <span className="text-sm">{students.length}</span>
            </button>
            
            {/* Classes Tree */}
            <div className="space-y-1">
              {classes.map(cls => (
                <div key={cls.id}>
                  <button
                    onClick={() => { setFilterClass(cls.name); setFilterSection(''); }}
                    className={`w-full text-right p-3 rounded-xl transition-all flex items-center justify-between ${
                      filterClass === cls.name && !filterSection ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <ChevronDown className={`w-4 h-4 transition-transform ${filterClass === cls.name ? 'rotate-180' : ''}`} />
                      {cls.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {students.filter(s => s.className === cls.name).length}
                    </span>
                  </button>
                  
                  {filterClass === cls.name && (
                    <div className="mr-6 mt-1 space-y-1">
                      {cls.sections.map(section => (
                        <button
                          key={section}
                          onClick={() => setFilterSection(section)}
                          className={`w-full text-right p-2 rounded-lg text-sm transition-all flex items-center justify-between ${
                            filterSection === section ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'
                          }`}
                        >
                          <span>فصل {section}</span>
                          <span className="text-xs">
                            {students.filter(s => s.className === cls.name && s.section === section).length}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4">
            {/* Search & Actions */}
            <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="بحث بالاسم أو المعرف..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full input-glass pr-10 py-2.5 rounded-xl text-sm"
                />
              </div>
              
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 font-bold text-sm flex items-center gap-2 hover:bg-emerald-500/20 transition-all"
              >
                <Download className="w-4 h-4" />
                تصدير / طباعة
              </button>
            </div>
            
            {/* Students Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAttendanceList.map(student => (
                <div key={student.id} className="glass-card p-4 rounded-2xl hover:border-white/20 transition-all group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500/30 to-secondary-500/30 flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-primary-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{student.name}</h4>
                        <p className="text-sm text-gray-400">{student.className} - {student.section}</p>
                        <p className="text-xs text-gray-500 font-mono">{student.id}</p>
                      </div>
                    </div>
                    
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      student.attendanceStatus === 'present' 
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : student.attendanceStatus === 'late'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {student.attendanceStatus === 'present' ? 'حاضر' : student.attendanceStatus === 'late' ? 'متأخر' : 'غائب'}
                    </span>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                    <button
                      onClick={() => openStudentProfile(student)}
                      className="flex-1 py-2 bg-white/5 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white text-sm font-medium flex items-center justify-center gap-1 transition-all"
                    >
                      <Eye className="w-4 h-4" />
                      الملف الشخصي
                    </button>
                    <button
                      onClick={() => { setMessageStudent(student); setMessageText(''); }}
                      className="p-2 bg-primary-500/10 rounded-xl text-primary-400 hover:bg-primary-500/20 transition-all"
                      title="إرسال رسالة"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openWhatsApp(student, 'late')}
                      className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 hover:bg-emerald-500/20 transition-all"
                      title="واتساب"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredAttendanceList.length === 0 && (
              <div className="glass-card p-12 rounded-2xl text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <p className="text-gray-400">لا توجد نتائج مطابقة للبحث</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== MODALS ===================== */}
      
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-3xl p-6 animate-fade-in-up border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white font-serif flex items-center gap-2">
                <FileDown className="w-6 h-6 text-emerald-400" />
                تصدير وطباعة التقارير
              </h3>
              <button onClick={() => { setShowExportModal(false); setExportFilterClass(''); setExportFilterSection(''); }} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Filter by Class/Section */}
            <div className="mb-5 p-4 bg-white/5 rounded-xl border border-white/10">
              <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary-400" />
                تحديد الصف والفصل (اختياري)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={exportFilterClass}
                  onChange={e => { setExportFilterClass(e.target.value); setExportFilterSection(''); }}
                  className="input-glass p-3 rounded-xl text-sm"
                >
                  <option value="">جميع الصفوف</option>
                  {uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={exportFilterSection}
                  onChange={e => setExportFilterSection(e.target.value)}
                  className="input-glass p-3 rounded-xl text-sm"
                  disabled={!exportFilterClass}
                >
                  <option value="">جميع الفصول</option>
                  {exportFilterClass && classes.find(c => c.name === exportFilterClass)?.sections.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Sort Options */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-3">ترتيب البيانات</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setExportSortBy('name')}
                  className={`p-3 rounded-xl border transition-all text-center ${
                    exportSortBy === 'name' 
                      ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' 
                      : 'border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <p className="font-bold text-sm">صف → فصل → الاسم</p>
                  <p className="text-xs opacity-70">ترتيب أبجدي</p>
                </button>
                <button
                  onClick={() => setExportSortBy('id')}
                  className={`p-3 rounded-xl border transition-all text-center ${
                    exportSortBy === 'id' 
                      ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' 
                      : 'border-white/10 text-gray-400 hover:bg-white/5'
                  }`}
                >
                  <p className="font-bold text-sm">صف → فصل → المعرف</p>
                  <p className="text-xs opacity-70">ترتيب رقمي</p>
                </button>
              </div>
            </div>
            
            {/* Export Type */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-3">نوع البيانات</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'all', label: 'الكل', icon: Users, color: 'violet' },
                  { value: 'present', label: 'حضور', icon: UserCheck, color: 'emerald' },
                  { value: 'late', label: 'متأخر', icon: Clock, color: 'amber' },
                  { value: 'absent', label: 'غائب', icon: UserX, color: 'red' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setExportType(opt.value as any)}
                    className={`p-3 rounded-xl border transition-all text-center ${
                      exportType === opt.value 
                        ? `bg-${opt.color}-500/20 border-${opt.color}-500/50 text-${opt.color}-300` 
                        : 'border-white/10 text-gray-400 hover:bg-white/5'
                    }`}
                  >
                    <opt.icon className="w-4 h-4 mx-auto mb-1" />
                    <p className="text-xs font-bold">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Preview Count */}
            <div className="mb-5 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center">
              <p className="text-emerald-300 text-sm">
                سيتم تصدير <strong>{getExportData(exportType, exportSortBy).length}</strong> سجل
                {exportFilterClass && <span> من {exportFilterClass}{exportFilterSection ? ` - ${exportFilterSection}` : ''}</span>}
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => exportToExcel(exportType, exportSortBy)}
                className="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
              >
                <FileSpreadsheet className="w-5 h-5" />
                تصدير Excel
              </button>
              <button
                onClick={() => printReport(exportType, exportSortBy)}
                className="py-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/20 transition-all"
              >
                <Printer className="w-5 h-5" />
                طباعة
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Bulk Notification Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-3xl p-6 animate-fade-in-up border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                  <Bell className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-serif">إشعار أولياء الأمور</h3>
                  <p className="text-sm text-gray-400">{selectedStudents.size} طالب محدد</p>
                </div>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Template Selection */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => { setBulkTemplate('late'); setBulkMessage(notificationTemplates.late.message); }}
                className={`p-4 rounded-xl border transition-all text-right ${
                  bulkTemplate === 'late' 
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                    : 'border-white/10 text-gray-400 hover:bg-white/5'
                }`}
              >
                <Clock className="w-5 h-5 mb-2" />
                <p className="font-bold">تنبيه تأخر</p>
              </button>
              <button
                onClick={() => { setBulkTemplate('absent'); setBulkMessage(notificationTemplates.absent.message); }}
                className={`p-4 rounded-xl border transition-all text-right ${
                  bulkTemplate === 'absent' 
                    ? 'bg-red-500/20 border-red-500/50 text-red-300' 
                    : 'border-white/10 text-gray-400 hover:bg-white/5'
                }`}
              >
                <UserX className="w-5 h-5 mb-2" />
                <p className="font-bold">تنبيه غياب</p>
              </button>
            </div>
            
            {/* Message */}
            <div className="mb-6">
              <label className="block text-sm text-gray-300 mb-2">نص الرسالة</label>
              <textarea
                value={bulkMessage}
                onChange={e => setBulkMessage(e.target.value)}
                className="w-full input-glass p-4 rounded-xl h-32 resize-none"
                placeholder="اكتب نص الرسالة..."
              />
              <p className="text-xs text-gray-500 mt-1">يمكنك تخصيص قوالب الإشعارات من واجهة الإدارة</p>
            </div>
            
            <button
              onClick={sendBulkNotifications}
              className="w-full py-4 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl text-white font-bold shadow-lg hover:shadow-primary-500/25 transition-all"
            >
              <Send className="w-5 h-5 inline ml-2" />
              إرسال الإشعارات
            </button>
          </div>
        </div>
      )}
      
      {/* Student Profile Modal */}
      {profileStudent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-3xl rounded-3xl p-6 animate-fade-in-up border border-white/20 my-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white font-serif">{profileStudent.name}</h3>
                  <p className="text-gray-400">{profileStudent.className} - {profileStudent.section}</p>
                  <p className="text-sm text-gray-500 font-mono">{profileStudent.id}</p>
                </div>
              </div>
              <button onClick={() => { setProfileStudent(null); setProfileData(null); }} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {/* Guardian Info */}
            <div className="bg-white/5 rounded-2xl p-4 mb-6">
              <h4 className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                معلومات ولي الأمر
              </h4>
              <p className="text-white font-mono">{profileStudent.guardianPhone}</p>
            </div>
            
            {profileData ? (
              <div className="space-y-6">
                {/* Stats Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-400">
                      {profileData.attendance.filter(a => a.status === 'present' || a.status === 'late').length}
                    </p>
                    <p className="text-sm text-emerald-300/70">أيام الحضور</p>
                  </div>
                  <div className="bg-blue-500/10 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-blue-400">{profileData.exits.length}</p>
                    <p className="text-sm text-blue-300/70">مرات الخروج</p>
                  </div>
                  <div className="bg-red-500/10 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-red-400">{profileData.violations.length}</p>
                    <p className="text-sm text-red-300/70">المخالفات</p>
                  </div>
                </div>
                
                {/* Recent Attendance */}
                <div>
                  <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary-400" />
                    سجل الحضور الأخير
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {profileData.attendance.slice(0, 10).map(a => (
                      <div key={a.id} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                        <span className="text-gray-300">{new Date(a.date).toLocaleDateString('ar-SA')}</span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          a.status === 'present' ? 'bg-emerald-500/20 text-emerald-300' :
                          a.status === 'late' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {a.status === 'present' ? 'حاضر' : a.status === 'late' ? `متأخر ${a.minutesLate || 0}د` : 'غائب'}
                        </span>
                      </div>
                    ))}
                    {profileData.attendance.length === 0 && (
                      <p className="text-gray-500 text-center py-4">لا توجد سجلات</p>
                    )}
                  </div>
                </div>
                
                {/* Violations */}
                {profileData.violations.length > 0 && (
                  <div>
                    <h4 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      المخالفات
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {profileData.violations.map(v => (
                        <div key={v.id} className="flex items-center justify-between bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                          <div>
                            <span className="text-red-300 font-bold">{v.type}</span>
                            <p className="text-xs text-gray-400">{v.description}</p>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(v.created_at).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto" />
              </div>
            )}
            
            {/* Actions */}
            <div className="mt-6 pt-4 border-t border-white/10 flex gap-3">
              <button
                onClick={() => openWhatsApp(profileStudent, 'late')}
                className="flex-1 py-3 bg-emerald-500/10 rounded-xl text-emerald-400 font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/20 transition-all"
              >
                <MessageCircle className="w-5 h-5" />
                واتساب
              </button>
              <button
                onClick={() => { setMessageStudent(profileStudent); setMessageText(''); setProfileStudent(null); }}
                className="flex-1 py-3 bg-primary-500/10 rounded-xl text-primary-400 font-bold flex items-center justify-center gap-2 hover:bg-primary-500/20 transition-all"
              >
                <Send className="w-5 h-5" />
                إرسال رسالة
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Direct Message Modal */}
      {messageStudent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md rounded-3xl p-6 animate-fade-in-up border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white font-serif">إرسال رسالة</h3>
              <button onClick={() => setMessageStudent(null)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-gray-400 mb-4">
              إرسال رسالة لولي أمر الطالب: <span className="text-white font-bold">{messageStudent.name}</span>
            </p>
            
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              className="w-full input-glass p-4 rounded-xl h-32 resize-none mb-4"
              autoFocus
            />
            
            <button
              onClick={sendDirectMessage}
              disabled={!messageText}
              className="w-full py-3 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl text-white font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5 inline ml-2" />
              إرسال
            </button>
          </div>
        </div>
      )}
      
      {/* Toast */}
      {toast.show && (
        <div className={`fixed bottom-6 left-6 z-50 animate-fade-in-up`}>
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-emerald-500/90 text-white' 
              : 'bg-red-500/90 text-white'
          }`}>
            {toast.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};

export default Supervision;
