import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { setUser, clearUser } from './store/slices/authSlice';
import { RootState } from './store';

// Pages
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import Profile from './pages/Profile';
import MemoryCreate from './pages/memories/MemoryCreate';
import MemoryEdit from './pages/memories/MemoryEdit';
import MemoryDetail from './pages/memories/MemoryDetail';
import MemoryList from './pages/memories/MemoryList';
import Navigation from './pages/navigation/Navigation';
import RoutePreview from './pages/navigation/RoutePreview';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/common/LoadingSpinner';

const App: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        }));
      } else {
        dispatch(clearUser());
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={!isAuthenticated ? <Login /> : <Navigate to="/memories" />} />
          <Route path="register" element={!isAuthenticated ? <Register /> : <Navigate to="/memories" />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          
          <Route path="profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          
          <Route path="memories" element={
            <ProtectedRoute>
              <MemoryList />
            </ProtectedRoute>
          } />
          
          <Route path="memories/create" element={
            <ProtectedRoute>
              <MemoryCreate />
            </ProtectedRoute>
          } />
          
          <Route path="memories/:id" element={
            <ProtectedRoute>
              <MemoryDetail />
            </ProtectedRoute>
          } />
          
          <Route path="memories/:id/edit" element={
            <ProtectedRoute>
              <MemoryEdit />
            </ProtectedRoute>
          } />
          
          <Route path="navigate" element={
            <ProtectedRoute>
              <Navigation />
            </ProtectedRoute>
          } />
          
          <Route path="route-preview" element={
            <ProtectedRoute>
              <RoutePreview />
            </ProtectedRoute>
          } />
          
          <Route path="settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;