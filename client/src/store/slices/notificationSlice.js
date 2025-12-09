import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  message: ""
};

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      state.message = action.payload;
    }
  }
});

export const {
  addMessage
} = notificationSlice.actions;

export default notificationSlice.reducer; 