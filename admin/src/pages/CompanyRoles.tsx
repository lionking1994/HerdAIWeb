import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Plus, Users, TreePine } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import OrganizationModal from '../components/OrganizationModal';
import ConfirmModal from '../components/ConfirmModal';
import RoleForm from '../components/RoleForm';
import RoleTable from '../components/RoleTable';
import HierarchyBuilder from '../components/HierarchyBuilder';
import LoadingStates from '../components/LoadingStates';

interface CompanyRole {
  id: string;
  name: string;
  description: string;
  meeting_weight: number;
  top_meeting_count: number;
  research_review_weight: number;
  research_review_top_count: number;
  task_weight: number;
  task_top_count: number;
  rating_given_weight: number;
  rating_given_top_count: number;
  est_cph?: number;
  parent_role_id?: number;
  hierarchy_level?: number;
  sort_order?: number;
  parent_name?: string;
  children?: CompanyRole[];
}

const CompanyRoles: React.FC = () => {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company');
  const { } = useAuth();
  
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [hierarchyRoles, setHierarchyRoles] = useState<CompanyRole[]>([]);
  const [organizations, setOrganizations] = useState<Array<{ id: number; name: string; description?: string; is_active: boolean }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<{ id?: number; name: string; description: string; is_active: boolean } | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [company, setCompany] = useState<{ default_cph?: number } | null>(null);
  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; description?: string; onConfirm?: () => void }>(() => ({ open: false, title: '' }));
  
  
  const [newRole, setNewRole] = useState<Partial<CompanyRole>>({
    name: '',
    description: '',
    meeting_weight: 1,
    top_meeting_count: 5,
    research_review_weight: 1,
    research_review_top_count: 5,
    task_weight: 1,
    task_top_count: 5,
    rating_given_weight: 1,
    rating_given_top_count: 5,
    est_cph: undefined,
  });


  useEffect(() => {
    if (companyId) {
      initializePageData();
    }
  }, [companyId]);

  // Coordinated initial load so hierarchy builds correctly on first refresh
  const initializePageData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const bootstrap = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company/bootstrap/${companyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!bootstrap.data?.success) throw new Error('Bootstrap failed');

      const { company: companyData, roles: rolesData, organizations: orgs, firstOrganizationId, firstOrgRoleTree } = bootstrap.data;

      setCompany(companyData);
      setNewRole(prev => ({ ...prev, est_cph: companyData?.default_cph }));
      setRoles(rolesData || []);
      setOrganizations(orgs || []);
      if (firstOrganizationId) {
        setSelectedOrgId(firstOrganizationId);
        await buildHierarchyFromFlatTree(firstOrgRoleTree, rolesData || []);
      } else {
        setHierarchyRoles([]);
      }
    } catch (error) {
      console.error('Error initializing page data:', error);
      toast.error('Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  };

  // (company details are loaded via initializePageData bootstrap)

  const fetchOrganizations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/organizations/${companyId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setOrganizations(res.data.organizations || []);
        const first = (res.data.organizations || [])[0];
        if (first) setSelectedOrgId(first.id);
      }
    } catch (err) {
      console.error('Error fetching organizations', err);
    }
  };

  const handleCreateOrganization = async () => {
    if (!editingOrg?.name.trim()) {
      toast.error('Organization name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/organizations`,
        {
          company_id: companyId,
          name: editingOrg.name,
          description: editingOrg.description,
          is_active: editingOrg.is_active
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Organization created successfully');
        setShowOrgModal(false);
        setEditingOrg(null);
        await fetchOrganizations();
        // If we have the new organization ID, fetch its hierarchy and select it
        if (response.data.organization?.id) {
          setSelectedOrgId(response.data.organization.id);
          await fetchHierarchy(response.data.organization.id);
        }
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      toast.error('Failed to create organization');
    }
  };

  const handleUpdateOrganization = async () => {
    if (!editingOrg?.id || !editingOrg?.name.trim()) {
      toast.error('Organization name is required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/organizations/${editingOrg.id}`,
        {
          name: editingOrg.name,
          description: editingOrg.description,
          is_active: editingOrg.is_active
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        toast.success('Organization updated successfully');
        setShowOrgModal(false);
        setEditingOrg(null);
        await fetchOrganizations();
      }
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Failed to update organization');
    }
  };

  const handleDeleteOrganization = async (orgId: number) => {
    setConfirmState({
      open: true,
      title: 'Delete organization?',
      description: 'This will also delete all role hierarchies within it.',
      onConfirm: async () => {
        try {
          const previousOrgs = [...organizations];
          const token = localStorage.getItem('token');
          const response = await axios.delete(
            `${import.meta.env.VITE_API_BASE_URL}/organizations/${orgId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
  
          if (response.data.success) {
            toast.success('Organization deleted successfully');
            // Reload orgs and select the next one
            const orgsRes = await axios.get(
              `${import.meta.env.VITE_API_BASE_URL}/organizations/${companyId}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (orgsRes.data.success) {
              const newOrgs = orgsRes.data.organizations || [];
              setOrganizations(newOrgs);
              if (newOrgs.length > 0) {
                const deletedIdx = previousOrgs.findIndex(o => o.id === orgId);
                const pickIdx = Math.min(Math.max(deletedIdx, 0), newOrgs.length - 1);
                const next = newOrgs[pickIdx];
                setSelectedOrgId(next.id);
                await fetchHierarchy(next.id);
              } else {
                setSelectedOrgId(null);
                setHierarchyRoles([]);
              }
            }
          }
        } catch (error) {
          console.error('Error deleting organization:', error);
          toast.error('Failed to delete organization');
        } finally {
          setConfirmState({ open: false, title: '' });
        }
      }
    });
  };

  const openOrgModal = (org?: { id: number; name: string; description?: string; is_active: boolean }) => {
    setEditingOrg(org ? { ...org, description: org.description || '' } : { name: '', description: '', is_active: true });
    setShowOrgModal(true);
  };

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/company-roles/${companyId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        setRoles(response.data.roles);
      } else {
        toast.error('Failed to fetch company roles');
      }
    } catch (error) {
      console.error('Error fetching company roles:', error);
      toast.error('Failed to fetch company roles');
    } finally {
      setIsLoading(false);
    }
  };

  const buildHierarchyFromFlatTree = async (flatNodes: Array<{ id: number; role_id: number; parent_node_id: number | null; sort_order: number; depth_level: number }>, rolesOverride?: CompanyRole[]) => {
    const effectiveRoles = rolesOverride && rolesOverride.length ? rolesOverride : roles;
    const roleById = new Map(effectiveRoles.map(r => [Number(r.id), r]));
    const nodeById = new Map<number, CompanyRole>();
    const roots: CompanyRole[] = [];
    for (const n of flatNodes) {
      const role = roleById.get(Number(n.role_id));
      if (!role) continue;
      const node: CompanyRole = { ...role, id: String(role.id), hierarchy_level: n.depth_level, sort_order: n.sort_order, children: [] };
      nodeById.set(n.id, node);
    }
    for (const n of flatNodes) {
      const node = nodeById.get(n.id);
      if (!node) continue;
      if (n.parent_node_id) {
        const parent = nodeById.get(n.parent_node_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }
    const sortTree = (arr: CompanyRole[]) => {
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      arr.forEach(c => c.children && sortTree(c.children));
    };
    sortTree(roots);
    setHierarchyRoles(roots);
    const ids: string[] = [];
    const collect = (nodes: CompanyRole[]) => nodes.forEach(n => { ids.push(n.id); n.children && collect(n.children); });
    collect(roots);
    setExpandedNodes(new Set(ids));
  };

  const fetchHierarchy = async (orgId: number, rolesOverride?: CompanyRole[]) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/organizations/${orgId}/role-tree`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        const flat = response.data.nodes as Array<{ id: number; role_id: number; parent_node_id: number | null; sort_order: number; depth_level: number }>;
        await buildHierarchyFromFlatTree(flat, rolesOverride);
      }
    } catch (error) {
      console.error('Error fetching role tree', error);
    }
  };

  const flattenTreeForSave = (nodes: CompanyRole[]) => {
    const out: Array<{ role_id: number; parent_node_id: number | null; sort_order: number; depth_level: number }>=[];
    const walk = (arr: CompanyRole[], parentRoleId: number | null, depth: number) => {
      arr.forEach((n, idx) => {
        out.push({ role_id: Number(n.id), parent_node_id: parentRoleId, sort_order: idx, depth_level: depth });
        if (n.children && n.children.length) walk(n.children, Number(n.id), depth + 1);
      });
    };
    walk(nodes, null, 0);
    return out;
  };

  const persistTree = async () => {
    if (!selectedOrgId) return;
    try {
      const token = localStorage.getItem('token');
      const payload = { nodes: flattenTreeForSave(hierarchyRoles) };
      await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/organizations/${selectedOrgId}/role-tree`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Hierarchy saved');
      await fetchHierarchy(selectedOrgId);
    } catch (e) {
      console.error('Save role tree failed', e);
      toast.error('Failed to save hierarchy');
    }
  };

  const handleAddRole = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Prepare the request body, ensuring est_cph is properly handled
      const requestBody = {
        ...newRole,
        company_id: companyId
      };
      
      console.log('Adding role with data:', requestBody); // Debug log
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/company-roles`,
        requestBody,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        toast.success('Company role added successfully');
        setRoles([...roles, response.data.role]);
        setIsAddingRole(false);
        setNewRole({
          name: '',
          description: '',
          meeting_weight: 1,
          top_meeting_count: 5,
          research_review_weight: 1,
          research_review_top_count: 5,
          task_weight: 1,
          task_top_count: 5,
          rating_given_weight: 1,
          rating_given_top_count: 5,
          est_cph: company?.default_cph, // Pre-populate with company default
        });
      } else {
        toast.error('Failed to add company role');
      }
    } catch (error) {
      console.error('Error adding company role:', error);
      toast.error('Failed to add company role');
    }
  };

  const handleUpdateRole = async (roleId: string) => {
    try {
      const roleToUpdate = roles.find(role => role.id === roleId);
      if (!roleToUpdate) return;
      
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE_URL}/company-roles/${roleId}`,
        roleToUpdate,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (response.data.success) {
        toast.success('Company role updated successfully');
        setEditingRoleId(null);
        fetchRoles(); // Refresh the roles list
      } else {
        toast.error('Failed to update company role');
      }
    } catch (error) {
      console.error('Error updating company role:', error);
      toast.error('Failed to update company role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setConfirmState({
      open: true,
      title: 'Delete role?',
      description: 'This action cannot be undone.',
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.delete(
            `${import.meta.env.VITE_API_BASE_URL}/company-roles/${roleId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (response.data.success) {
            toast.success('Company role deleted successfully');
            setRoles(roles.filter(role => role.id !== roleId));
          } else {
            toast.error('Failed to delete company role');
          }
        } catch (error) {
          console.error('Error deleting company role:', error);
          toast.error('Failed to delete company role');
        } finally {
          setConfirmState({ open: false, title: '' });
        }
      }
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: keyof CompanyRole,
    roleId?: string
  ) => {
    let value: string | number;
    
    if (e.target.type === 'number') {
      // Handle est_cph as decimal, others as integer
      if (field === 'est_cph') {
        value = e.target.value === '' ? '' : parseFloat(e.target.value);
      } else {
        value = e.target.value === '' ? 0 : parseInt(e.target.value);
      }
    } else {
      value = e.target.value;
    }
    
    if (roleId) {
      // Update existing role
      setRoles(roles.map(role => 
        role.id === roleId ? { ...role, [field]: value } : role
      ));
    } else {
      // Update new role
      setNewRole({ ...newRole, [field]: value });
    }
  };

  // Tree manipulation handlers
  const handleAddRoleToHierarchy = (roleId: string, parentId?: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return;

    const newRole: CompanyRole = { ...role, children: [] };
    const nextTree = [...hierarchyRoles];

    if (parentId) {
      // Add as child of parent
      const findAndAddChild = (arr: CompanyRole[]): boolean => {
        for (const node of arr) {
          if (node.id === parentId) {
            node.children = node.children || [];
            node.children.push(newRole);
            setExpandedNodes(prev => new Set(prev).add(parentId));
            return true;
          }
          if (node.children && findAndAddChild(node.children)) {
            return true;
          }
        }
        return false;
      };
      findAndAddChild(nextTree);
    } else {
      // Add to root
      nextTree.push(newRole);
    }

    setHierarchyRoles(nextTree);
  };

  const handleMoveRole = (roleId: string, direction: 'up' | 'down' | 'left' | 'right') => {
    const nextTree = [...hierarchyRoles];
    
    const findNode = (arr: CompanyRole[], id: string, parent?: CompanyRole, parentSiblings?: CompanyRole[]): { node: CompanyRole | null; parent: CompanyRole | null; siblings: CompanyRole[]; index: number; parentSiblings: CompanyRole[] } => {
      for (let i = 0; i < arr.length; i++) {
        const n = arr[i];
        if (n.id === id) return { node: n, parent: parent || null, siblings: arr, index: i, parentSiblings: parentSiblings || [] };
        if (n.children) {
          const res = findNode(n.children, id, n, arr);
          if (res.node) return res;
        }
      }
      return { node: null, parent: null, siblings: [], index: -1, parentSiblings: [] };
    };

    const { node, parent, siblings, index, parentSiblings } = findNode(nextTree, roleId);
    if (!node || index === -1) return;

    switch (direction) {
      case 'up':
        if (index > 0) {
          [siblings[index], siblings[index - 1]] = [siblings[index - 1], siblings[index]];
        }
        break;
      case 'down':
        if (index < siblings.length - 1) {
          [siblings[index], siblings[index + 1]] = [siblings[index + 1], siblings[index]];
        }
        break;
      case 'left':
        if (parent) {
          // Move to parent's level
          const parentIndex = parentSiblings.findIndex((p: CompanyRole) => p.id === parent.id);
          siblings.splice(index, 1);
          parentSiblings.splice(parentIndex + 1, 0, node);
        }
        break;
      case 'right':
        if (index > 0) {
          // Move as child of previous sibling
          const prevSibling = siblings[index - 1];
          prevSibling.children = prevSibling.children || [];
          siblings.splice(index, 1);
          prevSibling.children.push(node);
          setExpandedNodes(prev => new Set(prev).add(prevSibling.id));
        }
        break;
    }

    setHierarchyRoles(nextTree);
  };

  const removeFromHierarchy = async (roleId: string) => {
    console.log("removeFromHierarchy", roleId, roles);
    const role = roles.find(r => r.id == roleId);
    if (!role) return;
    
    // if (!window.confirm(`Are you sure you want to remove "${role.name}" from the hierarchy? This action cannot be undone.`)) {
    //   return;
    // }
    // Remove locally; user will click Save to persist
    const removeNode = (arr: CompanyRole[]): boolean => {
      const idx = arr.findIndex(n => n.id === roleId);
      if (idx >= 0) { arr.splice(idx, 1); return true; }
      for (const n of arr) {
        if (n.children && removeNode(n.children)) return true;
      }
      return false;
    };
    const next = [...hierarchyRoles];
    removeNode(next);
    setHierarchyRoles(next);
  };



  return (
    <div className="container mx-auto p-4 md:p-6 flex-1 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Company Roles</h1>
      </div>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <TabsTrigger value="roles" className="flex items-center justify-center space-x-2 py-2 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-blue-400">
            <Users className="h-4 w-4" />
            <span>Manage Roles</span>
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="flex items-center justify-center space-x-2 py-2 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600 dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-blue-400">
            <TreePine className="h-4 w-4" />
            <span>Build Hierarchy</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-6">
          <div className="flex justify-end items-center mb-6">
            {!isAddingRole && (
              <Button
                onClick={() => setIsAddingRole(true)}
                className="flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Role
              </Button>
            )}
          </div>
          
          {isAddingRole && (
            <RoleForm
              role={newRole}
              companyDefaultCph={company?.default_cph}
              onInputChange={(field, value) => {
                setNewRole({ ...newRole, [field]: value });
              }}
              onSave={handleAddRole}
              onCancel={() => setIsAddingRole(false)}
            />
          )}
          
          <RoleTable
            roles={roles}
            editingRoleId={editingRoleId}
            isLoading={isLoading}
            onInputChange={handleInputChange}
            onEdit={setEditingRoleId}
            onUpdate={handleUpdateRole}
            onDelete={handleDeleteRole}
            onCancelEdit={() => setEditingRoleId(null)}
          />
        </TabsContent>

        <TabsContent value="hierarchy" className="mt-6">
          {isLoading ? (
            <LoadingStates type="hierarchy" />
          ) : (
            <HierarchyBuilder
              roles={roles}
              hierarchyRoles={hierarchyRoles}
              organizations={organizations}
              selectedOrgId={selectedOrgId}
              expandedNodes={expandedNodes}
              onOrganizationChange={async (orgId) => {
                setSelectedOrgId(orgId);
                if (orgId) await fetchHierarchy(orgId);
              }}
              onAddOrganization={() => openOrgModal()}
              onEditOrganization={openOrgModal}
              onDeleteOrganization={handleDeleteOrganization}
              onSaveHierarchy={persistTree}
              onToggleExpand={(roleId) => {
                setExpandedNodes(prev => {
                  const next = new Set(prev);
                  if (next.has(roleId)) next.delete(roleId); else next.add(roleId);
                  return next;
                });
              }}
              onRemoveFromHierarchy={removeFromHierarchy}
              onMoveRole={handleMoveRole}
              onAddRoleToHierarchy={handleAddRoleToHierarchy}
              flattenTreeForSave={flattenTreeForSave}
            />
          )}
        </TabsContent>
      </Tabs>

      <OrganizationModal
        isOpen={showOrgModal}
        organization={editingOrg}
        onClose={() => {
          setShowOrgModal(false);
          setEditingOrg(null);
        }}
        onSave={editingOrg?.id ? handleUpdateOrganization : handleCreateOrganization}
        onInputChange={(field, value) => {
          if (editingOrg) {
            setEditingOrg({ ...editingOrg, [field]: value });
          }
        }}
      />

      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger
        onConfirm={() => confirmState.onConfirm && confirmState.onConfirm()}
        onCancel={() => setConfirmState({ open: false, title: '' })}
      />
    </div>
  );
};

export default CompanyRoles;

