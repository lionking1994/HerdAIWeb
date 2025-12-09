import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export function useRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadRoles();
      loadUserRoles();
    }
  }, [user]);

  const loadRoles = async () => {
    try {
      const { data } = await supabase.from('user_roles').select('*').order('name');

      if (data) {
        setRoles(data);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  const loadUserRoles = async () => {
    try {
      const { data } = await supabase
        .from('user_role_assignments')
        .select(`
          *,
          user_roles (*)
        `)
        .eq('user_id', user?.id);

      if (data) {
        setUserRoles(data);
      }
    } catch (error) {
      console.error('Error loading user roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (roleName) => {
    return userRoles.some((assignment) => assignment.user_roles.name === roleName);
  };

  const isAdmin = () => hasRole('admin');
  const isInstructor = () => hasRole('instructor');
  const isStudent = () => hasRole('student');
  const isManager = () => hasRole('manager');

  return {
    roles,
    userRoles,
    loading,
    hasRole,
    isAdmin,
    isInstructor,
    isStudent,
    isManager,
    loadRoles,
    loadUserRoles,
  };
}


