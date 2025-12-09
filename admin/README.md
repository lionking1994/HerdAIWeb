# HerdAI Admin Dashboard

A comprehensive React-based admin dashboard for managing the HerdAI platform. Built with TypeScript, Vite, and modern React patterns.



## 🚀 Features

### Core Functionality
- **User Management** - Manage users, roles, and permissions
- **Company Management** - Oversee company accounts and subscriptions
- **Analytics Dashboard** - Real-time insights and metrics
- **System Settings** - Configure platform-wide settings
- **Feedback Management** - Handle user feedback and support requests
- **Meeting Management** - Monitor and manage meeting data
- **System Logs** - Track system activities and errors
- **Subscription Settings** - Manage billing and subscription plans
- **Company Roles** - Configure role-based access control

### Technical Features
- **Responsive Design** - Mobile-first approach with Tailwind CSS
- **Real-time Updates** - Live data updates and notifications
- **Advanced Charts** - Interactive data visualization with Chart.js and Recharts
- **Data Tables** - Sortable, filterable data tables with pagination
- **Authentication** - Role-based access control (padmin, cadmin, dev)
- **File Management** - Drag-and-drop file uploads
- **Search & Filter** - Advanced search capabilities across all modules

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Redux Toolkit** - State management
- **React Router** - Client-side routing
- **React Hook Form** - Form handling with validation
- **Zod** - Schema validation

### UI Components
- **Radix UI** - Accessible component primitives
- **Headless UI** - Unstyled, accessible UI components
- **Lucide React** - Beautiful icons
- **Framer Motion** - Smooth animations
- **React Toastify** - Toast notifications

### Data Visualization
- **Chart.js** - Flexible charting library
- **React Chart.js 2** - React wrapper for Chart.js
- **Recharts** - Composable charting library
- **React Wordcloud** - Word cloud visualization

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

## 📁 Project Structure

```
admin/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── charts/         # Chart components
│   │   ├── DataTable/      # Enhanced data table
│   │   ├── Feedback/       # Feedback components
│   │   ├── ModelManagementModal/
│   │   ├── StripeConfiguration/
│   │   └── ui/             # Base UI components
│   ├── contexts/           # React contexts
│   ├── lib/               # Utility libraries
│   ├── pages/             # Main page components
│   ├── routes/            # Routing configuration
│   ├── store/             # Redux store and slices
│   └── types.ts           # TypeScript type definitions
├── public/                # Static assets
└── dist/                  # Build output
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Access to the HerdAI API

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd admin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   VITE_API_BASE_URL=https://your-api-domain.com
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## 🔐 Authentication & Authorization

The admin dashboard supports three user roles:

- **padmin** - Platform Administrator (full access)
- **cadmin** - Company Administrator (company-specific access)
- **dev** - Developer (full access)

### Access Control
- Role-based route protection
- Company-specific data filtering for cadmin users
- Token-based authentication with automatic refresh

## 📊 Available Pages

### Dashboard (`/`)
- Overview of platform metrics
- Real-time statistics
- Quick action buttons
- Recent activity feed

### User Management (`/user-management`)
- View and manage all users
- Filter by company, role, status
- Bulk operations
- User profile management

### Company Management (`/company-management`)
- Manage company accounts
- Subscription status
- User count per company
- Company settings

### System Settings (`/system-settings`)
- Platform configuration
- Feature toggles
- System parameters
- Integration settings

### User Analytics (`/user-analytics`)
- User behavior analytics
- Engagement metrics
- Usage patterns
- Performance insights

### Feedback Management (`/feedback-management`)
- User feedback review
- Support ticket management
- Response tracking
- Feedback categorization

### System Logs (`/system-logs`)
- System activity logs
- Error tracking
- Performance monitoring
- Audit trail

### Meetings (`/meetings`)
- Meeting data overview
- Meeting analytics
- Participant tracking
- Meeting insights

### Company Roles (`/company-roles`)
- Role management
- Permission configuration
- Access control settings
- Role hierarchy

## 🎨 UI Components

### Data Visualization
- **Bar Charts** - For comparing categories
- **Line Charts** - For time-series data
- **Word Clouds** - For text analysis
- **Pie Charts** - For proportions

### Interactive Elements
- **Enhanced Data Tables** - Sortable, filterable, paginated
- **Search Bars** - Global and contextual search
- **File Drop Zones** - Drag-and-drop file uploads
- **Modal Dialogs** - For detailed views and forms

### Navigation
- **Sidebar** - Main navigation with role-based menu items
- **Header** - User info, notifications, and quick actions
- **Breadcrumbs** - Contextual navigation

## 🔧 Development

### Code Style
- TypeScript for type safety
- ESLint for code quality
- Prettier for code formatting
- Component-based architecture

### State Management
- Redux Toolkit for global state
- React Context for theme and auth
- Local state for component-specific data

### API Integration
- Axios for HTTP requests
- Automatic token handling
- Error boundary implementation
- Loading states

## 🚀 Deployment

### Build Configuration
The application is configured for deployment with:
- Base path configuration for subdirectory deployment
- Optimized build settings
- Source map generation for debugging

### Environment Variables
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_APP_ENV` - Environment (development/production)

## 📝 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 🤝 Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Include proper error handling
4. Test responsive design on mobile devices
5. Update documentation for new features

## 📞 Support

For technical support or questions about the admin dashboard, please contact the development team or create an issue in the repository.

## 📄 License

This project is part of the HerdAI platform and is proprietary software.

## Need to update

### vite.config.ts

```typescript
base: '/',  // Set this to your subfolder name
```

to

```typescript
base: '/admin'
```

### src/App.tsx

```typescript
function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <ToastContainer />
        <Router>
          <Routes />
        </Router>
      </AuthProvider>
    </Provider>
  );
}
```

to

```typescript
function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <ToastContainer />
        <Router basename='/admin'>
          <Routes />
        </Router>
      </AuthProvider>
    </Provider>
  );
}
```
