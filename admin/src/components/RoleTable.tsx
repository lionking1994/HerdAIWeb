import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Pencil, Trash2, Save, X } from 'lucide-react';
import { RoleTableSkeleton } from './LoadingStates';

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
}

interface RoleTableProps {
  roles: CompanyRole[];
  editingRoleId: string | null;
  isLoading?: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, field: keyof CompanyRole, roleId?: string) => void;
  onEdit: (roleId: string) => void;
  onUpdate: (roleId: string) => void;
  onDelete: (roleId: string) => void;
  onCancelEdit: () => void;
}

const RoleTable: React.FC<RoleTableProps> = ({
  roles,
  editingRoleId,
  isLoading = false,
  onInputChange,
  onEdit,
  onUpdate,
  onDelete,
  onCancelEdit,
}) => {
  if (isLoading) {
    return <RoleTableSkeleton />;
  }

  if (roles.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-500 dark:text-gray-400">No company roles found. Add your first role to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Est CPH</TableHead>
            <TableHead>Meeting Weight</TableHead>
            <TableHead>Top Meeting Count</TableHead>
            <TableHead>Research Review Weight</TableHead>
            <TableHead>Research Review Top Count</TableHead>
            <TableHead>Task Weight</TableHead>
            <TableHead>Task Top Count</TableHead>
            <TableHead>Rating Given Weight</TableHead>
            <TableHead>Rating Given Top Count</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.id}>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    value={role.name}
                    onChange={(e) => onInputChange(e, 'name', role.id)}
                    className="w-full"
                  />
                ) : (
                  role.name
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Textarea
                    value={role.description}
                    onChange={(e) => onInputChange(e, 'description', role.id)}
                    className="w-full"
                  />
                ) : (
                  role.description
                )}
              </TableCell>
              <TableCell className="min-w-[100px]">
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={role.est_cph ?? ''}
                    onChange={(e) => onInputChange(e, 'est_cph', role.id)}
                    placeholder="Enter CPH"
                    className="w-full min-w-[80px]"
                  />
                ) : (
                  role.est_cph !== undefined && role.est_cph !== null ? `$${role.est_cph}` : 'N/A'
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    value={role.meeting_weight}
                    onChange={(e) => onInputChange(e, 'meeting_weight', role.id)}
                    min="1"
                    className="w-full"
                  />
                ) : (
                  role.meeting_weight
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    value={role.top_meeting_count}
                    onChange={(e) => onInputChange(e, 'top_meeting_count', role.id)}
                    min="1"
                    className="w-full"
                  />
                ) : (
                  role.top_meeting_count
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    value={role.research_review_weight}
                    onChange={(e) => onInputChange(e, 'research_review_weight', role.id)}
                    min="1"
                    className="w-full"
                  />
                ) : (
                  role.research_review_weight
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    value={role.research_review_top_count}
                    onChange={(e) => onInputChange(e, 'research_review_top_count', role.id)}
                    min="1"
                    className="w-full"
                  />
                ) : (
                  role.research_review_top_count
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    value={role.task_weight}
                    onChange={(e) => onInputChange(e, 'task_weight', role.id)}
                    min="1"
                    className="w-full"
                  />
                ) : (
                  role.task_weight
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    value={role.task_top_count}
                    onChange={(e) => onInputChange(e, 'task_top_count', role.id)}
                    min="1"
                    className="w-full"
                  />
                ) : (
                  role.task_top_count
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    value={role.rating_given_weight}
                    onChange={(e) => onInputChange(e, 'rating_given_weight', role.id)}
                    min="1"
                    className="w-full"
                  />
                ) : (
                  role.rating_given_weight
                )}
              </TableCell>
              <TableCell>
                {editingRoleId === role.id ? (
                  <Input
                    type="number"
                    value={role.rating_given_top_count}
                    onChange={(e) => onInputChange(e, 'rating_given_top_count', role.id)}
                    min="1"
                    className="w-full"
                  />
                ) : (
                  role.rating_given_top_count
                )}
              </TableCell>
              <TableCell className="text-right">
                {editingRoleId === role.id ? (
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onCancelEdit}
                      className="flex items-center"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onUpdate(role.id)}
                      className="flex items-center"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(role.id)}
                      className="flex items-center"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(role.id)}
                      className="flex items-center"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default RoleTable;
