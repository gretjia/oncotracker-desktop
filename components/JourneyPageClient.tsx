'use client';

import React, { useState } from 'react';
import { PatientJourneyVisualizer } from '@/components/PatientJourneyVisualizer';
import { ChatInterface } from '@/components/ChatInterface';
import { FormalDataset } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { MessageSquare, X } from 'lucide-react';

interface JourneyPageClientProps {
    dataset: FormalDataset;
    initialSettings?: any;
    patientId?: string;
}

// Feature flag to control AI Assistant visibility
const SHOW_AI_ASSISTANT = false;

export function JourneyPageClient({ dataset, initialSettings, patientId }: JourneyPageClientProps) {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [highlightedMetric, setHighlightedMetric] = useState<string | null>(null);

    return (
        <div className="h-screen w-screen overflow-hidden flex relative">
            {/* Main Chart Area */}
            <div className="flex-1 h-full relative">
                <PatientJourneyVisualizer
                    dataset={dataset}
                    highlightMetric={highlightedMetric}
                    initialSettings={initialSettings}
                    patientId={patientId}
                />

                {/* Floating Toggle Button */}
                {SHOW_AI_ASSISTANT && !isChatOpen && (
                    <Button
                        onClick={() => setIsChatOpen(true)}
                        className="absolute bottom-6 right-6 rounded-full shadow-xl h-12 px-4 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 z-40 animate-in fade-in zoom-in duration-300"
                    >
                        <MessageSquare className="w-5 h-5" />
                        <span className="font-semibold hidden md:inline">Assistant</span>
                        <span className="font-semibold md:hidden">AI Chat</span>
                    </Button>
                )}
            </div>

            {/* Chat Sidebar */}
            {SHOW_AI_ASSISTANT && isChatOpen && (
                <div className="fixed inset-0 z-50 w-full md:relative md:w-[350px] md:inset-auto h-full bg-white border-l shadow-xl transition-all duration-300 ease-in-out">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 z-30 h-8 w-8 md:h-6 md:w-6"
                        onClick={() => setIsChatOpen(false)}
                    >
                        <X className="w-5 h-5 md:w-4 md:h-4" />
                    </Button>
                    <ChatInterface dataset={dataset} onHighlightMetric={setHighlightedMetric} />
                </div>
            )}
        </div>
    );
}
