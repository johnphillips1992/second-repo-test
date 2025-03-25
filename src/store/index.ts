import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import memoriesReducer from './slices/memoriesSlice';
import navigationReducer from './slices/navigationSlice';
import notificationsReducer from './slices/notificationsSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    memories: memoriesReducer,
    navigation: navigationReducer,
    notifications: notificationsReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values in specific paths
        ignoredActions: ['memories/setMemoryFiles'],
        ignoredPaths: ['memories.currentMemory.files'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;