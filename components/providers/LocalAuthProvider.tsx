'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// Mock User Shape
export type User = {
    id: string;
    email: string;
    user_metadata: {
        full_name: string;
        role: string;
    }
}

type AuthContextType = {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signOut: async () => { },
});

export const MOCK_USER: User = {
    id: 'local-admin-doctor',
    email: 'doctor@local.oncotracker',
    user_metadata: {
        full_name: 'Local Administrator',
        role: 'doctor'
    }
};

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate checking session
        const timer = setTimeout(() => {
            console.log('[LocalAuthProvider] Auto-logging in as:', MOCK_USER.email);
            setUser(MOCK_USER);
            setLoading(false);
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    const signOut = async () => {
        console.log('[LocalAuthProvider] SignOut ignored in local mode');
        // In local mode, maybe we just reload or do nothing
        window.location.reload();
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useUser() {
    return useContext(AuthContext);
}
