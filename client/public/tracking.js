// User Action Tracking Script
class UserActionTracker {
    constructor() {
        this.actions = [];
        this.isTracking = false;
        this.config = {
            trackMouseClicks: true,
            trackMouseMovements: true,
            trackScroll: true,
            trackKeyPresses: true,
            trackPageViews: true,
            maxActions: 1000, // Limit to prevent memory issues
            mouseMovementThrottle: 100, // Throttle mouse movement events (ms)
            sessionId: this.generateSessionId()
        };
        
        this.lastMouseMoveTime = 0;
        this.pageStartTime = Date.now();
        this.sessionStartTime = Date.now();
        this.currentPage = window.location.pathname;
        this.pageTimeIntervals = [];
        this.init();
    }

    // Generate unique session ID
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Initialize tracking
    init() {
        if (this.isTracking) return;
        
        this.isTracking = true;
        this.currentPath = window.location.pathname;
        this.trackPageView();
        this.setupEventListeners();
        this.setupPathChangeTracking();
        console.log('User action tracking initialized');
    }

    // Setup event listeners
    setupEventListeners() {
        if (this.config.trackMouseClicks) {
            document.addEventListener('click', this.handleMouseClick.bind(this), true);
        }

        if (this.config.trackMouseMovements) {
            document.addEventListener('mousemove', this.handleMouseMove.bind(this), true);
        }

        if (this.config.trackScroll) {
            document.addEventListener('scroll', this.handleScroll.bind(this), true);
            window.addEventListener('scroll', this.handleScroll.bind(this), true);
        }

        if (this.config.trackKeyPresses) {
            document.addEventListener('keydown', this.handleKeyPress.bind(this), true);
        }

        // Track page visibility changes
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
        
        // Track before unload
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }

    // Setup path change tracking
    setupPathChangeTracking() {
        // Track initial path
        this.currentPath = window.location.pathname;
        this.currentUrl = window.location.href;
        
        // Use History API to track navigation changes
        // eslint-disable-next-line no-restricted-globals
        const originalPushState = history.pushState;
        // eslint-disable-next-line no-restricted-globals
        const originalReplaceState = history.replaceState;
        
        // Override pushState
        // eslint-disable-next-line no-restricted-globals
        history.pushState = (...args) => {
            // eslint-disable-next-line no-restricted-globals
            originalPushState.apply(history, args);
            this.handlePathChange();
        };
        
        // Override replaceState
        // eslint-disable-next-line no-restricted-globals
        history.replaceState = (...args) => {
            // eslint-disable-next-line no-restricted-globals
            originalReplaceState.apply(history, args);
            this.handlePathChange();
        };
        
        // Listen for popstate events (back/forward navigation)
        window.addEventListener('popstate', this.handlePathChange.bind(this));
        
        // Listen for hash changes
        window.addEventListener('hashchange', this.handlePathChange.bind(this));
        
        // Use MutationObserver to detect DOM changes that might indicate navigation
        this.setupMutationObserver();
    }

    // Handle path changes
    handlePathChange() {
        const newPath = window.location.pathname;
        const newUrl = window.location.href;
        
        // Only track if path actually changed
        if (newPath !== this.currentPath || newUrl !== this.currentUrl) {
            const oldPath = this.currentPath;
            const oldUrl = this.currentUrl;
            
            // Calculate time spent on previous page
            const currentTime = Date.now();
            const timeOnPage = currentTime - this.pageStartTime;
            
            // Store page time interval
            this.pageTimeIntervals.push({
                path: oldPath,
                url: oldUrl,
                startTime: this.pageStartTime,
                endTime: currentTime,
                duration: timeOnPage
            });
            
            console.log('Path changed:', { 
                from: oldPath, 
                to: newPath, 
                fromUrl: oldUrl, 
                toUrl: newUrl,
                timeOnPage: timeOnPage
            });
            
            // Track the path change with time data
            const action = {
                type: 'path_change',
                timestamp: currentTime,
                sessionId: this.config.sessionId,
                pathChange: {
                    from: oldPath,
                    to: newPath,
                    fromUrl: oldUrl,
                    toUrl: newUrl,
                    referrer: document.referrer,
                    timeOnPreviousPage: timeOnPage
                },
                url: newUrl,
                pathName: newPath,
                tab: window.location.search.split('tab=')[1] || '',
                userAgent: navigator.userAgent,
                title: document.title,
                timeOnPage: timeOnPage
            };
            if (window.location.pathname === '' || window.location.pathname === '/') return;
            this.addAction(action);
            
            // Update current path and reset page start time
            this.currentPath = newPath;
            this.currentUrl = newUrl;
            this.pageStartTime = currentTime;
            
            // Track new page view after path change
            setTimeout(() => {
                this.trackPageView();
            }, 100);
        }
    }

    // Setup MutationObserver to detect navigation changes
    setupMutationObserver() {
        // Observe title changes which often indicate navigation
        const titleObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.target.tagName === 'TITLE') {
                    // Title changed, might indicate navigation
                    setTimeout(() => {
                        this.handlePathChange();
                    }, 50);
                }
            });
        });
        
        if (document.title) {
            titleObserver.observe(document.querySelector('title') || document.head, {
                childList: true,
                subtree: true
            });
        }
        
        // Store observer for cleanup
        this.titleObserver = titleObserver;
    }

    // Handle mouse click events
    handleMouseClick(event) {
        const action = {
            type: 'click',
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            element: {
                tagName: event.target.tagName,
                className: event.target.className,
                id: event.target.id,
                textContent: event.target.textContent?.substring(0, 100) || '',
                href: event.target.href || '',
                type: event.target.type || ''
            },
            position: {
                x: event.clientX,
                y: event.clientY,
                pageX: event.pageX,
                pageY: event.pageY
            },
            modifiers: {
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey
            },
            url: window.location.href,
            userAgent: navigator.userAgent,
            pathName: window.location.pathname,
            tab: window.location.search.split('tab=')[1] || ''
        };
        if (window.location.pathname === '' || window.location.pathname === '/') return;
        this.addAction(action);
    }

    // Handle mouse movement events (throttled)
    handleMouseMove(event) {
        const now = Date.now();
        if (now - this.lastMouseMoveTime < this.config.mouseMovementThrottle) {
            return;
        }
        this.lastMouseMoveTime = now;

        const action = {
            type: 'mousemove',
            timestamp: now,
            sessionId: this.config.sessionId,
            position: {
                x: event.clientX,
                y: event.clientY,
                pageX: event.pageX,
                pageY: event.pageY
            },
            url: window.location.href,
            pathName: window.location.pathname,
            tab: window.location.search.split('tab=')[1] || ''
        };
        if (window.location.pathname === '' || window.location.pathname === '/') return;
        this.addAction(action);
    }

    // Handle scroll events
    handleScroll(event) {
        const action = {
            type: 'scroll',
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            scrollPosition: {
                scrollX: window.scrollX,
                scrollY: window.scrollY,
                scrollTop: event.target.scrollTop || 0,
                scrollLeft: event.target.scrollLeft || 0
            },
            element: {
                tagName: event.target.tagName,
                className: event.target.className,
                id: event.target.id
            },
            url: window.location.href
        };
        if (window.location.pathname === '' || window.location.pathname === '/') return;
        this.addAction(action);
    }

    // Handle key press events
    handleKeyPress(event) {
        // Skip tracking for common navigation keys to reduce noise
        const skipKeys = ['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (skipKeys.includes(event.key)) return;

        const action = {
            type: 'keypress',
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            key: event.key,
            code: event.code,
            modifiers: {
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey
            },
            element: {
                tagName: event.target.tagName,
                className: event.target.className,
                id: event.target.id,
                type: event.target.type || ''
            },
            url: window.location.href,
            pathName: window.location.pathname,
            tab: window.location.search.split('tab=')[1] || ''
        };
        if (window.location.pathname === '' || window.location.pathname === '/') return;
        this.addAction(action);
    }

    // Handle page visibility changes
    handleVisibilityChange() {
        const action = {
            type: 'visibility_change',
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            hidden: document.hidden,
            url: window.location.href,
            pathName: window.location.pathname,
            tab: window.location.search.split('tab=')[1] || ''
        };
        if (window.location.pathname === '' || window.location.pathname === '/') return;
        this.addAction(action);
    }

    // Handle before unload
    handleBeforeUnload() {
        const currentTime = Date.now();
        const timeOnPage = currentTime - this.pageStartTime;
        const sessionDuration = currentTime - this.sessionStartTime;
        
        // Store final page time interval
        this.pageTimeIntervals.push({
            path: this.currentPage,
            url: window.location.href,
            startTime: this.pageStartTime,
            endTime: currentTime,
            duration: timeOnPage
        });
        
        const action = {
            type: 'page_unload',
            timestamp: currentTime,
            sessionId: this.config.sessionId,
            url: window.location.href,
            pathName: window.location.pathname,
            tab: window.location.search.split('tab=')[1] || '',
            timeOnPage: timeOnPage,
            sessionDuration: sessionDuration,
            pageTimeIntervals: this.pageTimeIntervals
        };
        if (window.location.pathname === '' || window.location.pathname === '/') return;
        this.addAction(action);
        // this.saveToStorage();
    }

    // Track page view
    trackPageView() {
        const action = {
            type: 'page_view',
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            url: window.location.href,
            referrer: document.referrer,
            title: document.title,
            userAgent: navigator.userAgent,
            screenResolution: {
                width: window.screen?.width || 0,
                height: window.screen?.height || 0
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            pathName: window.location.pathname,
            tab: window.location.search.split('tab=')[1] || ''
        };
        console.log('page_view is called!');
        if (window.location.pathname === '' || window.location.pathname === '/') return;
        this.addAction(action);
    }

    // Add action to array
    addAction(action) {

        this.actions.push(action);
        
        // Limit array size to prevent memory issues
        if (this.actions.length > this.config.maxActions) {
            this.actions = this.actions.slice(-this.config.maxActions);
        }

        // Auto-save to localStorage periodically
        // if (this.actions.length % 50 === 0) {
        //     this.saveToStorage();
        // }
    }

    // Save actions to localStorage
    // saveToStorage() {
    //     try {
    //         const storageKey = `user_actions_${this.config.sessionId}`;
    //         localStorage.setItem(storageKey, JSON.stringify({
    //             sessionId: this.config.sessionId,
    //             actions: this.actions,
    //             lastUpdated: Date.now()
    //         }));
    //     } catch (error) {
    //         console.warn('Failed to save actions to localStorage:', error);
    //     }
    // }

    // Load actions from localStorage
    loadFromStorage() {
        try {
            const storageKey = `user_actions_${this.config.sessionId}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                this.actions = data.actions || [];
                return true;
            }
        } catch (error) {
            console.warn('Failed to load actions from localStorage:', error);
        }
        return false;
    }

    // Get all actions
    getActions() {
        return this.actions;
    }

    // Get actions by type
    getActionsByType(type) {
        return this.actions.filter(action => action.type === type);
    }

    // Get path change actions
    getPathChanges() {
        return this.getActionsByType('path_change');
    }

    // Get path change statistics
    getPathChangeStats() {
        const pathChanges = this.getPathChanges();
        const stats = {
            totalPathChanges: pathChanges.length,
            uniquePaths: new Set(),
            pathTransitions: {},
            mostFrequentPaths: {}
        };

        pathChanges.forEach(change => {
            const fromPath = change.pathChange.from;
            const toPath = change.pathChange.to;
            
            // Track unique paths
            stats.uniquePaths.add(fromPath);
            stats.uniquePaths.add(toPath);
            
            // Track path transitions
            const transitionKey = `${fromPath} -> ${toPath}`;
            stats.pathTransitions[transitionKey] = (stats.pathTransitions[transitionKey] || 0) + 1;
            
            // Track most frequent paths
            stats.mostFrequentPaths[toPath] = (stats.mostFrequentPaths[toPath] || 0) + 1;
        });

        stats.uniquePaths = Array.from(stats.uniquePaths);
        
        // Sort by frequency
        stats.mostFrequentPaths = Object.entries(stats.mostFrequentPaths)
            .sort(([,a], [,b]) => b - a)
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});

        return stats;
    }

    // Manually track a path change
    trackPathChange(fromPath, toPath, additionalData = {}) {
        const action = {
            type: 'path_change',
            timestamp: Date.now(),
            sessionId: this.config.sessionId,
            pathChange: {
                from: fromPath,
                to: toPath,
                fromUrl: window.location.href,
                toUrl: window.location.href,
                referrer: document.referrer,
                ...additionalData
            },
            url: window.location.href,
            pathName: toPath,
            tab: window.location.search.split('tab=')[1] || '',
            userAgent: navigator.userAgent,
            title: document.title
        };
        if (window.location.pathname === '' || window.location.pathname === '/') return;
        
        this.addAction(action);
        console.log('Manual path change tracked:', { from: fromPath, to: toPath });
        
        return action;
    }

    // Get current path
    getCurrentPath() {
        return {
            path: this.currentPath,
            url: this.currentUrl,
            fullUrl: window.location.href,
            pathname: window.location.pathname,
            search: window.location.search,
            hash: window.location.hash
        };
    }

    // Check if path has changed since last check
    hasPathChanged() {
        const currentPath = window.location.pathname;
        const currentUrl = window.location.href;
        return currentPath !== this.currentPath || currentUrl !== this.currentUrl;
    }

    // Force check for path changes
    checkPathChange() {
        if (this.hasPathChanged()) {
            this.handlePathChange();
            return true;
        }
        return false;
    }

    // Get actions within time range
    getActionsInTimeRange(startTime, endTime) {
        return this.actions.filter(action => 
            action.timestamp >= startTime && action.timestamp <= endTime
        );
    }

    // Get session summary
    getSessionSummary() {
        const summary = {
            sessionId: this.config.sessionId,
            startTime: this.actions.length > 0 ? this.actions[0].timestamp : null,
            endTime: this.actions.length > 0 ? this.actions[this.actions.length - 1].timestamp : null,
            totalActions: this.actions.length,
            actionTypes: {},
            pagesVisited: new Set(),
            pathChanges: [],
            totalDuration: 0,
            timeMetrics: this.getTimeMetrics()
        };

        // Count action types and collect path changes
        this.actions.forEach(action => {
            summary.actionTypes[action.type] = (summary.actionTypes[action.type] || 0) + 1;
            if (action.url) {
                summary.pagesVisited.add(action.url);
            }
            if (action.type === 'path_change') {
                summary.pathChanges.push({
                    from: action.pathChange.from,
                    to: action.pathChange.to,
                    timestamp: action.timestamp,
                    timeOnPreviousPage: action.timeOnPage
                });
            }
        });

        // Calculate duration
        if (summary.startTime && summary.endTime) {
            summary.totalDuration = summary.endTime - summary.startTime;
        }

        summary.pagesVisited = Array.from(summary.pagesVisited);

        return summary;
    }

    // Get time metrics
    getTimeMetrics() {
        const currentTime = Date.now();
        const sessionDuration = currentTime - this.sessionStartTime;
        const currentPageTime = currentTime - this.pageStartTime;
        
        // Calculate average time on page from page intervals
        const pageDurations = this.pageTimeIntervals.map(interval => interval.duration);
        const averageTimeOnPage = pageDurations.length > 0 
            ? pageDurations.reduce((sum, duration) => sum + duration, 0) / pageDurations.length 
            : currentPageTime;
        
        // Group by page to get average time per page
        const pageTimeMap = {};
        this.pageTimeIntervals.forEach(interval => {
            if (!pageTimeMap[interval.path]) {
                pageTimeMap[interval.path] = [];
            }
            pageTimeMap[interval.path].push(interval.duration);
        });
        
        const averageTimePerPage = {};
        Object.keys(pageTimeMap).forEach(path => {
            const durations = pageTimeMap[path];
            averageTimePerPage[path] = durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
        });
        
        return {
            sessionDuration: sessionDuration,
            currentPageTime: currentPageTime,
            averageTimeOnPage: averageTimeOnPage,
            averageTimePerPage: averageTimePerPage,
            totalPagesVisited: this.pageTimeIntervals.length + 1, // +1 for current page
            pageTimeIntervals: this.pageTimeIntervals
        };
    }

    // Clear actions
    clearActions() {
        this.actions = [];
        // this.saveToStorage();
    }

    // Stop tracking
    stop() {
        this.isTracking = false;
        document.removeEventListener('click', this.handleMouseClick);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('scroll', this.handleScroll);
        document.removeEventListener('keydown', this.handleKeyPress);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
        window.removeEventListener('popstate', this.handlePathChange);
        window.removeEventListener('hashchange', this.handlePathChange);
        
        // Cleanup MutationObserver
        if (this.titleObserver) {
            this.titleObserver.disconnect();
            this.titleObserver = null;
        }
        
        console.log('User action tracking stopped');
    }

    // Export actions as JSON
    exportActions() {
        return JSON.stringify({
            sessionId: this.config.sessionId,
            actions: this.actions,
            summary: this.getSessionSummary(),
            exportedAt: Date.now()
        }, null, 2);
    }

    // Update configuration
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    // Send actions to server
    async sendToServer(endpoint = '/api/user-analytics/track-actions', options = {}) {
        if (this.actions.length === 0) {
            console.log('No actions to send');
            return { success: true, message: 'No actions to send' };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({actions:this.actions})
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Failed to send tracking data:', error);
            return { success: false, error: error.message };
        }
    }

    // Send data in batches
    async sendInBatches(endpoint, dataToSend, config) {
        const batches = [];
        const actions = [...this.actions];
        
        // Split actions into batches
        for (let i = 0; i < actions.length; i += config.batchSize) {
            batches.push(actions.slice(i, i + config.batchSize));
        }

        const results = [];
        
        for (let i = 0; i < batches.length; i++) {
            const batchData = {
                ...dataToSend,
                actions: batches[i],
                batchNumber: i + 1,
                totalBatches: batches.length
            };

            const result = await this.sendRequest(endpoint, batchData, config);
            results.push(result);

            // Add delay between batches to avoid overwhelming server
            if (i < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return {
            success: results.every(r => r.success),
            results,
            totalBatches: batches.length
        };
    }

    // Send individual request with retry logic
    async sendRequest(endpoint, data, config) {
        let lastError;
        
        for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
            try {
                const response = await fetch(endpoint, {
                    method: config.method,
                    headers: config.headers,
                    body: JSON.stringify(data),
                    credentials: 'include' // Include cookies if needed
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const result = await response.json();
                return { success: true, data: result, attempt };

            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${attempt} failed:`, error.message);
                
                if (attempt < config.retryAttempts) {
                    await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempt));
                }
            }
        }

        throw lastError;
    }

    // Send actions periodically (auto-send)
    startAutoSend(interval = 30000, endpoint = '/api/user-analytics/track-actions', options = {}) {
        if (this.autoSendInterval) {
            this.stopAutoSend();
        }

        this.autoSendInterval = setInterval(async () => {
            if (this.actions.length > 0) {
                console.log(this.actions)
                console.log(`Auto-sending ${this.actions.length} actions to server...`);
                const result = await this.sendToServer(endpoint, options);
                
                if (result.success) {
                    // Clear sent actions after successful send
                    this.actions = [];
                    // this.saveToStorage();
                    console.log('Actions sent successfully, cleared from memory');
                } else {
                    console.warn('Auto-send failed:', result.error);
                }
            }
        }, interval);

        console.log(`Auto-send started with ${interval}ms interval`);
    }

    // Stop auto-send
    stopAutoSend() {
        if (this.autoSendInterval) {
            clearInterval(this.autoSendInterval);
            this.autoSendInterval = null;
            console.log('Auto-send stopped');
        }
    }

    // Send actions immediately and clear them
    async sendAndClear(endpoint = '/api/user-analytics/track-actions', options = {}) {
        const result = await this.sendToServer(endpoint, options);
        
        if (result.success) {
            this.actions = [];
            this.saveToStorage();
            console.log('Actions sent and cleared from memory');
        }
        
        return result;
    }

    // Send actions without clearing them
    async sendAndKeep(endpoint = '/api/user-analytics/track-actions', options = {}) {
        return await this.sendToServer(endpoint, options);
    }
}

// Initialize tracker when DOM is loaded
let userTracker;

document.addEventListener('DOMContentLoaded', function() {
    userTracker = new UserActionTracker();
    
    // Load existing actions from storage
    userTracker.loadFromStorage();
    
    // Make tracker globally accessible
    window.userTracker = userTracker;
    
    console.log('User action tracker ready');
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserActionTracker;
}
