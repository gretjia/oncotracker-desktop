'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Printer, ZoomIn, ZoomOut, Maximize2, RotateCcw, ArrowUpDown, Plus, Minus, SlidersHorizontal, ChevronDown, Settings2, Activity, ArrowLeftRight } from 'lucide-react';
import { savePatientSettings } from '@/lib/actions/settings';
import { useDebounce } from 'use-debounce';

import Link from 'next/link';
import { FormalDataset, AppStateData, AppStateView, Metric, Phase, EventMarker } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';

interface PatientJourneyVisualizerProps {
    dataset: FormalDataset;
    highlightMetric?: string | null;
    initialSettings?: any;
    patientId?: string;
}

const COLORS = ['#0284c7', '#d97706', '#be185d', '#7c3aed', '#059669', '#dc2626', '#475569', '#4f46e5', '#ea580c', '#0d9488', '#c026d3', '#6366f1', '#84cc16', '#f43f5e'];

// Helper to process data synchronously
function processData(dataset: FormalDataset): AppStateData {
    if (!dataset || !dataset.FormalDataset) {
        return { phases: [], events: [], metrics: {}, schemes: [], totalPoints: 0 };
    }

    const rows = dataset.FormalDataset;
    const headerRow = rows[0];
    const unitRow = rows[1];

    // Column mappings for CANONICAL format
    const COL_DATE = "Unnamed: 0";
    const COL_PHASE = "Unnamed: 1";
    const COL_CYCLE = "Unnamed: 2";
    const COL_SCHEME = "Unnamed: 4";
    const COL_EVENT = "Unnamed: 5";
    const COL_SCHEME_DETAIL = "Unnamed: 6";

    const newData: AppStateData = { phases: [], events: [], metrics: {}, schemes: [], totalPoints: 0 };
    const metricMap: Record<string, string> = {};

    if (!headerRow) return newData;

    const FIXED_COLS = [COL_DATE, COL_PHASE, COL_CYCLE, "Unnamed: 3", COL_SCHEME, COL_EVENT, COL_SCHEME_DETAIL];

    Object.entries(headerRow).forEach(([key, val]) => {
        if (val && !FIXED_COLS.includes(key)) {
            // Trim metric name to prevent "CEA" vs "CEA " duplicates
            const metricName = String(val).trim();
            metricMap[key] = metricName;

            if (!newData.metrics[metricName]) {
                const colorIdx = Object.keys(newData.metrics).length % COLORS.length;
                let threshold = null;
                if (unitRow && unitRow[key] && typeof unitRow[key] === 'string') {
                    const match = unitRow[key].match(/[<>]\s*([\d\.]+)/);
                    if (match) threshold = parseFloat(match[1]);
                }

                newData.metrics[metricName] = {
                    id: key, name: metricName, data: [], color: COLORS[colorIdx],
                    scale: 1.0, offset: 0, opacity: 1.0, showLine: true, showValues: false, mid: 0,
                    active: false, expanded: false,
                    unit: (unitRow && unitRow[key]) || '', rangeMin: 0, rangeMax: 0, threshold: threshold, baseScale: 1.0
                };
            }
        }
    });

    const timeline: { date: Date; row: any }[] = [];
    rows.slice(2).forEach((row, idx) => {
        let date: Date;
        const rawDate = row[COL_DATE];

        if (typeof rawDate === 'number') {
            date = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
        } else if (typeof rawDate === 'string') {
            date = new Date(rawDate);
        } else {
            return;
        }

        if (isNaN(date.getTime())) return;

        timeline.push({ date, row });
        if (row[COL_EVENT]) newData.events.push({ date, name: row[COL_EVENT], overlapIndex: 0 });

        Object.keys(metricMap).forEach(key => {
            let rawVal = row[key];
            const metricName = metricMap[key];

            if (rawVal != null && rawVal !== "") {
                if (typeof rawVal === 'string') rawVal = rawVal.replace(/,/g, '').replace(/[<>]/g, '');
                const num = parseFloat(rawVal);

                if (!isNaN(num)) {
                    const metric = newData.metrics[metricName];
                    if (metric) {
                        const isAlert = (metric.threshold !== null && num > metric.threshold);
                        metric.data.push({ date, value: num, isAlert });
                        newData.totalPoints++;
                    }
                }
            }
        });
    });

    // Calculate Ranges & Defaults
    Object.values(newData.metrics).forEach(m => {
        if (m.data.length === 0) return;
        const vals = m.data.map(d => d.value);
        const min = Math.min(...vals), max = Math.max(...vals);
        m.rangeMin = min; m.rangeMax = max;
        m.mid = (min + max) / 2;

        if (max === min) {
            m.scale = 1;
            m.offset = 50 - m.mid;
        } else {
            m.scale = 60 / (max - min);
            m.offset = 50 - m.mid;
        }
        m.scale = parseFloat(m.scale.toFixed(3));
        m.offset = Math.round(m.offset);
        m.baseScale = m.scale;
    });

    // Process Phases
    let currentPhase: Phase | null = null;
    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());

    timeline.forEach(({ date, row }) => {
        const phaseName = row[COL_PHASE] ? String(row[COL_PHASE]) : null;
        const rawCycle = row[COL_CYCLE] ? String(row[COL_CYCLE]) : null;
        const cycleName = rawCycle ? (rawCycle.match(/C\d+|AS\d+/) || [rawCycle])[0] : null;
        const schemeText = row[COL_SCHEME] ? String(row[COL_SCHEME]) : null;
        const eventName = row[COL_EVENT] ? String(row[COL_EVENT]) : null;

        const isAS = cycleName && cycleName.startsWith("AS");
        let isNewCycle = false;
        if (isAS) {
            isNewCycle = !currentPhase || currentPhase.name !== "AS";
        } else {
            isNewCycle = !!(cycleName && (!currentPhase || currentPhase.cycle !== cycleName));
        }

        const isNewNonCyclePhase = !cycleName && phaseName && phaseName !== eventName &&
            (!currentPhase || !currentPhase.cycle || phaseName.includes("术"));

        if (isNewCycle || isNewNonCyclePhase) {
            if (currentPhase) {
                currentPhase.end = date;
                currentPhase.duration = Math.ceil((currentPhase.end.getTime() - currentPhase.start.getTime()) / (1000 * 60 * 60 * 24));
                newData.phases.push(currentPhase);
            }

            let newName = phaseName || (currentPhase ? (currentPhase as Phase).name : "Treatment");
            let newCycle = cycleName || "";
            let newScheme = schemeText || (currentPhase ? (currentPhase as Phase).scheme : "");

            if (isAS) {
                newName = "AS";
                newCycle = "AS";
                newScheme = "";
            }

            currentPhase = {
                start: date,
                end: new Date(),
                name: newName,
                cycle: newCycle,
                scheme: newScheme,
                duration: 0,
                type: (phaseName && (phaseName.includes("术") || phaseName.includes("腹腔镜"))) ? "surgery" : "medication"
            };
        } else if (schemeText && currentPhase) {
            if (currentPhase.name !== "AS") {
                currentPhase.scheme = schemeText;
            }
        }
    });

    if (timeline.length > 0) {
        let maxDate = new Date(timeline[0].date);
        timeline.forEach(t => { if (t.date > maxDate) maxDate = t.date; });

        if (currentPhase) {
            const phase = currentPhase as Phase;
            const defaultEnd = new Date(phase.start.getTime() + (21 * 24 * 60 * 60 * 1000));
            phase.end = new Date(Math.max(defaultEnd.getTime(), maxDate.getTime()));
            phase.duration = Math.ceil((phase.end.getTime() - phase.start.getTime()) / (1000 * 60 * 60 * 24));
            newData.phases.push(phase);
        }
    }

    // Sort Events & Overlap
    newData.events.sort((a, b) => a.date.getTime() - b.date.getTime());
    let lastDate: Date | null = null;
    let overlapCount = 0;
    newData.events.forEach(e => {
        if (lastDate && e.date.getTime() === lastDate.getTime()) {
            overlapCount++;
        } else {
            overlapCount = 0;
            lastDate = e.date;
        }
        e.overlapIndex = overlapCount;
    });

    // Default Active Metrics
    const preferredMetrics = ["体重", "Weight", "CEA", "CA125", "MRD", "Tumor Burden", "AFP", "CYFRA21-1", "细胞角蛋白19片段"];
    preferredMetrics.forEach(n => { if (newData.metrics[n]) newData.metrics[n].active = true; });

    const activeCount = Object.values(newData.metrics).filter(m => m.active).length;
    if (activeCount === 0) {
        Object.values(newData.metrics).slice(0, 5).forEach(m => m.active = true);
    }

    return newData;
}

export function PatientJourneyVisualizer({ dataset, highlightMetric, initialSettings, patientId }: PatientJourneyVisualizerProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<Element, unknown> | null>(null);
    const gMainRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
    const xRef = useRef<d3.ScaleTime<number, number> | null>(null);

    // State
    const [data, setData] = useState<AppStateData>(() => {
        const baseData = processData(dataset);

        // Apply initial settings if available
        if (initialSettings?.metrics) {
            Object.keys(baseData.metrics).forEach(key => {
                if (initialSettings.metrics[key]) {
                    baseData.metrics[key] = {
                        ...baseData.metrics[key],
                        ...initialSettings.metrics[key],
                        // Preserve data points, don't overwrite them with settings
                        data: baseData.metrics[key].data
                    };
                }
            });
        }
        return baseData;
    });

    const [view, setView] = useState<AppStateView>(() => {
        const defaultView = {
            showPhases: true,
            showEvents: true,
            showSchemes: false,
            phaseOpacity: 0.15,
            margin: { top: 85, right: 30, bottom: 30, left: 30 },
            width: 0,
            height: 0,
            chartFlexRatio: 2,
            isPrinting: false
        };

        if (initialSettings?.view) {
            return { ...defaultView, ...initialSettings.view };
        }
        return defaultView;
    });

    const [showControls, setShowControls] = useState(true);
    const [showMetricSelector, setShowMetricSelector] = useState(false);

    // Debounce settings save
    const [debouncedData] = useDebounce(data, 1000);
    const [debouncedView] = useDebounce(view, 1000);

    // Effect to save settings
    useEffect(() => {
        if (!patientId) return;

        const settingsToSave = {
            metrics: Object.entries(debouncedData.metrics).reduce((acc, [key, metric]) => {
                // Only save visual properties
                acc[key] = {
                    color: metric.color,
                    scale: metric.scale,
                    offset: metric.offset,
                    opacity: metric.opacity,
                    showLine: metric.showLine,
                    showValues: metric.showValues,
                    active: metric.active,
                    expanded: metric.expanded
                };
                return acc;
            }, {} as any),
            view: {
                showPhases: debouncedView.showPhases,
                showEvents: debouncedView.showEvents,
                showSchemes: debouncedView.showSchemes,
                phaseOpacity: debouncedView.phaseOpacity
            }
        };

        savePatientSettings(patientId, settingsToSave).catch(err => {
            console.error('Failed to save settings:', err);
        });
    }, [debouncedData.metrics, debouncedView.showPhases, debouncedView.showEvents, debouncedView.showSchemes, debouncedView.phaseOpacity, patientId]);

    // Handle Highlight Metric Effect
    useEffect(() => {
        if (highlightMetric && data.metrics[highlightMetric]) {
            setData(prev => {
                const metric = prev.metrics[highlightMetric];
                if (!metric) return prev;

                if (metric.active && metric.expanded) return prev;

                return {
                    ...prev,
                    metrics: {
                        ...prev.metrics,
                        [highlightMetric]: { ...metric, active: true, expanded: true }
                    }
                };
            });
        }
    }, [highlightMetric, data.metrics]);

    // Handle Resize
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                const isMobile = width < 768;
                setView(prev => {
                    if (prev.width === width && prev.height === height) return prev;
                    return {
                        ...prev,
                        width,
                        height,
                        margin: isMobile
                            ? { top: 60, right: 10, bottom: 20, left: 10 }
                            : { top: 85, right: 30, bottom: 30, left: 30 }
                    };
                });
            }
        });

        resizeObserver.observe(chartContainerRef.current);

        const handleBeforePrint = () => {
            setView(prev => ({ ...prev, isPrinting: true }));
        };
        const handleAfterPrint = () => {
            setView(prev => ({ ...prev, isPrinting: false }));
        };

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, []);

    // Init Chart
    useEffect(() => {
        if (!chartContainerRef.current || data.phases.length === 0) return;

        const container = chartContainerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // Ensure view dimensions match container
        if (width !== view.width || height !== view.height) {
            setView(v => ({ ...v, width, height }));
            return; // Let the next render handle it
        }

        d3.select(container).selectAll("*").remove();

        const svg = d3.select(container).append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, width, height])
            .style("touch-action", "none");

        svgRef.current = svg.node();

        const defs = svg.append("defs");
        defs.append("marker").attr("id", "arrow-start").attr("viewBox", "0 0 10 10").attr("refX", 10).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M 10 0 L 0 5 L 10 10 z").attr("fill", "#94a3b8");
        defs.append("marker").attr("id", "arrow-end").attr("viewBox", "0 0 10 10").attr("refX", 0).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto").append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", "#94a3b8");

        const clipHeight = Math.max(0, height - view.margin.bottom);
        const chartClipHeight = Math.max(0, height - view.margin.top - view.margin.bottom);

        defs.append("clipPath").attr("id", "mainClip").append("rect").attr("x", view.margin.left).attr("y", 0).attr("width", Math.max(0, width - view.margin.left - view.margin.right)).attr("height", clipHeight);
        defs.append("clipPath").attr("id", "chartClip").append("rect").attr("x", view.margin.left).attr("y", view.margin.top).attr("width", Math.max(0, width - view.margin.left - view.margin.right)).attr("height", chartClipHeight);

        const allDates = [
            ...data.phases.map(p => p.start),
            ...data.phases.map(p => p.end),
            ...data.events.map(e => e.date),
            ...Object.values(data.metrics).flatMap(m => m.data.map(d => d.date))
        ].filter(d => d);

        const domain = d3.extent(allDates) as [Date, Date];
        if (domain[0]) domain[0] = new Date(domain[0].getTime() - 864000000);
        if (domain[1]) domain[1] = new Date(domain[1].getTime() + 864000000);

        if (!domain[0] || !domain[1]) {
            const now = new Date();
            domain[0] = new Date(now.getTime() - 365 * 86400000);
            domain[1] = now;
        }

        const x = d3.scaleTime().domain(domain).range([view.margin.left, width - view.margin.right]);
        xRef.current = x;
        const y = d3.scaleLinear().domain([0, 100]).range([height - view.margin.bottom, view.margin.top]);

        const zoom = d3.zoom()
            .scaleExtent([0.5, 20])
            .translateExtent([[-2000, 0], [width + 2000, height]])
            .filter((event) => !event.type.includes('wheel'))
            .on("zoom", (e) => {
                const newX = e.transform.rescaleX(x);
                updateChart(newX, y);
            });

        zoomRef.current = zoom;
        svg.call(zoom as any).on("dblclick.zoom", null);

        const gMain = svg.append("g");
        gMainRef.current = gMain;

        gMain.append("rect").attr("class", "header-bg").attr("x", 0).attr("y", 0).attr("width", width).attr("height", view.margin.top).attr("fill", "#f1f5f9");
        gMain.append("line").attr("class", "header-separator").attr("x1", 0).attr("y1", view.margin.top).attr("x2", width).attr("y2", view.margin.top).attr("stroke", "#cbd5e1").attr("stroke-width", 1);

        gMain.append("g").attr("class", "x-axis-month").attr("transform", `translate(0,${height - view.margin.bottom})`);
        gMain.append("g").attr("class", "x-axis-minor").attr("transform", `translate(0,${height - view.margin.bottom})`);
        gMain.append("g").attr("class", "x-axis-year-custom").attr("transform", `translate(0,${height - view.margin.bottom + 20})`);
        gMain.append("g").attr("class", "y-axis").attr("transform", `translate(${view.margin.left},0)`).call(d3.axisLeft(y));

        // Move event-layer here so it renders BEHIND metrics
        gMain.append("g").attr("id", "event-layer");

        const contentLayer = gMain.append("g").attr("id", "content-layer").attr("clip-path", "url(#mainClip)");
        contentLayer.append("g").attr("id", "phase-layer");
        contentLayer.append("g").attr("id", "line-layer").attr("clip-path", "url(#chartClip)");
        contentLayer.append("g").attr("id", "dot-layer").attr("clip-path", "url(#chartClip)");
        contentLayer.append("g").attr("id", "label-layer").attr("clip-path", "url(#chartClip)");

        updateChart(x, y);

    }, [data, view.width, view.height]);

    // Update Chart Function
    const updateChart = (scaleX: d3.ScaleTime<number, number>, scaleY: d3.ScaleLinear<number, number>) => {
        if (!gMainRef.current) return;
        const gMain = gMainRef.current;

        gMain.select<SVGGElement>(".x-axis-month").call(d3.axisBottom(scaleX).ticks(d3.timeMonth.every(1)).tickFormat(d3.timeFormat("%m") as any).tickSizeOuter(0));
        gMain.select<SVGGElement>(".x-axis-minor").call(d3.axisBottom(scaleX).ticks(d3.timeDay.filter(d => d.getDate() === 15)).tickFormat(() => "").tickSize(4).tickSizeOuter(0));

        const yearGroup = gMain.select(".x-axis-year-custom");
        yearGroup.selectAll("*").remove();
        const domainStart = scaleX.domain()[0];
        const domainEnd = scaleX.domain()[1];
        const years = d3.timeYear.range(d3.timeYear.floor(domainStart), d3.timeYear.ceil(domainEnd));
        if (years[years.length - 1] < domainEnd) years.push(d3.timeYear.offset(years[years.length - 1], 1));

        years.forEach(yearDate => {
            const nextYearDate = d3.timeYear.offset(yearDate, 1);
            const yearStart = yearDate < domainStart ? domainStart : yearDate;
            const yearEnd = nextYearDate > domainEnd ? domainEnd : nextYearDate;
            if (yearStart < yearEnd) {
                const x1 = scaleX(yearStart);
                const x2 = scaleX(yearEnd);
                const width = x2 - x1;
                if (width > 20) {
                    const mid = (x1 + x2) / 2;
                    yearGroup.append("text").attr("x", mid).attr("y", 4).attr("text-anchor", "middle").attr("fill", "#64748b").attr("font-size", "11px").attr("font-weight", "bold").text(d3.timeFormat("%Y")(yearDate));
                    if (mid - x1 > 30) yearGroup.append("line").attr("x1", x1 + 5).attr("y1", 0).attr("x2", mid - 20).attr("y2", 0).attr("stroke", "#94a3b8").attr("stroke-width", 1.5).attr("marker-start", "url(#arrow-start)");
                    if (x2 - mid > 30) yearGroup.append("line").attr("x1", mid + 20).attr("y1", 0).attr("x2", x2 - 5).attr("y2", 0).attr("stroke", "#94a3b8").attr("stroke-width", 1.5).attr("marker-end", "url(#arrow-end)");
                }
            }
            const boundaryX = scaleX(yearDate);
            if (boundaryX >= 0 && boundaryX <= view.width) {
                yearGroup.append("line").attr("x1", boundaryX).attr("y1", -15).attr("x2", boundaryX).attr("y2", 10).attr("stroke", "#cbd5e1").attr("stroke-width", 2);
            }
        });

        const phaseLayer = gMain.select("#phase-layer");
        phaseLayer.selectAll("*").remove();
        if (view.showPhases) {
            const visiblePhases = data.phases.filter(d => d.cycle || d.type === 'surgery');
            const phases = phaseLayer.selectAll(".phase-group").data(visiblePhases).join("g").attr("class", "phase-group");

            phases.append("rect")
                .attr("x", d => scaleX(d.start))
                .attr("y", 0)
                .attr("width", d => Math.max(1, scaleX(d.end) - scaleX(d.start)))
                .attr("height", view.margin.top)
                .attr("fill", (d, i) => {
                    if (d.type === 'surgery') return `rgba(239, 68, 68, ${view.phaseOpacity + 0.15})`;
                    const palette = [`rgba(239, 68, 68, ${view.phaseOpacity + 0.1})`, `rgba(249, 115, 22, ${view.phaseOpacity + 0.1})`, `rgba(234, 179, 8, ${view.phaseOpacity + 0.1})`, `rgba(34, 197, 94, ${view.phaseOpacity + 0.1})`, `rgba(6, 182, 212, ${view.phaseOpacity + 0.1})`, `rgba(59, 130, 246, ${view.phaseOpacity + 0.1})`, `rgba(168, 85, 247, ${view.phaseOpacity + 0.1})`];
                    return palette[i % palette.length];
                });

            phases.append("rect")
                .attr("x", d => scaleX(d.start))
                .attr("y", view.margin.top)
                .attr("width", d => Math.max(1, scaleX(d.end) - scaleX(d.start)))
                .attr("height", view.height - view.margin.bottom - view.margin.top)
                .attr("fill", (d, i) => {
                    if (d.type === 'surgery') return `rgba(239, 68, 68, ${view.phaseOpacity + 0.05})`;
                    const palette = [`rgba(239, 68, 68, ${view.phaseOpacity})`, `rgba(249, 115, 22, ${view.phaseOpacity})`, `rgba(234, 179, 8, ${view.phaseOpacity})`, `rgba(34, 197, 94, ${view.phaseOpacity})`, `rgba(6, 182, 212, ${view.phaseOpacity})`, `rgba(59, 130, 246, ${view.phaseOpacity})`, `rgba(168, 85, 247, ${view.phaseOpacity})`];
                    return palette[i % palette.length];
                });

            const textGroup = phases.append("text")
                .attr("x", d => scaleX(d.start) + (scaleX(d.end) - scaleX(d.start)) / 2)
                .attr("y", 15)
                .attr("text-anchor", "middle")
                .attr("fill", "#334155")
                .attr("font-size", "9px")
                .attr("font-weight", "bold");

            textGroup.append("tspan").text(d => d.cycle);
            textGroup.append("tspan").attr("x", d => scaleX(d.start) + (scaleX(d.end) - scaleX(d.start)) / 2).attr("dy", 10).text(d => `${d.duration} days`).attr("font-weight", "normal").attr("fill", "#64748b").attr("font-size", "8px");

            if (view.showSchemes) {
                phases.each(function (d) {
                    const el = d3.select(this).select("text");
                    const parts = d.scheme.split(/[&+]/).map(s => s.trim()).filter(s => s);
                    parts.forEach((part, i) => {
                        el.append("tspan").attr("x", scaleX(d.start) + (scaleX(d.end) - scaleX(d.start)) / 2).attr("dy", i === 0 ? 14 : 9).text(part).attr("font-weight", "500").attr("fill", "#475569").attr("font-size", "7.5px");
                    });
                });
            }
        }

        const eventLayer = gMain.select("#event-layer");
        eventLayer.selectAll("*").remove();
        if (view.showEvents) {
            const events = eventLayer.selectAll(".event-marker").data(data.events).join("g").attr("class", "event-marker");
            events.append("line").attr("x1", d => scaleX(d.date)).attr("x2", d => scaleX(d.date)).attr("y1", view.margin.top).attr("y2", view.height - view.margin.bottom).attr("stroke", "#94a3b8").attr("stroke-width", 1.5).attr("stroke-dasharray", "3 3");

            const textY = view.margin.top + 8;
            events.append("text").text(d => d.name)
                .attr("x", d => {
                    const side = d.overlapIndex % 2 === 0 ? 1 : -1;
                    const depth = Math.floor(d.overlapIndex / 2);
                    return scaleX(d.date) + side * (6 + depth * 10);
                })
                .attr("y", textY)
                .attr("dy", "0.35em")
                .style("writing-mode", "vertical-rl")
                .style("text-orientation", "sideways")
                .attr("text-anchor", "start")
                .attr("fill", "#334155")
                .attr("font-size", "7.5px")
                .style("font-weight", "500");

            events.append("circle").attr("cx", d => scaleX(d.date)).attr("cy", textY - 3).attr("r", 4).attr("fill", "#94a3b8");
        }

        const lineLayer = gMain.select("#line-layer");
        const dotLayer = gMain.select("#dot-layer");
        const labelLayer = gMain.select("#label-layer");
        lineLayer.selectAll("*").remove();
        dotLayer.selectAll("*").remove();
        labelLayer.selectAll("*").remove();

        const activeMetrics = Object.values(data.metrics).filter(m => m.active);
        activeMetrics.forEach(m => {
            const customY = (val: number) => scaleY(((val - m.mid) * m.scale) + m.mid + m.offset);

            if (m.showLine) {
                const line = d3.line<any>().x(d => scaleX(d.date)).y(d => customY(d.value)).curve(d3.curveCatmullRom);
                lineLayer.append("path").datum(m.data).attr("class", "metric-path").attr("d", line).attr("fill", "none").attr("stroke", "white").attr("stroke-width", 3).attr("stroke-opacity", 0.8 * m.opacity);
                lineLayer.append("path").datum(m.data).attr("class", "metric-path").attr("d", line).attr("fill", "none").attr("stroke", m.color).attr("stroke-width", 1.5).attr("stroke-opacity", m.opacity);
            }

            // Removed alert-pulse group to eliminate black circle artifact

            const dots = dotLayer.append("g").attr("class", "metric-dots");

            // Check if the metric color is "red-ish" which would make the red alert border hard to see
            const isRedMetric = ['#dc2626', '#ef4444', '#f43f5e', '#be185d', '#ea580c'].includes(m.color);

            dots.selectAll("circle").data(m.data).join("circle")
                .attr("cx", d => scaleX(d.date)).attr("cy", d => customY(d.value))
                .attr("r", 3.5)
                // If red metric AND alert -> White Fill (hollow feel). Else -> Metric Color Fill.
                .attr("fill", d => (d.isAlert && isRedMetric) ? "white" : m.color)
                // If alert -> Red Stroke. If red metric+alert -> Red Stroke (creates the ring).
                .attr("stroke", d => d.isAlert ? "#ef4444" : "white")
                .attr("stroke-width", d => d.isAlert ? 2 : 1.5)
                .attr("fill-opacity", m.opacity).attr("stroke-opacity", m.opacity);

            if (m.showValues) {
                labelLayer.append("g").attr("class", "metric-value-labels").selectAll("text").data(m.data).join("text")
                    .attr("x", d => scaleX(d.date)).attr("y", d => customY(d.value) - 8)
                    .attr("text-anchor", "middle").attr("font-size", "9px").attr("font-weight", "bold")
                    .attr("fill", d => d.isAlert ? "#ef4444" : m.color).attr("opacity", m.opacity * 0.9)
                    .text(d => d.value.toFixed(1));
            }
        });
    };

    // Redraw when view options change
    useEffect(() => {
        if (xRef.current && svgRef.current) {
            const transform = d3.zoomTransform(svgRef.current);
            const newX = transform.rescaleX(xRef.current);
            const y = d3.scaleLinear().domain([0, 100]).range([view.height - view.margin.bottom, view.margin.top]);
            updateChart(newX, y);
        }
    }, [view.showPhases, view.showEvents, view.showSchemes, view.phaseOpacity, data.metrics, view.width, view.height]);

    // Handlers
    const toggleMetric = (name: string) => {
        setData(prev => ({
            ...prev,
            metrics: { ...prev.metrics, [name]: { ...prev.metrics[name], active: !prev.metrics[name].active } }
        }));
    };

    const updateMetricProp = (name: string, prop: keyof Metric, value: any) => {
        setData(prev => ({
            ...prev,
            metrics: { ...prev.metrics, [name]: { ...prev.metrics[name], [prop]: value } }
        }));
    };

    const zoomChart = (factor: number) => {
        if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current as Element).transition().duration(300).call(zoomRef.current.scaleBy, factor);
        }
    };

    const resetChartZoom = () => {
        if (svgRef.current && zoomRef.current) {
            d3.select(svgRef.current as Element).transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
        }
    };

    const zoomYAxis = (factor: number) => {
        setView(prev => ({
            ...prev,
            chartFlexRatio: Math.max(0.5, Math.min(10, prev.chartFlexRatio * factor))
        }));
    };

    const autoFitYAxis = () => {
        setView(prev => ({ ...prev, chartFlexRatio: 2 }));
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
            <header className="h-14 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 flex-shrink-0 z-30 sticky top-0">
                <Link href="/dashboard/doctor" className="flex items-center gap-3 hover:opacity-80 transition-opacity group cursor-pointer">
                    <div className="w-9 h-9 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 shadow-sm ring-1 ring-blue-100 group-hover:bg-blue-100 transition-colors">
                        <Activity className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none mb-0.5">
                            {dataset.patientName ? (
                                <span className="flex items-center gap-2">
                                    PATIENT JOURNEY
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className="text-blue-700">{dataset.patientName}</span>
                                </span>
                            ) : 'PATIENT JOURNEY'}
                        </h1>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">OncoTracker</span>
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-[9px] font-bold text-blue-600 border border-blue-100">PRO</span>
                        </div>
                    </div>
                </Link>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-medium bg-white hover:bg-slate-50" onClick={() => window.print()}>Print Report</Button>
                </div>
            </header>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50">
                <main className="flex flex-col bg-white relative w-full border-b border-slate-200 z-0 min-h-0 print:h-screen print:w-screen print:border-none" style={{ flex: view.chartFlexRatio }}>
                    <div className="text-center py-2 border-b border-slate-100 bg-white shrink-0">
                        <h2 className="text-sm font-bold text-slate-800">
                            {dataset.patientName ? `Timeline of Cancer Treatment and Monitoring: ${dataset.patientName}` : 'Timeline of Cancer Treatment and Monitoring'}
                        </h2>
                    </div>
                    <div className="flex-1 relative w-full group min-h-0" ref={chartContainerRef}></div>

                    <div className="h-10 border-t border-slate-100 bg-slate-50/50 flex items-center px-3 justify-between shrink-0">
                        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-1 mr-4">
                            <div className="text-[9px] font-bold text-slate-400 uppercase whitespace-nowrap flex-shrink-0">Active:</div>
                            <div className="flex items-center gap-2 pr-2">
                                {Object.values(data.metrics).filter(m => m.active).map(m => (
                                    <div key={m.name} className="flex items-center gap-1 px-1 py-0.5 text-[10px] text-slate-500 whitespace-nowrap cursor-pointer hover:text-slate-900 transition-colors" onClick={() => updateMetricProp(m.name, 'expanded', !m.expanded)}>
                                        <div className="flex items-center relative w-6 justify-center">
                                            <div className="absolute w-full h-0.5" style={{ backgroundColor: m.color, opacity: 0.6 }}></div>
                                            <div className="w-2 h-2 rounded-full z-10 border border-white" style={{ backgroundColor: m.color, opacity: m.opacity }}></div>
                                        </div>
                                        <span className="font-bold text-slate-600">{m.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn("h-8 text-xs font-medium px-2", showMetricSelector && "bg-slate-100 text-blue-600")}
                                onClick={() => setShowMetricSelector(!showMetricSelector)}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                                指标选择
                            </Button>

                            {showMetricSelector && (
                                <Card className="absolute bottom-10 left-0 w-64 p-3 z-50 shadow-xl max-h-[60vh] overflow-y-auto border-slate-200 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                                        <h3 className="font-bold text-xs text-slate-800">显示指标 ({Object.values(data.metrics).filter(m => m.active).length})</h3>
                                    </div>
                                    <div className="space-y-1.5">
                                        {Object.values(data.metrics).sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                                            <div key={m.name} className="flex items-center justify-between hover:bg-slate-50 p-1 rounded transition-colors">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }}></div>
                                                    <span className="text-[10px] font-medium text-slate-600 truncate" title={m.name}>{m.name}</span>
                                                </div>
                                                <Switch
                                                    checked={m.active}
                                                    onCheckedChange={() => toggleMetric(m.name)}
                                                    className="scale-75 data-[state=checked]:bg-blue-600"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}
                        </div>

                        <div className="flex items-center gap-2 mr-4 border-l border-slate-200 pl-3 print:hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 md:hidden"
                                onClick={() => setShowControls(!showControls)}
                            >
                                {showControls ? <ChevronDown className="w-4 h-4 text-blue-600" /> : <Settings2 className="w-4 h-4 text-slate-500" />}
                            </Button>
                            <span className="text-[9px] font-bold text-slate-400 uppercase hidden sm:inline">背景透明度</span>
                            <Slider min={0} max={1} step={0.05} value={[view.phaseOpacity]} onValueChange={([v]) => setView(prev => ({ ...prev, phaseOpacity: v }))} className="w-16 hidden sm:flex" />
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0 pl-3 border-l border-slate-200 bg-slate-50/50 print:hidden">
                            <ArrowLeftRight className="w-3 h-3 text-slate-500 mr-0.5" />
                            <span className="text-[10px] font-bold text-slate-500 mr-1">横纵比：</span>
                            <button onClick={() => zoomChart(1.2)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-500 transition-all" title="Zoom In">
                                <Plus className="w-3 h-3" />
                            </button>
                            <button onClick={() => zoomChart(0.8)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-500 transition-all" title="Zoom Out">
                                <Minus className="w-3 h-3" />
                            </button>
                            <button onClick={resetChartZoom} className="h-6 px-2 flex items-center justify-center gap-1 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-600 text-[10px] font-bold transition-all ml-1" title="Reset View">
                                全病程
                            </button>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0 pl-3 border-l border-slate-200 bg-blue-50/30 print:hidden">
                            <ArrowUpDown className="w-3 h-3 text-blue-600 mr-0.5" />
                            <span className="text-[10px] font-bold text-slate-500 mr-1">纵横比：</span>
                            <button onClick={() => zoomYAxis(1.2)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-500 transition-all" title="Zoom In (Y-axis)">
                                <Plus className="w-3 h-3" />
                            </button>
                            <button onClick={() => zoomYAxis(0.8)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-500 transition-all" title="Zoom Out (Y-axis)">
                                <Minus className="w-3 h-3" />
                            </button>
                            <button onClick={autoFitYAxis} className="h-6 px-2 flex items-center justify-center gap-1 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 text-slate-600 text-[10px] font-bold transition-all ml-1" title="Auto-fit Y-axis">
                                自适应
                            </button>
                        </div>
                    </div>
                </main>

                <aside
                    className={cn(
                        "bg-slate-50 flex flex-col z-10 min-h-0 overflow-hidden print:hidden transition-all duration-300 ease-in-out",
                        showControls ? "flex-1 opacity-100" : "h-0 flex-none opacity-0 border-none"
                    )}
                    style={{ flex: showControls ? (view.width < 768 ? 1.5 : 1) : 0 }}
                >
                    <div className="px-4 py-2 border-b border-slate-200 bg-white flex gap-4 items-center justify-between shrink-0 shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
                        <div className="flex gap-4 items-center flex-1">
                            <div>
                                <div className="text-[9px] text-slate-400 font-bold uppercase">Points</div>
                                <div className="text-[10px] font-mono font-bold text-blue-600">{data.totalPoints}</div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <label className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-slate-200 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors select-none">
                                <input type="checkbox" checked={view.showPhases} onChange={(e) => setView(prev => ({ ...prev, showPhases: e.target.checked }))} className="w-3.5 h-3.5 rounded text-blue-600 border-slate-300 focus:ring-0" />
                                <span className="text-xs font-bold text-slate-600">周期</span>
                            </label>
                            <label className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-slate-200 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors select-none">
                                <input type="checkbox" checked={view.showEvents} onChange={(e) => setView(prev => ({ ...prev, showEvents: e.target.checked }))} className="w-3.5 h-3.5 rounded text-red-500 border-slate-300 focus:ring-0" />
                                <span className="text-xs font-bold text-slate-600">项目</span>
                            </label>
                            <label className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-slate-200 cursor-pointer shadow-sm hover:bg-slate-50 transition-colors select-none">
                                <input type="checkbox" checked={view.showSchemes} onChange={(e) => setView(prev => ({ ...prev, showSchemes: e.target.checked }))} className="w-3.5 h-3.5 rounded text-emerald-600 border-slate-300 focus:ring-0" />
                                <span className="text-xs font-bold text-slate-600">方案</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 bg-slate-50">
                        <div className="flex flex-wrap gap-2 pb-10">
                            {Object.values(data.metrics).sort((a, b) => b.data.length - a.data.length).map(m => (
                                <div key={m.name} className={cn("expand-transition group rounded cursor-pointer select-none overflow-hidden relative border shadow-sm flex flex-col", m.expanded ? "bg-slate-50 border-slate-400 shadow-md py-3 px-3 border-l-[4px] w-full md:w-96" : "bg-white border-slate-200 hover:border-blue-300 py-2 px-3 w-auto")} style={{ borderLeftColor: m.expanded ? m.color : 'transparent' }} onClick={() => updateMetricProp(m.name, 'expanded', !m.expanded)}>
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <input type="checkbox" checked={m.active} onChange={(e) => { e.stopPropagation(); toggleMetric(m.name); }} className="w-4 h-4 rounded-sm text-blue-600 bg-slate-100 border-slate-300 focus:ring-0 cursor-pointer shrink-0" />
                                            <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: m.color, opacity: m.opacity }}></div>
                                            <div className="flex flex-col overflow-hidden">
                                                <div className="flex items-baseline gap-1">
                                                    <span className={cn("text-[11px] font-bold truncate", m.active ? "text-slate-900" : "text-slate-500")}>{m.name}</span>
                                                    {!m.expanded && <span className="text-[9px] text-slate-400 truncate">({m.unit})</span>}
                                                </div>
                                                {m.expanded && <span className="text-[9px] text-slate-500 font-mono leading-none">{m.data.length}pts [{m.rangeMin}-{m.rangeMax}]</span>}
                                            </div>
                                        </div>
                                        {m.expanded && (
                                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="color"
                                                    value={m.color}
                                                    onChange={(e) => updateMetricProp(m.name, 'color', e.target.value)}
                                                    className="w-5 h-5 bg-transparent border-none cursor-pointer rounded p-0"
                                                    title={`Change color for ${m.name}`}
                                                    aria-label={`Change color for ${m.name}`}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {m.expanded && (
                                        <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-2 gap-x-3 gap-y-2 cursor-default" onClick={(e) => e.stopPropagation()}>
                                            <div className="touch-none">
                                                <div className="flex justify-between text-[9px] text-slate-500 mb-1"><span>Scale</span><span>{isNaN(m.scale) ? 1 : m.scale}</span></div>
                                                <Slider min={0.001} max={(m.baseScale || 1) * 5} step={(m.baseScale || 1) / 50} value={[isNaN(m.scale) ? 1 : m.scale]} onValueChange={([v]) => updateMetricProp(m.name, 'scale', v)} />
                                            </div>
                                            <div className="touch-none">
                                                <div className="flex justify-between text-[9px] text-slate-500 mb-1"><span>Shift</span><span>{isNaN(m.offset) ? 0 : m.offset}</span></div>
                                                <Slider min={-200} max={200} step={1} value={[isNaN(m.offset) ? 0 : m.offset]} onValueChange={([v]) => updateMetricProp(m.name, 'offset', v)} />
                                            </div>
                                            <div className="touch-none">
                                                <div className="flex justify-between text-[9px] text-slate-500 mb-1"><span>Opacity</span><span>{isNaN(m.opacity) ? 1 : m.opacity}</span></div>
                                                <Slider min={0.1} max={1} step={0.1} value={[isNaN(m.opacity) ? 1 : m.opacity]} onValueChange={([v]) => updateMetricProp(m.name, 'opacity', v)} />
                                            </div>
                                            <div className="flex items-end justify-end gap-1">
                                                <button onClick={() => updateMetricProp(m.name, 'showLine', !m.showLine)} className={cn("flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-300 transition-colors", !m.showLine ? "text-slate-400" : "text-blue-600 font-bold")}>
                                                    {m.showLine ? 'Line' : 'Dots'}
                                                </button>
                                                <button onClick={() => updateMetricProp(m.name, 'showValues', !m.showValues)} className={cn("flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-300 transition-colors", !m.showValues ? "text-slate-400" : "text-emerald-600 font-bold")}>
                                                    {m.showValues ? '隐藏数值' : '显示数值'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}
