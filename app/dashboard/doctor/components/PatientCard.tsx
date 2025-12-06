'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, FileSpreadsheet, Trash2 } from 'lucide-react';
import { deletePatientAction } from '@/app/actions/patient-actions';

interface PatientCardProps {
    patient: any;
}

export function PatientCard({ patient }: PatientCardProps) {
    const [isDeleted, setIsDeleted] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    if (isDeleted) return null;

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                        {patient.family_name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">
                            {patient.family_name} {patient.given_name}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                            <span>{patient.mrn}</span>
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                            <span>{patient.active ? 'Active' : 'Inactive'}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="text-right mr-4 hidden md:block">
                        <div className="text-xs text-slate-400">Date Added</div>
                        {new Date(patient.created_at).toLocaleDateString('zh-CN')}
                    </div>
                    <Link href={`/journey?patientId=${patient.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                            <Activity className="w-4 h-4" /> View Journey
                        </Button>
                    </Link>
                    <Link href={`/manage-data?patientId=${patient.id}`}>
                        <Button variant="outline" size="sm" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                            <FileSpreadsheet className="w-4 h-4" /> Edit Data
                        </Button>
                    </Link>
                    {isConfirming ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                            <span className="text-xs font-bold text-red-600">Confirm Delete?</span>
                            <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={async () => {
                                    const result = await deletePatientAction(patient.id);
                                    if (result.success) {
                                        setIsDeleted(true);
                                    } else {
                                        alert('Failed to delete patient: ' + result.error);
                                        setIsConfirming(false);
                                    }
                                }}
                            >
                                Yes
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => setIsConfirming(false)}
                            >
                                No
                            </Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setIsConfirming(true)}
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
