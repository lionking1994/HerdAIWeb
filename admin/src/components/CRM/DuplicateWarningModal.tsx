import React from 'react';
import { DuplicateResult } from '../../services/crm/duplicateDetection';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  onViewExisting: (record: any) => void;
  duplicates: DuplicateResult[];
  entityType: 'Account' | 'Contact' | 'Opportunity' | 'Stage' | 'Custom Field';
}

export default function DuplicateWarningModal({
  isOpen,
  onClose,
  onProceed,
  onViewExisting,
  duplicates,
  entityType
}: DuplicateWarningModalProps) {
  if (!isOpen) return null;

  const topMatch = duplicates[0];
  const hasMultipleMatches = duplicates.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Potential Duplicate {entityType}
            </h3>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            We found {duplicates.length} potential duplicate{duplicates.length > 1 ? 's' : ''} that closely match what you're trying to create.
          </p>
        </div>

        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Potential Matches:</h4>
          
          <div className="space-y-3">
            {duplicates.slice(0, 3).map((duplicate, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {duplicate.existingRecord.name || 
                         `${duplicate.existingRecord.first_name} ${duplicate.existingRecord.last_name}` ||
                         duplicate.existingRecord.field_label}
                      </span>
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {Math.round(duplicate.similarity * 100)}% match
                      </span>
                    </div>
                    
                    {duplicate.existingRecord.email && (
                      <p className="text-sm text-gray-600 mt-1">
                        Email: {duplicate.existingRecord.email}
                      </p>
                    )}
                    
                    {duplicate.existingRecord.account_type && (
                      <p className="text-sm text-gray-600 mt-1">
                        Type: {duplicate.existingRecord.account_type}
                      </p>
                    )}
                    
                    {duplicate.existingRecord.industry && (
                      <p className="text-sm text-gray-600 mt-1">
                        Industry: {duplicate.existingRecord.industry}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => onViewExisting(duplicate.existingRecord)}
                    className="ml-3 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
            
            {hasMultipleMatches && (
              <p className="text-xs text-gray-500 text-center">
                ... and {duplicates.length - 3} more potential matches
              </p>
            )}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                <strong>Recommendation:</strong> Review the existing {entityType.toLowerCase()} records above to avoid creating duplicates. 
                If you're sure this is a new record, you can proceed anyway.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          
          <button
            onClick={onProceed}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
