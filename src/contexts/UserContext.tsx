import React, { createContext, useState, useEffect, useContext } from 'react';
import { 
  User, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface UserContextType {
  currentUser: User | null;
  loading: boolean;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
  updateUserEmail: (email: string) => Promise<void>;
  updateUserPassword: (password: string) => Promise<void>;
  userProfile: UserProfile | null;
}

interface UserProfile {
  displayName: string;
  email: string;
  photoURL: string;
  createdAt: Date;
  notificationPreferences: {
    sound: boolean;
    vibration: boolean;
    memoryAlerts: boolean;
    distanceThreshold: number;
  };
  navigationPreferences: {
    mapStyle: string;
    voiceGuidance: boolean;
    maxDetourTime: number;
    transportationMode: string;
  };
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data() as UserProfile);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const register = async (email: string, password: string, displayName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
      
      // Create user profile in Firestore
      const newUserProfile: UserProfile = {
        displayName,
        email,
        photoURL: '',
        createdAt: new Date(),
        notificationPreferences: {
          sound: true,
          vibration: true,
          memoryAlerts: true,
          distanceThreshold: 300, // meters
        },
        navigationPreferences: {
          mapStyle: 'standard',
          voiceGuidance: true,
          maxDetourTime: 10, // minutes
          transportationMode: 'driving',
        }
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), newUserProfile);
      setUserProfile(newUserProfile);
    } catch (error) {
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if this is a new user
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      
      if (!userDoc.exists()) {
        // Create new user profile for Google sign-ins
        const newUserProfile: UserProfile = {
          displayName: result.user.displayName || 'User',
          email: result.user.email || '',
          photoURL: result.user.photoURL || '',
          createdAt: new Date(),
          notificationPreferences: {
            sound: true,
            vibration: true,
            memoryAlerts: true,
            distanceThreshold: 300, // meters
          },
          navigationPreferences: {
            mapStyle: 'standard',
            voiceGuidance: true,
            maxDetourTime: 10, // minutes
            transportationMode: 'driving',
          }
        };
        
        await setDoc(doc(db, 'users', result.user.uid), newUserProfile);
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw error;
    }
  };

  const updateUserProfile = async (displayName: string, photoURL?: string) => {
    try {
      if (!currentUser) throw new Error('No user logged in');
      
      const updateData: {displayName?: string, photoURL?: string} = { displayName };
      if (photoURL) updateData.photoURL = photoURL;
      
      await updateProfile(currentUser, updateData);
      
      // Update Firestore profile
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { displayName, ...(photoURL && { photoURL }) }, { merge: true });
      
      // Update local state
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          displayName,
          ...(photoURL && { photoURL })
        });
      }
    } catch (error) {
      throw error;
    }
  };

  const updateUserEmail = async (email: string) => {
    try {
      if (!currentUser) throw new Error('No user logged in');
      
      await updateEmail(currentUser, email);
      
      // Update Firestore profile
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { email }, { merge: true });
      
      // Update local state
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          email
        });
      }
    } catch (error) {
      throw error;
    }
  };

  const updateUserPassword = async (password: string) => {
    try {
      if (!currentUser) throw new Error('No user logged in');
      await updatePassword(currentUser, password);
    } catch (error) {
      throw error;
    }
  };

  const value = {
    currentUser,
    loading,
    register,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    updateUserEmail,
    updateUserPassword,
    userProfile
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};