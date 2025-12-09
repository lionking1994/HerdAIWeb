import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Move } from 'lucide-react';

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

interface SortableRoleItemProps {
  role: CompanyRole;
}

const SortableRoleItem: React.FC<SortableRoleItemProps> = ({ role }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-3 cursor-move hover:border-blue-400 dark:hover:border-blue-500 transition-all ${
        isDragging ? 'shadow-lg border-blue-500' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <Move className="h-5 w-5 text-gray-500" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100">{role.name}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{role.description}</p>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          → Drag to hierarchy
        </div>
      </div>
    </div>
  );
};

export default SortableRoleItem;
