
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    meeting_id: null,
    meeting_title: "",
};

const upcomingMeetingSlice = createSlice({
    name: 'upcomingMeeting',  // Consistent naming
  initialState,
  reducers: {
    addMeeting: (state, action) => {
          state.meeting_id = action.payload.id;
          state.meeting_title = action.payload.title;
    }
  }
});

export const {
  addMeeting
} = upcomingMeetingSlice.actions;

export default upcomingMeetingSlice.reducer; 
