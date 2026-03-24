import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { LogOut, User, Shield, Trophy, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  user: UserProfile | null;
  pendingCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ user, pendingCount = 0 }) => {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.email === 'naude.jj@gmail.com';

  const handleLogout = async () => {
    await auth.signOut();
    setIsMenuOpen(false);
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-2.5 sticky top-0 z-50">
      <div className="flex flex-wrap justify-between items-center mx-auto max-w-screen-xl">
        <div className="flex items-center">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="inline-flex items-center p-2 text-sm text-gray-500 rounded-lg lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 mr-2 relative"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            {isAdmin && pendingCount > 0 && (
              <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white ring-1 ring-white">
                {pendingCount}
              </span>
            )}
          </button>
          <Link to="/" className="flex items-center" onClick={() => setIsMenuOpen(false)}>
            <Trophy className="mr-3 h-6 w-6 text-indigo-600" />
            <span className="self-center text-xl font-semibold whitespace-nowrap">Chess Club</span>
          </Link>
          <div className="hidden lg:flex items-center ml-10 gap-6">
            <Link to="/" className="text-sm font-bold text-gray-600 hover:text-indigo-600 transition-colors uppercase tracking-widest relative">
              Dashboard
              {isAdmin && pendingCount > 0 && (
                <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {pendingCount}
                </span>
              )}
            </Link>
            <Link to="/ladders" className="text-sm font-bold text-gray-600 hover:text-indigo-600 transition-colors uppercase tracking-widest">Ladders</Link>
          </div>
        </div>
        
        <div className="flex items-center lg:order-2">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-gray-900">{user.email}</span>
                <span className="text-xs text-gray-500 capitalize">{isAdmin ? 'Admin' : 'User'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-800 hover:bg-gray-50 focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-4 py-2 focus:outline-none"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 font-medium rounded-lg text-sm px-4 py-2 focus:outline-none"
            >
              Log in
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden overflow-hidden bg-white border-t border-gray-100 mt-2"
          >
            <div className="flex flex-col py-4 gap-2">
              <Link 
                to="/" 
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-all uppercase tracking-widest flex items-center justify-between"
              >
                Dashboard
                {isAdmin && pendingCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <Link 
                to="/ladders" 
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-all uppercase tracking-widest"
              >
                Ladders
              </Link>
              {user && (
                <div className="px-4 py-3 border-t border-gray-50 mt-2">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Account</div>
                  <div className="text-sm font-medium text-gray-900">{user.email}</div>
                  <div className="text-xs text-gray-500 capitalize">{isAdmin ? 'Admin' : 'User'}</div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
