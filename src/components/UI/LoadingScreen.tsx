import React from 'react';
import '../../styles/LoadingScreen.css';

const LoadingScreen: React.FC = () => {
  return (
    <div className="loading-screen">
      <div className="loading-container">
        <div className="loading-pin"></div>
        <div className="loading-pulse"></div>
        <h2>Memory Lane GPS</h2>
        <p>Loading your nostalgic journey...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;