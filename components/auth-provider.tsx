'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';

interface UserData {
  email: string;
  points: number;
  role: 'user' | 'admin';
  downloadedExams?: string[];
  createdAt: any;
  updatedAt: any;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
  error: null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          if (!firebaseUser.email?.endsWith('@m.isct.ac.jp') && firebaseUser.email !== 'teduryu@gmail.com') {
            await signOut(auth);
            setError('このアプリは @m.isct.ac.jp のメールアドレスでのみ登録可能です。');
            setUser(null);
            setUserData(null);
          } else {
            setUser(firebaseUser);
            setError(null);
            // Fetch or create user data
            const userRef = doc(db, 'users', firebaseUser.uid);
            try {
              const userSnap = await getDoc(userRef);
              if (userSnap.exists()) {
                const data = userSnap.data() as UserData;
                if (firebaseUser.email === 'tezuka.r.a926@m.isct.ac.jp' || firebaseUser.email === 'teduryu@gmail.com') {
                  data.role = 'admin';
                }
                setUserData(data);
              } else {
                // Create user doc
                const newUserData = {
                  email: firebaseUser.email,
                  points: 10,
                  role: 'user',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                };
                if (firebaseUser.email === 'tezuka.r.a926@m.isct.ac.jp' || firebaseUser.email === 'teduryu@gmail.com') {
                  // Admin cannot create themselves as admin securely through this path, 
                  // but we override it in local state. The rule protects it anyway.
                }
                await setDoc(userRef, newUserData);
                // set local state with timestamp locally
                const localData = {
                  ...newUserData,
                  createdAt: Timestamp.now(),
                  updatedAt: Timestamp.now(),
                } as unknown as UserData;
                
                if (firebaseUser.email === 'tezuka.r.a926@m.isct.ac.jp' || firebaseUser.email === 'teduryu@gmail.com') {
                  localData.role = 'admin';
                }
                setUserData(localData);
              }
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
            }
          }
        } else {
          setUser(null);
          setUserData(null);
        }
      } catch (err: any) {
        console.error('Auth error:', err);
        setError(err.message || '認証エラーが発生しました。');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  const logOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signIn, logOut, error }}>
      {children}
    </AuthContext.Provider>
  );
}
