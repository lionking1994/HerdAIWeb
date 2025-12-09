import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import notificationReducer from './slices/notificationSlice';
import locationReducer from './slices/locationSlice';
import upcomingMeetingReducer from './slices/upcomingMeetingSlice';
import upcomingResearchReducer from './slices/upcomingResearchSlice';
import createMeetingReducer from './slices/createMeetingSlice';
import discussTaskReducer from './slices/discussTaskSlice';
import workflowReducer from './slices/workflowSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    notification: notificationReducer,
    location: locationReducer,
    upcomingMeeting: upcomingMeetingReducer,
    upcomingResearch: upcomingResearchReducer,
    createMeeting: createMeetingReducer,
    discussTask: discussTaskReducer,
    workflow: workflowReducer
  },
}); 