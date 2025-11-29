
import React, { useEffect, useState, useRef } from 'react';
import { User, AttendanceRecord, ViolationRecord, Student, ExitRecord, Notification, Role } from '../types';
import { db } from '../services/db';
import { auth } from '../services/auth';
import { User as UserIcon, AlertTriangle, Clock, Calendar, ChevronLeft, Loader2, DoorOpen, Bell, CheckCircle, ChevronDown, Settings } from 'lucide-react';

const Parents: React.FC<{ user: User }> = ({ user }) => {
  const [children, setChildren] = useState<Student[]>([]);
  const [selectedChild, setSelectedChild] = useState<Student | null>(null);
  
  // Data States
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [exits, setExits] = useState<ExitRecord[]>([]);
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'attendance' | 'exits' | 'violations' | 'notifications'>('attendance');
  const [showToast, setShowToast] = useState<Notification | null>(null);
  const toastTimeout = useRef<number | null>(null);

  useEffect(() => {
    // 1. Role Check
    auth.requireRole([Role.GUARDIAN]);

    // 2. Initial Load: Get all children associated with this parent
    const fetchChildren = async () => {
        try {
            // Using username (guardian phone) to fetch linked students
            const myChildren = await db.getStudentsByGuardian(user.username);
            setChildren(myChildren);
            if (myChildren.length > 0) {
                setSelectedChild(myChildren[0]); // Default to first child
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    fetchChildren();
  }, [user]);

  // 3. Child Specific Data Load
  useEffect(() => {
    if (!selectedChild) return;

    const fetchChildData = async () => {
        setLoading(true);
        try {
            const [att, ext, viol, notif] = await Promise.all([
                db.getStudentAttendance(selectedChild.id),
                db.getStudentExits(selectedChild.id),
                db.getViolations(selectedChild.id),
                db.getStudentNotifications(selectedChild.id, selectedChild.className)
            ]);
            
            setAttendance(att);
            setExits(ext);
            setViolations(viol);
            setNotifications(notif);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    
    fetchChildData();
  }, [selectedChild]);

  // ---- New effect for realtime notifications with toast ----
  useEffect(() => {
    if (!selectedChild) return;
    const unsub = db.subscribeToNotifications(user, (notif: Notification) => {
      // Add if relevant for the child
      if (
        notif.target_audience === 'all' ||
        notif.target_audience === 'guardian' ||
        (notif.target_audience === 'student' && notif.target_id === selectedChild.id) ||
        (notif.target_audience === 'class' && notif.target_id === selectedChild.className)
      ) {
        setNotifications(prev => [notif, ...prev]);
        if (notif.isPopup) {
          setShowToast(notif);
          if(toastTimeout.current) clearTimeout(toastTimeout.current);
          toastTimeout.current = window.setTimeout(() => setShowToast(null), 5000);
        }
      }
    });
    return () => { unsub.unsubscribe(); toastTimeout.current && clearTimeout(toastTimeout.current); }
  }, [user, selectedChild]);

  if (loading && !selectedChild) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-white w-10 h-10" /></div>;

  if (children.length === 0 && !loading) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
                <UserIcon className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-bold text-white">عفواً</h2>
            <p className="text-gray-400 mt-2">لا يوجد طلاب مرتبطين برقم الجوال هذا.</p>
        </div>
    );
  }

  if (!selectedChild) return null;

  // ---- Overlay Toast markup ----
  const Toast = showToast && (
    <div className="fixed z-[140] bottom-8 right-8 md:right-10 max-w-xs w-[340px] glass-card border border-pink-400/30 bg-pink-500/10 shadow-2xl animate-fade-in-up backdrop-blur-2xl rounded-2xl p-5 flex items-center animate-pulse-slow" dir="rtl">
      <div className="flex-shrink-0 mr-3">{getNotifIcon(showToast)}</div>
      <div className="flex-1 text-right">
        <div className="text-lg font-bold text-white mb-1">{showToast.title || "تنبيه جديد"}</div>
        <div className="text-sm text-primary-300 mb-1">{showToast.message}</div>
        <button onClick={() => setShowToast(null)} className="text-xs bg-white/10 text-pink-400 font-bold rounded-xl px-4 py-1 mt-1 hover:bg-pink-600/10 transition">إغلاق</button>
      </div>
    </div>
  );

  function getNotifIcon(n: Notification) {
    if(n.type === 'behavior') return <AlertTriangle className="w-6 h-6 text-red-400"/>;
    if(n.type === 'attendance') return <CheckCircle className="w-6 h-6 text-amber-400"/>;
    if(n.type === 'general' || n.type === 'announcement') return <Bell className="w-6 h-6 text-primary-400 "/>;
    if(n.type === 'command') return <Settings className="w-6 h-6 text-pink-500"/>;
    return <Bell className="w-6 h-6 text-primary-400" />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {Toast}
      
      {/* --- Multi-Child Selector --- */}
      {children.length > 1 && (
        <div className="glass-card p-4 rounded-2xl flex justify-between items-center relative z-20">
            <label className="text-gray-400 text-sm font-medium">اختر الابن:</label>
            <div className="relative w-64">
                <select 
                    className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 appearance-none text-white focus:border-primary-500 outline-none"
                    value={selectedChild.id}
                    onChange={(e) => {
                        const child = children.find(c => c.id === e.target.value);
                        if (child) setSelectedChild(child);
                    }}
                >
                    {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
        </div>
      )}

      {/* --- Student Profile Header --- */}
      <div className="relative rounded-[2.5rem] p-8 overflow-hidden group shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-slate-900 to-secondary-900 opacity-90 transition-opacity"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500 opacity-10 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary-500 opacity-10 rounded-full blur-[80px]"></div>
        
        <div className="relative z-10 flex items-center gap-8">
            <div className="w-24 h-24 glass rounded-3xl flex items-center justify-center text-4xl border border-white/20 shadow-xl">
                <span className="font-serif pt-2 text-white drop-shadow-md">{selectedChild.name.charAt(0)}</span>
            </div>
            <div>
                <h2 className="text-3xl font-bold font-serif text-white mb-2">{selectedChild.name}</h2>
                <div className="flex flex-wrap gap-2 text-sm text-gray-300">
                    <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/10">
                        {selectedChild.className} - {selectedChild.section}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-white/10 border border-white/10 font-mono">
                        #{selectedChild.id}
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* --- Tabs --- */}
      <div className="flex overflow-x-auto gap-2 py-2">
          {[
              { id: 'attendance', label: 'سجل الحضور', icon: Calendar },
              { id: 'exits', label: 'الاستئذان', icon: DoorOpen },
              { id: 'violations', label: 'السلوك', icon: AlertTriangle },
              { id: 'notifications', label: 'الإشعارات', icon: Bell },
          ].map(tab => (
              <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl whitespace-nowrap font-medium transition-all ${
                      activeTab === tab.id 
                      ? 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-lg' 
                      : 'glass text-gray-400 hover:bg-white/10'
                  }`}
              >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
              </button>
          ))}
      </div>

      {/* --- Content Area --- */}
      <div className="min-h-[400px]">
          {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary-400" /></div>
          ) : (
            <>
                {/* 1. Attendance Tab */}
                {activeTab === 'attendance' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="glass-card p-4 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-emerald-400 font-mono">{attendance.filter(a => a.status === 'present').length}</div>
                                <div className="text-xs text-gray-400">حضور</div>
                            </div>
                            <div className="glass-card p-4 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-amber-400 font-mono">{attendance.filter(a => a.status === 'late').length}</div>
                                <div className="text-xs text-gray-400">تأخر</div>
                            </div>
                            <div className="glass-card p-4 rounded-2xl text-center">
                                <div className="text-2xl font-bold text-red-400 font-mono">{attendance.filter(a => a.status === 'absent').length}</div>
                                <div className="text-xs text-gray-400">غياب</div>
                            </div>
                        </div>

                        <div className="glass-card rounded-2xl overflow-hidden">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-white/5 text-gray-400 border-b border-white/5">
                                    <tr>
                                        <th className="p-4">التاريخ</th>
                                        <th className="p-4">الوقت</th>
                                        <th className="p-4">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-gray-300">
                                    {attendance.map(record => (
                                        <tr key={record.id} className="hover:bg-white/5">
                                            <td className="p-4 font-mono">{record.date}</td>
                                            <td className="p-4 font-mono">{new Date(record.timestamp).toLocaleTimeString('ar-SA')}</td>
                                            <td className="p-4">
                                                {record.status === 'present' && <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> حضور</span>}
                                                {record.status === 'late' && <span className="text-amber-400 flex items-center gap-1"><Clock className="w-3 h-3"/> متأخر</span>}
                                            </td>
                                        </tr>
                                    ))}
                                    {attendance.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-500">لا يوجد سجلات</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 2. Exits Tab */}
                {activeTab === 'exits' && (
                    <div className="glass-card rounded-2xl overflow-hidden">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-white/5 text-gray-400 border-b border-white/5">
                                <tr>
                                    <th className="p-4">تاريخ الخروج</th>
                                    <th className="p-4">السبب</th>
                                    <th className="p-4">المشرف</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {exits.map(exit => (
                                    <tr key={exit.id} className="hover:bg-white/5">
                                        <td className="p-4 font-mono">{new Date(exit.exit_time).toLocaleString('ar-SA')}</td>
                                        <td className="p-4">{exit.reason}</td>
                                        <td className="p-4 text-xs text-gray-500">مشرف الفترة</td>
                                    </tr>
                                ))}
                                {exits.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-500">لا يوجد سجلات استئذان</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* 3. Violations Tab */}
                {activeTab === 'violations' && (
                    <div className="space-y-4">
                        {violations.map(v => (
                            <div key={v.id} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 text-red-300 font-bold">
                                        <AlertTriangle className="w-5 h-5" />
                                        {v.type}
                                    </div>
                                    <span className="text-xs font-mono text-red-400 opacity-70">{new Date(v.created_at).toLocaleDateString('ar-SA')}</span>
                                </div>
                                <p className="text-gray-300 text-sm leading-relaxed bg-black/20 p-3 rounded-lg border border-red-500/10">
                                    {v.description}
                                </p>
                                <div className="mt-3 flex justify-end">
                                    <span className="text-xs bg-red-500/20 text-red-300 px-3 py-1 rounded-full border border-red-500/20">
                                        مستوى: {v.level}
                                    </span>
                                </div>
                            </div>
                        ))}
                         {violations.length === 0 && (
                             <div className="glass-card p-10 text-center flex flex-col items-center gap-4 text-gray-500">
                                 <CheckCircle className="w-12 h-12 text-emerald-500/20" />
                                 سجل الطالب نظيف وخالي من المخالفات
                             </div>
                         )}
                    </div>
                )}

                {/* 4. Notifications Tab */}
                {activeTab === 'notifications' && (
                    <div className="space-y-4">
                        {notifications.map(notif => {
                            let borderColor = 'border-blue-500/20';
                            let iconColor = 'text-blue-400';
                            let bgColor = 'bg-blue-500/5';
                            
                            if (notif.type === 'behavior') { // Admin/Urgent usually behavior related
                                borderColor = 'border-red-500/30';
                                iconColor = 'text-red-400';
                                bgColor = 'bg-red-500/10';
                            } else if (notif.type === 'attendance') { // Supervisor usually attendance
                                borderColor = 'border-amber-500/30';
                                iconColor = 'text-amber-400';
                                bgColor = 'bg-amber-500/10';
                            }

                            return (
                                <div key={notif.id} className={`relative glass-card p-6 rounded-2xl border ${borderColor} ${bgColor} overflow-hidden`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <h4 className={`font-bold ${iconColor} flex items-center gap-2`}>
                                            <Bell className="w-4 h-4" />
                                            {notif.type === 'behavior' ? 'تنبيه إداري' : notif.type === 'attendance' ? 'تنبيه مشرف' : 'إشعار عام'}
                                        </h4>
                                        <span className="text-xs text-gray-500 font-mono">{new Date(notif.created_at).toLocaleDateString('ar-SA')}</span>
                                    </div>
                                    <p className="text-gray-300 text-sm leading-relaxed">
                                        {notif.message}
                                    </p>
                                </div>
                            );
                        })}
                        {notifications.length === 0 && (
                             <div className="glass-card p-10 text-center text-gray-500">
                                 لا توجد إشعارات جديدة
                             </div>
                         )}
                    </div>
                )}
            </>
          )}
      </div>

    </div>
  );
};

export default Parents;
