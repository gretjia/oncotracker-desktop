'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, ShieldCheck, Check, X, LogOut, Users } from 'lucide-react';

export default function SupervisorDashboard() {
    // Mock Data
    const pendingApprovals = [
        { id: 1, name: "Dr. New Guy", email: "newguy@hospital.com", role: "doctor", date: "Nov 30, 2024" },
        { id: 2, name: "Alice Wonderland", email: "alice@example.com", role: "patient", date: "Nov 29, 2024" },
    ];

    const stats = [
        { label: "Total Patients", value: "1,240" },
        { label: "Active Doctors", value: "48" },
        { label: "Pending Approvals", value: "2" },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Navbar */}
            <header className="bg-slate-900 border-b border-slate-800 h-16 flex items-center justify-between px-6 shadow-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-white">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className="font-bold text-white text-lg">OncoTracker <span className="text-indigo-300 text-xs ml-1 border border-indigo-700 px-2 py-0.5 rounded-full">Admin</span></span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-slate-300 text-sm">Supervisor Admin</span>
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white hover:bg-slate-800">
                            <LogOut className="w-4 h-4 mr-2" /> Sign Out
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-8">

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {stats.map((stat, idx) => (
                        <Card key={idx} className="bg-white border-slate-200 shadow-sm">
                            <CardContent className="p-6">
                                <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">{stat.label}</div>
                                <div className="text-3xl font-bold text-slate-900 mt-2">{stat.value}</div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Approval Queue */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-indigo-600" /> Pending Approvals
                    </h2>

                    <Card>
                        <div className="divide-y divide-slate-100">
                            {pendingApprovals.map((user) => (
                                <div key={user.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 font-bold">
                                            {user.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900">{user.name}</div>
                                            <div className="text-sm text-slate-500">{user.email}</div>
                                        </div>
                                        <Badge variant={user.role === 'doctor' ? 'default' : 'secondary'} className="ml-2 capitalize">
                                            {user.role}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1">
                                            <Check className="w-4 h-4" /> Approve
                                        </Button>
                                        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50 border-red-200 gap-1">
                                            <X className="w-4 h-4" /> Reject
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            {pendingApprovals.length === 0 && (
                                <div className="p-8 text-center text-slate-500">
                                    No pending approvals.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}
