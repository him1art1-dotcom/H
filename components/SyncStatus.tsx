import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, CheckCircle } from 'lucide-react';
import { db, SyncStatus as SyncStatusType } from '../services/db';

const SyncStatus: React.FC = () => {
  const [status, setStatus] = useState<SyncStatusType>('online');
  const [pendingCount, setPendingCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Initial status
    setStatus(db.getSyncStatus());
    setPendingCount(db.getPendingCount());

    // Subscribe to status changes
    const unsubscribe = db.onSyncStatusChange((newStatus) => {
      setStatus(newStatus);
      setPendingCount(db.getPendingCount());
    });

    // Periodic check for pending count
    const interval = setInterval(() => {
      setPendingCount(db.getPendingCount());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleForceSync = async () => {
    setIsRefreshing(true);
    try {
      await db.forceSyncNow();
    } catch (e) {
      console.error('Force sync failed:', e);
    }
    setIsRefreshing(false);
  };

  // Status configuration
  const statusConfig = {
    online: {
      icon: Cloud,
      text: 'متصل',
      bgClass: 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20',
      textClass: 'text-emerald-400',
      dotClass: 'bg-emerald-500',
      glowClass: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]'
    },
    offline: {
      icon: CloudOff,
      text: 'غير متصل',
      bgClass: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20',
      textClass: 'text-red-400',
      dotClass: 'bg-red-500',
      glowClass: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]'
    },
    syncing: {
      icon: RefreshCw,
      text: 'مزامنة...',
      bgClass: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20',
      textClass: 'text-amber-400',
      dotClass: 'bg-amber-500',
      glowClass: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]'
    }
  };

  const config = statusConfig[status];
  const Icon = isRefreshing ? RefreshCw : config.icon;

  return (
    <div className="relative">
      <button
        onClick={handleForceSync}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        disabled={isRefreshing}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md
          transition-all duration-300 cursor-pointer
          ${config.bgClass} ${config.glowClass}
          disabled:cursor-wait
        `}
      >
        {/* Status Dot */}
        <span className={`w-2 h-2 rounded-full ${config.dotClass} ${status === 'syncing' || isRefreshing ? 'animate-pulse' : ''}`}></span>
        
        {/* Icon */}
        <Icon className={`w-4 h-4 ${config.textClass} ${isRefreshing || status === 'syncing' ? 'animate-spin' : ''}`} />
        
        {/* Text */}
        <span className={`text-xs font-medium ${config.textClass}`}>
          {isRefreshing ? 'جاري التحديث...' : config.text}
        </span>

        {/* Pending Badge */}
        {pendingCount > 0 && (
          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full mt-2 right-0 z-50 animate-fade-in">
          <div className="bg-slate-800/95 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-xl min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              {status === 'online' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
              {status === 'offline' && <WifiOff className="w-4 h-4 text-red-400" />}
              {status === 'syncing' && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
              <span className="text-sm font-medium text-white">
                {status === 'online' && 'الاتصال نشط'}
                {status === 'offline' && 'لا يوجد اتصال'}
                {status === 'syncing' && 'جاري المزامنة'}
              </span>
            </div>
            
            <div className="text-xs text-gray-400 space-y-1">
              {pendingCount > 0 ? (
                <p className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  {pendingCount} سجل في انتظار المزامنة
                </p>
              ) : (
                <p className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  جميع البيانات محدثة
                </p>
              )}
              <p className="text-gray-500 mt-1">اضغط لتحديث البيانات</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncStatus;

