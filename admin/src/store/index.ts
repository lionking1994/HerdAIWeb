import { configureStore } from '@reduxjs/toolkit';
import quarterReducer from './slices/quarterSlice';
import workflowReducer from './slices/workflowSlice';

export const store = configureStore({
  reducer: {
    quarter: quarterReducer,
    workflow: workflowReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
