import React, { useMemo } from 'react';
import { Button } from './ui/button';
import { Save, Plus, Edit, Trash, Building2, Users, GitBranch, CheckCircle2 } from 'lucide-react';
import { TreeItem } from './TreeItem';
import { HierarchySkeleton } from './LoadingStates';
import { flattenTree, TreeItems, FlattenedItem } from '../utils/treeUtils';

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

interface Organization {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

interface HierarchyBuilderProps {
  roles: CompanyRole[];
  hierarchyRoles: CompanyRole[];
  organizations: Organization[];
  selectedOrgId: number | null;
  expandedNodes: Set<string>;
  isLoading?: boolean;
  onOrganizationChange: (orgId: number | null) => void;
  onAddOrganization: () => void;
  onEditOrganization: (org: Organization) => void;
  onDeleteOrganization: (orgId: number) => void;
  onSaveHierarchy: () => void;
  onToggleExpand: (roleId: string) => void;
  onRemoveFromHierarchy: (roleId: string) => void;
  onMoveRole: (roleId: string, direction: 'up' | 'down' | 'left' | 'right') => void;
  onAddRoleToHierarchy: (roleId: string, parentId?: string) => void;
  flattenTreeForSave: (nodes: CompanyRole[]) => Array<{ role_id: number; parent_node_id: number | null; sort_order: number; depth_level: number }>;
}

const HierarchyBuilder: React.FC<HierarchyBuilderProps> = ({
  roles,
  hierarchyRoles,
  organizations,
  selectedOrgId,
  expandedNodes,
  isLoading = false,
  onOrganizationChange,
  onAddOrganization,
  onEditOrganization,
  onDeleteOrganization,
  onSaveHierarchy,
  onToggleExpand,
  onRemoveFromHierarchy,
  onMoveRole,
  onAddRoleToHierarchy,
  flattenTreeForSave,
}) => {
  // Convert hierarchy roles to tree format
  const treeItems: TreeItems = useMemo(() => {
    const convertRoleToTreeItem = (role: CompanyRole): TreeItems[0] => ({
      id: role.id,
      children: role.children ? role.children.map(convertRoleToTreeItem) : [],
      collapsed: !expandedNodes.has(role.id)
    });
    
    return hierarchyRoles.map(convertRoleToTreeItem);
  }, [hierarchyRoles, expandedNodes]);

  // Flatten tree for rendering
  const flattenedItems: FlattenedItem[] = useMemo(() => {
    return flattenTree(treeItems);
  }, [treeItems]);

  if (isLoading) {
    return <HierarchySkeleton />;
  }

  if (organizations.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Organizations</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Create your first organization to start building role hierarchies.
        </p>
        <Button onClick={onAddOrganization} className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Create Organization
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Organization branches header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Organization Branches</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">Manage multiple organizational structures</p>
        </div>
        <Button onClick={onAddOrganization} className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Branch
        </Button>
      </div>

      {/* Organization cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {organizations.map((org) => {
          const isSelected = selectedOrgId === org.id;
          const selectedClasses = isSelected ? 'ring-2 ring-blue-500 border-blue-400' : 'border-gray-200 dark:border-gray-700';
          return (
            <div
              key={org.id}
              className={`relative bg-white dark:bg-gray-800 border ${selectedClasses} rounded-lg p-4 shadow-sm cursor-pointer hover:shadow transition`}
              onClick={() => onOrganizationChange(org.id)}
            >
              {isSelected && (
                <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Selected
                </span>
              )}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{org.name}</div>
                    <div className="text-xs text-gray-500">{org.is_active ? 'Active' : 'Inactive'}</div>
                  </div>
                </div>
                {isSelected && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onEditOrganization(org); }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); onDeleteOrganization(org.id); }}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {org.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">{org.description}</p>
              )}
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" /> {isSelected ? hierarchyRoles.length : 0} nodes
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> 0 users
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hierarchy header and content */}
      {!selectedOrgId ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Select an Organization</h3>
          <p className="text-gray-600 dark:text-gray-400">Choose a branch above to manage its role hierarchy.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {organizations.find(o => o.id === selectedOrgId)?.name} Hierarchy
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">Manage the organizational structure for this branch</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onSaveHierarchy} className="flex items-center">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Available Roles</h3>
              <span className="text-xs text-gray-500">Click to add to hierarchy</span>
            </div>
            <div className="space-y-2">
              {roles
                .filter(r => !new Set(flattenTreeForSave(hierarchyRoles).map(n => String(n.role_id))).has(String(r.id)))
                .map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    onClick={() => onAddRoleToHierarchy(role.id)}
                  >
                    <div>
                      <div className="font-medium text-sm">{role.name}</div>
                      <div className="text-xs text-gray-500">{role.description}</div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddRoleToHierarchy(role.id);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Hierarchy</h3>
              <span className="text-xs text-gray-500">Use buttons to reorder</span>
            </div>
            <div className="min-h-[200px] border border-dashed rounded p-3">
              {flattenedItems.length === 0 ? (
                <div className="text-sm text-gray-500">No roles yet. Click roles from the left to add them.</div>
              ) : (
                <ul className="space-y-0">
                  {flattenedItems.map((item) => {
                    console.log("item", item);
                    console.log("roles", roles);
                    const role = roles.find(r => r.id == item.id);
                    if (!role) return null;
                    
                    return (
                      <TreeItem
                        key={item.id}
                        id={item.id}
                        value={role.name}
                        depth={item.depth}
                        indentationWidth={20}
                        collapsed={item.collapsed}
                        childCount={item.children.length}
                        onCollapse={item.children.length > 0 ? () => onToggleExpand(item.id) : undefined}
                        onRemove={() => onRemoveFromHierarchy(item.id)}
                        onMoveUp={() => onMoveRole(item.id, 'up')}
                        onMoveDown={() => onMoveRole(item.id, 'down')}
                        onMoveLeft={() => onMoveRole(item.id, 'left')}
                        onMoveRight={() => onMoveRole(item.id, 'right')}
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};

export default HierarchyBuilder;
