import React, { useState, useEffect } from 'react';
import AuthPage from './Authpage';
import Dashboard from './Dashboard';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoadingScreen from "./LoadingScreen";

function RootRedirect() {
  const handleRedirect = () => {
    window.location.href = `${process.env.PUBLIC_URL}/flameonepage-gh-pages/index.html`;
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      backgroundColor: "#000",
      color: "#fff"
    }}>
      <button
        onClick={handleRedirect}
        style={{
          backgroundColor: "#22c55e",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "18px"
        }}
      >
        Go to Landing Page
      </button>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('authToken'));
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Add small transition delay for smooth user experience
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (email) => {
    localStorage.setItem('userEmail', email);
    setUserEmail(email);
    setIsLoggedIn(true);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/app/*"
          element={
            isLoggedIn ? (
              <Dashboard userEmail={userEmail} />
            ) : (
              <AuthPage onLogin={handleLogin} />
            )
          }
        />
        {/* Fallback route to redirect unknown paths to /app */}
        <Route path="*" element={<Dashboard userEmail={userEmail} />} />
      </Routes>
    </Router>
  );
}

export default App;