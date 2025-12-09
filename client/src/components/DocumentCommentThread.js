import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  FaReply,
  FaEllipsisV,
  FaFile,
  FaEye,
  FaDownload,
  FaAt,
  FaHashtag,
} from "react-icons/fa";
import { Loader2 } from "lucide-react";
import axios from "axios";
import { toast } from "react-toastify";
import AvatarPop from "./AvatarPop";
import ThreadMessageMenu from "./ThreadMessageMenu";

const DocumentCommentThread = ({
  documentId,
  selectedSection,
  onClose,
  user,
  taskId,
  initialText,
  initComment,
}) => {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [replyToComment, setReplyToComment] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState([]);
  const [userSuggestions, setUserSuggestions] = useState([]);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState(null);

  const commentInputRef = useRef(null);
  const commentThreadRef = useRef(null);
  const userSuggestionsRef = useRef(null);
  const tagSuggestionsRef = useRef(null);

  // Fetch comments for the document section
  useEffect(() => {
    if (documentId && selectedSection) {
      fetchComments();
    }
  }, [documentId, selectedSection]);

  // Auto-scroll to bottom of comments when new ones are added
  useEffect(() => {
    if (commentThreadRef.current) {
      commentThreadRef.current.scrollTop =
        commentThreadRef.current.scrollHeight;
    }
  }, [comments]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        userSuggestionsRef.current &&
        !userSuggestionsRef.current.contains(event.target)
      ) {
        setShowUserSuggestions(false);
      }
      if (
        tagSuggestionsRef.current &&
        !tagSuggestionsRef.current.contains(event.target)
      ) {
        setShowTagSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Set initial text when provided
  useEffect(() => {
    if (initialText) {
      setMessage(initialText);
    }
  }, [initialText]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/documents/comments/${documentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log("coonnnet", response.data);
      if (response.data.success) {
        setComments(response.data.comments || []);
      }

      if (initComment) scrollToThread(initComment);
    } catch (error) {
      console.error("Error fetching document comments:", error);
      toast.error("Failed to load comments");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!message.trim() && !selectedFile) {
      toast.error("Please enter a message or attach a file");
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // If we're editing a comment
      if (editingComment) {
        const token = localStorage.getItem("token");
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/documents/update-comment`,
          {
            commentId: editingComment.id,
            content: message,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (response.data.success) {
          toast.success("Comment updated successfully");
          setEditingComment(null);
          setMessage("");
          await fetchComments();
        }
      } else {
        // Regular comment or reply
        const formData = new FormData();
        if (selectedFile) {
          formData.append("file", selectedFile);
        }
        formData.append("documentId", documentId);
        formData.append("sectionId", selectedSection.id);
        formData.append("taskId", taskId);
        formData.append("content", message);
        formData.append("replyTo", replyToComment ? replyToComment.id : null);

        // Add mentioned users
        if (mentionedUsers.length > 0) {
          formData.append("mentionedUsers", JSON.stringify(mentionedUsers));
        }

        const token = localStorage.getItem("token");
        console.log("homedata", formData);
        await axios.post(
          `${process.env.REACT_APP_API_URL}/documents/add-comment`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "multipart/form-data",
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percentCompleted);
            },
          }
        );

        // Clear the message input and reset state
        setMessage("");
        setSelectedFile(null);
        setReplyToComment(null);
        setMentionedUsers([]);

        // Refresh comments
        await fetchComments();
      }
    } catch (error) {
      console.error("Error sending comment:", error);
      toast.error("Failed to send comment");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleReplyToComment = (comment) => {
    setReplyToComment(comment);
    commentInputRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyToComment(null);
  };

  const handleEditComment = (comment) => {
    setEditingComment(comment);
    setMessage(comment.content);
    commentInputRef.current?.focus();
  };

  const handleDeleteComment = async (comment) => {
    if (!window.confirm("Are you sure you want to delete this comment?"))
      return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/documents/delete-comment`,
        { commentId: comment.id },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success("Comment deleted successfully");
        await fetchComments();
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("Failed to delete comment");
    }
  };

  // Handle @ mentions and # tags
  const handleMessageChange = async (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    // Get cursor position
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    // Check for @ mentions
    const lastAtSymbolIndex = newMessage.lastIndexOf("@", cursorPos);
    const lastHashSymbolIndex = newMessage.lastIndexOf("#", cursorPos);

    // Handle @ mentions
    if (
      lastAtSymbolIndex !== -1 &&
      (lastHashSymbolIndex === -1 || lastAtSymbolIndex > lastHashSymbolIndex)
    ) {
      const textAfterAt = newMessage.substring(
        lastAtSymbolIndex + 1,
        cursorPos
      );

      // If there's text after @ and no space, show suggestions
      if (textAfterAt && !textAfterAt.includes(" ")) {
        try {
          const token = localStorage.getItem("token");
          const response = await axios.get(
            `${process.env.REACT_APP_API_URL}/documents/users/search`,
            {
              params: { query: textAfterAt, taskId: taskId },
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.data.success) {
            setUserSuggestions(response.data.users || []);
            setShowUserSuggestions(true);
            setShowTagSuggestions(false);
          }
        } catch (error) {
          console.error("Error fetching user suggestions:", error);
        }
      } else {
        setShowUserSuggestions(false);
      }
    }
    // Handle # tags
    else if (
      lastHashSymbolIndex !== -1 &&
      (lastAtSymbolIndex === -1 || lastHashSymbolIndex > lastAtSymbolIndex)
    ) {
      const textAfterHash = newMessage.substring(
        lastHashSymbolIndex + 1,
        cursorPos
      );

      // If there's text after # and no space, show tag suggestions
      if (textAfterHash && !textAfterHash.includes(" ")) {
        // Get existing tags from comments
        const existingTags = new Set();
        comments.forEach((comment) => {
          if (comment.tags && Array.isArray(comment.tags)) {
            comment.tags.forEach((tag) => existingTags.add(tag));
          }
        });

        // Filter tags based on input
        const filteredTags = Array.from(existingTags)
          .filter((tag) =>
            tag.toLowerCase().includes(textAfterHash.toLowerCase())
          )
          .slice(0, 5); // Limit to 5 suggestions

        setTagSuggestions(filteredTags);
        setShowTagSuggestions(true);
        setShowUserSuggestions(false);
      } else {
        setShowTagSuggestions(false);
      }
    } else {
      setShowUserSuggestions(false);
      setShowTagSuggestions(false);
    }
  };

  const handleSelectUser = (user) => {
    const lastAtSymbolIndex = message.lastIndexOf("@", cursorPosition);
    if (lastAtSymbolIndex !== -1) {
      const beforeAt = message.substring(0, lastAtSymbolIndex);
      const afterCursor = message.substring(cursorPosition);

      // Replace the @mention with the selected user
      const newMessage = `${beforeAt}@${user.name
        .split(" ")[0]
        .toLowerCase()} ${afterCursor}`;
      setMessage(newMessage);

      // Add to mentioned users if not already included
      if (!mentionedUsers.some((u) => u.id === user.id)) {
        setMentionedUsers([
          ...mentionedUsers,
          { id: user.id, username: user.name },
        ]);
      }
    }

    setShowUserSuggestions(false);
    commentInputRef.current?.focus();
  };

  const handleSelectTag = (tag) => {
    const lastHashSymbolIndex = message.lastIndexOf("#", cursorPosition);
    if (lastHashSymbolIndex !== -1) {
      const beforeHash = message.substring(0, lastHashSymbolIndex);
      const afterCursor = message.substring(cursorPosition);

      // Replace the #tag with the selected tag
      const newMessage = `${beforeHash}#${tag} ${afterCursor}`;
      setMessage(newMessage);
    }

    setShowTagSuggestions(false);
    commentInputRef.current?.focus();
  };

  // Highlight text in document
  const handleHighlightText = () => {
    // This would be implemented based on the document viewer's capabilities
    // For now, we'll just use the selected section
    toast.info(
      `Highlighted section: ${selectedSection.text || "Selected content"}`
    );
  };

  // Render tags for a comment
  const renderTags = (comment) => {
    if (
      !comment.tags ||
      !Array.isArray(comment.tags) ||
      comment.tags.length === 0
    ) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {comment.tags.map((tag, index) => (
          <span
            key={`${comment.id}-tag-${index}`}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full"
          >
            <FaHashtag className="mr-1 text-xs" />
            {tag}
          </span>
        ))}
      </div>
    );
  };

  // Scroll to a specific thread when replying
  const scrollToThread = (commentId) => {
    console.log("thread ID", commentId);
    setHighlightedCommentId(commentId);
    setTimeout(() => {
      const element = document.getElementById(`comment-${commentId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      // Remove highlight after a delay
      setTimeout(() => setHighlightedCommentId(null), 3000);
    }, 100);
  };

  // Render mentioned users in a comment
  const renderMentions = (content) => {
    if (!content) return content;

    // Replace @username with styled mentions
    const parts = content.split(/(@\w+)/g);

    return parts.map((part, index) => {
      if (part.startsWith("@")) {
        return (
          <span
            key={index}
            className="inline-block px-1 py-0.5 bg-blue-100 text-blue-700 rounded"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-lg font-semibold text-gray-800">
          Comments{" "}
          {selectedSection &&
            `- ${selectedSection.title || "Selected Section"}`}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
        >
          &times;
        </button>
      </div>

      {/* Comment Thread */}
      <div
        ref={commentThreadRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p>No comments yet</p>
            <p className="text-sm mt-2">
              Be the first to comment on this section
            </p>
          </div>
        ) : (
          comments.map((comment, index) => (
            <div
              key={comment.id}
              id={`comment-${comment.id}`}
              className={`flex gap-2 sm:gap-4 pb-4 ${
                index < comments.length - 1 ? "border-b border-gray-200" : ""
              } ${comment.userId === user.id ? "flex-row-reverse" : ""}
              ${
                highlightedCommentId === comment.id
                  ? "bg-blue-50 p-2 rounded-lg transition-colors duration-500"
                  : ""
              }`}
            >
              <div className="flex-shrink-0">
                <AvatarPop participant={comment.user[0]} />
              </div>

              <div
                className={`flex-1 ${
                  comment.userId === user.id ? "text-right" : ""
                }`}
              >
                <div
                  className={`flex items-center justify-between gap-1 sm:gap-2 mb-1 flex-wrap ${
                    comment.userId === user.id ? "" : "flex-row-reverse"
                  }`}
                >
                  <div
                    className={`flex items-center space-x-2 ${
                      comment.userId === user.id ? "" : "flex-row-reverse"
                    } `}
                  >
                    {comment.userId === user.id && (
                      <div className="relative">
                        <ThreadMessageMenu
                          thread={comment}
                          onReply={() => {
                            handleReplyToComment(comment);
                          }}
                          currentUserId={user.id}
                          onEdit={() => handleEditComment(comment)}
                          onDelete={() => handleDeleteComment(comment)}
                        />
                      </div>
                    )}
                    {comment.is_reply && comment.reply_to != -1 && (
                      <button
                        onClick={() => scrollToThread(comment.reply_to)}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <FaReply className="w-3 h-3 mr-1" />
                        View original
                      </button>
                    )}
                  </div>
                  <span className="font-medium text-gray-900 text-sm sm:text-base">
                    {comment.user[0]?.name || "User"}
                  </span>
                  {comment.isReply && (
                    <span className="text-xs text-gray-500">
                      replied to {comment.replyToUser?.name || "a comment"}
                    </span>
                  )}
                </div>

                <div
                  className={`inline-block max-w-[85%] p-3 rounded-lg ${
                    comment.userId === user.id
                      ? "bg-blue-100 text-left"
                      : "bg-gray-100"
                  }`}
                >
                  <p className="text-gray-800 whitespace-pre-wrap break-words">
                    {renderMentions(comment.content)}
                  </p>

                  {/* Render tags */}
                  {renderTags(comment)}
                </div>

                {/* File attachment */}
                {comment.file && (
                  <div className="mt-2">
                    <div className="inline-block bg-gray-50 border rounded-lg p-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-100 rounded-md">
                            <FaFile className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-[250px]">
                            {comment.fileName}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              // Preview file logic
                            }}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Preview"
                          >
                            <FaEye className="w-4 h-4" />
                          </button>
                          <a
                            href={`${process.env.REACT_APP_API_URL}/files/${comment.file}`}
                            download={comment.fileName}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Download"
                          >
                            <FaDownload className="w-4 h-4" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center mt-1 gap-2">
                  <p className="text-xs text-gray-400">
                    {format(
                      new Date(comment.created_at),
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Comment Input */}
      <div className="p-3 border-t">
        {replyToComment && (
          <div className="mt-2 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
            <button
              onClick={handleCancelReply}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              aria-label="Cancel reply"
            >
              &times;
            </button>
            <div className="text-xs text-gray-500 mb-1">
              Replying to {replyToComment.user[0]?.name || "User"}
            </div>
            <div className="text-sm text-gray-700 pl-2 border-l-2 border-blue-400 line-clamp-2">
              {replyToComment.message}
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="space-y-2">
          <div className="relative">
            <textarea
              ref={commentInputRef}
              value={message}
              onChange={handleMessageChange}
              placeholder="Type your comment... Use @ to mention users and # to add tags"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
            />

            {/* User suggestions for @mentions */}
            {showUserSuggestions && userSuggestions.length > 0 && (
              <div
                ref={userSuggestionsRef}
                className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-white border rounded-lg shadow-lg z-10"
              >
                {userSuggestions.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSelectUser(user)}
                  >
                    <div className="participant-avatar flex-none">
                      {user.avatar ? (
                        <img
                          src={`${process.env.REACT_APP_API_URL}/avatars/${user.avatar}`}
                          alt={user.name}
                        />
                      ) : (
                        <div className="flex-none avatar-placeholder ">
                          {user.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    <span>{user.name}</span>
                    <span className="text-xs text-gray-500">@{user.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tag suggestions for #tags */}
            {showTagSuggestions && tagSuggestions.length > 0 && (
              <div
                ref={tagSuggestionsRef}
                className="absolute bottom-full left-0 mb-1 w-64 max-h-48 overflow-y-auto bg-white border rounded-lg shadow-lg z-10"
              >
                {tagSuggestions.map((tag, index) => (
                  <div
                    key={`tag-suggestion-${index}`}
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSelectTag(tag)}
                  >
                    <FaHashtag className="text-blue-500" />
                    <span>{tag}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              </label>

              <button
                type="button"
                onClick={handleHighlightText}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Highlight text"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>

              <button
                type="button"
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Mention someone"
                onClick={() => {
                  const newMessage = message + "@";
                  setMessage(newMessage);
                  commentInputRef.current?.focus();
                  // Set cursor at the end
                  setTimeout(() => {
                    if (commentInputRef.current) {
                      commentInputRef.current.selectionStart =
                        newMessage.length;
                      commentInputRef.current.selectionEnd = newMessage.length;
                    }
                  }, 0);
                }}
              >
                <FaAt className="h-5 w-5" />
              </button>

              <button
                type="button"
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Add a tag"
                onClick={() => {
                  const newMessage = message + "#";
                  setMessage(newMessage);
                  commentInputRef.current?.focus();
                  // Set cursor at the end
                  setTimeout(() => {
                    if (commentInputRef.current) {
                      commentInputRef.current.selectionStart =
                        newMessage.length;
                      commentInputRef.current.selectionEnd = newMessage.length;
                    }
                  }, 0);
                }}
              >
                <FaHashtag className="h-5 w-5" />
              </button>
            </div>

            <button
              type="submit"
              disabled={isUploading || (!message.trim() && !selectedFile)}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                isUploading || (!message.trim() && !selectedFile)
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{uploadProgress}%</span>
                </div>
              ) : (
                "Send"
              )}
            </button>
          </div>

          {selectedFile && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
              <div className="flex items-center gap-2">
                <FaFile className="text-blue-500" />
                <span className="text-sm truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="text-gray-500 hover:text-red-500"
              >
                &times;
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default DocumentCommentThread;
