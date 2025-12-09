import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  workflowRequests: [], // Array of { uuid, path, timestamp }
  activeWorkflowModal: null, // { uuid, path, data }
  loading: false,
  error: null
};

const workflowSlice = createSlice({
  name: 'workflow',
  initialState,
  reducers: {
    addWorkflowRequest: (state, action) => {
      const { uuid, path } = action.payload;
      state.workflowRequests.push({
        uuid,
        path,
        timestamp: Date.now()
      });
    },
    setActiveWorkflowModal: (state, action) => {
      state.activeWorkflowModal = action.payload;
    },
    clearActiveWorkflowModal: (state) => {
      state.activeWorkflowModal = null;
    },
    removeWorkflowRequest: (state, action) => {
      const { uuid } = action.payload;
      state.workflowRequests = state.workflowRequests.filter(
        request => request.uuid !== uuid
      );
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const {
  addWorkflowRequest,
  setActiveWorkflowModal,
  clearActiveWorkflowModal,
  removeWorkflowRequest,
  setLoading,
  setError,
  clearError
} = workflowSlice.actions;

export default workflowSlice.reducer; 