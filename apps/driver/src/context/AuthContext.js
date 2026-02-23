import React, { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import { auth } from '../../firebase.config';
import authService from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Check if permissions were already granted
        const permissionsStatus = await AsyncStorage.getItem('permissionsGranted');
        setPermissionsGranted(permissionsStatus === 'true');
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    try {
      await authService.signOut();
      await AsyncStorage.removeItem('permissionsGranted');
      setPermissionsGranted(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const markPermissionsGranted = async () => {
    await AsyncStorage.setItem('permissionsGranted', 'true');
    setPermissionsGranted(true);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        permissionsGranted,
        signOut,
        markPermissionsGranted,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
