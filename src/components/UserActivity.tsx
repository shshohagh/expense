import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { History, Clock, Activity, AlertCircle } from 'lucide-react';

interface ActivityLog {
  userEmail: string;
  action: string;
  details: string;
  created_at: string;
}

export default function UserActivity() {
  const { token } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/user/activity', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch activities');
      const data = await res.json();
      setActivities(data);
    } catch (err) {
      setError('Could not load activity log');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <Activity className="text-blue-500" size={18} />;
      case 'ADD_TRANSACTION': return <Activity className="text-emerald-500" size={18} />;
      case 'UPDATE_TRANSACTION': return <Activity className="text-amber-500" size={18} />;
      case 'DELETE_TRANSACTION': return <Activity className="text-rose-500" size={18} />;
      case 'ADD_RECURRING': return <Activity className="text-emerald-500" size={18} />;
      case 'UPDATE_RECURRING': return <Activity className="text-amber-500" size={18} />;
      case 'DELETE_RECURRING': return <Activity className="text-rose-500" size={18} />;
      case 'UPDATE_PROFILE': return <Activity className="text-purple-500" size={18} />;
      case 'ADD_CATEGORY': return <Activity className="text-indigo-500" size={18} />;
      case 'DELETE_CATEGORY': return <Activity className="text-rose-500" size={18} />;
      default: return <Activity className="text-zinc-500" size={18} />;
    }
  };

  const formatAction = (action: string) => {
    return action.split('_').map(word => word.charAt(0) + word.slice(1).toLowerCase()).join(' ');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground">Track your recent actions and account changes.</p>
      </header>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-600">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
              <History size={32} className="text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No recent activity found.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {activities.map((activity, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 flex items-start gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="mt-1 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                  {getActionIcon(activity.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{formatAction(activity.action)}</p>
                      <span className="text-[10px] text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded uppercase font-medium">
                        {activity.userEmail}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <Clock size={12} />
                      {new Date(activity.created_at).toLocaleString()}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{activity.details}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
