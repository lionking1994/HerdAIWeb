import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  currentPath: '',
  previousPath: ''
};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    setLocation: (state, action) => {
      state.previousPath = state.currentPath;
      state.currentPath = action.payload;
    }
  }
});

export const { setLocation } = locationSlice.actions;
export default locationSlice.reducer;