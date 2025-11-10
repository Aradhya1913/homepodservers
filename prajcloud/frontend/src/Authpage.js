import React, { useState } from 'react';
import bgImage from './assets/1.png'; // ✅ correct import
import LoadingScreen from "./LoadingScreen";
import { initializeApp } from "firebase/app";


import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAw37BB51QEJtTEF83t2zh2E2EZ94zDMsU",
  authDomain: "login-aa9e1.firebaseapp.com",
  projectId: "login-aa9e1",
  storageBucket: "login-aa9e1.firebasestorage.app",
  messagingSenderId: "967700815757",
  appId: "1:967700815757:web:ae5c71718f296de9e727c4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const BASE_URL = "http://localhost:5001";

function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [showLoader, setShowLoader] = useState(false);

  // Common loader transition duration (ms)
  const loaderDelay = 1200;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowLoader(true);
    setTimeout(async () => {
      const url = isLogin ? '/login' : '/signup';
      const payload = isLogin ? { email, password } : { username, email, password };
      try {
        const res = await fetch(`${BASE_URL}${url}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        setMessage(data.message || await res.text());
        if (res.ok && data.token) {
          localStorage.setItem('authToken', data.token);
          localStorage.setItem('userEmail', email);
          onLogin(email);
        } else {
          setShowLoader(false);
        }
      } catch (err) {
        setMessage('❌ Network error');
        setShowLoader(false);
      }
    }, loaderDelay);
  };

  const handleGoogleSignIn = async () => {
    setShowLoader(true);
    setTimeout(async () => {
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const token = await user.getIdToken(true);
        localStorage.setItem('authToken', token);
        localStorage.setItem('userEmail', user.email);
        localStorage.setItem('userName', user.displayName);
        // Optional: verify token immediately with backend
        await fetch("http://localhost:5001/files", {
          headers: { Authorization: `Bearer ${token}` }
        });
        onLogin(user.email);
      } catch (error) {
        setShowLoader(false);
        console.error("Firebase Login Error:", error);
        alert("Google Sign-in failed. Please try again.");
      }
    }, loaderDelay);
  };

  const handleGoToHome = () => {
    setShowLoader(true);
    setTimeout(() => {
      window.location.href = `${process.env.PUBLIC_URL}/flameonepage-gh-pages/index.html`;
    }, loaderDelay);
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center relative"
      style={{
        backgroundImage: `url(${bgImage})`
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black bg-opacity-70 z-0"></div>

      {/* Form Container */}
      <div className="relative z-10 bg-white/10 backdrop-blur-lg p-8 rounded-xl shadow-2xl w-full max-w-md text-white">
        <h2
          className="text-3xl font-bold text-center mb-6 tracking-wide"
          style={{ color: '#ffffffff' }}
        >          {isLogin ? 'Homepod Servers' : 'Create Account'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 rounded bg-white/20 border border-white/30 focus:outline-none"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded bg-white/20 border border-white/30 focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded bg-white/20 border border-white/30 focus:outline-none"
            required
          />
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded hover:opacity-90 shadow-md font-semibold"
            disabled={showLoader}
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full py-3 flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-all mt-3 font-medium"
            disabled={showLoader}
          >
            <img
              src='https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg'
              alt='Google logo'
              className='w-5 h-5'
            />
            Sign in with Google
          </button>
          <button
            type="button"
            onClick={handleGoToHome}
            className="w-full py-3 mt-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded shadow-md font-semibold transform transition-all duration-500 hover:scale-105 hover:shadow-lg hover:from-purple-600 hover:to-blue-500"
            disabled={showLoader}
          >
            Go to Home Page
          </button>
        </form>

        <p className="text-center text-sm text-gray-200 mt-4">
          {isLogin ? "Don't have an account?" : "Already registered?"}{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-400 underline hover:text-blue-300"
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </p>

        {message && (
          <p className="text-center text-sm font-medium mt-2 text-red-300">
            {message}
          </p>
        )}
      </div>
      {showLoader && <LoadingScreen />}
    </div>
  );
}

export default AuthPage;
