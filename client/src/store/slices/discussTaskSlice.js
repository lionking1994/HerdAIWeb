import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    task_title: ''
};

const discussTaskSlice = createSlice({
    name: 'discussTask',
    initialState,
    reducers: {
        addTask: (state, action) => {
            state.task_title = action.payload.task_title;
        }
    }
});

export const {
    addTask
} = discussTaskSlice.actions;

export default discussTaskSlice.reducer;