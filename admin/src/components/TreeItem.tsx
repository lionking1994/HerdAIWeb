import React, { forwardRef, HTMLAttributes } from "react";
import { ChevronRight, ChevronDown, GripVertical, X } from "lucide-react";
import { Button } from "./ui/button";

export interface TreeItemProps extends HTMLAttributes<HTMLLIElement> {
  childCount?: number;
  clone?: boolean;
  collapsed?: boolean;
  depth: number;
  disableInteraction?: boolean;
  disableSelection?: boolean;
  ghost?: boolean;
  indicator?: boolean;
  indentationWidth: number;
  value: string;
  onCollapse?(): void;
  onRemove?(): void;
  onMoveUp?(): void;
  onMoveDown?(): void;
  onMoveLeft?(): void;
  onMoveRight?(): void;
  wrapperRef?(node: HTMLLIElement): void;
}

export const TreeItem = forwardRef<HTMLDivElement, TreeItemProps>(
  (
    {
      childCount,
      clone,
      depth,
      disableSelection,
      disableInteraction,
      ghost,
      indentationWidth,
      indicator,
      collapsed,
      onCollapse,
      onRemove,
      onMoveUp,
      onMoveDown,
      onMoveLeft,
      onMoveRight,
      style,
      value,
      wrapperRef,
      ...props
    },
    ref
  ) => {
    return (
      <li
        className={`
          flex items-center py-2 px-3 border-b border-gray-200 dark:border-gray-700
          ${clone ? 'opacity-50' : ''}
          ${ghost ? 'opacity-30' : ''}
          ${indicator ? 'bg-blue-50 dark:bg-blue-900' : ''}
          ${disableSelection ? 'select-none' : ''}
          ${disableInteraction ? 'pointer-events-none' : ''}
        `}
        ref={wrapperRef}
        style={{
          paddingLeft: `${indentationWidth * depth + 12}px`,
          ...style
        }}
        {...props}
      >
        <div className="flex items-center w-full" ref={ref}>
          {/* Drag handle */}
          <div className="flex items-center mr-2">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
          
          {/* Collapse/Expand button */}
          {onCollapse && childCount && childCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCollapse}
              className="p-1 h-6 w-6 mr-2"
            >
              {collapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          )}
          
          {/* Role name */}
          <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
            {value}
          </span>
          
          {/* Action buttons */}
          {!clone && (
            <div className="flex items-center gap-1">
              {onMoveUp && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMoveUp}
                  className="p-1 h-6 w-6"
                  title="Move up"
                >
                  ↑
                </Button>
              )}
              {onMoveDown && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMoveDown}
                  className="p-1 h-6 w-6"
                  title="Move down"
                >
                  ↓
                </Button>
              )}
              {onMoveLeft && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMoveLeft}
                  className="p-1 h-6 w-6"
                  title="Move left (outdent)"
                >
                  ←
                </Button>
              )}
              {onMoveRight && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMoveRight}
                  className="p-1 h-6 w-6"
                  title="Move right (indent)"
                >
                  →
                </Button>
              )}
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                  title="Remove from hierarchy"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
          
          {/* Child count for clone */}
          {clone && childCount && childCount > 1 && (
            <span className="ml-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {childCount}
            </span>
          )}
        </div>
      </li>
    );
  }
);

TreeItem.displayName = "TreeItem";
