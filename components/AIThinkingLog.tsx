
import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Loader2, Terminal, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AIThinkingLogProps {
    thoughtProcess: string;
    isAnalyzing: boolean;
    status: 'idle' | 'analyzing' | 'complete' | 'error';
    error?: string;
    className?: string;
}

export function AIThinkingLog({
    thoughtProcess,
    isAnalyzing,
    status,
    error,
    className
}: AIThinkingLogProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when thought process updates
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [thoughtProcess]);

    if (status === 'idle') return null;

    return (
        <div className={cn("w-full rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden", className)}>
            <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" />
                <span>AI Analysis Log</span>
                {isAnalyzing && (
                    <span className="ml-auto flex items-center gap-1.5 text-primary animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                    </span>
                )}
                {status === 'complete' && (
                    <span className="ml-auto flex items-center gap-1.5 text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Analysis Complete
                    </span>
                )}
                {status === 'error' && (
                    <span className="ml-auto flex items-center gap-1.5 text-red-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Analysis Failed
                    </span>
                )}
            </div>

            <ScrollArea ref={scrollRef} className="h-[200px] w-full bg-black/90 p-4 font-mono text-xs text-green-400">
                <div className="whitespace-pre-wrap">
                    {thoughtProcess || (isAnalyzing ? "Initializing Qwen AI model..." : "")}
                    {isAnalyzing && <span className="inline-block w-2 h-4 ml-1 align-middle bg-green-400 animate-pulse" />}
                </div>

                {error && (
                    <div className="mt-4 text-red-400 border-t border-red-900/50 pt-2">
                        Error: {error}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
