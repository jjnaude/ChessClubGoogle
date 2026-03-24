import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { chessService } from './services/chessService';
import { UserProfile } from './types';
import { Navbar } from './components/Navbar';
import { Toaster } from 'react-hot-toast';

// Views
import { LoginView } from './views/LoginView';
import { AdminView } from './views/AdminView';
import { UserView } from './views/UserView';
import { LoadingView } from './views/LoadingView';
import { LadderView } from './views/LadderView';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await chessService.getUserProfile(firebaseUser.uid);
        if (profile) {
          // Ensure default admin is always admin
          if (firebaseUser.email === 'naude.jj@gmail.com' && (profile.role !== 'admin' || !profile.isApproved)) {
            const updatedProfile = { ...profile, role: 'admin' as const, isApproved: true };
            await chessService.createUserProfile(updatedProfile);
            setUser(updatedProfile);
          } else {
            setUser(profile);
          }
        } else {
          // If profile doesn't exist, create a default one
          const isAdmin = firebaseUser.email === 'naude.jj@gmail.com';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            playerIds: [],
            role: isAdmin ? 'admin' : 'user',
            isApproved: isAdmin,
          };
          await chessService.createUserProfile(newProfile);
          setUser(newProfile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const isAdmin = user?.role === 'admin' || user?.email === 'naude.jj@gmail.com';
    if (isAdmin) {
      const unsub = chessService.onUsersChange((users) => {
        setPendingCount(users.filter(u => !u.isApproved).length);
      });
      return () => unsub();
    } else {
      setPendingCount(0);
    }
  }, [user]);

  if (loading) return <LoadingView />;

  const isAdmin = user?.role === 'admin' || user?.email === 'naude.jj@gmail.com';

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar user={user} pendingCount={pendingCount} />
        <main className="flex-grow container mx-auto max-w-screen-xl p-4">
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <LoginView />} />
            <Route path="/ladders" element={<LadderView />} />
            <Route 
              path="/" 
              element={
                user ? (
                  isAdmin ? <AdminView user={user} /> : <UserView user={user} />
                ) : (
                  <Navigate to="/login" />
                )
              } 
            />
          </Routes>
        </main>
        <Toaster position="bottom-right" />
      </div>
    </Router>
  );
}
