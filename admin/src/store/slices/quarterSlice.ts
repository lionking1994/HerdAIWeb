import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface QuarterState {
  currentQuarter: string;
}

const initialState: QuarterState = {
  currentQuarter: ''
};

const quarterSlice = createSlice({
  name: 'quarter',
  initialState,
  reducers: {
    setQuarter: (state, action: PayloadAction<string>) => {
      state.currentQuarter = action.payload;
    }
  }
});

export const { setQuarter } = quarterSlice.actions;
export default quarterSlice.reducer;