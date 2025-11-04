import React, { useState } from 'react';
import bgImage from './assets/1.png'; // ✅ correct import

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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      }
    } catch (err) {
      setMessage('❌ Network error');
    }
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
          >
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                localStorage.setItem('userEmail', user.email);
                localStorage.setItem('userName', user.displayName);
                localStorage.setItem('authToken', await user.getIdToken());
                onLogin(user.email);
              } catch (error) {
                console.error("Firebase Login Error:", error);
                alert("Google Sign-in failed. Please try again.");
              }
            }}
            className="w-full py-3 flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-all mt-3 font-medium"
          >
            <img
              src='https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg'
              alt='Google logo'
              className='w-5 h-5'
            />
            Sign in with Google
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
    </div>
  );
}

export default AuthPage;
