import React, { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';

export function RoleSelector({ courseId, onClose, onUpdate }) {
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [currentRestrictions, setCurrentRestrictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const roles = [
    { id: '1', name: 'Company Admin', value: 'cadmin', description: 'System adminstrator with full access' },
    { id: '2', name: 'User', value: 'user', description: 'Course instructers who can create and manage course' },
    { id: '3', name: 'PLatform Admin', value: 'padmin', description: 'Managers who can oversee training programs' },
    { id: '4', name: 'Developer', value: 'developer', description: 'Regular users who can enroll in courses' },
  ];

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    let uid = undefined;
    try {
      const parsed = storedUser ? JSON.parse(storedUser) : null;
      uid = parsed?.id || parsed?.userId;
    } catch (_) {}
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(uid ? { 'x-user-id': uid } : {}),
      'Content-Type': 'application/json',
    };
  };

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    (async () => {
      try {
        const resp = await fetch(`${process.env.REACT_APP_API_URL}/lms/courses/${courseId}`, {
          headers: getAuthHeaders(),
        });
        if (!resp.ok) throw new Error('Failed to load role restrictions');
        const json = await resp.json();
        const restrictions = Array.isArray(json.roles) ? json.roles : [];
        setCurrentRestrictions(restrictions);
        const preselected = restrictions.map(r => String(r.role_id));
        setSelectedRoles(preselected);
      } catch (error) {
        console.error('Error loading role restrictions:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  const handleRoleToggle = (roleId) => {
    setSelectedRoles((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Compute diff
      const currentRoleIds = new Set(currentRestrictions.map(r => String(r.role_id)));
      const desiredRoleIds = new Set(selectedRoles.map(r => String(r)));

      const toAdd = [...desiredRoleIds].filter(id => !currentRoleIds.has(id));
      const toRemove = [...currentRoleIds].filter(id => !desiredRoleIds.has(id));

      // Apply removals
      for (const roleId of toRemove) {
        const delResp = await fetch(`${process.env.REACT_APP_API_URL}/lms/courses/${courseId}/roles/${roleId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (!delResp.ok) {
          console.error('Failed to remove role', roleId);
        }
      }

      // Apply additions
      for (const roleId of toAdd) {
        const addResp = await fetch(`${process.env.REACT_APP_API_URL}/lms/courses/${courseId}/roles`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ roleId }),
        });
        if (!addResp.ok) {
          console.error('Failed to add role', roleId);
        }
      }

      onUpdate?.();
      onClose?.();
    } catch (error) {
      console.error('Error saving role restrictions:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading roles...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Course Access Roles</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            Select which roles can access this course. If no roles are selected, the course will be available to everyone.
          </p>
          <div className="space-y-3">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role.id)}
                  onChange={() => handleRoleToggle(role.id)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 capitalize">{role.name}</div>
                  {role.description && <div className="text-sm text-gray-500">{role.description}</div>}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}


