import React, { createContext, useState, useEffect, useContext } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { useUser } from './UserContext';

export interface Memory {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: Date;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  tags: string[];
  photos: string[];
  isPrivate: boolean;
  importance: number; // 1-10 scale to prioritize in navigation
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryContextType {
  memories: Memory[];
  loading: boolean;
  error: string | null;
  addMemory: (memory: Omit<Memory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, files: File[]) => Promise<string>;
  updateMemory: (id: string, memoryData: Partial<Memory>, newFiles?: File[], removedPhotos?: string[]) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  getMemory: (id: string) => Promise<Memory | null>;
  getMemoriesByLocation: (latitude: number, longitude: number, radiusKm: number) => Promise<Memory[]>;
  getMemoriesByTag: (tag: string) => Promise<Memory[]>;
}

const MemoryContext = createContext<MemoryContextType | undefined>(undefined);

export const useMemory = () => {
  const context = useContext(MemoryContext);
  if (context === undefined) {
    throw new Error('useMemory must be used within a MemoryProvider');
  }
  return context;
};

export const MemoryProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useUser();

  // Fetch memories when user changes
  useEffect(() => {
    const fetchMemories = async () => {
      if (!currentUser) {
        setMemories([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const q = query(collection(db, 'memories'), where('userId', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const loadedMemories: Memory[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          loadedMemories.push({
            id: doc.id,
            ...data,
            date: data.date.toDate(),
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate()
          } as Memory);
        });
        
        setMemories(loadedMemories);
        setError(null);
      } catch (err) {
        console.error('Error fetching memories:', err);
        setError('Failed to load memories. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMemories();
  }, [currentUser]);

  // Upload photos and return their URLs
  const uploadPhotos = async (files: File[], memoryId: string): Promise<string[]> => {
    const photoUrls: string[] = [];
    
    for (const file of files) {
      const fileRef = ref(storage, `memories/${currentUser?.uid}/${memoryId}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      photoUrls.push(url);
    }
    
    return photoUrls;
  };

  // Delete photos from storage
  const deletePhotos = async (photoUrls: string[]): Promise<void> => {
    for (const url of photoUrls) {
      try {
        const photoRef = ref(storage, url);
        await deleteObject(photoRef);
      } catch (err) {
        console.error('Error deleting photo:', err);
        // Continue with other photo deletions even if one fails
      }
    }
  };

  const addMemory = async (
    memory: Omit<Memory, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, 
    files: File[]
  ): Promise<string> => {
    try {
      if (!currentUser) throw new Error('User not authenticated');
      
      // First create the memory document to get an ID
      const memoryData = {
        ...memory,
        userId: currentUser.uid,
        photos: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'memories'), memoryData);
      
      // Now upload the photos using the new document ID
      if (files.length > 0) {
        const photoUrls = await uploadPhotos(files, docRef.id);
        
        // Update the memory with photo URLs
        await updateDoc(docRef, { photos: photoUrls });
        memoryData.photos = photoUrls;
      }
      
      // Add to local state
      const newMemory = {
        id: docRef.id,
        ...memoryData
      } as Memory;
      
      setMemories(prev => [...prev, newMemory]);
      
      return docRef.id;
    } catch (err) {
      console.error('Error adding memory:', err);
      setError('Failed to add memory. Please try again.');
      throw err;
    }
  };

  const updateMemory = async (
    id: string, 
    memoryData: Partial<Memory>, 
    newFiles: File[] = [], 
    removedPhotos: string[] = []
  ): Promise<void> => {
    try {
      if (!currentUser) throw new Error('User not authenticated');
      
      const memoryRef = doc(db, 'memories', id);
      const memoryDoc = await getDoc(memoryRef);
      
      if (!memoryDoc.exists()) {
        throw new Error('Memory not found');
      }
      
      const memorySnapshot = memoryDoc.data() as Omit<Memory, 'id'>;
      
      if (memorySnapshot.userId !== currentUser.uid) {
        throw new Error('Unauthorized to update this memory');
      }
      
      // Handle photo deletions
      if (removedPhotos.length > 0) {
        await deletePhotos(removedPhotos);
      }
      
      // Handle new photo uploads
      let allPhotos = memorySnapshot.photos.filter(url => !removedPhotos.includes(url));
      
      if (newFiles.length > 0) {
        const newPhotoUrls = await uploadPhotos(newFiles, id);
        allPhotos = [...allPhotos, ...newPhotoUrls];
      }
      
      // Update the memory document
      const updateData = {
        ...memoryData,
        photos: allPhotos,
        updatedAt: new Date()
      };
      
      await updateDoc(memoryRef, updateData);
      
      // Update local state
      setMemories(prev => 
        prev.map(memory => 
          memory.id === id 
            ? { ...memory, ...updateData, photos: allPhotos } 
            : memory
        )
      );
    } catch (err) {
      console.error('Error updating memory:', err);
      setError('Failed to update memory. Please try again.');
      throw err;
    }
  };

  const deleteMemory = async (id: string): Promise<void> => {
    try {
      if (!currentUser) throw new Error('User not authenticated');
      
      const memoryRef = doc(db, 'memories', id);
      const memoryDoc = await getDoc(memoryRef);
      
      if (!memoryDoc.exists()) {
        throw new Error('Memory not found');
      }
      
      const memoryData = memoryDoc.data();
      
      if (memoryData.userId !== currentUser.uid) {
        throw new Error('Unauthorized to delete this memory');
      }
      
      // Delete associated photos
      if (memoryData.photos && memoryData.photos.length > 0) {
        await deletePhotos(memoryData.photos);
      }
      
      // Delete the memory document
      await deleteDoc(memoryRef);
      
      // Update local state
      setMemories(prev => prev.filter(memory => memory.id !== id));
    } catch (err) {
      console.error('Error deleting memory:', err);
      setError('Failed to delete memory. Please try again.');
      throw err;
    }
  };

  const getMemory = async (id: string): Promise<Memory | null> => {
    try {
      if (!currentUser) throw new Error('User not authenticated');
      
      const memoryRef = doc(db, 'memories', id);
      const memoryDoc = await getDoc(memoryRef);
      
      if (!memoryDoc.exists()) {
        return null;
      }
      
      const data = memoryDoc.data();
      return {
        id: memoryDoc.id,
        ...data,
        date: data.date.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      } as Memory;
    } catch (err) {
      console.error('Error fetching memory:', err);
      setError('Failed to load memory. Please try again.');
      return null;
    }
  };

  const getMemoriesByLocation = async (latitude: number, longitude: number, radiusKm: number): Promise<Memory[]> => {
    // This is a simplified implementation - in a real app, you'd use geohashing or a proper spatial query
    // Here we're loading all memories and filtering client-side, which isn't efficient for large datasets
    try {
      if (!currentUser) throw new Error('User not authenticated');
      
      // Function to calculate distance between two coordinates using the Haversine formula
      const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const d = R * c; // Distance in km
        return d;
      };
      
      // Filter the memories based on distance
      return memories.filter(memory => {
        const distance = getDistanceFromLatLonInKm(
          latitude, 
          longitude, 
          memory.location.latitude, 
          memory.location.longitude
        );
        return distance <= radiusKm;
      });
    } catch (err) {
      console.error('Error fetching memories by location:', err);
      setError('Failed to load nearby memories. Please try again.');
      return [];
    }
  };

  const getMemoriesByTag = async (tag: string): Promise<Memory[]> => {
    try {
      if (!currentUser) throw new Error('User not authenticated');
      
      const q = query(
        collection(db, 'memories'), 
        where('userId', '==', currentUser.uid),
        where('tags', 'array-contains', tag)
      );
      
      const querySnapshot = await getDocs(q);
      
      const taggedMemories: Memory[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        taggedMemories.push({
          id: doc.id,
          ...data,
          date: data.date.toDate(),
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        } as Memory);
      });
      
      return taggedMemories;
    } catch (err) {
      console.error('Error fetching memories by tag:', err);
      setError('Failed to load memories with this tag. Please try again.');
      return [];
    }
  };

  const value: MemoryContextType = {
    memories,
    loading,
    error,
    addMemory,
    updateMemory,
    deleteMemory,
    getMemory,
    getMemoriesByLocation,
    getMemoriesByTag
  };

  return (
    <MemoryContext.Provider value={value}>
      {children}
    </MemoryContext.Provider>
  );
};