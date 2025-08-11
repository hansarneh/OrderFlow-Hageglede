import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  Loader2,
  RefreshCw,
  Download,
  Upload,
  Database,
  Zap,
  Calendar,
  Clock,
  Package,
  ShoppingCart,
  Truck,
  FileText,
  ExternalLink,
  Trash2,
  Plus,
  Users,
  User,
  Play,
  Key,
  Info,
  Wrench,
  Bug
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getIntegrations, saveIntegration } from '../../lib/firebaseUtils';
import InitialSyncTab from './InitialSyncTab';
import DebugTab from './DebugTab';

interface WooCommerceCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

interface RackbeatCredentials {
  apiKey: string;
}

interface OngoingWMSCredentials {
  username: string;
  password: string;
  baseUrl: string;
}

const SettingsTab: React.FC = () => {
  const { user, users, addUser, updateUser, deleteUser, refreshUsers } = useAuth();
  const [activeSection, setActiveSection] = useState('integrations');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // User management state
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
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

  // WooCommerce form state
  const [wooCommerceForm, setWooCommerceForm] = useState<WooCommerceCredentials>({
    storeUrl: '',
    consumerKey: '',
    consumerSecret: ''
  });

  // Rackbeat form state
  const [rackbeatForm, setRackbeatForm] = useState<RackbeatCredentials>({
    apiKey: ''
  });

  // Ongoing WMS form state
  const [ongoingWMSForm, setOngoingWMSForm] = useState<OngoingWMSCredentials>({
    username: '',
    password: '',
    baseUrl: ''
  });

  // Load integrations and users on component mount
  useEffect(() => {
    loadIntegrations();
    refreshUsers();
  }, []);

  const loadIntegrations = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const integrations = await getIntegrations(user.id);

      // Populate forms with existing data
      const wooCommerce = integrations.find(i => i.integrationType === 'woocommerce');
      if (wooCommerce) {
        setWooCommerceForm(wooCommerce.credentials);
      }

      const rackbeat = integrations.find(i => i.integrationType === 'rackbeat');
      if (rackbeat) {
        setRackbeatForm(rackbeat.credentials);
      }

      const ongoingWMS = integrations.find(i => i.integrationType === 'ongoing_wms');
      if (ongoingWMS) {
        setOngoingWMSForm(ongoingWMS.credentials);
      }

    } catch (err: any) {
      console.error('Error loading integrations:', err);
      setError(err.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const saveIntegrationData = async (type: string, credentials: any) => {
    if (!user?.id) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await saveIntegration(user.id, type, credentials);

      setSuccess(`${type} integration saved successfully!`);
      await loadIntegrations();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error('Error saving integration:', err);
      setError(err.message || 'Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleWooCommerceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveIntegrationData('woocommerce', wooCommerceForm);
  };

  const handleRackbeatSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveIntegrationData('rackbeat', rackbeatForm);
  };

  const handleOngoingWMSSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveIntegrationData('ongoing_wms', ongoingWMSForm);
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // User management functions
  const resetUserForm = () => {
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

  const closeUserModal = () => {
    console.log('closeUserModal: Closing modal and resetting form');
    setShowAddUserModal(false);
    resetUserForm();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleAddUser: Starting user creation process');
    
    if (!newUser.password) {
      console.log('handleAddUser: Password is required');
      alert('Password is required');
      return;
    }

    if (newUser.password.length < 6) {
      console.log('handleAddUser: Password must be at least 6 characters');
      alert('Password must be at least 6 characters long');
      return;
    }

    console.log('handleAddUser: Setting isSubmitting to true');
    setIsSubmitting(true);

    try {
      console.log('handleAddUser: Calling addUser function with:', { ...newUser, password: '***' });
      const success = await addUser(newUser);
      console.log('handleAddUser: addUser function returned:', success);
      
      if (success) {
        console.log('handleAddUser: User created successfully, showing alert');
        alert('User created successfully!');
        console.log('handleAddUser: Alert dismissed, calling closeUserModal');
        closeUserModal();
        console.log('handleAddUser: Modal should be closed now');
      } else {
        console.log('handleAddUser: addUser returned false, showing error');
        alert('Failed to create user.');
      }
    } catch (error: any) {
      console.error('handleAddUser: Error caught:', error);
      alert(`Error creating user: ${error.message || error}`);
    } finally {
      console.log('handleAddUser: Finally block, setting isSubmitting to false');
      setIsSubmitting(false);
      console.log('handleAddUser: isSubmitting should now be false');
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setShowAddUserModal(true);
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
        closeUserModal();
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

  const menuItems = [
    { id: 'integrations', label: 'Integrations', icon: Settings },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'initial-sync', label: 'Initial Sync', icon: Play },
    { id: 'debug', label: 'Debug', icon: Bug }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Configure integrations and manage users</p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div className="text-red-800 text-sm whitespace-pre-line">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="text-green-800 text-sm">{success}</div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center space-x-2 ${
                    activeSection === item.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      {activeSection === 'integrations' && (
        <div className="space-y-6">
          {/* WooCommerce Integration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">WooCommerce Integration</h3>
                <p className="text-sm text-gray-600">Connect your WooCommerce store to sync products and orders</p>
              </div>
            </div>

            <form onSubmit={handleWooCommerceSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Store URL</label>
                <input
                  type="url"
                  value={wooCommerceForm.storeUrl}
                  onChange={(e) => setWooCommerceForm({ ...wooCommerceForm, storeUrl: e.target.value })}
                  placeholder="https://yourstore.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Consumer Key</label>
                <div className="relative">
                  <input
                    type={showPasswords.wooConsumerKey ? "text" : "password"}
                    value={wooCommerceForm.consumerKey}
                    onChange={(e) => setWooCommerceForm({ ...wooCommerceForm, consumerKey: e.target.value })}
                    placeholder="ck_..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('wooConsumerKey')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.wooConsumerKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Consumer Secret</label>
                <div className="relative">
                  <input
                    type={showPasswords.wooConsumerSecret ? "text" : "password"}
                    value={wooCommerceForm.consumerSecret}
                    onChange={(e) => setWooCommerceForm({ ...wooCommerceForm, consumerSecret: e.target.value })}
                    placeholder="cs_..."
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('wooConsumerSecret')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.wooConsumerSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save WooCommerce Settings'}</span>
              </button>
            </form>
          </div>

          {/* Rackbeat Integration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Rackbeat Integration</h3>
                <p className="text-sm text-gray-600">Connect your Rackbeat account to sync purchase orders</p>
              </div>
            </div>

            <form onSubmit={handleRackbeatSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                <div className="relative">
                  <input
                    type={showPasswords.rackbeatApiKey ? "text" : "password"}
                    value={rackbeatForm.apiKey}
                    onChange={(e) => setRackbeatForm({ ...rackbeatForm, apiKey: e.target.value })}
                    placeholder="Your Rackbeat API key"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('rackbeatApiKey')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.rackbeatApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save Rackbeat Settings'}</span>
              </button>
            </form>
          </div>

          {/* Ongoing WMS Integration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ongoing WMS Integration</h3>
                <p className="text-sm text-gray-600">Connect your Ongoing WMS system to sync orders and inventory</p>
              </div>
            </div>

            <form onSubmit={handleOngoingWMSSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Base URL</label>
                <input
                  type="url"
                  value={ongoingWMSForm.baseUrl}
                  onChange={(e) => setOngoingWMSForm({ ...ongoingWMSForm, baseUrl: e.target.value })}
                  placeholder="https://api.ongoingsystems.se/Spedify/api/v1/"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <input
                  type="text"
                  value={ongoingWMSForm.username}
                  onChange={(e) => setOngoingWMSForm({ ...ongoingWMSForm, username: e.target.value })}
                  placeholder="Your Ongoing WMS username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPasswords.ongoingWMSPassword ? "text" : "password"}
                    value={ongoingWMSForm.password}
                    onChange={(e) => setOngoingWMSForm({ ...ongoingWMSForm, password: e.target.value })}
                    placeholder="Your Ongoing WMS password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('ongoingWMSPassword')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords.ongoingWMSPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save Ongoing WMS Settings'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {activeSection === 'users' && (
        <div className="space-y-6">
          {/* User Management */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
                  <p className="text-sm text-gray-600">Manage system users and their permissions</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddUserModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add User</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">User</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Login</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-4 px-4">
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
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-700">{user.department}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-1 text-sm text-gray-700">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span>{formatLastLogin(user.lastLogin)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="text-gray-500 hover:text-blue-600 transition-colors duration-200"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-gray-500 hover:text-red-600 transition-colors duration-200"
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
        </div>
      )}

      {activeSection === 'initial-sync' && <InitialSyncTab />}
      {activeSection === 'debug' && <DebugTab />}

      {/* Add/Edit User Modal */}
      {showAddUserModal && (
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
                  onClick={closeUserModal}
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

export default SettingsTab;