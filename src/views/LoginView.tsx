import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { Trophy, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export const LoginView: React.FC = () => {
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully!');
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to log in. Please try again.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-8 border border-gray-100">
        <div className="text-center">
          <Trophy className="mx-auto h-16 w-16 text-indigo-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Chess Club</h1>
          <p className="mt-2 text-gray-500">Manage your club, track rankings, and pair games.</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <LogIn className="h-5 w-5" />
            Sign in with Google
          </button>
        </div>

        <div className="text-center text-xs text-gray-400">
          By signing in, you agree to our terms and conditions.
        </div>
      </div>
    </div>
  );
};
