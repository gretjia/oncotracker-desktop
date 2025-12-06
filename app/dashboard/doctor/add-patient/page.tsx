
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { createPatientAction } from '../../../actions/patient-actions';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { AnalysisResultSchema } from '@/lib/schema/ai-mapping.schema';
import { AIThinkingLog } from '@/components/AIThinkingLog';
import * as XLSX from 'xlsx';
import { Switch } from '@/components/ui/switch';

export default function AddPatientPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [mappingResult, setMappingResult] = useState<any>(null);
    const [file, setFile] = useState<File | null>(null);
    const [useDeepAnalysis, setUseDeepAnalysis] = useState(false);
    const [isCanonical, setIsCanonical] = useState(false);

    const { object, submit, isLoading: isAIProcessing, error: aiError } = useObject({
        api: '/api/ai/analyze-file',
        schema: AnalysisResultSchema,
        onFinish: (result) => {
            if (result.object) {
                const legacyMapping = convertToLegacyFormat(result.object);
                setMappingResult({
                    isCanonical: false,
                    mapping: legacyMapping
                });
            }
        }
    });

    // Backup: Ensure mappingResult is set when processing completes if onFinish missed it
    // This handles cases where the stream finishes but onFinish doesn't trigger as expected
    useEffect(() => {
        if (!isAIProcessing && object && !mappingResult && !isCanonical) {
            const legacyMapping = convertToLegacyFormat(object);
            setMappingResult({
                isCanonical: false,
                mapping: legacyMapping
            });
        }
    }, [isAIProcessing, object, mappingResult, isCanonical]);

    // Helper to convert AI result to legacy format expected by backend
    function convertToLegacyFormat(aiResult: any) {
        const metrics: Record<string, string> = {};
        const events: string[] = [];

        if (aiResult.metricMappings) {
            Object.entries(aiResult.metricMappings).forEach(([sourceName, mapping]: [string, any]) => {
                if ((mapping.confidence >= 0.5 || mapping.isCustomMetric) && mapping.canonicalName) {
                    metrics[sourceName] = mapping.canonicalName;
                }
            });
        }

        if (aiResult.fixedColumnMappings) {
            const f = aiResult.fixedColumnMappings;
            if (f.phase?.sourceName) events.push(f.phase.sourceName);
            if (f.event?.sourceName) events.push(f.event.sourceName);
            if (f.cycle?.sourceName) events.push(f.cycle.sourceName);
            if (f.scheme?.sourceName) events.push(f.scheme.sourceName);
        }

        return {
            date_col: aiResult.dateColumn?.sourceName || null,
            date_col_index: aiResult.dateColumn?.sourceIndex ?? 0,
            metrics,
            events
        };
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;
        setFile(selectedFile);
        setMappingResult(null);
        setIsCanonical(false);

        // 1. Parse File on Client
        const buffer = await selectedFile.arrayBuffer();
        let rawData: any[][] = [];

        if (selectedFile.name.endsWith('.json')) {
            const text = new TextDecoder().decode(buffer);
            const json = JSON.parse(text);
            rawData = Array.isArray(json) ? json : [json];
        } else {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        }

        if (rawData.length === 0) return;

        // 2. Check for Canonical Format (Fast Path)
        // Simple check: if header row has "子类" and "项目"
        let headerRowIndex = 0;
        const metricHeaders = ['Weight', 'CEA', 'MRD', '白细胞'];
        for (let i = 0; i < Math.min(rawData.length, 20); i++) {
            const rowStr = (rawData[i] || []).join(' ');
            if (metricHeaders.some(m => rowStr.includes(m))) {
                headerRowIndex = i;
                break;
            }
        }
        const headers = rawData[headerRowIndex] || [];

        // Strict canonical check
        const isCanonicalFile = headers[0] === '子类' && headers[1] === '项目' && headers[4] === '方案';

        if (isCanonicalFile) {
            setIsCanonical(true);
            setMappingResult({ isCanonical: true, mapping: null });
            return;
        }

        // 3. Trigger AI Analysis
        const samples = rawData.slice(headerRowIndex + 1, headerRowIndex + 6);
        submit({ headers, samples, useDeepAnalysis });
    }

    async function handleSubmit(formData: FormData) {
        setIsLoading(true);
        setError('');

        try {
            if (mappingResult) {
                formData.append('mapping', JSON.stringify(mappingResult));
            }

            const result = await createPatientAction(formData);
            if (result.success) {
                router.push('/dashboard/doctor');
            } else {
                setError(result.error || 'Failed to create patient');
            }
        } catch (e) {
            setError('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6 flex items-center justify-center">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Link href="/dashboard/doctor">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                        </Link>
                        <CardTitle>Add New Patient</CardTitle>
                    </div>
                    <CardDescription>
                        Register a new patient. Upload a file to automatically map data.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form action={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name (姓名)</Label>
                            <Input id="fullName" name="fullName" placeholder="e.g. Zhang Li" required />
                        </div>

                        <div className="space-y-2 pt-4 border-t border-slate-100">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="dataset">Upload Initial Dataset</Label>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="deep-analysis"
                                        checked={useDeepAnalysis}
                                        onCheckedChange={setUseDeepAnalysis}
                                    />
                                    <Label htmlFor="deep-analysis" className="text-xs text-slate-500 cursor-pointer flex items-center gap-1">
                                        <BrainCircuit className="w-3 h-3" />
                                        Deep Analysis (Slower)
                                    </Label>
                                </div>
                            </div>
                            <Input
                                id="dataset"
                                name="dataset"
                                type="file"
                                accept=".xlsx, .xls, .csv, .json"
                                onChange={handleFileChange}
                            />
                        </div>

                        {/* AI Thinking Log */}
                        <AIThinkingLog
                            thoughtProcess={object?.thought_process || ''}
                            isAnalyzing={isAIProcessing}
                            status={isAIProcessing ? 'analyzing' : (object ? 'complete' : (aiError ? 'error' : 'idle'))}
                            error={aiError?.message}
                            className="mb-4"
                        />

                        {/* Result Display */}
                        {isCanonical && (
                            <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded border border-emerald-100">
                                <p className="font-bold mb-1">✓ Canonical Format Detected</p>
                                <p className="text-xs">File is already in standard format. No AI analysis needed.</p>
                            </div>
                        )}

                        {!isCanonical && object?.analysis && (
                            <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded border border-blue-100">
                                <p className="font-bold mb-1">AI Analysis Result:</p>
                                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                                    <li>Columns: {object.analysis.totalColumns} detected</li>
                                    <li>Date Column: {object.dateColumn?.sourceName || 'None'} ({Math.round((object.dateColumn?.confidence || 0) * 100)}%)</li>
                                    <li>Metrics Mapped: {Object.keys(object.metricMappings || {}).length}</li>
                                </ul>
                            </div>
                        )}

                        {error && (
                            <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={isLoading || isAIProcessing || (!isCanonical && !mappingResult)}>
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
                                    </>
                                ) : (
                                    'Create Patient Account'
                                )}
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1 border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                disabled={isLoading || isAIProcessing}
                                onClick={(e) => {
                                    e.preventDefault();
                                    const form = e.currentTarget.closest('form');
                                    if (form) {
                                        const formData = new FormData(form);
                                        formData.append('useTemplate', 'true');
                                        handleSubmit(formData);
                                    }
                                }}
                            >
                                Start with Empty Template
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
