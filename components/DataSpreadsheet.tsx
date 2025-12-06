'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FormalDatasetRow } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CANONICAL_HEADERS } from '@/lib/schema/index';

interface DataSpreadsheetProps {
    data: FormalDatasetRow[];
    columns: string[];
    onDataChange: (newData: FormalDatasetRow[]) => void;
}

const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 26;
const FROZEN_ROWS_COUNT = 4;
const DEFAULT_COL_WIDTH = 120;
const MIN_COL_WIDTH = 50;

const MORANDI_COLORS = [
    '#fde3e3', // Red (Opaque blended with white)
    '#feeadc', // Orange
    '#fdf4da', // Yellow
    '#def6e7', // Green
    '#daf4f9', // Cyan
    '#e2ecfe', // Blue
    '#f2e6fe'  // Purple
];

export function DataSpreadsheet({ data, columns, onDataChange }: DataSpreadsheetProps) {
    const [colWidths, setColWidths] = useState<Record<string, number>>({});
    const [resizingCol, setResizingCol] = useState<string | null>(null);
    const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null);

    // Initialize widths if needed
    useEffect(() => {
        setColWidths(prev => {
            const next = { ...prev };
            let changed = false;
            columns.forEach(col => {
                if (!next[col]) {
                    next[col] = DEFAULT_COL_WIDTH;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [columns]);

    // Handle global mouse events for resizing
    useEffect(() => {
        if (!resizingCol) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            const diff = e.clientX - resizingRef.current.startX;
            const newWidth = Math.max(MIN_COL_WIDTH, resizingRef.current.startWidth + diff);

            setColWidths(prev => ({
                ...prev,
                [resizingCol]: newWidth
            }));
        };

        const handleMouseUp = () => {
            setResizingCol(null);
            resizingRef.current = null;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto'; // Re-enable selection
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingCol]);

    const startResize = (e: React.MouseEvent, col: string) => {
        e.preventDefault();
        e.stopPropagation();
        setResizingCol(col);
        resizingRef.current = {
            startX: e.clientX,
            startWidth: colWidths[col] || DEFAULT_COL_WIDTH
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent selection while dragging
    };

    const handleCellChange = (rowIndex: number, column: string, value: string) => {
        const newData = [...data];
        newData[rowIndex] = { ...newData[rowIndex], [column]: value };
        onDataChange(newData);
    };

    const getHeaderLabel = (colKey: string) => {
        // Try to find the friendly name from the canonical headers
        // @ts-ignore
        const friendly = CANONICAL_HEADERS[colKey];
        if (friendly) return `${friendly}`;

        // If it's a metric column, try to get name from Row 2 (index 2) if available
        // Row 2 is the Header Row in canonical schema
        if (data && data.length > 2 && data[2] && data[2][colKey]) {
            return data[2][colKey] as string;
        }

        return colKey;
    };

    return (
        <div className="flex-1 overflow-auto relative bg-white border border-slate-300 rounded-none shadow-sm">
            <table className="min-w-max border-collapse text-[11px] font-mono table-fixed">
                <thead className="bg-slate-100 sticky top-0 z-40 shadow-[0_1px_0_0_rgba(203,213,225,1)]">
                    <tr style={{ height: HEADER_HEIGHT }}>
                        <th className="w-10 border-r border-b border-slate-300 bg-slate-200/80 text-slate-600 text-center select-none font-semibold sticky left-0 z-50">
                            #
                        </th>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                className="border-r border-b border-slate-300 px-2 text-left font-semibold text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis bg-slate-100 relative group"
                                style={{ width: colWidths[col] || DEFAULT_COL_WIDTH }}
                            >
                                {getHeaderLabel(col)}
                                {/* Resize Handle */}
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 group-hover:bg-slate-300 z-10"
                                    onMouseDown={(e) => startResize(e, col)}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, rIdx) => {
                        const isFrozen = rIdx < FROZEN_ROWS_COUNT;

                        // Calculate sticky top position for frozen rows
                        // Top header is HEADER_HEIGHT height.
                        // Frozen rows stack below it.
                        const stickyTop = isFrozen
                            ? HEADER_HEIGHT + (rIdx * ROW_HEIGHT)
                            : undefined;

                        // Dynamic Background Color for Frozen Rows
                        const rowStyle: React.CSSProperties = {
                            height: ROW_HEIGHT,
                            position: isFrozen ? 'sticky' : undefined,
                            top: stickyTop,
                            zIndex: isFrozen ? 30 : 0,
                            backgroundColor: isFrozen ? MORANDI_COLORS[rIdx % MORANDI_COLORS.length] : undefined
                        };

                        const rowClass = isFrozen
                            ? "font-medium text-slate-700 shadow-[0_1px_0_0_rgba(203,213,225,1)]"
                            : "hover:bg-blue-50/50 transition-colors";

                        return (
                            <tr
                                key={rIdx}
                                className={rowClass}
                                style={rowStyle}
                            >
                                <td
                                    className={cn(
                                        "border-r border-b border-slate-300 text-slate-500 text-center select-none sticky left-0 transition-colors",
                                        isFrozen ? "z-40 font-semibold" : "bg-slate-50 z-20"
                                    )}
                                    style={{
                                        backgroundColor: isFrozen ? MORANDI_COLORS[rIdx % MORANDI_COLORS.length] : undefined
                                    }}
                                >
                                    {rIdx + 1}
                                </td>
                                {columns.map((col, cIdx) => (
                                    <td
                                        key={cIdx}
                                        className="border-r border-b border-slate-300 p-0"
                                        style={{ width: colWidths[col] || DEFAULT_COL_WIDTH }}
                                    >
                                        <input
                                            type="text"
                                            className={cn(
                                                "w-full h-full px-2 bg-transparent border-none outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 text-[11px] whitespace-nowrap overflow-hidden text-ellipsis font-mono",
                                                isFrozen && "font-sans font-semibold text-slate-800"
                                            )}
                                            style={{
                                                lineHeight: `${ROW_HEIGHT}px`
                                            }}
                                            value={row[col] || ''}
                                            onChange={(e) => handleCellChange(rIdx, col, e.target.value)}
                                            title={row[col] || ''} // Show full text on hover
                                        />
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
