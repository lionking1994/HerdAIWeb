import React, { useMemo, useCallback, useEffect } from 'react';
import ReactWordcloud from 'react-wordcloud';
import { FeedbackItem } from '../types';
import { Star } from 'lucide-react';

interface TaskReviewCloudProps {
  title: string;
  isLoading: boolean;
  words: FeedbackItem[] | [];
  onWordClick: (word: FeedbackItem) => void;
}

const TaskReviewCloud: React.FC<TaskReviewCloudProps> = React.memo(({ title, isLoading, words, onWordClick }) => {
  const options = useMemo(() => ({
    rotations: 2,
    rotationAngles: [],
    fontSizes: [15, 60],
    fontFamily: 'Inter, sans-serif',
    colors: [
      // Blues
      '#24befb',
      '#3b82f6',
      '#1d4ed8',
      // Greens
      '#2aecdc',
      '#10b981',
      '#059669',
      // Purples
      '#9f0bf5',
      '#8b5cf6',
      '#7c3aed',
      // Oranges/Yellows
      '#F59E0B',
      '#f97316',
      '#fb923c',
      // Reds
      '#ff2b2b',
      '#ef4444',
      '#dc2626',
      // Teals/Cyans
      '#06b6d4',
      '#0891b2',
      '#0e7490',
      // Warm neutrals
      '#b94d2c',
      '#92400e',
      '#78350f'
    ],
    enableTooltip: false,
    padding: 2,
    deterministic: true,
  }), []);

  const callbacks = useMemo(() => ({
    onWordClick: (word: FeedbackItem) => {
      onWordClick(word);
    },
  }), [onWordClick]);

  useEffect(() => { console.log("TaskReviewCloud is called") }, [])

  const memoizedWords = useMemo(() => words, [words]);

  return (
    <div className={`bg-white rounded-lg shadow-md p-3 sm:p-4 h-full ${isLoading ? 'hidden' : ''}`}>
      <div className="flex items-center gap-2 mb-2 sm:mb-4">
        <Star className="w-5 h-5 text-yellow-400" />
        <h3 className="text-base sm:text-lg font-medium text-gray-900">
          {title}
        </h3>
      </div>
      <div className="h-48 sm:h-64 relative">
        {memoizedWords.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-2xl font-semibold">No reviews available</p>
          </div>
        ) : (
            <ReactWordcloud
              words={memoizedWords}
              options={options}
              callbacks={callbacks}
              key={JSON.stringify(memoizedWords)} // Only re-render when words actually change
            />
        )}
      </div>
    </div>
  );
});

TaskReviewCloud.displayName = 'TaskReviewCloud';

export default TaskReviewCloud;
