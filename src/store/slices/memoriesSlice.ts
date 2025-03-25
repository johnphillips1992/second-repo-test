import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  GeoPoint,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import { RootState } from '../index';

export interface MemoryLocation {
  latitude: number;
  longitude: number;
  address: string;
  name?: string;
}

export interface MemoryTag {
  id: string;
  name: string;
}

export interface MemoryMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  caption?: string;
}

export interface Memory {
  id: string;
  userId: string;
  title: string;
  description: string;
  location: MemoryLocation;
  tags: MemoryTag[];
  media: MemoryMedia[];
  importance: number; // 1-5 rating for how important this memory is
  date?: Date;
  createdAt: Date;
  updatedAt: Date;
  isPrivate: boolean;
}

export interface MemoryFormData {
  title: string;
  description: string;
  location: MemoryLocation;
  tags: MemoryTag[];
  files?: File[];
  importance: number;
  date?: Date;
  isPrivate: boolean;
}

interface MemoriesState {
  memories: Memory[];
  filteredMemories: Memory[];
  currentMemory: Memory | null;
  isLoading: boolean;
  error: string | null;
  activeFilters: {
    tags: string[];
    dateRange: { from: Date | null; to: Date | null };
    importance: number | null;
  };
}

const initialState: MemoriesState = {
  memories: [],
  filteredMemories: [],
  currentMemory: null,
  isLoading: false,
  error: null,
  activeFilters: {
    tags: [],
    dateRange: { from: null, to: null },
    importance: null,
  },
};

// Async thunks
export const fetchMemories = createAsyncThunk(
  'memories/fetchMemories',
  async (userId: string, { rejectWithValue }) => {
    try {
      const memoriesRef = collection(db, 'memories');
      const q = query(
        memoriesRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const memoriesData: Memory[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        memoriesData.push({
          id: doc.id,
          userId: data.userId,
          title: data.title,
          description: data.description,
          location: {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            address: data.location.address,
            name: data.location.name,
          },
          tags: data.tags || [],
          media: data.media || [],
          importance: data.importance || 3,
          date: data.date ? data.date.toDate() : undefined,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          isPrivate: data.isPrivate,
        });
      });
      
      return memoriesData;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchMemoryById = createAsyncThunk(
  'memories/fetchMemoryById',
  async (memoryId: string, { rejectWithValue }) => {
    try {
      const memoryRef = doc(db, 'memories', memoryId);
      const memoryDoc = await getDoc(memoryRef);
      
      if (!memoryDoc.exists()) {
        return rejectWithValue('Memory not found');
      }
      
      const data = memoryDoc.data();
      return {
        id: memoryDoc.id,
        userId: data.userId,
        title: data.title,
        description: data.description,
        location: {
          latitude: data.location.latitude,
          longitude: data.location.longitude,
          address: data.location.address,
          name: data.location.name,
        },
        tags: data.tags || [],
        media: data.media || [],
        importance: data.importance || 3,
        date: data.date ? data.date.toDate() : undefined,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        isPrivate: data.isPrivate,
      } as Memory;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createMemory = createAsyncThunk(
  'memories/createMemory',
  async ({ 
    memoryData, 
    files 
  }: { 
    memoryData: Omit<MemoryFormData, 'files'>, 
    files: File[] 
  }, 
  { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as RootState;
      const userId = state.auth.user?.uid;
      
      if (!userId) {
        return rejectWithValue('User not authenticated');
      }
      
      // Upload files first
      const mediaItems: MemoryMedia[] = [];
      
      for (const file of files) {
        const fileId = Date.now().toString();
        const fileRef = ref(storage, `memories/${userId}/${fileId}_${file.name}`);
        
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);
        
        const type = file.type.startsWith('image/') ? 'image' : 'video';
        
        mediaItems.push({
          id: fileId,
          type,
          url: downloadUrl,
          caption: '',
        });
      }
      
      // Create memory document
      const memoryData = {
        userId,
        title: memoryData.title,
        description: memoryData.description,
        location: new GeoPoint(
          memoryData.location.latitude,
          memoryData.location.longitude
        ),
        locationData: {
          address: memoryData.location.address,
          name: memoryData.location.name,
        },
        tags: memoryData.tags,
        media: mediaItems,
        importance: memoryData.importance,
        date: memoryData.date,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPrivate: memoryData.isPrivate,
      };
      
      const docRef = await addDoc(collection(db, 'memories'), memoryData);
      
      return {
        id: docRef.id,
        userId,
        title: memoryData.title,
        description: memoryData.description,
        location: {
          latitude: memoryData.location.latitude,
          longitude: memoryData.location.longitude,
          address: memoryData.locationData.address,
          name: memoryData.locationData.name,
        },
        tags: memoryData.tags,
        media: mediaItems,
        importance: memoryData.importance,
        date: memoryData.date,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPrivate: memoryData.isPrivate,
      } as Memory;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateMemory = createAsyncThunk(
  'memories/updateMemory',
  async ({ 
    memoryId, 
    memoryData, 
    newFiles = [], 
    removedMediaIds = [] 
  }: { 
    memoryId: string;
    memoryData: Omit<MemoryFormData, 'files'>;
    newFiles?: File[];
    removedMediaIds?: string[];
  }, 
  { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as RootState;
      const userId = state.auth.user?.uid;
      
      if (!userId) {
        return rejectWithValue('User not authenticated');
      }
      
      // Get the current memory data
      const memoryRef = doc(db, 'memories', memoryId);
      const memoryDoc = await getDoc(memoryRef);
      
      if (!memoryDoc.exists()) {
        return rejectWithValue('Memory not found');
      }
      
      const currentData = memoryDoc.data();
      
      // Remove deleted media files from storage
      for (const mediaId of removedMediaIds) {
        const mediaItem = currentData.media.find((item: any) => item.id === mediaId);
        if (mediaItem) {
          try {
            // Extract the file path from the URL
            const fileUrl = mediaItem.url;
            const fileRef = ref(storage, fileUrl);
            await deleteObject(fileRef);
          } catch (error) {
            console.error('Error deleting file:', error);
            // Continue even if deletion fails
          }
        }
      }
      
      // Upload new files
      const newMediaItems: MemoryMedia[] = [];
      
      for (const file of newFiles) {
        const fileId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
        const fileRef = ref(storage, `memories/${userId}/${fileId}_${file.name}`);
        
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);
        
        const type = file.type.startsWith('image/') ? 'image' : 'video';
        
        newMediaItems.push({
          id: fileId,
          type,
          url: downloadUrl,
          caption: '',
        });
      }
      
      // Combine the remaining media with the new ones
      const updatedMedia = [
        ...currentData.media.filter((item: any) => !removedMediaIds.includes(item.id)),
        ...newMediaItems
      ];
      
      // Update the memory document
      const updatedMemoryData = {
        title: memoryData.title,
        description: memoryData.description,
        location: new GeoPoint(
          memoryData.location.latitude,
          memoryData.location.longitude
        ),
        locationData: {
          address: memoryData.location.address,
          name: memoryData.location.name,
        },
        tags: memoryData.tags,
        media: updatedMedia,
        importance: memoryData.importance,
        date: memoryData.date,
        updatedAt: serverTimestamp(),
        isPrivate: memoryData.isPrivate,
      };
      
      await updateDoc(memoryRef, updatedMemoryData);
      
      return {
        id: memoryId,
        userId,
        title: memoryData.title,
        description: memoryData.description,
        location: {
          latitude: memoryData.location.latitude,
          longitude: memoryData.location.longitude,
          address: memoryData.location.address,
          name: memoryData.location.name,
        },
        tags: memoryData.tags,
        media: updatedMedia,
        importance: memoryData.importance,
        date: memoryData.date,
        createdAt: currentData.createdAt.toDate(),
        updatedAt: new Date(),
        isPrivate: memoryData.isPrivate,
      } as Memory;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteMemory = createAsyncThunk(
  'memories/deleteMemory',
  async (memoryId: string, { rejectWithValue, getState }) => {
    try {
      const state = getState() as RootState;
      const userId = state.auth.user?.uid;
      
      if (!userId) {
        return rejectWithValue('User not authenticated');
      }
      
      // Get the memory to delete its media files
      const memoryRef = doc(db, 'memories', memoryId);
      const memoryDoc = await getDoc(memoryRef);
      
      if (!memoryDoc.exists()) {
        return rejectWithValue('Memory not found');
      }
      
      const memoryData = memoryDoc.data();
      
      // Delete media files from storage
      if (memoryData.media && memoryData.media.length > 0) {
        for (const mediaItem of memoryData.media) {
          try {
            const fileRef = ref(storage, mediaItem.url);
            await deleteObject(fileRef);
          } catch (error) {
            console.error('Error deleting file:', error);
            // Continue even if deletion fails
          }
        }
      }
      
      // Delete the memory document
      await deleteDoc(memoryRef);
      
      return memoryId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const memoriesSlice = createSlice({
  name: 'memories',
  initialState,
  reducers: {
    clearCurrentMemory: (state) => {
      state.currentMemory = null;
    },
    setFilterTags: (state, action: PayloadAction<string[]>) => {
      state.activeFilters.tags = action.payload;
      state.filteredMemories = applyFilters(state.memories, state.activeFilters);
    },
    setFilterDateRange: (state, action: PayloadAction<{ from: Date | null; to: Date | null }>) => {
      state.activeFilters.dateRange = action.payload;
      state.filteredMemories = applyFilters(state.memories, state.activeFilters);
    },
    setFilterImportance: (state, action: PayloadAction<number | null>) => {
      state.activeFilters.importance = action.payload;
      state.filteredMemories = applyFilters(state.memories, state.activeFilters);
    },
    clearFilters: (state) => {
      state.activeFilters = {
        tags: [],
        dateRange: { from: null, to: null },
        importance: null,
      };
      state.filteredMemories = state.memories;
    },
  },
  extraReducers: (builder) => {
    // Fetch memories
    builder.addCase(fetchMemories.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchMemories.fulfilled, (state, action) => {
      state.memories = action.payload;
      state.filteredMemories = applyFilters(action.payload, state.activeFilters);
      state.isLoading = false;
    });
    builder.addCase(fetchMemories.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Fetch memory by id
    builder.addCase(fetchMemoryById.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchMemoryById.fulfilled, (state, action) => {
      state.currentMemory = action.payload;
      state.isLoading = false;
    });
    builder.addCase(fetchMemoryById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Create memory
    builder.addCase(createMemory.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(createMemory.fulfilled, (state, action) => {
      state.memories = [action.payload, ...state.memories];
      state.filteredMemories = applyFilters([action.payload, ...state.memories], state.activeFilters);
      state.currentMemory = action.payload;
      state.isLoading = false;
    });
    builder.addCase(createMemory.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Update memory
    builder.addCase(updateMemory.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(updateMemory.fulfilled, (state, action) => {
      const updatedMemory = action.payload;
      state.memories = state.memories.map((memory) => 
        memory.id === updatedMemory.id ? updatedMemory : memory
      );
      state.filteredMemories = applyFilters(state.memories, state.activeFilters);
      state.currentMemory = updatedMemory;
      state.isLoading = false;
    });
    builder.addCase(updateMemory.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
    
    // Delete memory
    builder.addCase(deleteMemory.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(deleteMemory.fulfilled, (state, action) => {
      const memoryId = action.payload;
      state.memories = state.memories.filter((memory) => memory.id !== memoryId);
      state.filteredMemories = state.filteredMemories.filter((memory) => memory.id !== memoryId);
      if (state.currentMemory?.id === memoryId) {
        state.currentMemory = null;
      }
      state.isLoading = false;
    });
    builder.addCase(deleteMemory.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string;
    });
  },
});

// Helper function to apply filters
const applyFilters = (memories: Memory[], filters: MemoriesState['activeFilters']) => {
  return memories.filter((memory) => {
    // Filter by tags
    if (filters.tags.length > 0) {
      const memoryTagIds = memory.tags.map((tag) => tag.id);
      if (!filters.tags.some((tagId) => memoryTagIds.includes(tagId))) {
        return false;
      }
    }
    
    // Filter by date range
    if (filters.dateRange.from && memory.date && memory.date < filters.dateRange.from) {
      return false;
    }
    if (filters.dateRange.to && memory.date && memory.date > filters.dateRange.to) {
      return false;
    }
    
    // Filter by importance
    if (filters.importance !== null && memory.importance !== filters.importance) {
      return false;
    }
    
    return true;
  });
};

export const { 
  clearCurrentMemory, 
  setFilterTags, 
  setFilterDateRange, 
  setFilterImportance, 
  clearFilters 
} = memoriesSlice.actions;

export default memoriesSlice.reducer;