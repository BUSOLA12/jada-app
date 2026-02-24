import { useContext } from 'react';
import { DriverContext } from '../context/DriverContext';

export const useDriver = () => {
  const context = useContext(DriverContext);
  if (!context) {
    throw new Error('useDriver must be used within a DriverProvider');
  }
  return context;
};

