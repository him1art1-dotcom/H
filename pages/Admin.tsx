
import React, { useState, useEffect } from 'react';
import { db, getLocalISODate } from '../services/db';
import { Student, DashboardStats, ReportFilter, SchoolClass, User, Role, KioskSettings, AttendanceRecord, ExitRecord, ViolationRecord, NotificationTemplates, NotificationTemplate } from '../types';
import { FileService } from '../services/fileService';
import { FileSpreadsheet, Upload, UserPlus, Database, Loader2, LayoutDashboard, TrendingUp, AlertCircle, Clock, CheckCircle, FileText, Printer, FileCode, FileType, Plus, X, Search, Calendar, Trash2, Users, Trophy, ChevronDown, MoreHorizontal, Target, Monitor, Image as ImageIcon, Settings as SettingsIcon, Activity, User as UserIcon, Eye, DoorOpen, AlertOctagon, Palette, Check, Type, Maximize2, Bell, MessageSquare, Save, Edit3, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  
  // Dashboard State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [classStats, setClassStats] = useState<any[]>([]);
  const [detailedStats, setDetailedStats] = useState<any>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);
  const [attendanceByClass, setAttendanceByClass] = useState<any[]>([]);
  const [violationsData, setViolationsData] = useState<any[]>([]);
  const [exitsData, setExitsData] = useState<any[]>([]);

  // Students State
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Structure State
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [newClass, setNewClass] = useState({ name: '', sections: '' });

  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [newUser, setNewUser] = useState<{ name: string, username: string, password: string, role: Role, assignedClasses: { className: string, sections: string[] }[] }>({ 
    name: '', 
    username: '', 
    password: '', 
    role: Role.SCHOOL_ADMIN,
    assignedClasses: []
  });

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<Student | null>(null);
  const [studentProfileData, setStudentProfileData] = useState<{attendance: AttendanceRecord[], exits: ExitRecord[], violations: ViolationRecord[]} | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ type: 'class' | 'user' | 'student', id: string, name: string } | null>(null);
  
  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);

  // New Student Form State
  const [newStudent, setNewStudent] = useState({
      name: '',
      className: '',
      section: '',
      guardianPhone: ''
  });
  
  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);

  // Reports State
  // Use local date for defaults to avoid timezone confusion
  const [reportFilter, setReportFilter] = useState<ReportFilter>({
      dateFrom: getLocalISODate(),
      dateTo: getLocalISODate(),
      className: '',
      section: '',
      status: 'all',
      searchQuery: ''
  });
  const [reportData, setReportData] = useState<{summary: any, details: any[]} | null>(null);

  // Kiosk Settings State
  const [kioskSettings, setKioskSettings] = useState<KioskSettings>({
    mainTitle: 'مرحباً في نظام الحضور الذكي',
    subTitle: 'لطفاً انتظر التعليمات أو مرر البطاقة',
    earlyMessage: 'أهلًا بك! وصلت في الوقت المناسب',
    lateMessage: 'لقد تأخرت عن التجمع، راجع الإدارة',
    showStats: true,
    screensaverEnabled: false,
    screensaverTimeout: 300000, // 5 minutes default
    screensaverImages: [],
    headerImage: undefined,
    assemblyTime: '07:00',
    gracePeriod: 15,
    theme: 'dark-neon',
    displaySettings: {
      clockSize: 'large',
      titleSize: 'large',
      cardSize: 'medium',
      inputSize: 'large'
    }
  });

  // Notification Templates State
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplates>({
    late: { title: 'تنبيه تأخر', message: 'نود إعلامكم بتأخر ابنكم/ابنتكم عن الحضور للمدرسة اليوم. نأمل الحرص على الالتزام بالمواعيد.' },
    absent: { title: 'تنبيه غياب', message: 'نود إعلامكم بتغيب ابنكم/ابنتكم عن المدرسة اليوم. يرجى تبرير الغياب في أقرب وقت.' },
    behavior: { title: 'ملاحظة سلوكية', message: 'نود إعلامكم بتسجيل ملاحظة سلوكية على ابنكم/ابنتكم. يرجى مراجعة الإدارة للمتابعة.' },
    summon: { title: 'استدعاء ولي أمر', message: 'نرجو التكرم بمراجعة إدارة المدرسة لمناقشة موضوع يخص ابنكم/ابنتكم.' }
  });
  const [editingTemplate, setEditingTemplate] = useState<'late' | 'absent' | 'behavior' | 'summon' | null>(null);

  // --- Fetchers ---
  const fetchDashboard = async () => {
      setLoading(true);
      try {
          const today = getLocalISODate();
          const [allStudents, allAttendance, allClasses, allViolations, allExits] = await Promise.all([
              db.getStudents(),
              db.getAttendance(),
              db.getClasses(),
              db.getViolations(),
              db.getTodayExits()
          ]);

          // Calculate real weekly stats (last 7 days)
          const weekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
          const weeklyData: any[] = [];
          for (let i = 6; i >= 0; i--) {
              const date = new Date();
              date.setDate(date.getDate() - i);
              const dateStr = date.toISOString().split('T')[0];
              const dayAttendance = allAttendance.filter(a => a.date === dateStr);
              const dayStudents = allStudents.length;
              const present = dayAttendance.filter(a => a.status === 'present').length;
              const late = dayAttendance.filter(a => a.status === 'late').length;
              const rate = dayStudents > 0 ? Math.round(((present + late) / dayStudents) * 100) : 0;
              weeklyData.push({
                  day: weekDays[date.getDay()],
                  presence: rate,
                  present,
                  late,
                  absent: dayStudents - (present + late),
                  total: dayStudents
              });
          }
          setWeeklyStats(weeklyData);

          // Calculate real class stats
          const classData: any[] = [];
          for (const cls of allClasses) {
              const classStudents = allStudents.filter(s => s.className === cls.name);
              const todayAtt = allAttendance.filter(a => {
                  const student = allStudents.find(s => s.id === a.studentId);
                  return student && student.className === cls.name && a.date === today;
              });
              const absent = classStudents.length - todayAtt.length;
              classData.push({
                  name: cls.name,
                  total: classStudents.length,
                  present: todayAtt.filter(a => a.status === 'present').length,
                  late: todayAtt.filter(a => a.status === 'late').length,
                  absent,
                  rate: classStudents.length > 0 ? Math.round((todayAtt.length / classStudents.length) * 100) : 0
              });
          }
          setClassStats(classData);

          // Calculate detailed stats
          const todayAttendance = allAttendance.filter(a => a.date === today);
          const presentCount = todayAttendance.filter(a => a.status === 'present').length;
          const lateCount = todayAttendance.filter(a => a.status === 'late').length;
          const absentCount = allStudents.length - (presentCount + lateCount);
          const attendanceRate = allStudents.length > 0 ? Math.round(((presentCount + lateCount) / allStudents.length) * 100) : 0;

          // Calculate yesterday for comparison
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          const yesterdayAttendance = allAttendance.filter(a => a.date === yesterdayStr);
          const yesterdayPresent = yesterdayAttendance.filter(a => a.status === 'present').length;
          const yesterdayLate = yesterdayAttendance.filter(a => a.status === 'late').length;
          const yesterdayRate = allStudents.length > 0 ? Math.round(((yesterdayPresent + yesterdayLate) / allStudents.length) * 100) : 0;
          const rateChange = attendanceRate - yesterdayRate;

          setStats({
              totalStudents: allStudents.length,
              presentCount,
              lateCount,
              absentCount,
              attendanceRate
          });

          // Attendance by class for detailed view
          const attendanceByClassData = classData.map(c => ({
              name: c.name,
              present: c.present,
              late: c.late,
              absent: c.absent,
              total: c.total,
              rate: c.rate
          }));
          setAttendanceByClass(attendanceByClassData);

          // Violations data
          const violationsByLevel = [
              { name: 'منخفض', value: allViolations.filter(v => v.level === 'low').length, color: '#10b981' },
              { name: 'متوسط', value: allViolations.filter(v => v.level === 'medium').length, color: '#f59e0b' },
              { name: 'عالي', value: allViolations.filter(v => v.level === 'high').length, color: '#ef4444' }
          ];
          setViolationsData(violationsByLevel);

          // Exits data
          setExitsData(allExits);

          // Monthly trends (last 30 days)
          const monthlyData: any[] = [];
          for (let i = 29; i >= 0; i--) {
              const date = new Date();
              date.setDate(date.getDate() - i);
              const dateStr = date.toISOString().split('T')[0];
              const dayAtt = allAttendance.filter(a => a.date === dateStr);
              const dayRate = allStudents.length > 0 ? Math.round(((dayAtt.filter(a => a.status === 'present' || a.status === 'late').length) / allStudents.length) * 100) : 0;
              monthlyData.push({
                  date: dateStr,
                  day: date.getDate(),
                  rate: dayRate,
                  present: dayAtt.filter(a => a.status === 'present').length,
                  late: dayAtt.filter(a => a.status === 'late').length
              });
          }
          setMonthlyTrends(monthlyData);

          // Detailed stats object
          setDetailedStats({
              totalStudents: allStudents.length,
              todayRate: attendanceRate,
              yesterdayRate,
              rateChange,
              totalViolations: allViolations.length,
              totalExits: allExits.length,
              averageWeeklyRate: Math.round(weeklyData.reduce((sum, d) => sum + d.presence, 0) / weeklyData.length)
          });

      } catch(e) { 
          console.error(e); 
      } finally { 
          setLoading(false); 
      }
  };

  const fetchStudents = async () => {
      setLoading(true);
      try {
          const data = await db.getStudents();
          setStudents(data);
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchStructure = async () => {
      setLoading(true);
      try {
          const data = await db.getClasses();
          setClasses(data);
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchUsers = async () => {
      setLoading(true);
      try {
          const data = await db.getUsers();
          setUsers(data);
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchKioskSettings = async () => {
      setLoading(true);
      try {
          const settings = await db.getSettings();
          if (settings) {
              const defaults: KioskSettings = {
                  mainTitle: 'مرحباً في نظام الحضور الذكي',
                  subTitle: 'لطفاً انتظر التعليمات أو مرر البطاقة',
                  earlyMessage: 'أهلًا بك! وصلت في الوقت المناسب',
                  lateMessage: 'لقد تأخرت عن التجمع، راجع الإدارة',
                  showStats: true,
                  screensaverEnabled: false,
                  screensaverTimeout: 300000,
                  screensaverImages: [],
                  headerImage: undefined,
                  assemblyTime: '07:00',
                  gracePeriod: 15,
                  theme: 'dark-neon'
              };
              // Convert through unknown to handle different theme types
              setKioskSettings({ ...defaults, ...(settings as unknown as Partial<KioskSettings>) });
          }
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const fetchNotificationTemplates = async () => {
      setLoading(true);
      try {
          const settings = await db.getSettings();
          if (settings?.notificationTemplates) {
              setNotificationTemplates({
                  late: settings.notificationTemplates.late || notificationTemplates.late,
                  absent: settings.notificationTemplates.absent || notificationTemplates.absent,
                  behavior: settings.notificationTemplates.behavior || notificationTemplates.behavior,
                  summon: settings.notificationTemplates.summon || notificationTemplates.summon
              });
          }
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const saveNotificationTemplates = async () => {
      setLoading(true);
      try {
          const currentSettings = await db.getSettings() || {};
          await db.saveSettings({ ...currentSettings, notificationTemplates } as any);
          alert('تم حفظ قوالب الإشعارات بنجاح ✓');
          setEditingTemplate(null);
      } catch(e) { 
          console.error(e); 
          alert('حدث خطأ أثناء الحفظ');
      } finally { setLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') fetchDashboard();
    if (activeTab === 'students') { fetchStudents(); fetchStructure(); }
    if (activeTab === 'structure') fetchStructure();
    if (activeTab === 'users') { fetchUsers(); fetchStructure(); }
    if (activeTab === 'kiosk') fetchKioskSettings();
    if (activeTab === 'reports') fetchStructure();
    if (activeTab === 'notifications') fetchNotificationTemplates();
  }, [activeTab]);

  // Load student profile data when a student is selected
  useEffect(() => {
    if (selectedStudentProfile) {
      const loadProfileData = async () => {
        setLoading(true);
        try {
          const [attendance, exits, violations] = await Promise.all([
            db.getStudentAttendance(selectedStudentProfile.id),
            db.getStudentExits(selectedStudentProfile.id),
            db.getViolations(selectedStudentProfile.id)
          ]);
          setStudentProfileData({ attendance, exits, violations });
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      loadProfileData();
    } else {
      setStudentProfileData(null);
    }
  }, [selectedStudentProfile]);

  // --- Handlers ---
  
  const handleAddStudent = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
          const studentToAdd: Student = {
              id: `2024${Math.floor(Math.random() * 100000)}`,
              ...newStudent
          };
          await db.saveStudents([studentToAdd]);
          await fetchStudents();
          setShowAddModal(false);
          setNewStudent({ name: '', className: '', section: '', guardianPhone: '' });
          alert('تم إضافة الطالب بنجاح');
      } catch (e) {
          alert('حدث خطأ أثناء الإضافة');
      } finally {
          setLoading(false);
      }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingStudent) return;
      setLoading(true);
      try {
          await db.updateStudent(editingStudent);
          await fetchStudents();
          setShowEditStudentModal(false);
          setEditingStudent(null);
          alert('تم تحديث بيانات الطالب بنجاح');
      } catch (e) {
          alert('حدث خطأ أثناء التحديث');
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
      setDeleteConfirmation({ type: 'student', id: studentId, name: studentName });
  };

  const confirmDeleteStudent = async () => {
      if (!deleteConfirmation || deleteConfirmation.type !== 'student') return;
      setLoading(true);
      try {
          await db.deleteStudent(deleteConfirmation.id);
          await fetchStudents();
          setDeleteConfirmation(null);
          alert('تم حذف الطالب بنجاح');
      } catch (e) {
          alert('حدث خطأ أثناء الحذف');
      } finally {
          setLoading(false);
      }
  };

  const handleImport = async () => {
      if (!importFile) return;
      setLoading(true);
      try {
          const rawData = await FileService.parseImportFile(importFile);
          
          const getValue = (row: any, keys: string[]) => {
              for (const k of keys) {
                  // Robust key matching (trim and case insensitive)
                  const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
                  if (foundKey) return row[foundKey];
              }
              return null;
          };

          const newStudents: Student[] = rawData.map((row: any) => ({
              // Ensure ID is string to prevent scientific notation if Excel treats as number
              id: String(getValue(row, ['المعرف', 'id']) || `2024${Math.floor(Math.random()*100000)}`),
              name: getValue(row, ['الاسم', 'name']) || 'Unknown',
              className: getValue(row, ['الصف', 'className']) || 'General',
              section: getValue(row, ['الفصل', 'section']) || 'A',
              guardianPhone: String(getValue(row, ['الجوال', 'guardianPhone']) || '000')
          })).filter(s => s.name !== 'Unknown');

          await db.saveStudents(newStudents);
          await fetchStudents();
          alert(`تم استيراد ${newStudents.length} طالب بنجاح`);
          setImportFile(null);
          setShowImportModal(false);
      } catch (e) {
          alert('حدث خطأ أثناء قراءة الملف. تأكد من الصيغة.');
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  // Export Student Template for bulk import
  const handleExportTemplate = () => {
      // Template with headers and example rows
      const templateData = [
          { 
            'المعرف': '2024001', 
            'الاسم': 'أحمد محمد العلي', 
            'الصف': 'أول ثانوي', 
            'الفصل': 'أ', 
            'الجوال': '501234567' 
          },
          { 
            'المعرف': '2024002', 
            'الاسم': 'خالد سعد القحطاني', 
            'الصف': 'أول ثانوي', 
            'الفصل': 'ب', 
            'الجوال': '509876543' 
          },
          { 
            'المعرف': '', 
            'الاسم': '', 
            'الصف': '', 
            'الفصل': '', 
            'الجوال': '' 
          }
      ];
      
      FileService.exportToExcel(templateData, 'نموذج_قائمة_الطلاب');
  };

  const handleAddClass = async () => {
      if(!newClass.name) return;
      await db.saveClass({
          id: Math.random().toString(36).substr(2,9),
          name: newClass.name,
          sections: newClass.sections.split(',').map(s => s.trim()).filter(Boolean)
      });
      setNewClass({ name: '', sections: '' });
      fetchStructure();
  };

  const handleDeleteClass = (id: string, name: string) => {
      setDeleteConfirmation({ type: 'class', id, name });
  };

  const handleAddUser = async () => {
      if(!newUser.username || !newUser.password || !newUser.name) {
          alert('يرجى ملء جميع الحقول');
          return;
      }
      if(newUser.role === Role.SUPERVISOR_CLASS && newUser.assignedClasses.length === 0) {
          alert('يرجى تحديد صف واحد على الأقل لمشرف الصف');
          return;
      }
      await db.saveUser({
          id: Math.random().toString(36).substr(2,9),
          name: newUser.name,
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          assignedClasses: newUser.role === Role.SUPERVISOR_CLASS ? newUser.assignedClasses : undefined
      });
      setNewUser({ name: '', username: '', password: '', role: Role.SCHOOL_ADMIN, assignedClasses: [] });
      fetchUsers();
      alert('تم إنشاء الحساب بنجاح');
  };

  const handleDeleteUser = (id: string, name: string) => {
      setDeleteConfirmation({ type: 'user', id, name });
  };
  
  const confirmDeleteAction = async () => {
      if (!deleteConfirmation) return;
      
      setLoading(true);
      try {
          if (deleteConfirmation.type === 'class') {
              await db.deleteClass(deleteConfirmation.id);
              await fetchStructure();
          } else if (deleteConfirmation.type === 'user') {
              await db.deleteUser(deleteConfirmation.id);
              await fetchUsers();
          } else if (deleteConfirmation.type === 'student') {
              await db.deleteStudent(deleteConfirmation.id);
              await fetchStudents();
          }
          setDeleteConfirmation(null);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };


  const handleGenerateReport = async () => {
      setLoading(true);
      try {
          const data = await db.getAttendanceReport(reportFilter);
          
          // Apply additional client-side filters
          let filteredDetails = data.details;
          
          // Filter by status
          if (reportFilter.status && reportFilter.status !== 'all') {
              filteredDetails = filteredDetails.filter(d => d.status === reportFilter.status);
          }
          
          // Filter by search query (name or ID)
          if (reportFilter.searchQuery && reportFilter.searchQuery.trim()) {
              const query = reportFilter.searchQuery.trim().toLowerCase();
              filteredDetails = filteredDetails.filter(d => 
                  d.studentName.toLowerCase().includes(query) || 
                  d.studentId.toLowerCase().includes(query)
              );
          }
          
          // Recalculate summary based on filtered data
          const summary = {
              totalRecords: filteredDetails.length,
              present: filteredDetails.filter(d => d.status === 'present').length,
              late: filteredDetails.filter(d => d.status === 'late').length
          };
          
          setReportData({ summary, details: filteredDetails });
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const handleExport = (type: 'xlsx' | 'csv' | 'html' | 'pdf') => {
      if (!reportData) return;
      const filename = `تقرير_الحضور_${reportFilter.dateFrom}_${reportFilter.dateTo}`;
      const title = `تقرير الحضور - ${reportFilter.dateFrom} إلى ${reportFilter.dateTo}`;
      const exportData = reportData.details.map(d => ({
          studentId: d.studentId,
          studentName: d.studentName,
          className: d.className,
          date: d.date,
          status: d.status === 'present' ? 'حاضر' : d.status === 'late' ? 'متأخر' : 'غائب',
          time: new Date(d.time).toLocaleTimeString('ar-SA')
      }));
      const columns = [
          { header: 'المعرف', key: 'studentId' },
          { header: 'الاسم', key: 'studentName' },
          { header: 'الصف', key: 'className' },
          { header: 'التاريخ', key: 'date' },
          { header: 'الوقت', key: 'time' },
          { header: 'الحالة', key: 'status' },
      ];
      switch(type) {
          case 'xlsx': FileService.exportToExcel(exportData, filename); break;
          case 'csv': FileService.exportToCSV(exportData, filename); break;
          case 'html': FileService.exportToHTML(columns, exportData, filename, title); break;
          case 'pdf': FileService.exportToPDF(columns, exportData, filename, title); break;
      }
  };

  const handleImageUpload = async (type: 'header' | 'screensaver', file: File) => {
      // Check file size (max 2MB before compression)
      const MAX_SIZE = 2 * 1024 * 1024; // 2MB
      if (file.size > MAX_SIZE) {
          alert('حجم الصورة كبير جداً. الحد الأقصى 2 ميجابايت.');
          return;
      }

      try {
          // Compress image before converting to base64
          const compressedBase64 = await compressImage(file, 800, 0.7);
          
          if (type === 'header') {
              setKioskSettings({ ...kioskSettings, headerImage: compressedBase64 });
              alert('تم رفع صورة الهيدر بنجاح');
          } else {
              const currentImages = kioskSettings.screensaverImages || [];
              if (currentImages.length >= 5) {
                  alert('الحد الأقصى 5 صور لشاشة التوقف');
                  return;
              }
              setKioskSettings({ ...kioskSettings, screensaverImages: [...currentImages, compressedBase64] });
              alert('تم إضافة الصورة بنجاح');
          }
      } catch (error) {
          console.error('Image upload error:', error);
          alert('حدث خطأ أثناء معالجة الصورة. جرب صورة أصغر.');
      }
  };

  // Helper function to compress image
  const compressImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  
                  // Resize if needed
                  if (width > maxWidth) {
                      height = Math.round((height * maxWidth) / width);
                      width = maxWidth;
                  }
                  
                  canvas.width = width;
                  canvas.height = height;
                  
                  const ctx = canvas.getContext('2d');
                  if (!ctx) {
                      reject(new Error('Canvas context not available'));
                      return;
                  }
                  
                  ctx.drawImage(img, 0, 0, width, height);
                  const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                  resolve(compressedBase64);
              };
              img.onerror = () => reject(new Error('Failed to load image'));
              img.src = e.target?.result as string;
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
      });
  };

  const handleRemoveImage = (index: number) => {
      const newImages = [...(kioskSettings.screensaverImages || [])];
      newImages.splice(index, 1);
      setKioskSettings({ ...kioskSettings, screensaverImages: newImages });
  };

  const handleSaveKioskSettings = async () => {
      setLoading(true);
      try {
          await db.saveSettings(kioskSettings as any);
          alert('تم حفظ إعدادات الكشك بنجاح ✓');
      } catch(e: any) {
          console.error(e);
          if (e?.name === 'QuotaExceededError' || e?.message?.includes('quota')) {
              alert('مساحة التخزين ممتلئة. يرجى حذف بعض الصور أو تقليل حجمها.');
          } else {
              alert('حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.');
          }
      } finally {
          setLoading(false);
      }
  };

  const filteredStudents = students.filter(s => 
      s.name.includes(searchTerm) || 
      s.id.includes(searchTerm) ||
      s.className.includes(searchTerm)
  );

  const selectedClassObj = classes.find(c => c.name === newStudent.className);
  const editingClassObj = editingStudent ? classes.find(c => c.name === editingStudent.className) : null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 px-2 no-print">
         <h1 className="text-3xl font-bold font-serif text-white">لوحة الإدارة</h1>
         
         <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-[#1e293b]/50 px-4 py-2 rounded-full border border-white/10 text-sm">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-gray-300">أداء المدرسة:</span>
                <span className="text-emerald-400 font-bold">ممتاز</span>
            </div>
            <div className="relative">
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="بحث شامل..." className="bg-[#1e293b] border border-white/10 rounded-full py-2 pr-10 pl-4 text-sm text-white focus:border-primary-500 w-64" />
            </div>
         </div>
      </div>

      {/* Main Container */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Sidebar/Tabs Navigation - Vertical on Large screens */}
        <div className="lg:w-64 flex-shrink-0">
            <div className="glass-card rounded-3xl p-4 h-full border border-white/5 flex flex-col gap-2 sticky top-6">
                {[
                    { id: 'dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
                    { id: 'students', label: 'الطلاب', icon: UserPlus },
                    { id: 'reports', label: 'التقارير', icon: FileText },
                    { id: 'structure', label: 'الهيكل المدرسي', icon: Database },
                    { id: 'users', label: 'المستخدمين', icon: Users },
                    { id: 'kiosk', label: 'إعدادات الكشك', icon: Monitor },
                    { id: 'notifications', label: 'قوالب الإشعارات', icon: Bell },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-medium transition-all duration-300 ${
                            activeTab === tab.id
                            ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/20' 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <tab.icon className="w-5 h-5" />
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
            
            {loading && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary-400" />
                </div>
            )}

            {/* --- DASHBOARD TAB (REDESIGNED WITH REAL DATA) --- */}
            {activeTab === 'dashboard' && stats && detailedStats && (
                <div className="animate-fade-in space-y-6">
                    
                    {/* Top Stats Row - Real Data */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="glass-card p-6 rounded-[2rem] border border-white/5 bg-[#1e293b]/60 hover:bg-[#1e293b]/80 transition-all hover:scale-[1.02]">
                            <div className="text-gray-400 text-sm mb-2 font-medium">إجمالي الطلاب</div>
                                <div className="flex items-end justify-between">
                                <div className="text-4xl font-bold font-mono text-white">{stats.totalStudents}</div>
                                <div className="text-xs bg-emerald-500/20 px-3 py-1 rounded-lg text-emerald-400 border border-emerald-500/30 font-bold">نشط</div>
                                </div>
                            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-500">
                                جميع الطلاب المسجلين في النظام
                            </div>
                        </div>
                        <div className="glass-card p-6 rounded-[2rem] border border-white/5 bg-[#1e293b]/60 hover:bg-[#1e293b]/80 transition-all hover:scale-[1.02]">
                            <div className="text-gray-400 text-sm mb-2 font-medium">نسبة الحضور اليوم</div>
                            <div className="flex items-end justify-between">
                                <div className="text-4xl font-bold font-mono text-emerald-400">{stats.attendanceRate}%</div>
                                <div className={`text-xs px-3 py-1 rounded-lg border font-bold ${detailedStats.rateChange >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                                    {detailedStats.rateChange >= 0 ? '+' : ''}{detailedStats.rateChange}%
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-500">
                                مقارنة بالأمس: {detailedStats.yesterdayRate}%
                            </div>
                        </div>
                        <div className="glass-card p-6 rounded-[2rem] border border-white/5 bg-[#1e293b]/60 hover:bg-[#1e293b]/80 transition-all hover:scale-[1.02]">
                            <div className="text-gray-400 text-sm mb-2 font-medium">حالات الغياب</div>
                            <div className="flex items-end justify-between">
                                <div className="text-4xl font-bold font-mono text-red-400">{stats.absentCount}</div>
                                <div className="text-xs bg-red-500/20 px-3 py-1 rounded-lg text-red-400 border border-red-500/30 font-bold">
                                    {stats.totalStudents > 0 ? Math.round((stats.absentCount / stats.totalStudents) * 100) : 0}%
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-500">
                                من إجمالي الطلاب
                            </div>
                        </div>
                        <div className="glass-card p-6 rounded-[2rem] border border-white/5 bg-[#1e293b]/60 hover:bg-[#1e293b]/80 transition-all hover:scale-[1.02]">
                            <div className="text-gray-400 text-sm mb-2 font-medium">حالات التأخير</div>
                            <div className="flex items-end justify-between">
                                <div className="text-4xl font-bold font-mono text-amber-400">{stats.lateCount}</div>
                                <div className="text-xs bg-amber-500/20 px-3 py-1 rounded-lg text-amber-400 border border-amber-500/30 font-bold">
                                    {stats.totalStudents > 0 ? Math.round((stats.lateCount / stats.totalStudents) * 100) : 0}%
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-500">
                                يحتاجون متابعة
                            </div>
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Widget: Leading Classes (Left) - Real Data */}
                        <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60 flex flex-col">
                            <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div> أداء الصفوف
                            </h3>
                            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {classStats.slice(0, 8).map((cls, i) => {
                                    const rate = cls.rate || 0;
                                    return (
                                        <div key={i} className="pb-4 border-b border-white/5 last:border-0">
                                            <div className="flex justify-between text-sm mb-2">
                                            <span className="text-gray-300 font-medium">{cls.name}</span>
                                                <span className="text-emerald-400 font-mono font-bold">{rate}%</span>
                                        </div>
                                        <div className="h-2 w-full bg-[#0f172a] rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all" style={{width: `${rate}%`}}></div>
                                        </div>
                                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                <span>حاضر: {cls.present || 0}</span>
                                                <span>متأخر: {cls.late || 0}</span>
                                                <span className="text-red-400">غائب: {cls.absent || 0}</span>
                                    </div>
                                        </div>
                                    );
                                })}
                                <div className="mt-auto pt-4 border-t border-white/5">
                                    <div className="text-xs text-gray-500 mb-2">متوسط الحضور الأسبوعي</div>
                                    <div className="text-2xl font-bold text-white font-mono">{detailedStats.averageWeeklyRate}%</div>
                                </div>
                            </div>
                        </div>

                        {/* Widget: Main Area Chart (Center) - Real Weekly Data */}
                        <div className="lg:col-span-6 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60 min-h-[400px]">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-white font-bold text-lg">اتجاه الحضور الأسبوعي</h3>
                                    <p className="text-xs text-gray-400">آخر 7 أيام - بيانات حقيقية</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 text-xs">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                        <span className="text-gray-400">حضور</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs">
                                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                        <span className="text-gray-400">تأخر</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[300px] w-full relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={weeklyStats}>
                                        <defs>
                                            <linearGradient id="colorPresence" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="day" stroke="#94a3b8" tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                                        <YAxis stroke="#94a3b8" tick={{fontSize: 11}} axisLine={false} tickLine={false} domain={[0, 100]} />
                                        <Tooltip 
                                            contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(10px)'}}
                                            itemStyle={{color: '#fff'}}
                                            formatter={(value: any) => [`${value}%`, 'نسبة الحضور']}
                                        />
                                        <Area type="monotone" dataKey="presence" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPresence)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                                
                                {/* Real change indicator */}
                                {weeklyStats.length >= 2 && (
                                    <div className="absolute top-10 right-20 glass-card border border-white/10 px-4 py-2 rounded-full text-xs text-white shadow-lg backdrop-blur-md">
                                        {weeklyStats[weeklyStats.length - 1].presence > weeklyStats[0].presence ? '↑' : '↓'} 
                                        {Math.abs(weeklyStats[weeklyStats.length - 1].presence - weeklyStats[0].presence)}% 
                                        {weeklyStats[weeklyStats.length - 1].presence > weeklyStats[0].presence ? 'تحسن' : 'انخفاض'}
                                </div>
                                )}
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">متوسط الأسبوع</div>
                                    <div className="text-lg font-bold text-emerald-400">{detailedStats.averageWeeklyRate}%</div>
                        </div>
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">أعلى يوم</div>
                                    <div className="text-lg font-bold text-primary-400">{Math.max(...weeklyStats.map(w => w.presence))}%</div>
                             </div>
                                <div>
                                    <div className="text-xs text-gray-400 mb-1">أقل يوم</div>
                                    <div className="text-lg font-bold text-red-400">{Math.min(...weeklyStats.map(w => w.presence))}%</div>
                                </div>
                            </div>
                        </div>

                        {/* Widget: Radar Chart (Right) - Real Performance Data */}
                        <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60 flex flex-col relative overflow-hidden">
                             <h3 className="text-white font-bold w-full mb-4 text-center">مؤشر الأداء الشامل</h3>
                             <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                                        { subject: 'الحضور', A: stats.attendanceRate, fullMark: 100 },
                                        { subject: 'الانضباط', A: stats.totalStudents > 0 ? Math.round((1 - (violationsData.reduce((sum, v) => sum + v.value, 0) / stats.totalStudents)) * 100) : 95, fullMark: 100 },
                                        { subject: 'الالتزام', A: stats.totalStudents > 0 ? Math.round((stats.presentCount / stats.totalStudents) * 100) : 85, fullMark: 100 },
                                        { subject: 'الاستئذان', A: exitsData.length > 0 ? Math.min(100, Math.round((exitsData.length / stats.totalStudents) * 50)) : 90, fullMark: 100 },
                                        { subject: 'المتابعة', A: detailedStats.averageWeeklyRate, fullMark: 100 },
                                    ]}>
                                        <PolarGrid stroke="#334155" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="الأداء" dataKey="A" stroke="#06b6d4" strokeWidth={2} fill="#06b6d4" fillOpacity={0.4} />
                                        <Tooltip contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff'}} />
                                    </RadarChart>
                                </ResponsiveContainer>
                             </div>
                             <div className="text-xs text-gray-400 mt-2 text-center w-full px-4">
                                 تحليل شامل بناءً على البيانات الفعلية
                             </div>
                             <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                                 <div className="text-center">
                                     <div className="text-emerald-400 font-bold">{stats.attendanceRate}%</div>
                                     <div className="text-gray-500">الحضور</div>
                                 </div>
                                 <div className="text-center">
                                     <div className="text-cyan-400 font-bold">{detailedStats.averageWeeklyRate}%</div>
                                     <div className="text-gray-500">المتوسط</div>
                                 </div>
                             </div>
                        </div>
                    </div>

                    {/* Bottom Grid - Real Data */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Donut Charts Section - Real Attendance Data */}
                        <div className="lg:col-span-4 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60">
                             <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-purple-400" /> توزيع الحضور اليوم
                             </h3>
                             <div className="flex items-center justify-center gap-6">
                                 <div className="relative w-44 h-44">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'حضور', value: stats.presentCount, color: '#10b981' },
                                                    { name: 'غياب', value: stats.absentCount, color: '#ef4444' },
                                                    { name: 'تأخر', value: stats.lateCount, color: '#f59e0b' },
                                                ]}
                                                innerRadius={50}
                                                outerRadius={70}
                                                paddingAngle={3}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                <Cell fill="#10b981" />
                                                <Cell fill="#ef4444" />
                                                <Cell fill="#f59e0b" />
                                            </Pie>
                                            <Tooltip 
                                                contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff'}}
                                                formatter={(value: any, name: string) => [`${value} طالب`, name]}
                                            />
                                        </PieChart>
                                     </ResponsiveContainer>
                                     <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                         <span className="text-3xl font-bold text-white font-mono">{stats.attendanceRate}%</span>
                                         <span className="text-xs text-gray-400">نسبة الحضور</span>
                                     </div>
                                 </div>
                                 <div className="space-y-3 text-sm">
                                     <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                         <div className="flex items-center gap-2">
                                             <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                                             <span className="text-gray-300">حضور</span>
                                 </div>
                                         <span className="text-white font-bold font-mono">{stats.presentCount}</span>
                                     </div>
                                     <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                                         <div className="flex items-center gap-2">
                                             <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                             <span className="text-gray-300">غياب</span>
                                         </div>
                                         <span className="text-white font-bold font-mono">{stats.absentCount}</span>
                                     </div>
                                     <div className="flex items-center justify-between gap-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                         <div className="flex items-center gap-2">
                                             <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                                             <span className="text-gray-300">تأخر</span>
                                         </div>
                                         <span className="text-white font-bold font-mono">{stats.lateCount}</span>
                                     </div>
                                     <div className="pt-2 border-t border-white/5 mt-2">
                                         <div className="text-xs text-gray-500 mb-1">الإجمالي</div>
                                         <div className="text-lg font-bold text-white font-mono">{stats.totalStudents}</div>
                                     </div>
                                 </div>
                             </div>
                        </div>

                         {/* Monthly Trends Bar Chart - Real Data */}
                         <div className="lg:col-span-5 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-[#1e293b]/60">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                   <TrendingUp className="w-5 h-5 text-pink-500" /> اتجاه الحضور (آخر 30 يوم)
                                </h3>
                                <div className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                    {new Date().toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={monthlyTrends.slice(-14)} barSize={8}>
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#ec4899" stopOpacity={0.8}/>
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                        <XAxis dataKey="day" stroke="#64748b" tick={{fontSize: 9}} axisLine={false} tickLine={false} />
                                        <YAxis stroke="#64748b" tick={{fontSize: 9}} axisLine={false} tickLine={false} domain={[0, 100]} />
                                        <Tooltip 
                                            cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                                            contentStyle={{backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff'}}
                                            formatter={(value: any) => [`${value}%`, 'نسبة الحضور']}
                                        />
                                        <Bar dataKey="rate" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-4 flex justify-between items-center text-xs">
                                <div className="text-gray-400">متوسط الشهر: <span className="text-emerald-400 font-bold">{Math.round(monthlyTrends.reduce((sum, d) => sum + d.rate, 0) / monthlyTrends.length)}%</span></div>
                                <div className="text-gray-400">أعلى نسبة: <span className="text-primary-400 font-bold">{Math.max(...monthlyTrends.map(d => d.rate))}%</span></div>
                            </div>
                        </div>
                        
                        {/* Violations & Exits Summary Widget */}
                        <div className="lg:col-span-3 glass-card rounded-[2.5rem] p-6 border border-white/5 bg-gradient-to-br from-primary-900 to-[#1e293b] flex flex-col relative overflow-hidden">
                             <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                 <AlertCircle className="w-5 h-5 text-red-400" /> المخالفات والاستئذان
                             </h3>
                             <div className="space-y-4 flex-1">
                                 <div className="glass-card p-4 rounded-xl border border-white/10">
                                     <div className="text-xs text-gray-400 mb-2">المخالفات اليوم</div>
                                     <div className="text-2xl font-bold text-red-400 font-mono">{violationsData.reduce((sum, v) => sum + v.value, 0)}</div>
                                     <div className="mt-2 flex gap-2">
                                         {violationsData.map((v, i) => (
                                             <div key={i} className="flex-1 text-center">
                                                 <div className="text-xs text-gray-500">{v.name}</div>
                                                 <div className="text-sm font-bold" style={{color: v.color}}>{v.value}</div>
                                 </div>
                                         ))}
                                     </div>
                                 </div>
                                 <div className="glass-card p-4 rounded-xl border border-white/10">
                                     <div className="text-xs text-gray-400 mb-2">الاستئذان اليوم</div>
                                     <div className="text-2xl font-bold text-amber-400 font-mono">{exitsData.length}</div>
                                     <div className="text-xs text-gray-500 mt-1">طلبات خروج مسجلة</div>
                                 </div>
                                 <button 
                                     onClick={() => { setActiveTab('reports'); }} 
                                     className="w-full py-3 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl text-white font-bold hover:from-primary-500 hover:to-secondary-500 transition-all shadow-lg text-sm"
                                 >
                                     عرض التقارير التفصيلية
                                 </button>
                             </div>
                        </div>

                    </div>

                    {/* Additional Detailed Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Class Performance Comparison */}
                        <div className="glass-card rounded-[2rem] p-6 border border-white/5 bg-[#1e293b]/60">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-400" /> أفضل أداء
                            </h3>
                            <div className="space-y-3">
                                {classStats.sort((a, b) => (b.rate || 0) - (a.rate || 0)).slice(0, 3).map((cls, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                                i === 0 ? 'bg-yellow-500/20 text-yellow-400' : 
                                                i === 1 ? 'bg-gray-500/20 text-gray-400' : 
                                                'bg-amber-900/20 text-amber-600'
                                            }`}>
                                                {i + 1}
                                            </div>
                                            <div>
                                                <div className="text-white font-medium">{cls.name}</div>
                                                <div className="text-xs text-gray-500">{cls.total} طالب</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-emerald-400 font-mono">{cls.rate}%</div>
                                            <div className="text-xs text-gray-500">حضور</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Weekly Summary */}
                        <div className="glass-card rounded-[2rem] p-6 border border-white/5 bg-[#1e293b]/60">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-400" /> ملخص الأسبوع
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">إجمالي الحضور</span>
                                    <span className="text-white font-bold font-mono">{weeklyStats.reduce((sum, d) => sum + d.present, 0)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">إجمالي التأخير</span>
                                    <span className="text-amber-400 font-bold font-mono">{weeklyStats.reduce((sum, d) => sum + d.late, 0)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">إجمالي الغياب</span>
                                    <span className="text-red-400 font-bold font-mono">{weeklyStats.reduce((sum, d) => sum + d.absent, 0)}</span>
                                </div>
                                <div className="pt-4 border-t border-white/5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-300 font-medium">المتوسط الأسبوعي</span>
                                        <span className="text-2xl font-bold text-emerald-400 font-mono">{detailedStats.averageWeeklyRate}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Real-time Activity */}
                        <div className="glass-card rounded-[2rem] p-6 border border-white/5 bg-[#1e293b]/60">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-pink-400" /> النشاط الفوري
                            </h3>
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                    <div className="text-xs text-emerald-400 mb-1">حضور اليوم</div>
                                    <div className="text-2xl font-bold text-white font-mono">{stats.presentCount + stats.lateCount}</div>
                                    <div className="text-xs text-gray-400 mt-1">من {stats.totalStudents} طالب</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                                        <div className="text-xs text-red-400 mb-1">مخالفات</div>
                                        <div className="text-lg font-bold text-white font-mono">{violationsData.reduce((sum, v) => sum + v.value, 0)}</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                                        <div className="text-xs text-amber-400 mb-1">استئذان</div>
                                        <div className="text-lg font-bold text-white font-mono">{exitsData.length}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- OTHER TABS (Students, Structure, Users, Reports) - Kept Clean --- */}
            {activeTab === 'students' && (
                 <div className="animate-fade-in space-y-4">
                     {/* ... (Keep existing Student Tab Logic) ... */}
                     <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                        <div><h2 className="text-2xl font-bold font-serif text-white">إدارة الطلاب</h2></div>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <button onClick={handleExportTemplate} className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-600/30 font-bold transition-all whitespace-nowrap" title="تحميل نموذج Excel فارغ لتعبئة بيانات الطلاب"><Download className="w-4 h-4" /> تحميل النموذج</button>
                            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-600/30 font-bold transition-all whitespace-nowrap"><FileSpreadsheet className="w-4 h-4" /> استيراد</button>
                            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-500 font-bold shadow-lg shadow-primary-500/20 transition-all whitespace-nowrap"><Plus className="w-4 h-4" /> إضافة طالب</button>
                        </div>
                     </div>
                     <div className="overflow-hidden rounded-2xl border border-white/10 glass-card">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="bg-black/40 text-gray-400 text-sm">
                              <th className="p-4">المعرف</th>
                              <th className="p-4">الإسم</th>
                              <th className="p-4">الصف</th>
                              <th className="p-4">الفصل</th>
                              <th className="p-4">رقم ولي الأمر</th>
                              <th className="p-4 w-32">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredStudents.map(s => (
                              <tr key={s.id} className="hover:bg-white/5 transition-colors text-gray-300 group">
                                <td className="p-4 font-mono text-primary-300">{s.id}</td>
                                <td className="p-4 font-bold text-white">{s.name}</td>
                                <td className="p-4"><span className="bg-white/5 px-2 py-1 rounded text-xs">{s.className}</span></td>
                                <td className="p-4"><span className="bg-primary-500/10 text-primary-400 px-2 py-1 rounded text-xs">{s.section}</span></td>
                                <td className="p-4 font-mono text-sm">{s.guardianPhone}</td>
                                <td className="p-4">
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => setSelectedStudentProfile(s)}
                                      className="p-2 bg-primary-500/10 hover:bg-primary-500/20 rounded-lg text-primary-400 transition-colors"
                                      title="عرض الملف الشخصي"
                                    >
                                      <UserIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => { setEditingStudent(s); setShowEditStudentModal(true); }}
                                      className="p-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-amber-400 transition-colors opacity-0 group-hover:opacity-100"
                                      title="تعديل الطالب"
                                    >
                                      <SettingsIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteStudent(s.id, s.name)}
                                      className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                      title="حذف الطالب"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                 </div>
            )}
            
            {activeTab === 'structure' && (
              <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass-card p-6 rounded-2xl h-fit">
                      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Plus className="w-5 h-5"/> إضافة مرحلة دراسية</h3>
                      <div className="space-y-4">
                          <input type="text" placeholder="مثال: أول ثانوي" className="w-full input-glass p-3 rounded-xl" value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} />
                          <input type="text" placeholder="مثال: أ, ب, ج, د" className="w-full input-glass p-3 rounded-xl" value={newClass.sections} onChange={e => setNewClass({...newClass, sections: e.target.value})} />
                          <button onClick={handleAddClass} className="w-full py-3 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500">إضافة للهيكل</button>
                      </div>
                  </div>
                  <div className="space-y-4">
                      {classes.map(cls => (
                          <div key={cls.id} className="glass-card p-4 rounded-xl flex justify-between items-center group hover:bg-white/5 transition-colors">
                              <div><h4 className="font-bold text-white text-lg">{cls.name}</h4><div className="flex gap-2 mt-2">{cls.sections.map(sec => <span key={sec} className="bg-white/10 px-2 py-1 rounded text-xs text-gray-300">{sec}</span>)}</div></div>
                              <button onClick={() => handleDeleteClass(cls.id, cls.name)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-5 h-5" /></button>
                          </div>
                      ))}
                  </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="animate-fade-in grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="glass-card p-6 rounded-2xl h-fit">
                      <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><UserPlus className="w-5 h-5"/> إضافة موظف جديد</h3>
                      <p className="text-xs text-gray-400 mb-4">إدارة حسابات موظفي المدرسة (مدير مدرسة، مشرفين، مراقبين)</p>
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs text-gray-400 mb-1 block">الاسم الكامل</label>
                              <input type="text" className="w-full input-glass p-3 rounded-xl" placeholder="مثال: أحمد محمد العتيبي" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400 mb-1 block">اسم المستخدم (Username)</label>
                              <input type="text" className="w-full input-glass p-3 rounded-xl" placeholder="مثال: ahmed_school" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400 mb-1 block">كلمة المرور</label>
                              <input type="text" className="w-full input-glass p-3 rounded-xl" placeholder="كلمة مرور قوية" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                          </div>
                          <div>
                              <label className="text-xs text-gray-400 mb-1 block">الصلاحية</label>
                              <select className="w-full input-glass p-3 rounded-xl" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role, assignedClasses: []})}>
                                  <option value={Role.SCHOOL_ADMIN}>مدير مدرسة - صلاحيات كاملة</option>
                                  <option value={Role.SUPERVISOR_GLOBAL}>مشرف عام - إشراف على جميع الصفوف</option>
                                  <option value={Role.SUPERVISOR_CLASS}>مشرف صف - إشراف على صفوف محددة</option>
                                  <option value={Role.WATCHER}>مراقب - مراقبة الحضور فقط</option>
                                  <option value={Role.KIOSK}>كشك - واجهة الكشك فقط</option>
                          </select>
                          </div>
                          
                          {/* Class Assignment for Supervisor Class */}
                          {newUser.role === Role.SUPERVISOR_CLASS && (
                              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                  <label className="text-sm text-gray-300 font-medium block mb-3">تحديد الصفوف والفصول المسؤول عنها:</label>
                                  <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar">
                                      {classes.map(cls => (
                                          <div key={cls.id} className="p-3 bg-black/20 rounded-lg border border-white/5">
                                              <div className="flex items-center gap-2 mb-2">
                                                  <input 
                                                      type="checkbox" 
                                                      id={`class-${cls.id}`}
                                                      checked={newUser.assignedClasses.some(ac => ac.className === cls.name)}
                                                      onChange={(e) => {
                                                          if (e.target.checked) {
                                                              setNewUser({
                                                                  ...newUser, 
                                                                  assignedClasses: [...newUser.assignedClasses, { className: cls.name, sections: [] }]
                                                              });
                                                          } else {
                                                              setNewUser({
                                                                  ...newUser, 
                                                                  assignedClasses: newUser.assignedClasses.filter(ac => ac.className !== cls.name)
                                                              });
                                                          }
                                                      }}
                                                      className="w-4 h-4 rounded"
                                                  />
                                                  <label htmlFor={`class-${cls.id}`} className="text-white font-medium">{cls.name}</label>
                                              </div>
                                              {newUser.assignedClasses.some(ac => ac.className === cls.name) && cls.sections.length > 0 && (
                                                  <div className="mr-6 flex flex-wrap gap-2">
                                                      {cls.sections.map(sec => {
                                                          const assignedClass = newUser.assignedClasses.find(ac => ac.className === cls.name);
                                                          const isSelected = assignedClass?.sections.includes(sec);
                                                          return (
                                                              <label key={sec} className={`flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                                                                  isSelected ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-white/5 text-gray-400 border border-white/10'
                                                              }`}>
                                                                  <input 
                                                                      type="checkbox"
                                                                      checked={isSelected}
                                                                      onChange={(e) => {
                                                                          const updatedClasses = newUser.assignedClasses.map(ac => {
                                                                              if (ac.className === cls.name) {
                                                                                  return {
                                                                                      ...ac,
                                                                                      sections: e.target.checked 
                                                                                          ? [...ac.sections, sec]
                                                                                          : ac.sections.filter(s => s !== sec)
                                                                                  };
                                                                              }
                                                                              return ac;
                                                                          });
                                                                          setNewUser({ ...newUser, assignedClasses: updatedClasses });
                                                                      }}
                                                                      className="hidden"
                                                                  />
                                                                  <span className="text-sm">فصل {sec}</span>
                                                              </label>
                                                          );
                                                      })}
                                                  </div>
                                              )}
                                          </div>
                                      ))}
                                  </div>
                                  {newUser.assignedClasses.length === 0 && (
                                      <p className="text-xs text-amber-400 mt-2">⚠️ يرجى تحديد صف واحد على الأقل</p>
                                  )}
                              </div>
                          )}
                          
                          <button onClick={handleAddUser} className="w-full py-3 bg-gradient-to-r from-secondary-600 to-primary-600 rounded-xl text-white font-bold hover:from-secondary-500 hover:to-primary-500 transition-all shadow-lg">إنشاء حساب</button>
                      </div>
                  </div>
                  <div className="space-y-4">
                      {users.filter(u => u.role !== Role.SITE_ADMIN).length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>لا يوجد مستخدمين مسجلين</p>
                              <p className="text-xs mt-1">أضف مستخدمين جدد من النموذج على اليسار</p>
                          </div>
                      ) : (
                          users.filter(u => u.role !== Role.SITE_ADMIN).map(u => (
                              <div key={u.id} className="glass-card p-4 rounded-xl group hover:bg-white/5 transition-colors">
                                  <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                                              u.role === Role.SCHOOL_ADMIN ? 'bg-gradient-to-tr from-amber-500 to-orange-500' :
                                              u.role === Role.SUPERVISOR_GLOBAL ? 'bg-gradient-to-tr from-blue-500 to-cyan-500' :
                                              u.role === Role.SUPERVISOR_CLASS ? 'bg-gradient-to-tr from-green-500 to-emerald-500' :
                                              u.role === Role.KIOSK ? 'bg-gradient-to-tr from-teal-500 to-cyan-500' :
                                              'bg-gradient-to-tr from-primary-500 to-secondary-500'
                                          }`}>
                                              {u.name.charAt(0)}
                                          </div>
                                          <div>
                                              <h4 className="font-bold text-white">{u.name}</h4>
                                              <div className="text-xs text-gray-400 flex gap-2">
                                                  <span>@{u.username}</span> • 
                                                  <span className={`${
                                                      u.role === Role.SCHOOL_ADMIN ? 'text-amber-400' :
                                                      u.role === Role.SUPERVISOR_GLOBAL ? 'text-blue-400' :
                                                      u.role === Role.SUPERVISOR_CLASS ? 'text-green-400' :
                                                      u.role === Role.KIOSK ? 'text-teal-400' :
                                                      'text-primary-400'
                                                  }`}>
                                                      {u.role === Role.SCHOOL_ADMIN ? 'مدير مدرسة' :
                                                       u.role === Role.SUPERVISOR_GLOBAL ? 'مشرف عام' :
                                                       u.role === Role.SUPERVISOR_CLASS ? 'مشرف صف' :
                                                       u.role === Role.WATCHER ? 'مراقب' :
                                                       u.role === Role.KIOSK ? 'كشك' : u.role.replace('_', ' ')}
                                                  </span>
                                              </div>
                                          </div>
                                      </div>
                                      <button onClick={() => handleDeleteUser(u.id, u.name)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Trash2 className="w-5 h-5" />
                                      </button>
                                  </div>
                                  {/* Show assigned classes for class supervisors */}
                                  {u.role === Role.SUPERVISOR_CLASS && u.assignedClasses && u.assignedClasses.length > 0 && (
                                      <div className="mt-3 pt-3 border-t border-white/5">
                                          <div className="text-xs text-gray-400 mb-2">الصفوف المسؤول عنها:</div>
                                          <div className="flex flex-wrap gap-2">
                                              {u.assignedClasses.map((ac, i) => (
                                                  <span key={i} className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-lg border border-green-500/20">
                                                      {ac.className}
                                                      {ac.sections.length > 0 && ` (${ac.sections.join(', ')})`}
                                                  </span>
                                              ))}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          ))
                      )}
                  </div>
              </div>
            )}
            
            {activeTab === 'kiosk' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="glass-card p-8 rounded-3xl border border-white/10">
                        <h2 className="text-3xl font-bold font-serif text-white mb-6 flex items-center gap-3">
                            <Monitor className="w-8 h-8 text-primary-400" />
                            إعدادات كشك الحضور
                        </h2>

                        {/* Time Settings - موعد الطابور ومهلة السماح */}
                        <div className="mb-8 p-6 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-amber-400" />
                                إعدادات التوقيت
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-gray-300 mb-2 font-medium">موعد الطابور</label>
                                    <input 
                                        type="time" 
                                        className="w-full input-glass p-3 rounded-xl text-lg"
                                        value={kioskSettings.assemblyTime || '07:00'}
                                        onChange={e => setKioskSettings({...kioskSettings, assemblyTime: e.target.value})}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">الوقت الذي يبدأ بعده احتساب التأخير</p>
                                </div>
                                <div>
                                    <label className="block text-gray-300 mb-2 font-medium">مهلة السماح (بالدقائق)</label>
                                    <input 
                                        type="number" 
                                        className="w-full input-glass p-3 rounded-xl text-lg"
                                        value={kioskSettings.gracePeriod || 0}
                                        onChange={e => setKioskSettings({...kioskSettings, gracePeriod: Number(e.target.value)})}
                                        min="0"
                                        max="60"
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">فترة سماح بعد موعد الطابور قبل احتساب التأخير</p>
                                </div>
                            </div>
                            <div className="mt-4 p-3 bg-black/20 rounded-xl">
                                <p className="text-sm text-amber-300">
                                    ⏰ بناءً على الإعدادات الحالية: سيُحتسب التأخير بعد الساعة{' '}
                                    <strong className="font-mono">
                                        {(() => {
                                            const [h, m] = (kioskSettings.assemblyTime || '07:00').split(':').map(Number);
                                            const totalMinutes = h * 60 + m + (kioskSettings.gracePeriod || 0);
                                            const newH = Math.floor(totalMinutes / 60) % 24;
                                            const newM = totalMinutes % 60;
                                            return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
                                        })()}
                                    </strong>
                                </p>
                            </div>
                        </div>

                        {/* Theme Selection - اختيار نمط الكشك */}
                        <div className="mb-8 p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/20">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Palette className="w-5 h-5 text-purple-400" />
                                نمط شاشة الكشك
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {/* Dark Neon */}
                                <button 
                                    onClick={() => setKioskSettings({...kioskSettings, theme: 'dark-neon'})}
                                    className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                                        kioskSettings.theme === 'dark-neon' 
                                            ? 'border-cyan-400 ring-2 ring-cyan-400/30' 
                                            : 'border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    <div className="h-20 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 mb-2 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,255,0.15),transparent_70%)]" />
                                        <div className="absolute bottom-2 right-2 w-8 h-1 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan]" />
                                        <div className="absolute top-2 left-2 w-4 h-4 rounded bg-cyan-400/20 border border-cyan-400/50" />
                                    </div>
                                    <p className="text-white text-sm font-bold">داكن نيون</p>
                                    <p className="text-gray-500 text-xs">Dark Neon</p>
                                    {kioskSettings.theme === 'dark-neon' && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-cyan-400 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-black" />
                                        </div>
                                    )}
                                </button>

                                {/* Dark Gradient */}
                                <button 
                                    onClick={() => setKioskSettings({...kioskSettings, theme: 'dark-gradient'})}
                                    className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                                        kioskSettings.theme === 'dark-gradient' 
                                            ? 'border-violet-400 ring-2 ring-violet-400/30' 
                                            : 'border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    <div className="h-20 rounded-xl bg-gradient-to-br from-violet-900 via-purple-900 to-fuchsia-900 mb-2 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.3),transparent_50%)]" />
                                    </div>
                                    <p className="text-white text-sm font-bold">داكن متدرج</p>
                                    <p className="text-gray-500 text-xs">Dark Gradient</p>
                                    {kioskSettings.theme === 'dark-gradient' && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-violet-400 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-black" />
                                        </div>
                                    )}
                                </button>

                                {/* Light Clean */}
                                <button 
                                    onClick={() => setKioskSettings({...kioskSettings, theme: 'light-clean'})}
                                    className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                                        kioskSettings.theme === 'light-clean' 
                                            ? 'border-blue-400 ring-2 ring-blue-400/30' 
                                            : 'border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    <div className="h-20 rounded-xl bg-gradient-to-br from-gray-100 to-white mb-2 relative overflow-hidden border border-gray-200">
                                        <div className="absolute bottom-2 right-2 w-8 h-1 bg-blue-500 rounded-full" />
                                        <div className="absolute top-2 left-2 w-4 h-4 rounded bg-blue-100 border border-blue-200" />
                                    </div>
                                    <p className="text-white text-sm font-bold">فاتح نظيف</p>
                                    <p className="text-gray-500 text-xs">Light Clean</p>
                                    {kioskSettings.theme === 'light-clean' && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>

                                {/* Light Soft */}
                                <button 
                                    onClick={() => setKioskSettings({...kioskSettings, theme: 'light-soft'})}
                                    className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                                        kioskSettings.theme === 'light-soft' 
                                            ? 'border-rose-400 ring-2 ring-rose-400/30' 
                                            : 'border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    <div className="h-20 rounded-xl bg-gradient-to-br from-rose-50 via-amber-50 to-sky-50 mb-2 relative overflow-hidden border border-rose-100">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(251,207,232,0.5),transparent_50%)]" />
                                    </div>
                                    <p className="text-white text-sm font-bold">فاتح ناعم</p>
                                    <p className="text-gray-500 text-xs">Light Soft</p>
                                    {kioskSettings.theme === 'light-soft' && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-rose-400 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>

                                {/* Ocean Blue */}
                                <button 
                                    onClick={() => setKioskSettings({...kioskSettings, theme: 'ocean-blue'})}
                                    className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                                        kioskSettings.theme === 'ocean-blue' 
                                            ? 'border-sky-400 ring-2 ring-sky-400/30' 
                                            : 'border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    <div className="h-20 rounded-xl bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-800 mb-2 relative overflow-hidden">
                                        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-sky-400/30 to-transparent" />
                                        <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-white/30" />
                                    </div>
                                    <p className="text-white text-sm font-bold">أزرق محيطي</p>
                                    <p className="text-gray-500 text-xs">Ocean Blue</p>
                                    {kioskSettings.theme === 'ocean-blue' && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-sky-400 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>

                                {/* Sunset Warm */}
                                <button 
                                    onClick={() => setKioskSettings({...kioskSettings, theme: 'sunset-warm'})}
                                    className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                                        kioskSettings.theme === 'sunset-warm' 
                                            ? 'border-orange-400 ring-2 ring-orange-400/30' 
                                            : 'border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    <div className="h-20 rounded-xl bg-gradient-to-br from-orange-500 via-rose-500 to-purple-600 mb-2 relative overflow-hidden">
                                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-yellow-400/20 to-transparent" />
                                    </div>
                                    <p className="text-white text-sm font-bold">غروب دافئ</p>
                                    <p className="text-gray-500 text-xs">Sunset Warm</p>
                                    {kioskSettings.theme === 'sunset-warm' && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>

                                {/* Forest Green */}
                                <button 
                                    onClick={() => setKioskSettings({...kioskSettings, theme: 'forest-green'})}
                                    className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                                        kioskSettings.theme === 'forest-green' 
                                            ? 'border-emerald-400 ring-2 ring-emerald-400/30' 
                                            : 'border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    <div className="h-20 rounded-xl bg-gradient-to-br from-emerald-700 via-green-800 to-teal-900 mb-2 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(52,211,153,0.2),transparent_50%)]" />
                                    </div>
                                    <p className="text-white text-sm font-bold">أخضر طبيعي</p>
                                    <p className="text-gray-500 text-xs">Forest Green</p>
                                    {kioskSettings.theme === 'forest-green' && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>

                                {/* Royal Purple */}
                                <button 
                                    onClick={() => setKioskSettings({...kioskSettings, theme: 'royal-purple'})}
                                    className={`relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${
                                        kioskSettings.theme === 'royal-purple' 
                                            ? 'border-fuchsia-400 ring-2 ring-fuchsia-400/30' 
                                            : 'border-white/10 hover:border-white/30'
                                    }`}
                                >
                                    <div className="h-20 rounded-xl bg-gradient-to-br from-purple-800 via-fuchsia-800 to-pink-800 mb-2 relative overflow-hidden">
                                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_8px_yellow]" />
                                        <div className="absolute bottom-2 left-4 w-6 h-0.5 bg-fuchsia-300/50 rounded" />
                                    </div>
                                    <p className="text-white text-sm font-bold">بنفسجي ملكي</p>
                                    <p className="text-gray-500 text-xs">Royal Purple</p>
                                    {kioskSettings.theme === 'royal-purple' && (
                                        <div className="absolute top-2 left-2 w-5 h-5 bg-fuchsia-400 rounded-full flex items-center justify-center">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-4 text-center">اختر النمط المناسب لشاشة الكشك • يتم تطبيقه فوراً عند الحفظ</p>
                        </div>

                        {/* Basic Settings */}
                        <div className="space-y-6 mb-8 p-6 bg-white/5 rounded-2xl border border-white/10">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <SettingsIcon className="w-5 h-5 text-gray-400" />
                                الإعدادات الأساسية
                            </h3>
                            <div>
                                <label className="block text-gray-300 mb-2 font-medium">العنوان الرئيسي</label>
                                <input type="text" className="w-full input-glass p-3 rounded-xl" value={kioskSettings.mainTitle} onChange={e => setKioskSettings({...kioskSettings, mainTitle: e.target.value})} placeholder="مثال: مرحباً في نظام الحضور الذكي" />
                            </div>
                            <div>
                                <label className="block text-gray-300 mb-2 font-medium">العنوان الفرعي</label>
                                <input type="text" className="w-full input-glass p-3 rounded-xl" value={kioskSettings.subTitle} onChange={e => setKioskSettings({...kioskSettings, subTitle: e.target.value})} placeholder="مثال: لطفاً انتظر التعليمات" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-300 mb-2 font-medium">رسالة الحضور المبكر</label>
                                    <input type="text" className="w-full input-glass p-3 rounded-xl" value={kioskSettings.earlyMessage} onChange={e => setKioskSettings({...kioskSettings, earlyMessage: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-gray-300 mb-2 font-medium">رسالة التأخير</label>
                                    <input type="text" className="w-full input-glass p-3 rounded-xl" value={kioskSettings.lateMessage} onChange={e => setKioskSettings({...kioskSettings, lateMessage: e.target.value})} />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" checked={kioskSettings.showStats} onChange={e => setKioskSettings({...kioskSettings, showStats: e.target.checked})} className="w-5 h-5 rounded" />
                                <label className="text-gray-300 font-medium">عرض الإحصائيات</label>
                            </div>
                        </div>

                        {/* Display Size Settings */}
                        <div className="mb-8 p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/20">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Maximize2 className="w-5 h-5 text-blue-400" />
                                أحجام العرض
                            </h3>
                            <p className="text-xs text-gray-400 mb-4">تحكم في حجم العناصر المختلفة في شاشة الكشك</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Clock Size */}
                                <div>
                                    <label className="block text-gray-300 mb-2 font-medium text-sm">حجم الساعة</label>
                                    <select 
                                        className="w-full input-glass p-3 rounded-xl"
                                        value={kioskSettings.displaySettings?.clockSize || 'large'}
                                        onChange={e => setKioskSettings({
                                            ...kioskSettings, 
                                            displaySettings: {
                                                ...kioskSettings.displaySettings,
                                                clockSize: e.target.value as any,
                                                titleSize: kioskSettings.displaySettings?.titleSize || 'large',
                                                cardSize: kioskSettings.displaySettings?.cardSize || 'medium',
                                                inputSize: kioskSettings.displaySettings?.inputSize || 'large'
                                            }
                                        })}
                                    >
                                        <option value="small">صغير</option>
                                        <option value="medium">متوسط</option>
                                        <option value="large">كبير</option>
                                        <option value="xlarge">كبير جداً</option>
                                    </select>
                                </div>

                                {/* Title Size */}
                                <div>
                                    <label className="block text-gray-300 mb-2 font-medium text-sm">حجم العناوين</label>
                                    <select 
                                        className="w-full input-glass p-3 rounded-xl"
                                        value={kioskSettings.displaySettings?.titleSize || 'large'}
                                        onChange={e => setKioskSettings({
                                            ...kioskSettings, 
                                            displaySettings: {
                                                ...kioskSettings.displaySettings,
                                                clockSize: kioskSettings.displaySettings?.clockSize || 'large',
                                                titleSize: e.target.value as any,
                                                cardSize: kioskSettings.displaySettings?.cardSize || 'medium',
                                                inputSize: kioskSettings.displaySettings?.inputSize || 'large'
                                            }
                                        })}
                                    >
                                        <option value="small">صغير</option>
                                        <option value="medium">متوسط</option>
                                        <option value="large">كبير</option>
                                        <option value="xlarge">كبير جداً</option>
                                    </select>
                                </div>

                                {/* Card Size */}
                                <div>
                                    <label className="block text-gray-300 mb-2 font-medium text-sm">حجم البطاقات</label>
                                    <select 
                                        className="w-full input-glass p-3 rounded-xl"
                                        value={kioskSettings.displaySettings?.cardSize || 'medium'}
                                        onChange={e => setKioskSettings({
                                            ...kioskSettings, 
                                            displaySettings: {
                                                ...kioskSettings.displaySettings,
                                                clockSize: kioskSettings.displaySettings?.clockSize || 'large',
                                                titleSize: kioskSettings.displaySettings?.titleSize || 'large',
                                                cardSize: e.target.value as any,
                                                inputSize: kioskSettings.displaySettings?.inputSize || 'large'
                                            }
                                        })}
                                    >
                                        <option value="small">صغير</option>
                                        <option value="medium">متوسط</option>
                                        <option value="large">كبير</option>
                                        <option value="xlarge">كبير جداً</option>
                                    </select>
                                </div>

                                {/* Input Size */}
                                <div>
                                    <label className="block text-gray-300 mb-2 font-medium text-sm">حجم حقل الإدخال</label>
                                    <select 
                                        className="w-full input-glass p-3 rounded-xl"
                                        value={kioskSettings.displaySettings?.inputSize || 'large'}
                                        onChange={e => setKioskSettings({
                                            ...kioskSettings, 
                                            displaySettings: {
                                                ...kioskSettings.displaySettings,
                                                clockSize: kioskSettings.displaySettings?.clockSize || 'large',
                                                titleSize: kioskSettings.displaySettings?.titleSize || 'large',
                                                cardSize: kioskSettings.displaySettings?.cardSize || 'medium',
                                                inputSize: e.target.value as any
                                            }
                                        })}
                                    >
                                        <option value="small">صغير</option>
                                        <option value="medium">متوسط</option>
                                        <option value="large">كبير</option>
                                        <option value="xlarge">كبير جداً</option>
                                    </select>
                                </div>
                            </div>

                            {/* Size Preview */}
                            <div className="mt-4 p-4 bg-black/30 rounded-xl border border-white/10">
                                <p className="text-xs text-gray-500 mb-2 text-center">معاينة الأحجام:</p>
                                <div className="flex items-center justify-center gap-4">
                                    <div className="text-center">
                                        <div className={`font-mono font-bold mb-1 ${
                                            kioskSettings.displaySettings?.clockSize === 'small' ? 'text-lg' :
                                            kioskSettings.displaySettings?.clockSize === 'medium' ? 'text-2xl' :
                                            kioskSettings.displaySettings?.clockSize === 'xlarge' ? 'text-5xl' : 'text-3xl'
                                        } text-emerald-400`}>
                                            ٠٧:٣٠
                                        </div>
                                        <span className="text-xs text-gray-500">الساعة</span>
                                    </div>
                                    <div className="text-center">
                                        <div className={`font-bold mb-1 ${
                                            kioskSettings.displaySettings?.titleSize === 'small' ? 'text-sm' :
                                            kioskSettings.displaySettings?.titleSize === 'medium' ? 'text-lg' :
                                            kioskSettings.displaySettings?.titleSize === 'xlarge' ? 'text-3xl' : 'text-xl'
                                        } text-white`}>
                                            عنوان
                                        </div>
                                        <span className="text-xs text-gray-500">العنوان</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Header Image */}
                        <div className="mb-8 p-6 bg-white/5 rounded-2xl border border-white/10">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary-400" /> صورة الهيدر</h3>
                            {kioskSettings.headerImage && (
                                <div className="mb-4 relative inline-block">
                                    <img src={kioskSettings.headerImage} alt="Header" className="max-h-32 rounded-xl border border-white/20" />
                                    <button onClick={() => setKioskSettings({...kioskSettings, headerImage: undefined})} className="absolute top-2 left-2 p-1 bg-red-500 rounded-full text-white"><X className="w-4 h-4" /></button>
                                </div>
                            )}
                            <label className="block cursor-pointer">
                                <div className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-primary-500 transition-colors">
                                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                    <span className="text-gray-300">اضغط لرفع صورة الهيدر</span>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleImageUpload('header', e.target.files[0])} />
                            </label>
                        </div>

                        {/* Screensaver Settings */}
                        <div className="mb-8 p-6 bg-white/5 rounded-2xl border border-white/10">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><SettingsIcon className="w-5 h-5 text-secondary-400" /> إعدادات شاشة التوقف</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked={kioskSettings.screensaverEnabled} onChange={e => setKioskSettings({...kioskSettings, screensaverEnabled: e.target.checked})} className="w-5 h-5 rounded" />
                                    <label className="text-gray-300 font-medium">تفعيل شاشة التوقف</label>
                                </div>
                                {kioskSettings.screensaverEnabled && (
                                    <>
                                        <div>
                                            <label className="block text-gray-300 mb-2 font-medium">مدة عدم النشاط (بالثواني)</label>
                                            <div className="flex items-center gap-4">
                                                <input 
                                                    type="number" 
                                                    className="flex-1 input-glass p-3 rounded-xl" 
                                                    value={Math.round((kioskSettings.screensaverTimeout || 300000) / 1000)} 
                                                    onChange={e => setKioskSettings({...kioskSettings, screensaverTimeout: Number(e.target.value) * 1000})} 
                                                    placeholder="300" 
                                                    min="10"
                                                />
                                                <span className="text-gray-400 text-sm">ثانية</span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">({Math.round((kioskSettings.screensaverTimeout || 300000) / 60000)} دقيقة)</p>
                                        </div>
                                        
                                        {/* Screensaver Images */}
                                        <div className="pt-4 border-t border-white/10">
                                            <label className="block text-gray-300 mb-3 font-medium flex items-center gap-2">
                                                <ImageIcon className="w-5 h-5 text-secondary-400" />
                                                صور شاشة التوقف ({kioskSettings.screensaverImages?.length || 0}/5)
                                            </label>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                                                {kioskSettings.screensaverImages?.map((img, idx) => (
                                                    <div key={idx} className="relative group aspect-video">
                                                        <img src={img} alt={`Screensaver ${idx+1}`} className="w-full h-full object-cover rounded-xl border border-white/20" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                                                            <button onClick={() => handleRemoveImage(idx)} className="p-2 bg-red-500 rounded-full text-white hover:bg-red-400 transition-colors">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">{idx + 1}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {(kioskSettings.screensaverImages?.length || 0) < 5 && (
                                                <label className="block cursor-pointer">
                                                    <div className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center hover:border-secondary-500 transition-colors">
                                                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                                                        <span className="text-gray-300 text-sm">إضافة صورة لشاشة التوقف</span>
                                                    </div>
                                                    <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleImageUpload('screensaver', e.target.files[0])} />
                                                </label>
                                            )}
                                        </div>

                                        {/* Screensaver Phrases */}
                                        <div className="pt-4 border-t border-white/10">
                                            <label className="block text-gray-300 mb-3 font-medium flex items-center gap-2">
                                                <FileText className="w-5 h-5 text-primary-400" />
                                                عبارات شاشة التوقف ({kioskSettings.screensaverPhrases?.length || 0})
                                            </label>
                                            <div className="space-y-2 mb-4">
                                                {kioskSettings.screensaverPhrases?.map((phrase, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10 group">
                                                        <span className="text-primary-400 font-mono text-sm">{idx + 1}.</span>
                                                        <span className="flex-1 text-white">{phrase}</span>
                                                        <button 
                                                            onClick={() => {
                                                                const newPhrases = [...(kioskSettings.screensaverPhrases || [])];
                                                                newPhrases.splice(idx, 1);
                                                                setKioskSettings({...kioskSettings, screensaverPhrases: newPhrases});
                                                            }} 
                                                            className="p-1 text-red-400 hover:bg-red-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    id="newPhrase"
                                                    className="flex-1 input-glass p-3 rounded-xl" 
                                                    placeholder="أدخل عبارة جديدة..."
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const input = e.target as HTMLInputElement;
                                                            if (input.value.trim()) {
                                                                setKioskSettings({
                                                                    ...kioskSettings, 
                                                                    screensaverPhrases: [...(kioskSettings.screensaverPhrases || []), input.value.trim()]
                                                                });
                                                                input.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                                <button 
                                                    onClick={() => {
                                                        const input = document.getElementById('newPhrase') as HTMLInputElement;
                                                        if (input?.value.trim()) {
                                                            setKioskSettings({
                                                                ...kioskSettings, 
                                                                screensaverPhrases: [...(kioskSettings.screensaverPhrases || []), input.value.trim()]
                                                            });
                                                            input.value = '';
                                                        }
                                                    }}
                                                    className="px-4 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl text-white font-bold transition-colors"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">💡 أمثلة: "مرحباً بكم في مدرستنا" - "العلم نور" - "التميز هدفنا"</p>
                                        </div>

                                        {/* Custom Screensaver Text */}
                                        <div className="pt-4 border-t border-white/10">
                                            <div className="flex items-center justify-between mb-4">
                                                <label className="text-gray-300 font-medium flex items-center gap-2">
                                                    <Type className="w-5 h-5 text-amber-400" />
                                                    نص مخصص على شاشة التوقف
                                                </label>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={kioskSettings.screensaverCustomText?.enabled || false}
                                                        onChange={e => setKioskSettings({
                                                            ...kioskSettings, 
                                                            screensaverCustomText: {
                                                                ...kioskSettings.screensaverCustomText,
                                                                text: kioskSettings.screensaverCustomText?.text || '',
                                                                position: kioskSettings.screensaverCustomText?.position || 'center',
                                                                size: kioskSettings.screensaverCustomText?.size || 'large',
                                                                enabled: e.target.checked
                                                            }
                                                        })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                                </label>
                                            </div>

                                            {kioskSettings.screensaverCustomText?.enabled && (
                                                <div className="space-y-4 p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                                                    {/* Text Input */}
                                                    <div>
                                                        <label className="block text-gray-400 text-sm mb-2">النص</label>
                                                        <textarea
                                                            className="w-full input-glass p-3 rounded-xl resize-none"
                                                            rows={2}
                                                            placeholder="اكتب النص الذي سيظهر على شاشة التوقف..."
                                                            value={kioskSettings.screensaverCustomText?.text || ''}
                                                            onChange={e => setKioskSettings({
                                                                ...kioskSettings,
                                                                screensaverCustomText: {
                                                                    ...kioskSettings.screensaverCustomText!,
                                                                    text: e.target.value
                                                                }
                                                            })}
                                                        />
                                                    </div>

                                                    {/* Position & Size Grid */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {/* Position */}
                                                        <div>
                                                            <label className="block text-gray-400 text-sm mb-2">موضع النص</label>
                                                            <select
                                                                className="w-full input-glass p-3 rounded-xl"
                                                                value={kioskSettings.screensaverCustomText?.position || 'center'}
                                                                onChange={e => setKioskSettings({
                                                                    ...kioskSettings,
                                                                    screensaverCustomText: {
                                                                        ...kioskSettings.screensaverCustomText!,
                                                                        position: e.target.value as any
                                                                    }
                                                                })}
                                                            >
                                                                <option value="top">أعلى الشاشة ⬆️</option>
                                                                <option value="center">وسط الشاشة ⬌</option>
                                                                <option value="bottom">أسفل الشاشة ⬇️</option>
                                                            </select>
                                                        </div>

                                                        {/* Size */}
                                                        <div>
                                                            <label className="block text-gray-400 text-sm mb-2">حجم النص</label>
                                                            <select
                                                                className="w-full input-glass p-3 rounded-xl"
                                                                value={kioskSettings.screensaverCustomText?.size || 'large'}
                                                                onChange={e => setKioskSettings({
                                                                    ...kioskSettings,
                                                                    screensaverCustomText: {
                                                                        ...kioskSettings.screensaverCustomText!,
                                                                        size: e.target.value as any
                                                                    }
                                                                })}
                                                            >
                                                                <option value="small">صغير</option>
                                                                <option value="medium">متوسط</option>
                                                                <option value="large">كبير</option>
                                                                <option value="xlarge">كبير جداً</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Preview */}
                                                    <div className="p-4 bg-black/40 rounded-xl border border-white/10">
                                                        <p className="text-xs text-gray-500 mb-2 text-center">معاينة:</p>
                                                        <div className={`
                                                            flex min-h-[100px] rounded-lg bg-gradient-to-br from-slate-800 to-slate-900
                                                            ${kioskSettings.screensaverCustomText?.position === 'top' ? 'items-start pt-4' : ''}
                                                            ${kioskSettings.screensaverCustomText?.position === 'center' ? 'items-center' : ''}
                                                            ${kioskSettings.screensaverCustomText?.position === 'bottom' ? 'items-end pb-4' : ''}
                                                            justify-center
                                                        `}>
                                                            <p className={`
                                                                text-white font-bold text-center px-4
                                                                ${kioskSettings.screensaverCustomText?.size === 'small' ? 'text-sm' : ''}
                                                                ${kioskSettings.screensaverCustomText?.size === 'medium' ? 'text-lg' : ''}
                                                                ${kioskSettings.screensaverCustomText?.size === 'large' ? 'text-2xl' : ''}
                                                                ${kioskSettings.screensaverCustomText?.size === 'xlarge' ? 'text-3xl' : ''}
                                                            `}>
                                                                {kioskSettings.screensaverCustomText?.text || 'النص سيظهر هنا...'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Save Button */}
                        <button onClick={handleSaveKioskSettings} className="w-full py-4 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl text-white font-bold hover:from-primary-500 hover:to-secondary-500 transition-all shadow-lg text-lg">
                            حفظ الإعدادات
                        </button>
                  </div>
              </div>
            )}

            {/* ===================== TAB: NOTIFICATION TEMPLATES ===================== */}
            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="glass-card p-6 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <Bell className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white font-serif">قوالب الإشعارات</h2>
                        <p className="text-gray-400">تخصيص رسائل الإشعارات المرسلة لأولياء الأمور</p>
                      </div>
                    </div>
                    <button 
                      onClick={saveNotificationTemplates}
                      className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 rounded-xl text-white font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-amber-500/25 transition-all"
                    >
                      <Save className="w-5 h-5" />
                      حفظ التغييرات
                    </button>
                  </div>
                </div>

                {/* Templates Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Late Template */}
                  <div className={`glass-card p-6 rounded-2xl transition-all ${editingTemplate === 'late' ? 'ring-2 ring-amber-500' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">تنبيه التأخر</h3>
                          <p className="text-xs text-gray-500">يُرسل عند تأخر الطالب</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setEditingTemplate(editingTemplate === 'late' ? null : 'late')}
                        className={`p-2 rounded-lg transition-all ${editingTemplate === 'late' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {editingTemplate === 'late' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">عنوان الإشعار</label>
                          <input 
                            type="text"
                            className="w-full input-glass p-3 rounded-xl"
                            value={notificationTemplates.late.title}
                            onChange={e => setNotificationTemplates({...notificationTemplates, late: {...notificationTemplates.late, title: e.target.value}})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">نص الرسالة</label>
                          <textarea 
                            className="w-full input-glass p-3 rounded-xl resize-none"
                            rows={3}
                            value={notificationTemplates.late.message}
                            onChange={e => setNotificationTemplates({...notificationTemplates, late: {...notificationTemplates.late, message: e.target.value}})}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                        <p className="text-amber-300 font-bold text-sm mb-1">{notificationTemplates.late.title}</p>
                        <p className="text-gray-400 text-sm">{notificationTemplates.late.message}</p>
                      </div>
                    )}
                  </div>

                  {/* Absent Template */}
                  <div className={`glass-card p-6 rounded-2xl transition-all ${editingTemplate === 'absent' ? 'ring-2 ring-red-500' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                          <AlertCircle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">تنبيه الغياب</h3>
                          <p className="text-xs text-gray-500">يُرسل عند غياب الطالب</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setEditingTemplate(editingTemplate === 'absent' ? null : 'absent')}
                        className={`p-2 rounded-lg transition-all ${editingTemplate === 'absent' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {editingTemplate === 'absent' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">عنوان الإشعار</label>
                          <input 
                            type="text"
                            className="w-full input-glass p-3 rounded-xl"
                            value={notificationTemplates.absent.title}
                            onChange={e => setNotificationTemplates({...notificationTemplates, absent: {...notificationTemplates.absent, title: e.target.value}})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">نص الرسالة</label>
                          <textarea 
                            className="w-full input-glass p-3 rounded-xl resize-none"
                            rows={3}
                            value={notificationTemplates.absent.message}
                            onChange={e => setNotificationTemplates({...notificationTemplates, absent: {...notificationTemplates.absent, message: e.target.value}})}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <p className="text-red-300 font-bold text-sm mb-1">{notificationTemplates.absent.title}</p>
                        <p className="text-gray-400 text-sm">{notificationTemplates.absent.message}</p>
                      </div>
                    )}
                  </div>

                  {/* Behavior Template */}
                  <div className={`glass-card p-6 rounded-2xl transition-all ${editingTemplate === 'behavior' ? 'ring-2 ring-purple-500' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">ملاحظة سلوكية</h3>
                          <p className="text-xs text-gray-500">يُرسل عند تسجيل مخالفة</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setEditingTemplate(editingTemplate === 'behavior' ? null : 'behavior')}
                        className={`p-2 rounded-lg transition-all ${editingTemplate === 'behavior' ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {editingTemplate === 'behavior' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">عنوان الإشعار</label>
                          <input 
                            type="text"
                            className="w-full input-glass p-3 rounded-xl"
                            value={notificationTemplates.behavior.title}
                            onChange={e => setNotificationTemplates({...notificationTemplates, behavior: {...notificationTemplates.behavior, title: e.target.value}})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">نص الرسالة</label>
                          <textarea 
                            className="w-full input-glass p-3 rounded-xl resize-none"
                            rows={3}
                            value={notificationTemplates.behavior.message}
                            onChange={e => setNotificationTemplates({...notificationTemplates, behavior: {...notificationTemplates.behavior, message: e.target.value}})}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                        <p className="text-purple-300 font-bold text-sm mb-1">{notificationTemplates.behavior.title}</p>
                        <p className="text-gray-400 text-sm">{notificationTemplates.behavior.message}</p>
                      </div>
                    )}
                  </div>

                  {/* Summon Template */}
                  <div className={`glass-card p-6 rounded-2xl transition-all ${editingTemplate === 'summon' ? 'ring-2 ring-cyan-500' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                          <Users className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">استدعاء ولي أمر</h3>
                          <p className="text-xs text-gray-500">يُرسل عند طلب الحضور</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setEditingTemplate(editingTemplate === 'summon' ? null : 'summon')}
                        className={`p-2 rounded-lg transition-all ${editingTemplate === 'summon' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {editingTemplate === 'summon' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">عنوان الإشعار</label>
                          <input 
                            type="text"
                            className="w-full input-glass p-3 rounded-xl"
                            value={notificationTemplates.summon.title}
                            onChange={e => setNotificationTemplates({...notificationTemplates, summon: {...notificationTemplates.summon, title: e.target.value}})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">نص الرسالة</label>
                          <textarea 
                            className="w-full input-glass p-3 rounded-xl resize-none"
                            rows={3}
                            value={notificationTemplates.summon.message}
                            onChange={e => setNotificationTemplates({...notificationTemplates, summon: {...notificationTemplates.summon, message: e.target.value}})}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4">
                        <p className="text-cyan-300 font-bold text-sm mb-1">{notificationTemplates.summon.title}</p>
                        <p className="text-gray-400 text-sm">{notificationTemplates.summon.message}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tips */}
                <div className="glass-card p-6 rounded-2xl bg-gradient-to-br from-amber-900/20 to-orange-900/20 border border-amber-500/20">
                  <h3 className="text-lg font-bold text-amber-300 mb-3 flex items-center gap-2">
                    💡 نصائح لكتابة رسائل فعالة
                  </h3>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li>• استخدم لغة واضحة ومهذبة تحترم ولي الأمر</li>
                    <li>• اجعل الرسالة مختصرة ومباشرة</li>
                    <li>• اذكر اسم الطالب تلقائياً في بداية الرسالة (يُضاف تلقائياً)</li>
                    <li>• حدد الإجراء المطلوب من ولي الأمر بوضوح</li>
                    <li>• تجنب استخدام لغة سلبية أو تهديدية</li>
                  </ul>
                </div>
              </div>
            )}
            
            {activeTab === 'reports' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Advanced Filters */}
                  <div className="glass-card p-6 rounded-2xl no-print">
                      <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-primary-400" /> فلترة التقارير والسجلات
                      </h3>
                      
                      {/* Date Range */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div>
                              <label className="block text-xs text-gray-400 mb-2">من تاريخ</label>
                              <input 
                                  type="date" 
                                  className="w-full input-glass p-3 rounded-xl" 
                                  value={reportFilter.dateFrom} 
                                  onChange={e => setReportFilter({...reportFilter, dateFrom: e.target.value})} 
                              />
                      </div>
                          <div>
                              <label className="block text-xs text-gray-400 mb-2">إلى تاريخ</label>
                              <input 
                                  type="date" 
                                  className="w-full input-glass p-3 rounded-xl" 
                                  value={reportFilter.dateTo} 
                                  onChange={e => setReportFilter({...reportFilter, dateTo: e.target.value})} 
                              />
                  </div>
                          <div>
                              <label className="block text-xs text-gray-400 mb-2">الصف</label>
                              <select 
                                  className="w-full input-glass p-3 rounded-xl"
                                  value={reportFilter.className || ''}
                                  onChange={e => setReportFilter({...reportFilter, className: e.target.value, section: ''})}
                              >
                                  <option value="">جميع الصفوف</option>
                                  {classes.map(c => (
                                      <option key={c.id} value={c.name}>{c.name}</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs text-gray-400 mb-2">الفصل</label>
                              <select 
                                  className="w-full input-glass p-3 rounded-xl"
                                  value={reportFilter.section || ''}
                                  onChange={e => setReportFilter({...reportFilter, section: e.target.value})}
                                  disabled={!reportFilter.className}
                              >
                                  <option value="">جميع الفصول</option>
                                  {reportFilter.className && classes.find(c => c.name === reportFilter.className)?.sections.map(s => (
                                      <option key={s} value={s}>{s}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      {/* Status & Search Filters */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div>
                              <label className="block text-xs text-gray-400 mb-2">الحالة</label>
                              <select 
                                  className="w-full input-glass p-3 rounded-xl"
                                  value={reportFilter.status || 'all'}
                                  onChange={e => setReportFilter({...reportFilter, status: e.target.value as any})}
                              >
                                  <option value="all">جميع الحالات</option>
                                  <option value="present">الحضور فقط ✓</option>
                                  <option value="late">المتأخرين فقط ⏰</option>
                                  <option value="absent">الغائبين فقط ✗</option>
                              </select>
                          </div>
                          <div className="md:col-span-2">
                              <label className="block text-xs text-gray-400 mb-2">البحث عن طالب</label>
                              <div className="relative">
                                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                  <input 
                                      type="text" 
                                      className="w-full input-glass p-3 pr-10 rounded-xl" 
                                      placeholder="اكتب اسم الطالب أو رقم المعرف..."
                                      value={reportFilter.searchQuery || ''}
                                      onChange={e => setReportFilter({...reportFilter, searchQuery: e.target.value})}
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Quick Filters */}
                      <div className="flex flex-wrap gap-2 mb-6">
                          <span className="text-xs text-gray-400 ml-2">فلاتر سريعة:</span>
                          <button 
                              onClick={() => setReportFilter({...reportFilter, dateFrom: getLocalISODate(), dateTo: getLocalISODate()})}
                              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                          >
                              اليوم
                          </button>
                          <button 
                              onClick={() => {
                                  const today = new Date();
                                  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                                  setReportFilter({
                                      ...reportFilter, 
                                      dateFrom: weekAgo.toISOString().split('T')[0], 
                                      dateTo: getLocalISODate()
                                  });
                              }}
                              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                          >
                              آخر أسبوع
                          </button>
                          <button 
                              onClick={() => {
                                  const today = new Date();
                                  const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
                                  setReportFilter({
                                      ...reportFilter, 
                                      dateFrom: monthAgo.toISOString().split('T')[0], 
                                      dateTo: getLocalISODate()
                                  });
                              }}
                              className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors"
                          >
                              آخر شهر
                          </button>
                          <div className="w-px h-6 bg-white/10 mx-1"></div>
                          <button 
                              onClick={() => setReportFilter({...reportFilter, status: 'late'})}
                              className={`px-3 py-1 border rounded-lg text-xs transition-colors ${
                                  reportFilter.status === 'late' 
                                  ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' 
                                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                              }`}
                          >
                              ⏰ المتأخرين
                          </button>
                          <button 
                              onClick={() => setReportFilter({...reportFilter, status: 'absent'})}
                              className={`px-3 py-1 border rounded-lg text-xs transition-colors ${
                                  reportFilter.status === 'absent' 
                                  ? 'bg-red-500/20 border-red-500/30 text-red-400' 
                                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                              }`}
                          >
                              ✗ الغائبين
                          </button>
                          <button 
                              onClick={() => setReportFilter({
                                  dateFrom: getLocalISODate(), 
                                  dateTo: getLocalISODate(), 
                                  className: '', 
                                  section: '', 
                                  status: 'all', 
                                  searchQuery: ''
                              })}
                              className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs text-red-400 transition-colors"
                          >
                              مسح الفلاتر
                          </button>
                      </div>

                      {/* Generate Button */}
                      <button 
                          onClick={handleGenerateReport} 
                          className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl text-white font-bold hover:from-primary-500 hover:to-secondary-500 transition-all shadow-lg flex items-center justify-center gap-2"
                      >
                          <FileText className="w-5 h-5" />
                          عرض التقرير
                      </button>
                  </div>

                  {/* Report Results */}
                  {reportData && (
                      <div className="animate-fade-in-up">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 no-print">
                              <div>
                              <h2 className="text-2xl font-bold text-white font-serif">نتائج التقرير</h2>
                                  <p className="text-sm text-gray-400 mt-1">
                                      {reportFilter.dateFrom === reportFilter.dateTo 
                                          ? `تاريخ: ${reportFilter.dateFrom}` 
                                          : `من ${reportFilter.dateFrom} إلى ${reportFilter.dateTo}`
                                      }
                                      {reportFilter.className && ` • ${reportFilter.className}`}
                                      {reportFilter.section && ` - ${reportFilter.section}`}
                                      {reportFilter.status && reportFilter.status !== 'all' && ` • ${
                                          reportFilter.status === 'present' ? 'الحضور' :
                                          reportFilter.status === 'late' ? 'المتأخرين' : 'الغائبين'
                                      }`}
                                  </p>
                              </div>
                              
                              <div className="flex gap-2">
                                  <button onClick={() => handleExport('xlsx')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-600/20 transition-all text-sm font-bold">
                                      <FileSpreadsheet className="w-4 h-4" /> Excel
                                  </button>
                                  <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 px-4 py-2 bg-red-600/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-600/20 transition-all text-sm font-bold">
                                      <FileType className="w-4 h-4" /> PDF
                                  </button>
                                  <button onClick={() => window.print()} className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 text-gray-300" title="طباعة">
                                      <Printer className="w-5 h-5" />
                                  </button>
                              </div>
                          </div>
                          
                          {/* Summary Cards */}
                          <div id="print-area" className="glass-card p-8 rounded-3xl bg-white text-black print:text-black print:bg-white print:shadow-none print:border-none print:p-0">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm">
                                      <p className="text-xs font-bold text-blue-600 mb-1">إجمالي السجلات</p>
                                      <p className="text-2xl font-bold text-gray-800 font-mono">{reportData.summary.totalRecords}</p>
                              </div>
                                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                      <p className="text-xs font-bold text-emerald-600 mb-1">حضور</p>
                                      <p className="text-2xl font-bold text-gray-800 font-mono">{reportData.summary.present}</p>
                                      <p className="text-xs text-emerald-600 mt-1">
                                          {reportData.summary.totalRecords > 0 
                                              ? `${Math.round((reportData.summary.present / reportData.summary.totalRecords) * 100)}%` 
                                              : '0%'
                                          }
                                      </p>
                          </div>
                                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 shadow-sm">
                                      <p className="text-xs font-bold text-amber-600 mb-1">تأخر</p>
                                      <p className="text-2xl font-bold text-gray-800 font-mono">{reportData.summary.late}</p>
                                      <p className="text-xs text-amber-600 mt-1">
                                          {reportData.summary.totalRecords > 0 
                                              ? `${Math.round((reportData.summary.late / reportData.summary.totalRecords) * 100)}%` 
                                              : '0%'
                                          }
                                      </p>
                                  </div>
                                  <div className="p-4 rounded-2xl bg-red-50 border border-red-100 shadow-sm">
                                      <p className="text-xs font-bold text-red-600 mb-1">غياب</p>
                                      <p className="text-2xl font-bold text-gray-800 font-mono">
                                          {reportData.summary.totalRecords - reportData.summary.present - reportData.summary.late}
                                      </p>
                                      <p className="text-xs text-red-600 mt-1">
                                          {reportData.summary.totalRecords > 0 
                                              ? `${Math.round(((reportData.summary.totalRecords - reportData.summary.present - reportData.summary.late) / reportData.summary.totalRecords) * 100)}%` 
                                              : '0%'
                                          }
                                      </p>
                                  </div>
                              </div>

                              {/* Results Table */}
                              {reportData.details.length === 0 ? (
                                  <div className="text-center py-12 text-gray-500">
                                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                      <p>لا توجد نتائج للفلاتر المحددة</p>
                                  </div>
                              ) : (
                                  <div className="overflow-x-auto">
                                      <table className="w-full text-right border-collapse text-gray-700">
                                          <thead>
                                              <tr className="bg-gray-50 border-b">
                                                  <th className="p-4 text-sm font-bold">#</th>
                                                  <th className="p-4 text-sm font-bold">التاريخ</th>
                                                  <th className="p-4 text-sm font-bold">الطالب</th>
                                                  <th className="p-4 text-sm font-bold">الصف</th>
                                                  <th className="p-4 text-sm font-bold">الفصل</th>
                                                  <th className="p-4 text-sm font-bold">الوقت</th>
                                                  <th className="p-4 text-sm font-bold">الحالة</th>
                                              </tr>
                                          </thead>
                                          <tbody>
                                              {reportData.details.map((row: any, i: number) => (
                                                  <tr key={i} className="border-b hover:bg-gray-50 transition-colors">
                                                      <td className="p-3 text-gray-400 font-mono text-sm">{i + 1}</td>
                                                      <td className="p-3 font-mono text-sm">{row.date}</td>
                                                      <td className="p-3 font-bold">{row.studentName}</td>
                                                      <td className="p-3 text-sm">{row.className}</td>
                                                      <td className="p-3 text-sm">{row.section || '-'}</td>
                                                      <td className="p-3 font-mono text-sm">
                                                          {new Date(row.time).toLocaleTimeString('ar-SA', {hour: '2-digit', minute: '2-digit'})}
                                                      </td>
                                                      <td className="p-3">
                                                          <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                              row.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                                                              row.status === 'late' ? 'bg-amber-100 text-amber-700' :
                                                              'bg-red-100 text-red-700'
                                                          }`}>
                                                              {row.status === 'present' ? 'حاضر' :
                                                               row.status === 'late' ? 'متأخر' : 'غائب'}
                                                          </span>
                                                      </td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              )}

                              {/* Footer for print */}
                              <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400 print:block hidden">
                                  تم إنشاء هذا التقرير بواسطة نظام حاضر - {new Date().toLocaleString('ar-SA')}
                              </div>
                          </div>
                      </div>
                  )}
              </div>
            )}

        </div>
      </div>

      {/* --- MODALS (Shared) --- */}
      
      {/* Student Profile Modal */}
      {selectedStudentProfile && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
              <div className="glass-card w-full max-w-4xl rounded-3xl p-6 relative animate-fade-in-up border border-white/20 my-8">
                  <button onClick={() => setSelectedStudentProfile(null)} className="absolute left-6 top-6 text-gray-400 hover:text-white z-10"><X className="w-6 h-6" /></button>
                  
                  {/* Header */}
                  <div className="flex items-center gap-6 mb-8 pb-6 border-b border-white/10">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                          {selectedStudentProfile.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                          <h2 className="text-3xl font-bold font-serif text-white mb-2">{selectedStudentProfile.name}</h2>
                          <div className="flex items-center gap-4 text-gray-400 text-sm">
                              <span className="font-mono bg-white/5 px-3 py-1 rounded-lg">#{selectedStudentProfile.id}</span>
                              <span className="bg-primary-500/20 text-primary-400 px-3 py-1 rounded-lg">{selectedStudentProfile.className} - {selectedStudentProfile.section}</span>
                          </div>
                      </div>
                  </div>

                  {/* Guardian Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <div className="text-xs text-gray-400 mb-1">معرف الطالب</div>
                          <div className="text-white font-mono text-lg">{selectedStudentProfile.id}</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                          <div className="text-xs text-gray-400 mb-1">رقم ولي الأمر</div>
                          <div className="text-white font-mono text-lg">{selectedStudentProfile.guardianPhone}</div>
                      </div>
                  </div>

                  {loading ? (
                      <div className="text-center py-12">
                          <Loader2 className="w-10 h-10 animate-spin text-primary-400 mx-auto mb-4" />
                          <p className="text-gray-400">جاري تحميل البيانات...</p>
                      </div>
                  ) : studentProfileData && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Attendance Summary */}
                          <div className="glass-card p-4 rounded-2xl border border-white/10">
                              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                  <Clock className="w-5 h-5 text-emerald-400" /> سجل الحضور
                              </h3>
                              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                  {studentProfileData.attendance.length === 0 ? (
                                      <p className="text-gray-500 text-sm text-center py-4">لا يوجد سجلات حضور</p>
                                  ) : (
                                      studentProfileData.attendance.slice(0, 10).map((a, i) => (
                                          <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm">
                                              <span className="text-gray-400 font-mono">{a.date}</span>
                                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                  a.status === 'present' ? 'bg-emerald-500/20 text-emerald-400' :
                                                  a.status === 'late' ? 'bg-amber-500/20 text-amber-400' :
                                                  'bg-red-500/20 text-red-400'
                                              }`}>
                                                  {a.status === 'present' ? 'حاضر' : a.status === 'late' ? `متأخر ${a.minutesLate || 0} د` : 'غائب'}
                                              </span>
                                          </div>
                                      ))
                                  )}
                              </div>
                              <div className="mt-4 pt-4 border-t border-white/10 text-center">
                                  <span className="text-xs text-gray-400">الإجمالي: </span>
                                  <span className="text-white font-bold">{studentProfileData.attendance.length}</span>
                                  <span className="text-xs text-gray-400 mr-2"> سجل</span>
                              </div>
                          </div>

                          {/* Exits (Permissions) */}
                          <div className="glass-card p-4 rounded-2xl border border-white/10">
                              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                  <DoorOpen className="w-5 h-5 text-amber-400" /> سجل الاستئذان
                              </h3>
                              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                  {studentProfileData.exits.length === 0 ? (
                                      <p className="text-gray-500 text-sm text-center py-4">لا يوجد سجلات استئذان</p>
                                  ) : (
                                      studentProfileData.exits.slice(0, 10).map((e, i) => (
                                          <div key={i} className="p-2 bg-white/5 rounded-lg text-sm">
                                              <div className="flex justify-between items-center mb-1">
                                                  <span className="text-gray-400 font-mono text-xs">{e.exit_time.split('T')[0]}</span>
                                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                                      e.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'
                                                  }`}>
                                                      {e.status === 'approved' ? 'معتمد' : 'معلق'}
                                                  </span>
                                              </div>
                                              <p className="text-gray-300 text-xs">{e.reason}</p>
                                          </div>
                                      ))
                                  )}
                              </div>
                              <div className="mt-4 pt-4 border-t border-white/10 text-center">
                                  <span className="text-xs text-gray-400">الإجمالي: </span>
                                  <span className="text-white font-bold">{studentProfileData.exits.length}</span>
                                  <span className="text-xs text-gray-400 mr-2"> استئذان</span>
                              </div>
                          </div>

                          {/* Violations */}
                          <div className="glass-card p-4 rounded-2xl border border-white/10">
                              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                  <AlertOctagon className="w-5 h-5 text-red-400" /> المخالفات
                              </h3>
                              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                  {studentProfileData.violations.length === 0 ? (
                                      <p className="text-gray-500 text-sm text-center py-4">لا يوجد مخالفات - ممتاز! 🌟</p>
                                  ) : (
                                      studentProfileData.violations.slice(0, 10).map((v, i) => (
                                          <div key={i} className="p-2 bg-white/5 rounded-lg text-sm">
                                              <div className="flex justify-between items-center mb-1">
                                                  <span className="text-gray-400 font-mono text-xs">{v.created_at.split('T')[0]}</span>
                                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                      v.level === 'high' ? 'bg-red-500/20 text-red-400' :
                                                      v.level === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                                      'bg-blue-500/20 text-blue-400'
                                                  }`}>
                                                      {v.level === 'high' ? 'عالي' : v.level === 'medium' ? 'متوسط' : 'منخفض'}
                                                  </span>
                                              </div>
                                              <p className="text-gray-300 text-xs">{v.description}</p>
                                          </div>
                                      ))
                                  )}
                              </div>
                              <div className="mt-4 pt-4 border-t border-white/10 text-center">
                                  <span className="text-xs text-gray-400">الإجمالي: </span>
                                  <span className={`font-bold ${studentProfileData.violations.length === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {studentProfileData.violations.length}
                                  </span>
                                  <span className="text-xs text-gray-400 mr-2"> مخالفة</span>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* Quick Stats */}
                  {studentProfileData && (
                      <div className="mt-6 pt-6 border-t border-white/10">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="text-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                  <div className="text-2xl font-bold text-emerald-400 font-mono">
                                      {studentProfileData.attendance.filter(a => a.status === 'present').length}
                                  </div>
                                  <div className="text-xs text-gray-400">أيام حضور</div>
                              </div>
                              <div className="text-center p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                  <div className="text-2xl font-bold text-amber-400 font-mono">
                                      {studentProfileData.attendance.filter(a => a.status === 'late').length}
                                  </div>
                                  <div className="text-xs text-gray-400">أيام تأخير</div>
                              </div>
                              <div className="text-center p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                  <div className="text-2xl font-bold text-blue-400 font-mono">
                                      {studentProfileData.exits.length}
                                  </div>
                                  <div className="text-xs text-gray-400">استئذان</div>
                              </div>
                              <div className="text-center p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                                  <div className="text-2xl font-bold text-red-400 font-mono">
                                      {studentProfileData.violations.length}
                                  </div>
                                  <div className="text-xs text-gray-400">مخالفات</div>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="glass-card w-full max-w-lg rounded-3xl p-6 relative animate-fade-in-up border border-white/20">
                  <button onClick={() => setShowAddModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                  <h3 className="text-2xl font-bold font-serif text-white mb-6 flex items-center gap-2"><UserPlus className="w-6 h-6 text-primary-400" /> إضافة طالب جديد</h3>
                  <form onSubmit={handleAddStudent} className="space-y-4">
                      <input type="text" required className="w-full input-glass p-3 rounded-xl" placeholder="الاسم" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                      <input type="text" required className="w-full input-glass p-3 rounded-xl font-mono" placeholder="جوال ولي الأمر" value={newStudent.guardianPhone} onChange={e => setNewStudent({...newStudent, guardianPhone: e.target.value})} />
                      <div className="grid grid-cols-2 gap-4"><select className="w-full input-glass p-3 rounded-xl" value={newStudent.className} onChange={e => setNewStudent({...newStudent, className: e.target.value, section: ''})} required><option value="">اختر الصف...</option>{classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select>{selectedClassObj && selectedClassObj.sections.length > 0 ? (<select className="w-full input-glass p-3 rounded-xl" value={newStudent.section} onChange={e => setNewStudent({...newStudent, section: e.target.value})} required><option value="">اختر الفصل...</option>{selectedClassObj.sections.map(sec => (<option key={sec} value={sec}>{sec}</option>))}</select>) : (<input type="text" required className="w-full input-glass p-3 rounded-xl" placeholder="أ، ب، ج..." value={newStudent.section} onChange={e => setNewStudent({...newStudent, section: e.target.value})} />)}</div>
                      <button type="submit" className="w-full py-4 mt-4 bg-primary-600 rounded-xl text-white font-bold hover:bg-primary-500 shadow-lg">حفظ وإضافة</button>
                  </form>
              </div>
          </div>
      )}

      {/* Edit Student Modal */}
      {showEditStudentModal && editingStudent && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="glass-card w-full max-w-lg rounded-3xl p-6 relative animate-fade-in-up border border-white/20">
                  <button onClick={() => { setShowEditStudentModal(false); setEditingStudent(null); }} className="absolute left-6 top-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                  <h3 className="text-2xl font-bold font-serif text-white mb-6 flex items-center gap-2">
                      <SettingsIcon className="w-6 h-6 text-amber-400" /> تعديل بيانات الطالب
                  </h3>
                  <form onSubmit={handleEditStudent} className="space-y-4">
                      {/* Student ID - Read Only */}
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">المعرف (لا يمكن تغييره)</label>
                          <input 
                              type="text" 
                              readOnly 
                              className="w-full input-glass p-3 rounded-xl bg-white/5 text-gray-400 cursor-not-allowed font-mono" 
                              value={editingStudent.id} 
                          />
                      </div>
                      
                      {/* Name */}
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">الاسم</label>
                          <input 
                              type="text" 
                              required 
                              className="w-full input-glass p-3 rounded-xl" 
                              placeholder="الاسم" 
                              value={editingStudent.name} 
                              onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} 
                          />
                      </div>
                      
                      {/* Guardian Phone */}
                      <div>
                          <label className="block text-xs text-gray-400 mb-1">جوال ولي الأمر</label>
                          <input 
                              type="text" 
                              required 
                              className="w-full input-glass p-3 rounded-xl font-mono" 
                              placeholder="جوال ولي الأمر" 
                              value={editingStudent.guardianPhone} 
                              onChange={e => setEditingStudent({...editingStudent, guardianPhone: e.target.value})} 
                          />
                      </div>
                      
                      {/* Class and Section */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs text-gray-400 mb-1">الصف</label>
                              <select 
                                  className="w-full input-glass p-3 rounded-xl" 
                                  value={editingStudent.className} 
                                  onChange={e => setEditingStudent({...editingStudent, className: e.target.value, section: ''})} 
                                  required
                              >
                                  <option value="">اختر الصف...</option>
                                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs text-gray-400 mb-1">الفصل</label>
                              {editingClassObj && editingClassObj.sections.length > 0 ? (
                                  <select 
                                      className="w-full input-glass p-3 rounded-xl" 
                                      value={editingStudent.section} 
                                      onChange={e => setEditingStudent({...editingStudent, section: e.target.value})} 
                                      required
                                  >
                                      <option value="">اختر الفصل...</option>
                                      {editingClassObj.sections.map(sec => (
                                          <option key={sec} value={sec}>{sec}</option>
                                      ))}
                                  </select>
                              ) : (
                                  <input 
                                      type="text" 
                                      required 
                                      className="w-full input-glass p-3 rounded-xl" 
                                      placeholder="أ، ب، ج..." 
                                      value={editingStudent.section} 
                                      onChange={e => setEditingStudent({...editingStudent, section: e.target.value})} 
                                  />
                              )}
                          </div>
                      </div>
                      
                      <button type="submit" className="w-full py-4 mt-4 bg-amber-600 rounded-xl text-white font-bold hover:bg-amber-500 shadow-lg shadow-amber-900/20 transition-all">
                          حفظ التغييرات
                      </button>
                  </form>
              </div>
          </div>
      )}

      {showImportModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="glass-card w-full max-w-2xl rounded-3xl p-8 relative animate-fade-in-up border border-white/20 text-center">
                  <button onClick={() => setShowImportModal(false)} className="absolute left-6 top-6 text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                  <FileSpreadsheet className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                  <h2 className="text-3xl font-bold font-serif text-white mb-2">استيراد بيانات الطلاب</h2>
                  
                  {/* Template Download Section */}
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-6">
                      <p className="text-blue-300 text-sm mb-3">💡 حمّل النموذج أولاً، ثم املأه ببيانات الطلاب وارفعه هنا</p>
                      <button 
                          onClick={handleExportTemplate} 
                          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl hover:bg-blue-600/50 font-bold transition-all text-sm"
                      >
                          <Download className="w-4 h-4" /> تحميل نموذج Excel
                      </button>
                  </div>

                  {/* Required Columns Info */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-6 text-right">
                      <p className="text-xs text-gray-400 mb-2 font-bold">الأعمدة المطلوبة في الملف:</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                          <span className="bg-primary-500/20 text-primary-300 px-2 py-1 rounded text-xs">المعرف</span>
                          <span className="bg-primary-500/20 text-primary-300 px-2 py-1 rounded text-xs">الاسم</span>
                          <span className="bg-primary-500/20 text-primary-300 px-2 py-1 rounded text-xs">الصف</span>
                          <span className="bg-primary-500/20 text-primary-300 px-2 py-1 rounded text-xs">الفصل</span>
                          <span className="bg-primary-500/20 text-primary-300 px-2 py-1 rounded text-xs">الجوال</span>
                      </div>
                  </div>
                  
                  <label className="block w-full cursor-pointer group mb-6">
                      <div className="border-2 border-dashed border-white/10 rounded-3xl p-10 group-hover:border-emerald-500/50 group-hover:bg-emerald-500/5 transition-all">
                          <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                          <span className="text-lg font-bold text-gray-300">اضغط لاختيار ملف Excel أو CSV</span>
                          {importFile && <p className="text-emerald-400 mt-2 text-sm">✓ تم اختيار: {importFile.name}</p>}
                      </div>
                      <input type="file" className="hidden" accept=".csv, .xlsx" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                  </label>
                  {importFile && <button onClick={handleImport} className="px-6 py-2 bg-emerald-600 rounded-lg text-white font-bold hover:bg-emerald-500 transition-colors">رفع ومعالجة</button>}
              </div>
          </div>
      )}

      {deleteConfirmation && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
                <div className="glass-card w-full max-w-sm rounded-3xl p-6 border border-white/20 text-center relative">
                    <Trash2 className="w-8 h-8 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">تأكيد الحذف</h3>
                    <p className="text-gray-400 mb-6">هل أنت متأكد من حذف <span className="text-white font-bold mx-1">{deleteConfirmation.name}</span>؟</p>
                    <div className="flex gap-3"><button onClick={() => setDeleteConfirmation(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-gray-300 font-bold transition-colors">إلغاء</button><button onClick={confirmDeleteAction} className="flex-1 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-bold shadow-lg shadow-red-900/20 transition-colors">حذف</button></div>
                </div>
            </div>
      )}

    </div>
  );
};

export default Admin;
