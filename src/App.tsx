import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { UserProvider } from './contexts/UserContext';
import { MemoryProvider } from './contexts/MemoryContext';
import { LocationProvider } from './contexts/LocationContext';
import { NavigationProvider } from './contexts/NavigationContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import MemoryCreation from './pages/MemoryCreation';
import Navigation from './pages/Navigation';
import Profile from './pages/Profile';
import PrivateRoute from './components/PrivateRoute';
import LoadingScreen from './components/UI/LoadingScreen';
import './styles/App.css';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <UserProvider>
        <MemoryProvider>
          <LocationProvider>
            <NavigationProvider>
              <Routes>
                <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
                <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
                <Route path="/forgot-password" element={!user ? <ForgotPassword /> : <Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/memory/create" element={<PrivateRoute><MemoryCreation /></PrivateRoute>} />
                <Route path="/memory/edit/:id" element={<PrivateRoute><MemoryCreation /></PrivateRoute>} />
                <Route path="/navigation" element={<PrivateRoute><Navigation /></PrivateRoute>} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
              </Routes>
            </NavigationProvider>
          </LocationProvider>
        </MemoryProvider>
      </UserProvider>
    </Router>
  );
};

export default App;