import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';
import { Shield, User as UserIcon, Plus, Edit2, X, Eye, EyeOff, Lock, Check, AlertCircle, FileText, FileSpreadsheet, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  subscribeToUsers, 
  updateUserStatus, 
  subscribeToRolePermissions, 
  updateRolePermissions, 
  subscribeToAllActivityLogs,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  deleteRole,
  renameRole
} from '../services/firestoreService';

interface RolePermission {
  role: string;
  permissions: string[];
}

const AVAILABLE_PERMISSIONS = [
  { id: 'manage_users', label: 'Manage Users', description: 'Create, edit, and approve user accounts' },
  { id: 'manage_categories', label: 'Manage Categories', description: 'Create and edit income/expense categories' },
  { id: 'export_data', label: 'Export Data', description: 'Export transactions to CSV/Excel' },
  { id: 'view_admin_panel', label: 'View Admin Panel', description: 'Access to the admin dashboard' },
];

export default function AdminPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'permissions' | 'activity'>('users');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [renamingRole, setRenamingRole] = useState<{ oldName: string, newName: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    status: 'PENDING',
    phoneNumber: ''
  });

  useEffect(() => {
    if (currentUser?.role !== 'SUPER_ADMIN') return;

    const unsubUsers = subscribeToUsers((data) => {
      setUsers(data as User[]);
      setLoading(false);
    });

    const unsubPerms = subscribeToRolePermissions((data) => {
      setRolePermissions(data as RolePermission[]);
    });

    const unsubLogs = subscribeToAllActivityLogs((data) => {
      setActivities(data);
    });

    return () => {
      unsubUsers();
      unsubPerms();
      unsubLogs();
    };
  }, [currentUser?.role]);

  const handlePermissionToggle = async (role: string, permissionId: string) => {
    const rolePerm = rolePermissions.find(rp => (rp.role || (rp as any).id) === role);
    if (!rolePerm) return;

    const permissions = rolePerm.permissions || [];
    const newPermissions = permissions.includes(permissionId)
      ? permissions.filter(p => p !== permissionId)
      : [...permissions, permissionId];

    try {
      await updateRolePermissions(role, newPermissions);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return;
    const role = newRoleName.trim().toUpperCase();
    if (rolePermissions.some(rp => (rp.role || (rp as any).id) === role)) {
      setNotification({ message: 'Role already exists', type: 'error' });
      return;
    }

    try {
      await updateRolePermissions(role, []);
      setNewRoleName('');
      setIsAddingRole(false);
      setNotification({ message: 'Role added successfully', type: 'success' });
    } catch (error) {
      console.error(error);
      setNotification({ message: 'Failed to add role', type: 'error' });
    }
  };

  const handleDeleteRole = async (role: string) => {
    if (role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'USER') {
      setNotification({ message: 'Cannot delete core system roles', type: 'error' });
      return;
    }

    const userCount = users.filter(u => u.role === role).length;
    const message = userCount > 0 
      ? `There are ${userCount} users with this role. Deleting the role will not delete the users, but they will lose their permissions. Continue?`
      : `Are you sure you want to delete the role "${role}"?`;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Role',
      message,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteRole(role);
          setNotification({ message: 'Role deleted successfully', type: 'success' });
        } catch (error) {
          console.error(error);
          setNotification({ message: 'Failed to delete role', type: 'error' });
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRenameRole = async () => {
    if (!renamingRole || !renamingRole.newName.trim() || renamingRole.newName === renamingRole.oldName) {
      setRenamingRole(null);
      return;
    }

    const newRole = renamingRole.newName.trim().toUpperCase();
    if (rolePermissions.some(rp => (rp.role || (rp as any).id) === newRole)) {
      setNotification({ message: 'Role already exists', type: 'error' });
      return;
    }

    try {
      await renameRole(renamingRole.oldName, newRole);
      setRenamingRole(null);
      setNotification({ message: 'Role renamed successfully', type: 'success' });
    } catch (error) {
      console.error(error);
      setNotification({ message: 'Failed to rename role', type: 'error' });
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await updateUserStatus(id, status);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.role === 'SUPER_ADMIN') {
      setNotification({ message: 'Cannot delete a Super Admin', type: 'error' });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await adminDeleteUser(user.id.toString());
          setNotification({ message: 'User deleted successfully', type: 'success' });
        } catch (error) {
          console.error(error);
          setNotification({ message: 'Failed to delete user', type: 'error' });
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUser) {
        await adminUpdateUser(editingUser.id.toString(), {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status,
          phoneNumber: formData.phoneNumber
        });
      } else {
        // For new users, we generate a temporary ID
        const tempId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await adminCreateUser({
          id: tempId,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status,
          currency: 'USD',
          language: 'en',
          permissions: [],
          phoneNumber: formData.phoneNumber
        });
      }
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', password: '', role: 'USER', status: 'PENDING', phoneNumber: '' });
      setNotification({ message: editingUser ? 'User updated' : 'User created', type: 'success' });
    } catch (error) {
      console.error(error);
      setNotification({ message: 'Failed to save user', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
      phoneNumber: user.phoneNumber || ''
    });
    setIsModalOpen(true);
  };

  const exportUsersCSV = () => {
    const headers = ['Name', 'Email', 'Role', 'Status', 'Created At'];
    const data = users.map(u => [
      u.name,
      u.email,
      u.role,
      u.status,
      u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'
    ]);

    const csvContent = [headers, ...data].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `users_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportUsersExcel = () => {
    const data = users.map(u => ({
      Name: u.name,
      Email: u.email,
      Role: u.role,
      Status: u.status,
      'Created At': u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, `users_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (currentUser?.role !== 'SUPER_ADMIN') {
    return <div className="p-8 text-center">Access Denied.</div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
            <p className="text-muted-foreground">Manage users and permissions.</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'users' && (
              <>
                <div className="flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden mr-2">
                  <button
                    onClick={exportUsersCSV}
                    className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-r border-zinc-200 dark:border-zinc-800"
                    title="Export Users to CSV"
                  >
                    <FileText size={18} />
                  </button>
                  <button
                    onClick={exportUsersExcel}
                    className="p-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    title="Export Users to Excel"
                  >
                    <FileSpreadsheet size={18} />
                  </button>
                </div>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setFormData({ name: '', email: '', password: '', role: 'USER', status: 'PENDING' });
                    setIsModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                  <Plus size={18} /> Add
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-fit mb-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'users' 
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' 
                : 'text-muted-foreground hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'permissions' 
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' 
                : 'text-muted-foreground hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Role Permissions
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-6 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'activity' 
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' 
                : 'text-muted-foreground hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            System Activity
          </button>
        </div>

        {activeTab === 'permissions' && (
          <div className="flex items-center gap-2 mb-6">
            {isAddingRole ? (
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <input
                  type="text"
                  placeholder="Role Name (e.g. MANAGER)"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="px-3 py-1.5 text-sm bg-transparent focus:outline-none w-48"
                  autoFocus
                />
                <button
                  onClick={handleAddRole}
                  className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setIsAddingRole(false)}
                  className="p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingRole(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                <Plus size={18} />
                Add Role
              </button>
            )}
          </div>
        )}

        {activeTab === 'permissions' && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 mb-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Existing Roles in System</h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([
                'USER', 'ADMIN', 'SUPER_ADMIN',
                ...users.map(u => u.role),
                ...rolePermissions.map(rp => rp.role || (rp as any).id)
              ])).filter(Boolean).map(role => (
                <div key={role} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center gap-2 border border-zinc-200 dark:border-zinc-700">
                  <Shield size={14} className="text-zinc-500" />
                  <span className="text-sm font-semibold">{role}</span>
                  <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-500">
                    {users.filter(u => u.role === role).length} users
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      {activeTab === 'users' ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 overflow-hidden">
                          <UserIcon size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                          {u.phoneNumber && <p className="text-[10px] text-muted-foreground">{u.phoneNumber}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        u.role === 'SUPER_ADMIN' ? 'text-blue-600' : 
                        u.role === 'ADMIN' ? 'text-emerald-600' : 'text-zinc-500'
                      }`}>
                        {(u.role === 'SUPER_ADMIN' || u.role === 'ADMIN') && <Shield size={12} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        u.status === 'PENDING' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                        u.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' :
                        'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                          title="Edit User"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={u.role === 'SUPER_ADMIN'}
                          className={`p-2 transition-colors ${
                            u.role === 'SUPER_ADMIN' 
                              ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed' 
                              : 'text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400'
                          }`}
                          title={u.role === 'SUPER_ADMIN' ? 'Cannot delete Super Admin' : 'Delete User'}
                        >
                          <Trash2 size={18} />
                        </button>
                        <select
                          value={u.status}
                          onChange={(e) => handleStatusUpdate(u.id.toString(), e.target.value)}
                          className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="APPROVED">APPROVED</option>
                          <option value="REJECTED">REJECTED</option>
                          <option value="CANCEL">CANCEL</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'permissions' ? (
        <div className="space-y-6">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl flex gap-3">
            <AlertCircle className="text-amber-600 shrink-0" size={20} />
            <p className="text-sm text-amber-800 dark:text-amber-400">
              <strong>Note:</strong> SUPER_ADMIN always has full access regardless of these settings. Changes here affect all users with the specified role.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from(new Set([
              'USER', 'ADMIN',
              ...users.map(u => u.role),
              ...rolePermissions.map(rp => rp.role || (rp as any).id)
            ])).filter(role => role && role !== 'SUPER_ADMIN').map((roleName) => {
              const rp = rolePermissions.find(p => (p.role || (p as any).id) === roleName);
              return (
                <div key={roleName} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-lg">
                        <Lock size={18} />
                      </div>
                      {renamingRole?.oldName === roleName ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={renamingRole.newName}
                            onChange={(e) => setRenamingRole({ ...renamingRole, newName: e.target.value })}
                            className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-sm focus:outline-none"
                            autoFocus
                          />
                          <button onClick={handleRenameRole} className="p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded">
                            <Check size={16} />
                          </button>
                          <button onClick={() => setRenamingRole(null)} className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded">
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <h3 className="font-bold text-lg">{roleName} Permissions</h3>
                      )}
                    </div>
                    {roleName !== 'SUPER_ADMIN' && roleName !== 'ADMIN' && roleName !== 'USER' && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setRenamingRole({ oldName: roleName, newName: roleName })}
                          className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                          title="Rename Role"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteRole(roleName)}
                          className="p-2 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          title="Delete Role"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-6 space-y-4">
                    {AVAILABLE_PERMISSIONS.map((perm) => (
                      <div 
                        key={perm.id}
                        className="flex items-start justify-between gap-4 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-sm">{perm.label}</p>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </div>
                        <button
                          disabled={roleName === 'SUPER_ADMIN'}
                          onClick={() => handlePermissionToggle(roleName, perm.id)}
                          className={`w-10 h-6 rounded-full transition-all relative ${
                            (rp?.permissions || []).includes(perm.id) || roleName === 'SUPER_ADMIN'
                              ? 'bg-emerald-500' 
                              : 'bg-zinc-200 dark:bg-zinc-700'
                          } ${roleName === 'SUPER_ADMIN' ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                            (rp?.permissions || []).includes(perm.id) || roleName === 'SUPER_ADMIN' ? 'left-5' : 'left-1'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-bottom border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {activities.map((a, i) => (
                  <tr key={i} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{a.userName}</span>
                        <span className="text-xs text-muted-foreground">{a.userEmail}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold uppercase tracking-wider">
                        {a.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{a.details}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-8 right-8 z-[100] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border ${
              notification.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' :
              notification.type === 'error' ? 'bg-rose-500 border-rose-400 text-white' :
              'bg-zinc-900 border-zinc-800 text-white'
            }`}
          >
            {notification.type === 'success' ? <Check size={18} /> : 
             notification.type === 'error' ? <AlertCircle size={18} /> : <Shield size={18} />}
            <span className="font-medium">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </motion.div>
        )}

        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  confirmModal.type === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-600'
                }`}>
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-bold mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-muted-foreground mb-6">{confirmModal.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    className={`flex-1 px-4 py-2 rounded-xl font-medium text-white transition-opacity hover:opacity-90 ${
                      confirmModal.type === 'danger' ? 'bg-rose-600' : 'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900'
                    }`}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="text-xl font-bold">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    placeholder="+1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!editingUser}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                      <option value="CANCEL">CANCEL</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                  >
                    {editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
