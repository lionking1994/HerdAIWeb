import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    research_topic: null
};

const upcomingResearchSlice = createSlice({
    name: 'upcomingResearch',
    initialState,
    reducers: {
        addResearch: (state, action) => {
            state.research_topic = action.payload.research_topic;
        }
    }
});

export const {
    addResearch
} = upcomingResearchSlice.actions;

export default upcomingResearchSlice.reducer;