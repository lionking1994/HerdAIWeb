import React, { createContext, useState } from 'react'

// 1️⃣ Create the context
export const ChatPopContext = createContext()

// 2️⃣ Create the provider component
export const ChatPopProvider = ({ children }) => {
  const [PopMsg, setPopMsg] = useState('') // Example state
  const [popOpen, setPopOpen] = useState(false)

  console.log(popOpen, 'jfhkjhjkjhbjhbhj', PopMsg)

  return (
    <ChatPopContext.Provider value={{ PopMsg, setPopMsg, popOpen, setPopOpen }}>
      {children}
    </ChatPopContext.Provider>
  )
}
