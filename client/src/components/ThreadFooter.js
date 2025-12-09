import React from "react";
import { format } from "date-fns";
import EmojiReactions from "./EmojiReactions";
import ThreadRecommendationButton from "./ThreadRecommendationButton";

const ThreadFooter = ({
  thread,
  currentUser,
  isRecommend,
  recommendation,
  isRecommendLoading,
  error,
}) => {
  return (
    <div className="flex justify-between items-center mt-1">
      <p className="text-xs text-gray-400">
        {format(new Date(thread.task_created_at), "MMM d, yyyy 'at' h:mm a")}
      </p>
      <div className="flex items-center gap-2">
      {!isRecommend && thread.recommendation && (
          <ThreadRecommendationButton
            thread={thread}
            user={currentUser}
            recommendation={thread.recommendation}
            isRecommendLoading={false}
            error={error}
          />
        )}
        {isRecommend && (
          <ThreadRecommendationButton
            thread={thread}
            user={currentUser}
            recommendation={recommendation}
            isRecommendLoading={isRecommendLoading}
            error={error}
          />
        )}
        <EmojiReactions
          threadId={thread.task_threads_id}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
};

export default ThreadFooter;
