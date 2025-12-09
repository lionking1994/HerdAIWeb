import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Download, Trash2, FileText, File } from 'lucide-react';
import { VideoDocument } from '../../../types';

interface DocumentListProps {
  documents: VideoDocument[];
  onReorder: (documents: VideoDocument[]) => void;
  onDelete: (documentId: string) => void;
  canEdit?: boolean;
}

interface SortableDocumentItemProps {
  document: VideoDocument;
  index: number;
  onDelete: (documentId: string) => void;
  canEdit: boolean;
}

function SortableDocumentItem({ document, index, onDelete, canEdit }: SortableDocumentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: document.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return FileText;
    return File;
  };

  const FileIcon = getFileIcon(document.file_type);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center space-x-3">
        {canEdit && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          >
            <GripVertical className="h-5 w-5" />
          </div>
        )}
        
        <div className="flex-shrink-0">
          <FileIcon className="h-8 w-8 text-indigo-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 mb-1 truncate">
            {document.title}
          </h4>
          {document.description && (
            <p className="text-sm text-gray-600 mb-1 line-clamp-2">{document.description}</p>
          )}
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>{formatFileSize(document.file_size)}</span>
            <span className="capitalize">{document.file_type.split('/').pop()}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <a
            href={document.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
            title="Download document"
          >
            {/* <Download className="h-4 w-4" /> */}
          </a>
          {canEdit && (
            <button
              onClick={() => onDelete(document.id)}
              className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
              title="Delete document"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentList({ documents, onReorder, onDelete, canEdit = false }: DocumentListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = documents.findIndex((doc) => doc.id === active.id);
      const newIndex = documents.findIndex((doc) => doc.id === over.id);

      const reorderedDocuments = arrayMove(documents, oldIndex, newIndex).map((doc, index) => ({
        ...doc,
        order_index: index,
      }));

      onReorder(reorderedDocuments);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No documents available for this video.</p>
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="space-y-3">
        {documents.map((document, index) => (
          <SortableDocumentItem
            key={document.id}
            document={document}
            index={index}
            onDelete={onDelete}
            canEdit={false}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={documents.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {documents.map((document, index) => (
            <SortableDocumentItem
              key={document.id}
              document={document}
              index={index}
              onDelete={onDelete}
              canEdit={canEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}