import React from 'react';
import ReactWordcloud from 'react-wordcloud';
import { FeedbackItem } from '../types';
import { MessageSquare } from 'lucide-react';

interface WordCloudCardProps {
  title: string;
  isLoading: boolean;
  words: FeedbackItem[] | [];
  onWordClick: (word: FeedbackItem) => void;
}

const WordCloudCard: React.FC<WordCloudCardProps> = ({ title, isLoading, words, onWordClick }) => {
  const options = {
    rotations: 2,
    rotationAngles: [],
    fontSizes: [15, 60],
    fontFamily: 'Inter, sans-serif',
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
    enableTooltip: false,
    padding: 2,
    deterministic: true,
  };

  const callbacks = {
    onWordClick: (word: FeedbackItem) => {
      onWordClick(word)
    },
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-3 sm:p-4 h-full ${isLoading ? 'hidden' : ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-blue-400" />
        <h2 className="text-xl font-semibold text-black">
          Platform Feedback Word Cloud
        </h2>
      </div>
      <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2 sm:mb-4">
        {title}
      </h3>
      <div className="h-48 sm:h-64 relative">
        {words.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-2xl font-semibold">No feedback available</p>
          </div>
        ) : (
          <>
              <ReactWordcloud words={words} options={options} callbacks={callbacks} />
            </>
        )}
      </div>
    </div>
  );
};

export default WordCloudCard;
