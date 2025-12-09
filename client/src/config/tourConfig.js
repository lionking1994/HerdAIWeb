// Tour configuration with all steps
export const tourSteps = [
    // Dashboard Introduction
    {
        selector: '.tour-search-bar',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Search Bar</h3>
                <p>Use this powerful search to quickly find meetings, tasks, or any content across your workspace. Search by keywords, dates, or participants.</p>
            </div>
        ),
    },
    {
        selector: '.tour-todays-schedule',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Today's Schedule</h3>
                <p>View your upcoming meetings for today. Click on any meeting to see details, join the meeting, or access AI-generated summaries and action items.</p>
            </div>
        ),
    },
    {
        selector: '.tour-top-assignees',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Top Assignees</h3>
                <p>See who's been most active with task assignments and completions. Click on any team member to view their profile and performance metrics.</p>
            </div>
        ),
    },
    // {
    //     selector: '.tour-previous-research',
    //     content: (
    //         <div>
    //             <h3 className="text-lg font-semibold mb-2">Previous Research</h3>
    //             <p>Access AI-generated insights and research from your recent meetings. This includes participant analysis, key topics discussed, and actionable recommendations.</p>
    //         </div>
    //     ),
    // },
    {
        selector: '.tour-open-tasks',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Open Tasks</h3>
                <p>See your pending tasks that need review or action. Tasks are automatically generated from meeting discussions and can be assigned to team members. Click to review, approve, or modify tasks.</p>
            </div>
        ),
    },
    {
        selector: '.favourite-documents',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Favorite Documents</h3>
                <p>Access AI-generated insights and research from your recent meetings. This includes participant analysis, key topics discussed, and actionable recommendations.</p>
            </div>
        ),
    },
    {
        selector: '.tour-previous-research',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Previous Research</h3>
                <p>Access AI-generated insights and research from your recent meetings. This includes participant analysis, key topics discussed, and actionable recommendations.</p>
            </div>
        ),
    },
    // {
    //     selector: '.tour-open-tasks',
    //     content: (
    //         <div>
    //             <h3 className="text-lg font-semibold mb-2">Open Tasks</h3>
    //             <p>See your pending tasks that need review or action. Tasks are automatically generated from meeting discussions and can be assigned to team members. Click to review, approve, or modify tasks.</p>
    //         </div>
    //     ),
    // },

    // // Navigation & Profile
    // {
    //     selector: '.user-menu-trigger',
    //     content: (
    //         <div>
    //             <h3 className="text-lg font-semibold mb-2">User Navigation & Profile</h3>
    //             <p>Click here to access your profile settings, account preferences, and sign out. You can also manage your subscription and view platform administration options if applicable.</p>
    //             <p className="mt-2 text-sm text-blue-600">💡 Tip: The Profile option will be highlighted when you're on the profile page!</p>
    //         </div>
    //     ),
    // },
    // {
    //     selector: '[data-tour="profile-nav"]',
    //     content: (
    //         <div>
    //             <h3 className="text-lg font-semibold mb-2">👤 Profile Settings</h3>
    //             <p>Access your profile page to:</p>
    //             <ul className="list-disc list-inside mt-2 space-y-1">
    //                 <li>Update personal information and avatar</li>
    //                 <li>Configure LinkedIn integration</li>
    //                 <li>Set default meeting platforms</li>
    //                 <li>Manage AI agent settings</li>
    //                 <li>Update security and password settings</li>
    //             </ul>
    //             <p className="mt-2 text-sm text-green-600">✨ This section is highlighted when you're on the profile page!</p>
    //         </div>
    //     ),
    //     skipIfNotFound: true
    // },
    // {
    //     selector: '.tour-notifications',
    //     content: (
    //         <div>
    //             <h3 className="text-lg font-semibold mb-2">🔔 Notifications</h3>
    //             <p>Stay updated with important alerts, task assignments, meeting reminders, and system notifications. The red dot indicates new unread notifications.</p>
    //         </div>
    //     ),
    // },

    // Navigation Items
    {
        selector: '[data-tour="activities-nav"]',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Activities Page</h3>
                <p>View all your meeting activities, including:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Meeting history and recordings</li>
                    <li>AI-generated summaries and transcripts</li>
                    <li>Participant insights and engagement metrics</li>
                    <li>Action items and follow-ups</li>
                </ul>
            </div>
        ),
    },
    {
        selector: '[data-tour="tasks-nav"]',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Tasks Page</h3>
                <p>Manage all your tasks in one place:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>View tasks by status (Open, In Progress, Completed)</li>
                    <li>Assign tasks to team members</li>
                    <li>Set due dates and priorities</li>
                    <li>Track task completion and performance</li>
                </ul>
            </div>
        ),
    },
    {
        selector: '[data-tour="performance-nav"]',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Performance Page</h3>
                <p>Analyze your productivity and performance:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>View performance word clouds and metrics</li>
                    <li>Track meeting participation and engagement</li>
                    <li>See task completion rates and trends</li>
                    <li>Compare performance across different time periods</li>
                </ul>
            </div>
        ),
    },

    // Profile & Connections (for when visiting profile)
    // {
    //     selector: '.profile-linkedin-section',
    //     content: (
    //         <div>
    //             <h3 className="text-lg font-semibold mb-2">LinkedIn Integration</h3>
    //             <p>Connect your LinkedIn account to:</p>
    //             <ul className="list-disc list-inside mt-2 space-y-1">
    //                 <li>Sync professional connections</li>
    //                 <li>Import contact information automatically</li>
    //                 <li>Enhance meeting participant insights</li>
    //                 <li>Get professional background context</li>
    //             </ul>
    //         </div>
    //     ),
    //     skipIfNotFound: true
    // },
    // {
    //     selector: '.profile-platform-settings',
    //     content: (
    //         <div>
    //             <h3 className="text-lg font-semibold mb-2">🎥 Meeting Platform Settings</h3>
    //             <p>Configure your default meeting platforms:</p>
    //             <ul className="list-disc list-inside mt-2 space-y-1">
    //                 <li>Enable Teams, Zoom, or Google Meet integration</li>
    //                 <li>Set up automatic meeting detection</li>
    //                 <li>Configure AI agent participation</li>
    //                 <li>Manage platform-specific settings</li>
    //             </ul>
    //         </div>
    //     ),
    //     skipIfNotFound: true
    // },

    // // Agent Engagement
    // {
    //     selector: '.tour-agent-frame',
    //     content: (
    //         <div>
    //             <h3 className="text-lg font-semibold mb-2">🤖 AI Agent Engagement</h3>
    //             <p>This is where you can interact with your AI meeting assistant:</p>
    //             <ul className="list-disc list-inside mt-2 space-y-1">
    //                 <li>Ask questions about meetings or tasks</li>
    //                 <li>Get summaries and insights</li>
    //                 <li>Request research on specific topics</li>
    //                 <li>Generate follow-up actions</li>
    //             </ul>
    //         </div>
    //     ),
    //     skipIfNotFound: true
    // },

    // Footer & Feedback
    {
        selector: '[data-tour="feedback-link"]',
        content: (
            <div>
                <h3 className="text-lg font-semibold mb-2">Feedback & Support</h3>
                <p>Help us improve! Use this link to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Report bugs or issues</li>
                    <li>Suggest new features</li>
                    <li>Share your experience</li>
                    <li>Get help and support</li>
                </ul>
            </div>
        ),
    },
];

// Tour styles configuration
export const tourStyles = {
    popover: (base) => ({
        ...base,
        '--reactour-accent': '#2563eb',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '420px',
    }),
    maskArea: (base) => ({
        ...base,
        rx: 8
    }),
    badge: (base) => ({
        ...base,
        left: 'auto',
        right: '-0.8125em',
    }),
};

// Storage keys for tour state
export const TOUR_STORAGE_KEYS = {
    COMPLETED: 'herd-ai-tour-completed',
    LAST_STEP: 'herd-ai-tour-last-step',
}; 