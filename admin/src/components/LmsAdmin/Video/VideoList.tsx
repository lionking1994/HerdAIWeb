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
import { GripVertical, Trash2, Brain, Edit, FileText } from 'lucide-react';
import { Video } from '../../../types';

interface VideoListProps {
  videos: Video[];
  onReorder: (videos: Video[]) => void;
  onEdit?: (video: Video) => void;
  onManageDocuments?: (video: Video) => void;
  onDelete: (videoId: string) => void;
}

interface SortableVideoItemProps {
  video: Video;
  index: number;
  onEdit?: (video: Video) => void;
  onManageDocuments?: (video: Video) => void;
  onDelete: (videoId: string) => void;
}

function SortableVideoItem({ video, index, onEdit, onManageDocuments, onDelete }: SortableVideoItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-gray-200 rounded-lg p-4 bg-white"
    >
      <div className="flex items-center space-x-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="h-5 w-5" />
        </div>

        <div className="flex-1">
          <h4 className="font-medium text-gray-900 mb-1">
            {index + 1}. {video.title}
          </h4>
          <p className="text-sm text-gray-600 mb-2">{video.description}</p>
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <span>Duration: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}</span>
            {video.ai_summary && (
              <span className="flex items-center space-x-1">
                <Brain className="h-3 w-3" />
                <span>AI Enhanced</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(video)}
              className="text-indigo-500 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
              title="Edit video"
            >
              <Edit className="h-4 w-4" />
            </button>
          )}
          {onManageDocuments && (
            <button
              onClick={() => onManageDocuments(video)}
              className="text-green-500 hover:text-green-700 p-2 rounded-lg hover:bg-green-50 transition-colors"
              title="Manage video documents"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(video.id)}
            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
            title="Delete video"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function VideoList({ videos, onReorder, onEdit, onManageDocuments, onDelete }: VideoListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = videos.findIndex((video) => video.id === active.id);
      const newIndex = videos.findIndex((video) => video.id === over.id);

      const reorderedVideos = arrayMove(videos, oldIndex, newIndex).map((video, index) => ({
        ...video,
        order_index: index,
      }));

      onReorder(reorderedVideos);
    }
  };

  if (videos.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No videos yet. Add your first video to get started.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={videos.map(v => v.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {videos.map((video, index) => (
            <SortableVideoItem
              key={video.id}
              video={video}
              index={index}
              onEdit={onEdit}
              onManageDocuments={onManageDocuments}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}