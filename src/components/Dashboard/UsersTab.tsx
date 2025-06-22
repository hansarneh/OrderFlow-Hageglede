import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  User, 
  Users,
  Shield,
  Clock,
  Edit3,
  Trash2,
  MoreVertical,
  Mail,
  Phone,
  MapPin,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth, User as UserType } from '../../contexts/AuthContext';

const UsersTab: React.FC = () => {
  const { users, addUser, updateUser, deleteUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'operator' as 'admin' | 'manager' | 'operator',
    department: '',
    status: 'active' as 'active' | 'inactive'
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-700 bg-red-100';
      case 'manager': return 'text-blue-700 bg-blue-100';
      case 'operator': return 'text-green-700 bg-green-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-700 bg-green-100';
      case 'inactive': return 'text-gray-700 bg-gray-100';
      default: return 'text-gray-700 bg-gray-100';
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const resetForm = () => {
    setNewUser({
      name: '',
      email: '',
      password: '',
      role: 'operator',
      department: '',
      status: 'active'
    });
    setEditingUser(null);
    setShowPassword(false);
    setIsSubmitting(false);
  };

  const closeModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUser.password) {
      alert('Password is required');
      return;
    }

    if (newUser.password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);

    try {
      const success = await addUser(newUser);
      if (success) {
        alert('User created successfully!');
        closeModal();
      }
    } catch (error: any) {
      alert(`Error creating user: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = (user: UserType) => {
    setEditingUser(user);
    setShowAddModal(true);
    setNewUser({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password for security
      role: user.role,
      department: user.department,
      status: user.status
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsSubmitting(true);

    try {
      const success = await updateUser(editingUser.id, {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        status: newUser.status
      });
      
      if (success) {
        alert('User updated successfully!');
        closeModal();
      }
    } catch (error: any) {
      alert(`Error updating user: ${error.message || error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        const success = await deleteUser(userId);
        if (success) {
          alert('User deleted successfully!');
        }
      } catch (error: any) {
        alert(`Error deleting user: ${error.message || error}`);
      }
    }
  };

  const formatLastLogin = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const activeUsers = users.filter(user => user.status === 'active').length;
  const adminUsers = users.filter(user => user.role === 'admin').length;
  const managerUsers = users.filter(user => user.role === 'manager').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Manage system users and their permissions</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{activeUsers}</p>
            </div>
            <User className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Administrators</p>
              <p className="text-2xl font-bold text-gray-900">{adminUsers}</p>
            </div>
            <Shield className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Managers</p>
              <p className="text-2xl font-bold text-gray-900">{managerUsers}</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="operator">Operator</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Department</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Login</th>
                <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-700">{user.department}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-1 text-sm text-gray-700">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{formatLastLogin(user.lastLogin)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="text-gray-500 hover:text-blue-600 transition-colors duration-200"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-gray-500 hover:text-red-600 transition-colors duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button className="text-gray-500 hover:text-gray-700 transition-colors duration-200">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
            </div>
            <form onSubmit={editingUser ? handleUpdateUser : handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      disabled={isSubmitting}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'manager' | 'operator' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="operator">Operator</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <input
                  type="text"
                  value={newUser.department}
                  onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={newUser.status}
                  onChange={(e) => setNewUser({ ...newUser, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Processing...' : (editingUser ? 'Update User' : 'Add User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersTab;