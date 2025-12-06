'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, Save, FileSpreadsheet, ArrowLeft, Plus, Database, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { DataSpreadsheet } from '@/components/DataSpreadsheet';
import { FormalDataset, FormalDatasetRow } from '@/lib/types';
import { uploadData } from '@/app/actions/upload-data';

function ManageDataContent() {
    const searchParams = useSearchParams();
    const patientId = searchParams.get('patientId');

    const [rows, setRows] = useState<FormalDatasetRow[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [patientName, setPatientName] = useState<string>('');

    useEffect(() => {
        const apiUrl = patientId
            ? `/api/data/current?patientId=${encodeURIComponent(patientId)}`
            : '/api/data/current';

        fetch(apiUrl)
            .then(res => res.json())
            .then((data: FormalDataset) => {
                const loadedRows = data.FormalDataset || [];
                setRows(loadedRows);
                setPatientName(data.patientName || 'Unknown Patient');
                if (loadedRows.length > 0) {
                    setColumns(Object.keys(loadedRows[0]));
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Failed to load data", err);
                setIsLoading(false);
            });
    }, [patientId]);

    const handleDataChange = (newRows: FormalDatasetRow[]) => {
        setRows(newRows);
    };

    const handleAddRow = () => {
        const newRow: FormalDatasetRow = {};
        columns.forEach(col => newRow[col] = '');
        setRows([...rows, newRow]);
    };

    const handleAddMetric = () => {
        const name = window.prompt("Enter new metric name:");
        if (!name) return;

        // Find next Unnamed index
        let maxIndex = -1;
        columns.forEach(col => {
            if (col.startsWith('Unnamed:')) {
                const idx = parseInt(col.split(':')[1]);
                if (!isNaN(idx) && idx > maxIndex) maxIndex = idx;
            }
        });

        // Start from at least 0 if no columns, or increment max
        const newColKey = `Unnamed: ${maxIndex + 1}`;

        // Update headers in rows 2 (headers) and 3 (units) if they exist
        const newRows = [...rows];

        // Ensure we have enough rows for headers (at least 4 rows: Title, Categories, Headers, Units)
        while (newRows.length < 4) {
            const emptyRow: FormalDatasetRow = {};
            columns.forEach(c => emptyRow[c] = '');
            newRows.push(emptyRow);
        }

        // Update Header Row (Index 2) - Metric Name
        if (newRows[2]) {
            newRows[2] = { ...newRows[2], [newColKey]: name };
        }

        // Update Unit Row (Index 3) - Empty Unit initially
        if (newRows[3]) {
            newRows[3] = { ...newRows[3], [newColKey]: '' };
        }

        // Add key to all other rows
        for (let i = 0; i < newRows.length; i++) {
            if (newRows[i][newColKey] === undefined) {
                newRows[i][newColKey] = '';
            }
        }

        setColumns([...columns, newColKey]);
        setRows(newRows);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const result = await uploadData(formData);
            const dataset = result.dataset as FormalDataset;
            setRows(dataset.FormalDataset);
            if (dataset.FormalDataset.length > 0) {
                setColumns(Object.keys(dataset.FormalDataset[0]));
            }
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Upload failed: " + String(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        console.log("Saving data...", rows);
        alert("Save functionality coming soon (requires backend API update). Data is logged to console.");
        // TODO: Implement API call to save. The current uploadData action only handles files.
        // We need an action or API route to save the JSON directly.
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <Link
                        href={patientId ? `/journey?patientId=${patientId}` : '/journey'}
                        className="text-slate-500 hover:text-slate-900 transition-colors p-2 hover:bg-slate-100 rounded-full"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex flex-col">
                        <h1 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <Database className="w-5 h-5 text-blue-600" />
                            Data Manager
                        </h1>
                        <span className="text-xs text-slate-500 font-medium">Patient: {patientName}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* Upload & Save Buttons */}
                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv, .json"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                        />
                        <Button variant="outline" size="sm" className="gap-2 text-slate-600 hover:text-blue-600 hover:border-blue-200">
                            <Upload className="w-4 h-4" />
                            Import
                        </Button>
                    </div>
                    <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-sm transition-all hover:shadow-md" onClick={handleSave}>
                        <Save className="w-4 h-4" />
                        Save Changes
                    </Button>
                </div>
            </header>

            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={handleAddRow} className="gap-2 text-slate-700 hover:bg-slate-100 hover:text-blue-600">
                    <Plus className="w-4 h-4" />
                    Add Row
                </Button>
                <Button variant="ghost" size="sm" onClick={handleAddMetric} className="gap-2 text-slate-700 hover:bg-slate-100 hover:text-blue-600">
                    <LayoutGrid className="w-4 h-4" />
                    Add Metric
                </Button>
            </div>

            {/* Content */}
            <main className="flex-1 overflow-hidden flex flex-col relative w-full">
                <div className="h-full flex flex-col overflow-hidden bg-white w-full">
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                            Loading dataset...
                        </div>
                    ) : rows.length > 0 ? (
                        <DataSpreadsheet
                            data={rows}
                            columns={columns}
                            onDataChange={handleDataChange}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                            <FileSpreadsheet className="w-16 h-16 opacity-10" />
                            <p className="font-medium">No dataset loaded</p>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv, .json"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileUpload}
                                />
                                <Button variant="outline">
                                    Upload Excel File
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function ManageDataPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading Data Manager...</div>}>
            <ManageDataContent />
        </Suspense>
    );
}
