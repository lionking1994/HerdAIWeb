import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    meeting_topic: ''
};

const createMeetingSlice = createSlice({
    name: 'createMeeting',
    initialState,
    reducers: {
        addcreatemeeting: (state, action) => {
            state.meeting_topic = action.payload.meeting_topic;
        }
    }
});

export const {
    addcreatemeeting
} = createMeetingSlice.actions;

export default createMeetingSlice.reducer;