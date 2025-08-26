import React, { useState } from 'react';
import AuthPage from './Authpage';
import Dashboard from './Dashboard';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

function RootRedirect() {
  const handleRedirect = () => {
    window.location.href = `${process.env.PUBLIC_URL}/flameonepage-gh-pages/index.html`;
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
      <button onClick={handleRedirect}>Go to Landing Page</button>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('authToken'));
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail'));

  const handleLogin = (email) => {
    localStorage.setItem('userEmail', email);
    setUserEmail(email);
    setIsLoggedIn(true);
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/app"
          element={
            isLoggedIn ? (
              <Dashboard userEmail={userEmail} />
            ) : (
              <AuthPage onLogin={handleLogin} />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;