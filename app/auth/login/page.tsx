'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { loginAction } from '@/app/actions/auth-actions';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Activity, ArrowLeft } from 'lucide-react';

function LoginForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const role = searchParams.get('role') || 'patient';
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null); // New state for error messages

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null); // Clear previous errors

        const formData = new FormData(e.target as HTMLFormElement);
        // Add email and password to formData for the server action
        formData.append('email', email);
        formData.append('password', password);
        formData.append('role', role); // Pass the role to the server action if needed for redirection logic

        try {
            const result = await loginAction(formData);

            if (result?.error) {
                setError(result.error);
                setIsLoading(false);
            }
            // If success, the server action redirects, so we don't need to do anything here.
            // The browser will navigate away.

        } catch (err) {
            console.error('Login error:', err);
            setError('An unexpected error occurred');
            setIsLoading(false);
        }
    };


    const roleTitle = role === 'doctor' ? 'Provider' : role === 'supervisor' ? 'Supervisor' : 'Patient';

    return (
        <Card className="w-full max-w-md border-slate-200 shadow-lg">
            <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-slate-400 hover:text-slate-600 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div className="w-5" /> {/* Spacer */}
                </div>
                <CardTitle className="text-2xl font-bold text-center pt-4">{roleTitle} Login</CardTitle>
                <CardDescription className="text-center">
                    Enter your credentials to access your account
                </CardDescription>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
                        {error}
                    </div>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                        {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="flex justify-center">
                <div className="text-sm text-slate-500">
                    Don't have an account? <Link href={`/auth/register?role=${role}`} className="text-blue-600 hover:underline">Sign up</Link>
                </div>
            </CardFooter>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Suspense fallback={<div>Loading...</div>}>
                <LoginForm />
            </Suspense>
        </div>
    );
}
