import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemType: 'epic' | 'feature' | 'story';
  itemTitle: string;
  isDeleting?: boolean;
}

export default function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  itemType,
  itemTitle,
  isDeleting = false
}: DeleteConfirmationModalProps) {
  if (!isOpen) return null;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'epic': return 'text-purple-600 bg-purple-100';
      case 'feature': return 'text-blue-600 bg-blue-100';
      case 'story': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getWarningMessage = (type: string) => {
    switch (type) {
      case 'epic': return 'This will also delete all features and stories within this epic.';
      case 'feature': return 'This will also delete all stories within this feature.';
      case 'story': return 'This will permanently delete this story.';
      default: return 'This action cannot be undone.';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete {itemType.charAt(0).toUpperCase() + itemType.slice(1)}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isDeleting}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-3">
            Are you sure you want to delete this <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(itemType)}`}>
              {itemType}
            </span>?
          </p>
          
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <p className="font-medium text-gray-900">"{itemTitle}"</p>
          </div>
          
          <p className="text-sm text-red-600 font-medium">
            {getWarningMessage(itemType)}
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {isDeleting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
