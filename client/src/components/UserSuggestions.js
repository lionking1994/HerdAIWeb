import React from "react";
import { Avatar } from "@mui/material";

const UserSuggestions = ({
  suggestions,
  isVisible,
  onSelectUser,
  suggestionsRef,
  prefix = "#"
}) => {
  if (!isVisible || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={suggestionsRef}
      className="absolute z-50 mt-1 w-full max-h-60 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg"
    >
      <ul className="py-1">
        {suggestions.map((user) => (
          <li
            key={user.id}
            className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
            onClick={() => onSelectUser(user)}
          >
            <Avatar
              src={user.avatar || ""}
              alt={user.name}
              className="w-6 h-6"
              sx={{ width: 24, height: 24 }}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </Avatar>
            <div className="flex flex-col">
              <span className="font-medium">
                {user.name}
              </span>
              <span className="text-xs text-gray-500">{user.email}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UserSuggestions;

