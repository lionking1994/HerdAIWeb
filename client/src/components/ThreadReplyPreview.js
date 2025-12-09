import React from 'react';

const ThreadReplyPreview = ({ replyToThread, onCancelReply }) => {
  if (!replyToThread) return null;

  return (
    <div className="mt-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
      <button 
        onClick={onCancelReply}
        className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        aria-label="Cancel reply"
      >
        &times;
      </button>
      <div className="text-xs text-gray-500 mb-1">Replying to {replyToThread.name}</div>
      <div className="text-sm text-gray-700 pl-2 border-l-2 border-blue-400 line-clamp-2">
        {replyToThread.task_message}
      </div>
    </div>
  );
};

export default ThreadReplyPreview;

