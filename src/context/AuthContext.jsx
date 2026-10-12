import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
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
        // 'estimate' fills pending serverTimestamp() fields (e.g. right after
        // clearing notifications) with the local time instead of null.
        setProfileSnap({
          uid,
          profile: snapshot.exists() ? { id: snapshot.id, ...snapshot.data({ serverTimestamps: 'estimate' }) } : null,
        });
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
  // Only operator accounts with a bus line may use this dashboard (commuters
  // can self-register in the NEX app, conductors have logins too).
  const isOperator = profile?.role === 'operator' && Boolean(profile?.line);

  const value = useMemo(
    () => ({
      user,
      profile,
      busLine: profile?.line ?? null,
      isOperator,
      loading,
      async signIn(email, password, rememberMe) {
        await setPersistence(
          auth,
          rememberMe ? browserLocalPersistence : browserSessionPersistence,
        );
        const cred = await signInWithEmailAndPassword(auth, email, password);
        // Reject non-operator accounts right away. The error code is handled
        // like wrong credentials, so the login form doesn't reveal that the
        // account exists.
        let snapshot = null;
        try {
          snapshot = await getDoc(doc(db, 'users', cred.user.uid));
        } catch {
          // fall through: treated as not an operator
        }
        const data = snapshot?.exists() ? snapshot.data() : null;
        if (data?.role !== 'operator' || !data?.line) {
          await fbSignOut(auth);
          const error = new Error('Not an operator account.');
          error.code = 'auth/not-operator';
          throw error;
        }
        return cred.user;
      },
      signOut() {
        return fbSignOut(auth);
      },
    }),
    [user, profile, isOperator, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
