import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, Plus, LogOut, Search } from 'lucide-react';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PatientCard } from './components/PatientCard';

export default async function DoctorDashboard() {
    const supabase = await createServerClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/auth/login');
    }

    // Fetch patients directly on the server
    const { data: patients, error: fetchError } = await supabase
        .from('patients')
        .select('*')
        .eq('assigned_doctor_id', user.id)
        .order('created_at', { ascending: false });

    if (fetchError) {
        console.error('Error fetching patients:', fetchError);
        // We can render an error state here if needed
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Navbar */}
            <header className="bg-white border-b border-slate-200 min-h-16 flex flex-col md:flex-row items-center justify-between px-4 md:px-6 py-2 md:py-0 shadow-sm gap-2 md:gap-0">
                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-600 rounded flex items-center justify-center text-white">
                            <Activity className="w-5 h-5" />
                        </div>
                        <span className="font-bold text-slate-800 text-lg">OncoTracker <span className="text-emerald-600 text-xs ml-1 bg-emerald-100 px-2 py-0.5 rounded-full">Provider</span></span>
                    </div>
                    {/* Mobile User Menu could go here, for now keeping it simple */}
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <span className="text-slate-600 text-sm truncate max-w-[150px] md:max-w-none">Dr. {user?.user_metadata?.full_name || 'SciX'}</span>
                    <Link href="/auth/logout">
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-red-600">
                            <LogOut className="w-4 h-4 mr-2" /> <span className="hidden md:inline">Sign Out</span><span className="md:hidden">Exit</span>
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">My Patients</h1>
                    <Link href="/dashboard/doctor/add-patient" className="w-full md:w-auto">
                        <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2 w-full md:w-auto">
                            <Plus className="w-4 h-4" /> Add Patient
                        </Button>
                    </Link>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input placeholder="Search by name or MRN..." className="pl-10" />
                </div>

                {/* Patient List */}
                <div className="grid gap-4">
                    {patients && patients.length > 0 ? (
                        patients.map((patient) => (
                            <PatientCard key={patient.id} patient={patient} />
                        ))
                    ) : (
                        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
                            <p className="text-slate-500 mb-4">No patients found.</p>
                            <Link href="/dashboard/doctor/add-patient">
                                <Button variant="outline">Add your first patient</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
