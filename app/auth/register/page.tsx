'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Activity, ArrowLeft } from 'lucide-react';

function RegisterForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const role = searchParams.get('role') || 'patient';
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        mrn: '', // Patient only
        license: '', // Doctor only
        specialty: '', // Doctor only
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // TODO: Implement actual Supabase registration here
        console.log("Registering as", role, formData);

        // Simulate delay
        setTimeout(() => {
            setIsLoading(false);
            // Redirect to pending approval or dashboard
            alert("Account created! Please wait for supervisor approval.");
            router.push('/');
        }, 1000);
    };

    const roleTitle = role === 'doctor' ? 'Provider' : 'Patient';

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
                    <div className="w-5" />
                </div>
                <CardTitle className="text-2xl font-bold text-center pt-4">Create {roleTitle} Account</CardTitle>
                <CardDescription className="text-center">
                    Enter your details to request access
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" placeholder="John Doe" required value={formData.fullName} onChange={handleChange} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="name@example.com" required value={formData.email} onChange={handleChange} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" required value={formData.password} onChange={handleChange} />
                    </div>

                    {role === 'patient' && (
                        <div className="space-y-2">
                            <Label htmlFor="mrn">Medical Record Number (MRN)</Label>
                            <Input id="mrn" placeholder="MRN-12345" value={formData.mrn} onChange={handleChange} />
                        </div>
                    )}

                    {role === 'doctor' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="specialty">Specialty</Label>
                                <Input id="specialty" placeholder="Oncology" value={formData.specialty} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="license">License Number</Label>
                                <Input id="license" placeholder="LIC-12345" value={formData.license} onChange={handleChange} />
                            </div>
                        </>
                    )}

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                        {isLoading ? "Creating Account..." : "Create Account"}
                    </Button>
                </form>
            </CardContent>
            <CardFooter className="flex justify-center">
                <div className="text-sm text-slate-500">
                    Already have an account? <Link href={`/auth/login?role=${role}`} className="text-blue-600 hover:underline">Sign in</Link>
                </div>
            </CardFooter>
        </Card>
    );
}

export default function RegisterPage() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Suspense fallback={<div>Loading...</div>}>
                <RegisterForm />
            </Suspense>
        </div>
    );
}
