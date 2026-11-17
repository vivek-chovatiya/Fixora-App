/**
 * Redux store
 *
 * Holds state that genuinely crosses module boundaries. Screen-local state stays
 * in the screen (CLAUDE.md section 12); this store is not a dumping ground.
 *
 * Feature reducers are added here as their modules land — requests, categories
 * and profile in Stages 3 and 4.
 */

import { configureStore } from '@reduxjs/toolkit';

import { authReducer } from '@/features/auth/state/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
