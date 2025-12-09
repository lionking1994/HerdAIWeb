import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { X } from 'lucide-react';

interface Organization {
  id?: number;
  name: string;
  description: string;
  is_active: boolean;
}

interface OrganizationModalProps {
  isOpen: boolean;
  organization: Organization | null;
  onClose: () => void;
  onSave: () => void;
  onInputChange: (field: keyof Organization, value: string | boolean) => void;
}

const OrganizationModal: React.FC<OrganizationModalProps> = ({
  isOpen,
  organization,
  onClose,
  onSave,
  onInputChange,
}) => {
  if (!isOpen || !organization) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {organization.id ? 'Edit Organization' : 'Create Organization'}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <Input
              value={organization.name}
              onChange={(e) => onInputChange('name', e.target.value)}
              placeholder="Organization name"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={organization.description}
              onChange={(e) => onInputChange('description', e.target.value)}
              placeholder="Organization description"
              className="w-full"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              checked={organization.is_active}
              onChange={(e) => onInputChange('is_active', e.target.checked)}
              className="rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium">
              Active
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={!organization.name.trim()}
          >
            {organization.id ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationModal;
