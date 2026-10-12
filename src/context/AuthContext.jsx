import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

/**
 * Wraps the app and exposes the current Firebase user plus sign-in / sign-out
 * helpers. Accounts are provisioned manually in the Firebase console — there is
 * no registration or password-reset flow.
 *
 * Also subscribes to the signed-in user's Firestore profile (`users/{uid}`),
 * which carries the operator's `role` and bus `line`.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileSnap, setProfileSnap] = useState({ uid: null, profile: null });

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      doc(db, 'users', uid),
      (snapshot) => {
        setProfileSnap({ uid, profile: snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null });
      },
      (error) => {
        console.error('Failed to load user profile:', error);
        setProfileSnap({ uid, profile: null });
      },
    );
  }, [uid]);

  // Only trust a snapshot that belongs to the current user.
  const profileReady = !uid || profileSnap.uid === uid;
  const profile = uid && profileReady ? profileSnap.profile : null;
  const loading = authLoading || !profileReady;

  const value = useMemo(
    () => ({
      user,
      profile,
      busLine: profile?.line ?? null,
      loading,
      async signIn(email, password, rememberMe) {
        await setPersistence(
          auth,
          rememberMe ? browserLocalPersistence : browserSessionPersistence,
        );
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return cred.user;
      },
      signOut() {
        return fbSignOut(auth);
      },
    }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
