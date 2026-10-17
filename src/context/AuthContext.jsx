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
  // `failed`: the profile couldn't be read (offline, rules) — not the same as
  // "not an operator", so ProtectedRoute can say so and offer a retry.
  const [profileSnap, setProfileSnap] = useState({ uid: null, profile: null, failed: false });

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
          failed: false,
        });
      },
      (error) => {
        console.error('Failed to load user profile:', error);
        setProfileSnap({ uid, profile: null, failed: true });
      },
    );
  }, [uid]);

  // Only trust a snapshot that belongs to the current user.
  const profileReady = !uid || profileSnap.uid === uid;
  const profile = uid && profileReady ? profileSnap.profile : null;
  const profileFailed = Boolean(uid && profileReady && profileSnap.failed);
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
      profileFailed,
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
        let snapshot;
        try {
          snapshot = await getDoc(doc(db, 'users', cred.user.uid));
        } catch (readError) {
          // The password was right but the profile couldn't be read
          // (connection, rules) — reported as such, not as wrong credentials.
          console.error('Failed to read operator profile:', readError);
          await fbSignOut(auth);
          const error = new Error("Couldn't load the operator profile.");
          error.code = 'auth/profile-unavailable';
          throw error;
        }
        const data = snapshot.exists() ? snapshot.data() : null;
        if (data?.role !== 'operator' || !data?.line) {
          await fbSignOut(auth);
          const error = new Error('Not an operator account.');
          error.code = 'auth/not-operator';
          throw error;
        }
        return cred.user;
      },
      async signOut() {
        // Stop this browser's pushes first (needs the signed-in user). Loaded
        // on demand so the messaging SDK stays out of the shell bundle.
        const uid = auth.currentUser?.uid;
        try {
          if (localStorage.getItem('nex_push_token')) {
            const { disableWebPush } = await import('../utils/pushServices');
            await disableWebPush(uid);
          }
        } catch (error) {
          console.warn('Could not unregister push notifications:', error);
        }
        return fbSignOut(auth);
      },
    }),
    [user, profile, isOperator, profileFailed, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>');
  return ctx;
}
