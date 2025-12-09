import { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';
import { CourseRoleRestriction } from '../../../types';
import { useSearchParams } from 'react-router-dom';

interface RoleSelectorProps {
  courseId: string;
  onClose: () => void;
  onUpdate: () => void; 
}

interface CompanyRole {
  id: string;
  name: string;
  description: string;
}

export function RoleSelector({ courseId, onClose, onUpdate }: RoleSelectorProps) {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [currentRestrictions, setCurrentRestrictions] = useState<CourseRoleRestriction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);



  useEffect(() => {
    loadData();
  }, [courseId, companyId]);

  const loadData = async () => {
    const token = localStorage.getItem('token');
    try {
      // Load course role restrictions
      const resp = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/lms/course-role-restrictions/${courseId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      if (!resp.ok) throw new Error('Failed to load data');

      const restrictionsData = await resp.json();
      console.log('Loaded restrictions data:', restrictionsData);
      setCurrentRestrictions(restrictionsData.restrictions || []);
      setSelectedRoles(restrictionsData?.roles?.map((r: any) => r));

      // Load company roles if companyId is present
      if (companyId) {
        await loadCompanyRoles();
      } else {
        // If no companyId, use default roles
        setRoles(defaultRoles);
      }
    } catch (error) {
      console.error('Error loading role data:', error);
      // Fallback to default roles if API fails
      setRoles(defaultRoles);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanyRoles = async () => {
    const token = localStorage.getItem('token');

    if (!companyId) {
      console.warn('⚠️ No company ID found, using default roles');
      setRoles(defaultRoles);
      return;
    }

    try {
      console.log('🔍 Fetching company roles for company ID:', companyId);

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/company-roles/${companyId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch company roles: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 Company Roles API Response:', data);

      if (data.success && Array.isArray(data.roles)) {
        const normalizedRoles: CompanyRole[] = data.roles.map((role: any) => ({
          id: String(role.id),
          name: role.name,
          description: role.description,
        }));

        setRoles(normalizedRoles);
      } else {
        console.warn('⚠️ No valid roles in API response, setting to empty array');
        setRoles([]);
      }
    } catch (error) {
      console.error('❌ Error fetching company roles:', error);
      // On error, fallback to empty array (not defaultRoles)
      setRoles([]);
    }
  };


  // Default roles to use as fallback when no companyId or API fails
  const defaultRoles: CompanyRole[] = [
    {
      id: 'padmin',
      name: 'Platform Admin',
      description: 'Can view course content and participate in discussions.'
    },
    {
      id: 'cadmin',
      name: 'Company Admin',
      description: 'Can manage course content and grades.'
    },
    {
      id: 'user',
      name: 'Platform User',
      description: 'Has full access to the course, including user management.'
    },
    {
      id: 'suser',
      name: 'Standard User',
      description: 'Can view course content but cannot participate in discussions or access grades.'
    }
  ];

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const token = localStorage.getItem('token');

      if (selectedRoles.length > 0) {
        const restrictions = selectedRoles.map(roleId => ({
          course_id: courseId,
          role_id: roleId
        }));


        const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL}/lms/course-role-restrictions/${courseId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`, // if you use JWT/session tokens
          },
          body: JSON.stringify({
            restrictions // now array of role names ["Admin", "Instructor", "Student"]
          })
        });

        if (!resp.ok) {
          throw new Error(`Error saving restrictions: ${resp.status}`);
        }

        const result = await resp.json();
        console.log('Save result:', result);

        onUpdate(); // refresh parent component
        onClose();  // close modal/drawer
      }


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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            Select which roles can access this course. If no roles are selected, the course will be available to everyone.
          </p>

          <div className="space-y-3">
            {roles.length === 0 && companyId ? (
              <div className="text-center p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="text-yellow-600 text-lg font-medium mb-2">
                  No Company Roles Found
                </div>
                <div className="text-yellow-700 text-sm">
                  Please create roles for your company before assigning course access.
                </div>
                <div className="text-yellow-600 text-xs mt-2">
                  You can create company roles in the Company Roles section.
                </div>
              </div>
            ) : (
              roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={() => handleRoleToggle(role.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 capitalize">{role.name}</div>
                    {/* {role.description && (
                      <div className="text-sm text-gray-500">{role.description}</div>
                    )} */}
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (roles.length === 0 && companyId)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}