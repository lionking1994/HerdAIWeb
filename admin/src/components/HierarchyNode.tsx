import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from './ui/button';
import { Move, ChevronRight, ChevronDown, X } from 'lucide-react';

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

interface HierarchyNodeProps {
  role: CompanyRole;
  level: number;
  expandedNodes: Set<string>;
  dropIndicator: { targetId: string; position: 'before' | 'after' } | null;
  onToggleExpand: (roleId: string) => void;
  onRemove: (roleId: string) => void;
  roleElementRefs: React.MutableRefObject<Map<string, HTMLElement>>;
}

const HierarchyNode: React.FC<HierarchyNodeProps> = ({
  role,
  level,
  expandedNodes,
  dropIndicator,
  onToggleExpand,
  onRemove,
  roleElementRefs,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: role.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isExpanded = expandedNodes.has(role.id);

  const attachRef = (el: HTMLElement | null) => {
    setNodeRef(el);
    if (el) {
      roleElementRefs.current.set(role.id, el);
    } else {
      roleElementRefs.current.delete(role.id);
    }
  };

  return (
    <div ref={attachRef} className="ml-6 mb-3">
      {dropIndicator && dropIndicator.targetId === role.id && dropIndicator.position === 'before' && (
        <div className="h-0.5 bg-blue-500 rounded-full mb-2" />
      )}
      <div 
        style={style}
        {...attributes}
        className={`relative bg-white dark:bg-gray-800 border rounded-lg p-3 transition-all ${
          isOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
        } ${isDragging ? 'shadow-lg border-blue-500' : 'shadow-sm'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 flex-1">
            <button
              type="button"
              onClick={() => onToggleExpand(role.id)}
              className="mt-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div
              {...listeners}
              className="mt-0.5 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <Move className="h-4 w-4 text-gray-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">{role.name}</h4>
                {role.hierarchy_level !== undefined && (
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">
                    L{role.hierarchy_level}
                  </span>
                )}
              </div>
              {role.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{role.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOver && (
              <span className="text-xs text-blue-600 dark:text-blue-400">Drop here</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(role.id)}
              className="h-7 px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {dropIndicator && dropIndicator.targetId === role.id && dropIndicator.position === 'after' && (
        <div className="h-0.5 bg-blue-500 rounded-full mt-2" />
      )}

      {/* Connector line for children */}
      {role.children && role.children.length > 0 && isExpanded && (
        <div className="mt-2 ml-4 border-l border-gray-200 dark:border-gray-700 pl-4">
          {role.children.map((child) => (
            <HierarchyNode 
              key={child.id} 
              role={child} 
              level={level + 1}
              expandedNodes={expandedNodes}
              dropIndicator={dropIndicator}
              onToggleExpand={onToggleExpand}
              onRemove={onRemove}
              roleElementRefs={roleElementRefs}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HierarchyNode;
