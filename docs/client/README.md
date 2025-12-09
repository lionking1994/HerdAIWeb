# Client Documentation

This document provides detailed information about the client component of the HerdAIWeb application.

## Overview

The client is a React-based frontend application that provides the user interface for end users. It handles user authentication, meeting management, task tracking, feedback collection, and performance analysis.

## Directory Structure

```
client/
├── public/                # Static assets
│   ├── index.html        # HTML template
│   ├── logo.png          # Application logo
│   └── ...               # Other static assets
├── src/                   # Source code
│   ├── App.js            # Main application component
│   ├── index.js          # Application entry point
│   ├── components/        # Reusable UI components
│   │   ├── Navbar.js     # Navigation bar
│   │   ├── Footer.js     # Footer component
│   │   └── ...           # Other components
│   ├── pages/             # Page components
│   │   ├── Dashboard.js  # Dashboard page
│   │   ├── Login.js      # Login page
│   │   └── ...           # Other pages
│   ├── context/           # React context providers
│   │   └── ThemeContext.js # Theme context
│   ├── store/             # Redux store
│   │   ├── index.js      # Store configuration
│   │   └── slices/       # Redux slices
│   │       ├── authSlice.js # Authentication slice
│   │       └── ...       # Other slices
│   ├── libs/              # Utility libraries
│   │   ├── socket.js     # WebSocket client
│   │   └── utils.js      # Utility functions
│   ├── styles/            # CSS styles
│   │   ├── global.css    # Global styles
│   │   └── ...           # Other styles
│   └── utils/             # Utility functions
│       └── colorUtils.js # Color utility functions
├── package.json           # Dependencies and scripts
└── tailwind.config.cjs    # Tailwind CSS configuration
```

## Core Components

### Pages

The `pages` directory contains the main page components of the application:

- **Dashboard.js**: Main dashboard with overview of meetings and tasks
- **Login.js**: User authentication page
- **MeetingList.js**: List of meetings
- **MeetingDetail.js**: Detailed view of a meeting
- **TaskList.js**: List of tasks
- **TaskDetails.js**: Detailed view of a task
- **Profile.js**: User profile management
- **Settings.js**: Application settings
- **Onboarding.js**: User onboarding flow
- **PerformanceCloud.js**: Performance analytics visualization

### Components

The `components` directory contains reusable UI components:

- **Navbar.js**: Navigation bar
- **Footer.js**: Footer component
- **MeetingsModal.js**: Modal for creating/editing meetings
- **TaskForm.js**: Form for creating/editing tasks
- **FeedbackDrawer.js**: Drawer for submitting feedback
- **UserProfileDrawer.js**: Drawer for viewing user profiles
- **ExpandableChart.js**: Expandable chart component
- **FileDropZone.js**: File upload component
- **MeetingAgent**: Components for the meeting assistant feature

### State Management

The application uses Redux for state management:

- **store/index.js**: Redux store configuration
- **store/slices/authSlice.js**: Authentication state management
- **store/slices/notificationSlice.js**: Notification state management
- **store/slices/locationSlice.js**: Location state management

### Context Providers

The application uses React Context for certain features:

- **context/ThemeContext.js**: Theme management (light/dark mode)

### Utilities

The application includes various utility functions:

- **libs/utils.js**: General utility functions
- **libs/socket.js**: WebSocket client for real-time communication
- **utils/colorUtils.js**: Color manipulation utilities

## Authentication

The client supports multiple authentication methods:

1. **Email/Password**: Traditional authentication
2. **OAuth Providers**: Google, Facebook, Apple
3. **Face ID**: Biometric authentication option

Authentication flow:

1. User enters credentials or selects OAuth provider
2. Client sends authentication request to server
3. Server validates credentials and returns JWT
4. Client stores JWT in local storage
5. JWT is included in subsequent API requests

## API Communication

The client communicates with the server via RESTful API endpoints:

- Fetch API for HTTP requests
- JWT authentication for secure communication
- Error handling and retry logic

## Real-time Communication

The client uses WebSockets (via Socket.IO) for real-time updates:

- Notification delivery
- Meeting status updates
- Task assignment notifications

## Responsive Design

The client implements responsive design for various screen sizes:

- Mobile-first approach
- Responsive layout using CSS media queries
- Adaptive UI components

## Theme Support

The client supports light and dark themes:

- Theme switching via ThemeContext
- Persistent theme preference storage
- CSS variables for theme colors

## Meeting Integration

The client integrates with multiple meeting platforms:

- **Zoom**: Join/create Zoom meetings
- **Microsoft Teams**: Join/create Teams meetings
- **Google Meet**: Join/create Google Meet meetings

Integration flow:

1. User connects their account with the meeting platform
2. Client stores access tokens securely
3. Client can create/join meetings via the platform's API

## Task Management

The client provides task management features:

- Task creation and assignment
- Task status tracking
- Task filtering and sorting
- Task detail view

## Feedback System

The client includes a feedback collection system:

- Feedback submission form
- Feedback analysis visualization
- Score analysis

## Performance Analytics

The client provides performance analytics visualization:

- Performance cloud
- Meeting analytics
- Word cloud for key topics
- Charts and data visualization

## Accessibility

The client implements accessibility features:

- Semantic HTML
- ARIA attributes
- Keyboard navigation
- Screen reader support

## Error Handling

The client implements comprehensive error handling:

- API error handling
- Fallback UI components
- Error boundaries
- User-friendly error messages

## Development and Deployment

### Development

To set up the client for development:

1. Install dependencies: `npm install --force`
2. Start development server: `npm start`

### Deployment

To deploy the client:

1. Build the application: `npm run build`
2. Deploy the build folder to a static hosting service

## Performance Optimization

The client implements various performance optimizations:

- Code splitting for reduced bundle size
- Lazy loading of components
- Memoization of expensive computations
- Optimized rendering with React.memo and useMemo

## Browser Compatibility

The client supports modern browsers:

- Chrome, Firefox, Safari, Edge
- Polyfills for older browsers
- Feature detection for progressive enhancement
