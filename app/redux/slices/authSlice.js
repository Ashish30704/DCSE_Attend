import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  role: null, // 'admin', 'teacher', or 'student'
  loading: true,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Set authenticated user data
     * Should only be called from AuthGate when Firebase auth state changes
     * Never pass null - use clearUser instead
     */
    setUser: (state, action) => {
      if (!action.payload) {
        console.error('[authSlice] setUser called with null - use clearUser instead');
        return;
      }
      state.user = action.payload;
      state.role = action.payload.role || null;
      state.isAuthenticated = !!action.payload && !!action.payload.role;
      state.loading = false;
    },
    /**
     * Clear user data on logout or when no authenticated user
     * This is the correct way to handle logged-out state
     */
    clearUser: (state) => {
      state.user = null;
      state.role = null;
      state.isAuthenticated = false;
      state.loading = false;
    },
    /**
     * Set loading state
     * Used during initial auth state resolution
     */
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
  },
});

export const { setUser, clearUser, setLoading } = authSlice.actions;
export default authSlice.reducer;

