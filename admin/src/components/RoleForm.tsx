import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Save, X } from 'lucide-react';

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

interface RoleFormProps {
  role: Partial<CompanyRole>;
  companyDefaultCph?: number;
  onInputChange: (field: keyof CompanyRole, value: string | number) => void;
  onSave: () => void;
  onCancel: () => void;
  isEditing?: boolean;
}

const RoleForm: React.FC<RoleFormProps> = ({
  role,
  companyDefaultCph,
  onInputChange,
  onSave,
  onCancel,
  isEditing = false,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
      <h3 className="text-lg font-medium mb-4">
        {isEditing ? 'Edit Company Role' : 'Add New Company Role'}
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input
            value={role.name || ''}
            onChange={(e) => onInputChange('name', e.target.value)}
            placeholder="Role name"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Textarea
            value={role.description || ''}
            onChange={(e) => onInputChange('description', e.target.value)}
            placeholder="Role description"
            className="w-full"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Est CPH</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={role.est_cph ?? ''}
            onChange={(e) => onInputChange('est_cph', e.target.value === '' ? '' : parseFloat(e.target.value))}
            placeholder={companyDefaultCph ? `Default: $${companyDefaultCph}` : 'Enter CPH'}
            className="w-full"
          />
          {companyDefaultCph && (
            <p className="text-xs text-gray-500 mt-1">
              Company default: ${companyDefaultCph}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meeting Weight</label>
          <Input
            type="number"
            value={role.meeting_weight || 1}
            onChange={(e) => onInputChange('meeting_weight', parseInt(e.target.value) || 1)}
            min="1"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Top Meeting Count</label>
          <Input
            type="number"
            value={role.top_meeting_count || 5}
            onChange={(e) => onInputChange('top_meeting_count', parseInt(e.target.value) || 5)}
            min="1"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Research Review Weight</label>
          <Input
            type="number"
            value={role.research_review_weight || 1}
            onChange={(e) => onInputChange('research_review_weight', parseInt(e.target.value) || 1)}
            min="1"
            className="w-full"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Task Weight</label>
          <Input
            type="number"
            value={role.task_weight || 1}
            onChange={(e) => onInputChange('task_weight', parseInt(e.target.value) || 1)}
            min="1"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Task Top Count</label>
          <Input
            type="number"
            value={role.task_top_count || 5}
            onChange={(e) => onInputChange('task_top_count', parseInt(e.target.value) || 5)}
            min="1"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rating Given Weight</label>
          <Input
            type="number"
            value={role.rating_given_weight || 1}
            onChange={(e) => onInputChange('rating_given_weight', parseInt(e.target.value) || 1)}
            min="1"
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Rating Given Top Count</label>
          <Input
            type="number"
            value={role.rating_given_top_count || 5}
            onChange={(e) => onInputChange('rating_given_top_count', parseInt(e.target.value) || 5)}
            min="1"
            className="w-full"
          />
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex items-center"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={onSave}
          className="flex items-center"
          disabled={!role.name}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
};

export default RoleForm;
