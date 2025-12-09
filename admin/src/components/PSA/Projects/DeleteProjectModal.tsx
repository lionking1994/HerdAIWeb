import { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { Project } from '../Dashboard/types';

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (projectId: string, companyId: string) => void;
  project: Project | null;
  companyId: string;
}

export default function DeleteProjectModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  project, 
  companyId 
}: DeleteProjectModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !project) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(project.id, companyId);
      onClose();
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg mr-3">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Delete Project</h2>
          </div>
          <button 
            onClick={handleClose} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isDeleting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
           <div className="flex items-start mb-6">
             <AlertTriangle className="w-5 h-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
             <div>
               <p className="text-gray-700 mb-4">
                 Are you sure you want to delete <strong>"{project.name}"</strong>? This action cannot be undone.
               </p>
               <div className="bg-gray-50 rounded-lg p-3">
                 <p className="text-sm text-gray-600">{project.description}</p>
               </div>
             </div>
           </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isDeleting}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center cursor-pointer ${
                !isDeleting
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-red-400 text-white cursor-not-allowed'
              }`}
            >
              {isDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Project
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
