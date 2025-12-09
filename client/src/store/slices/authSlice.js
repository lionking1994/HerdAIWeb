import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isAuthenticated: !!localStorage.getItem('token'),
  user: null,
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload;
      state.loading = false;
      state.error = null;
    },
    loginFailure: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.loading = false;
      state.error = null;
      localStorage.removeItem('token');

      // Clear all user-specific FloatingAgent flags
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('hasVisitedDashboard_') || key.startsWith('userManuallyClosed_')) {
          localStorage.removeItem(key);
        }
      });

      // Clear meeting platform check flags for all users on logout
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('meeting-platform-check-shown-')) {
          localStorage.removeItem(key);
        }
      });
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
    }
  }
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  updateUser
} = authSlice.actions;

export default authSlice.reducer;
