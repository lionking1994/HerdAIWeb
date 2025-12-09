import React, { useState, useEffect } from 'react';
import { OpportunityStage } from '../../types/crm';

interface StageFormProps {
  stage?: OpportunityStage;
  onSubmit: (data: Partial<OpportunityStage>) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function StageForm({ stage, onSubmit, onCancel, isSubmitting }: StageFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    order_index: 0,
    weight_percentage: 0,
    is_active: true,
    is_closed_won: false,
    is_closed_lost: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (stage) {
      setFormData({
        name: stage.name || '',
        description: stage.description || '',
        order_index: stage.order_index || 0,
        weight_percentage: stage.weight_percentage || 0,
        is_active: stage.is_active !== undefined ? stage.is_active : true,
        is_closed_won: stage.is_closed_won || false,
        is_closed_lost: stage.is_closed_lost || false,
      });
    }
  }, [stage]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Stage name is required';
    }
    
    if (formData.weight_percentage < 0 || formData.weight_percentage > 100) {
      newErrors.weight_percentage = 'Weight percentage must be between 0 and 100';
    }
    
    if (formData.is_closed_won && formData.is_closed_lost) {
      newErrors.is_closed_won = 'Stage cannot be both won and lost';
      newErrors.is_closed_lost = 'Stage cannot be both won and lost';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {stage ? 'Edit Stage' : 'Create New Stage'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stage Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Prospecting, Qualification"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter stage description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order Index
            </label>
            <input
              type="number"
              value={formData.order_index}
              onChange={(e) => handleChange('order_index', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Lower numbers appear first in the pipeline
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weight Percentage *
            </label>
            <input
              type="number"
              value={formData.weight_percentage}
              onChange={(e) => handleChange('weight_percentage', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.weight_percentage ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="0.0"
              min="0"
              max="100"
              step="0.1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Percentage weight for this stage (0-100%)
            </p>
            {errors.weight_percentage && <p className="text-red-500 text-sm mt-1">{errors.weight_percentage}</p>}
          </div>

          {/* Stage Properties */}
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => handleChange('is_active', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                Stage is active
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_closed_won"
                checked={formData.is_closed_won}
                onChange={(e) => handleChange('is_closed_won', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_closed_won" className="ml-2 block text-sm text-gray-900">
                This is a won stage
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_closed_lost"
                checked={formData.is_closed_lost}
                onChange={(e) => handleChange('is_closed_lost', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_closed_lost" className="ml-2 block text-sm text-gray-900">
                This is a lost stage
              </label>
            </div>

            {(errors.is_closed_won || errors.is_closed_lost) && (
              <div className="text-red-500 text-sm">
                {errors.is_closed_won || errors.is_closed_lost}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (stage ? 'Update Stage' : 'Create Stage')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}