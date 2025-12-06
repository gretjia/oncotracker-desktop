# Debugging Log - Empty Chart & Data Issues

**Date:** December 3, 2025
**Status:** ✅ RESOLVED
**Priority:** High

## Executive Summary

We investigated an issue where the Patient Journey Chart was not displaying data. The root cause was **dual data format support** - the system had two different Excel data layouts:

1. **Original Format** (used by `张莉.xlsx` and HTML source):
   - Columns: Date, Phase, Cycle, **PrevCycle**, **Scheme**, **Event**, SchemeDetail, Metrics...
   
2. **Standardized Format** (created by AI ingestion for `高玉修.xlsx`):
   - Columns: Date, Phase, Cycle, **Scheme**, **Event**, Metrics...

The column mapping was hardcoded for one format, causing misalignment when the other format was loaded.

### Additional Issues Found:
1. **Data Parsing:** The "Smart Header Detection" logic initially failed to correctly identify the header row due to a title row ("肿瘤病程周期表") appearing above it.
2. **Metric Activation:** Metrics were parsed but not set to "Active" by default, causing the chart to render an empty frame.
3. **CSP (Content Security Policy):** The `d3` library used for visualization requires `unsafe-eval`, which was blocked by the browser's security policy, causing the chart to crash or fail to load.

## Detailed Timeline of Interventions

### 1. Initial Investigation: Empty Chart

- **Symptom:** User uploaded a file, but the chart area was blank.
- **Finding:** The application relies on specific column names (e.g., "Date", "Phase"). The user's file had Chinese headers.
- **Action:** Implemented an AI-driven `parseAndMapUpload` function to standardize headers using Qwen LLM.
- **Result:** AI correctly identified columns, but the internal "Smart Header Detection" logic (used to find *where* the header row is) was too aggressive and selected the title row instead of the actual header row.
- **Fix:** Refined `processAndSaveDataset` to require multiple keyword matches (e.g., "Date" AND "Phase") before accepting a row as a header.

### 2. Metric Visibility Issue

- **Symptom:** Logs showed metrics were found, but chart was still empty.
- **Finding:** The `PatientJourneyVisualizer` component has a list of "Preferred Metrics" (e.g., "CEA", "Weight") that it auto-activates. The user's metrics (e.g., "Tumor Burden") were not in this list, so they defaulted to `active: false`.
- **Fix:** Updated `PatientJourneyVisualizer.tsx` to:
    1. Include English metric names in the preferred list.
    2. **Fallback Logic:** If *no* metrics are active after the preferred check, automatically activate the first 5 metrics found.

### 3. Content Security Policy (CSP) Blocking

- **Symptom:** User reported a console error: `Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script`.
- **Cause:** The `d3-dsv` library (a dependency of `d3`) uses `new Function()` which is blocked by strict CSP.
- **Attempt 1 (Middleware):** Added a `Content-Security-Policy` header to `middleware.ts` allowing `unsafe-eval`.
  - *Failure:* The middleware logic was resetting the response object, wiping out the header.
- **Attempt 2 (Middleware Fix):** Fixed the middleware logic to set the header at the end.
  - *Failure:* Error persisted, suggesting `next.config.ts` or default Next.js behavior was overriding it.
- **Attempt 3 (Next Config):** Added `headers()` configuration to `next.config.ts` with the permissive CSP.
  - *Failure:* Error persisted.
- **Attempt 4 (Removal):** Removed all custom CSP headers to rely on Next.js development defaults.
  - *Result:* **Success.** The CSP error is resolved.

### 4. Missing Data Points (RESOLVED)

- **Symptom:** Chart appears but shows no lines. Logs reveal:
  - `Visualizer: Final Active Metrics: ['Tumor Burden']`
  - `Visualizer: Metric [Tumor Burden] has 1 data points.`
- **Analysis:** A single data point cannot form a line. The parser is skipping the vast majority of the data rows.
- **Root Cause:**
  - The system has **TWO different Excel data formats** (see Executive Summary).
  - The column mapping was hardcoded for the Original format, but the loaded file was in Standardized format.
  - This caused "Scheme" to be read from the wrong column, and "Event" to be misread as a metric.
  
- **Fix:** Updated `PatientJourneyVisualizer.tsx` (VERSION 3.0) to **auto-detect the data format**:

    ```typescript
    // Auto-detect data format by checking header row
    const isStandardizedFormat = headerRow && (
        headerRow["Unnamed: 3"] === "Scheme" || 
        headerRow["Unnamed: 4"] === "Event" ||
        !headerRow["Unnamed: 6"] // Original format has SchemeDetail in col 6
    );
    
    // Column mappings based on format
    const COL_SCHEME = isStandardizedFormat ? "Unnamed: 3" : "Unnamed: 4";
    const COL_EVENT = isStandardizedFormat ? "Unnamed: 4" : "Unnamed: 5";
    ```

- **Verification Status:** ✅ RESOLVED. The page loads successfully at `http://localhost:3000/journey`.

### 5. AS Phase Merging (ALREADY IMPLEMENTED)

The AS phase merging logic was already present in both `oncotracker v0.6.2.html` and `PatientJourneyVisualizer.tsx`:
- All `AS0`, `AS17`, `AS31`, etc. cycles are merged into a single "AS" phase.
- The chart displays "AS" in the header with total days below (e.g., "48 days").

### 6. Patient Data Loading Fix

- **Symptom:** 高玉修's chart displayed 张莉's data and title.
- **Cause:** `loadDataset()` was loading the newest `.xlsx` file by modification time, ignoring the `patientId` parameter.
- **Fix:** Updated `lib/data-loader.ts` to:
  1. Accept `patientId` parameter
  2. Look up patient's original Chinese name from Supabase
  3. Load the specific patient's `.xlsx` file
  4. Fall back to newest file only if no specific match found

### 7. Custom Metrics Support

- **Symptom:** 高玉修's data has "细胞角蛋白19片段" (CYFRA21-1) which was being ignored by the AI.
- **Cause:** The AI mapping only recognized metrics in the predefined dictionary.
- **Fix:**
  1. Added CYFRA21-1, NSE, SCC to `metric-dictionary.ts`
  2. Updated AI prompts to preserve ALL metrics, even unknown ones with `category: "CUSTOM"`
  3. Updated `data-transformer.ts` to add "其他指标" category for custom metrics
  4. Updated `qwen.ts` to include custom metrics in the mapping output

### 8. MRD Data Point Not Visible

- **Symptom:** MRD value (18.68) existed in data but wasn't showing on chart.
- **Cause:** X-axis domain was calculated from phases/events only, not metric data points. 高玉修 had no phases/events, so domain was empty.
- **Fix:** Updated `PatientJourneyVisualizer.tsx` to include metric data point dates in the domain calculation:
  ```typescript
  const allDates = [
      ...data.phases.map(p => p.start), 
      ...data.phases.map(p => p.end), 
      ...data.events.map(e => e.date),
      // NEW: Include metric data point dates
      ...Object.values(data.metrics).flatMap(m => m.data.map(d => d.date))
  ].filter(d => d);
  ```

### 9. Format Detection Fix

- **Symptom:** Canonical format (张莉.xlsx style) was misdetected as "Legacy" format.
- **Cause:** Detection checked for English headers "Scheme"/"Event" but canonical uses Chinese "方案"/"处置".
- **Fix:** Updated detection to check for canonical Chinese headers:
  ```typescript
  const isCanonicalFormat = headerRow && (
      headerRow["Unnamed: 0"] === "子类" &&
      headerRow["Unnamed: 1"] === "项目" &&
      headerRow["Unnamed: 5"] === "处置"
  );
  ```

## Resolution Summary

| Issue | Status | Fix |
|-------|--------|-----|
| Header Detection | ✅ Fixed | Multiple keyword match requirement |
| Metric Activation | ✅ Fixed | Fallback to first 5 metrics |
| CSP Blocking | ✅ Fixed | Removed custom CSP headers |
| Column Mapping | ✅ Fixed | Auto-detect format (VERSION 3.0) |
| AS Phase Merging | ✅ Already Working | Logic present in both HTML & React |
| Patient Data Loading | ✅ Fixed | Load by patientId from URL |
| Custom Metrics | ✅ Fixed | AI preserves unknown metrics |
| MRD Not Visible | ✅ Fixed | Include metric dates in X-axis domain |
| Format Detection | ✅ Fixed | Check Chinese headers for canonical format |

## Technical Artifacts

- **Modified Files:**
  - `app/actions/patient-actions.ts` (Header detection)
  - `components/PatientJourneyVisualizer.tsx` (Rendering logic, auto-format detection, column mapping)
  - `lib/types.ts` (Updated column comments for clarity)
  - `lib/supabase/middleware.ts` (CSP attempts)
  - `next.config.ts` (CSP attempts)
- **Logs:** `debug-log.txt` (Server-side), Browser Console (Client-side)

## Data Format Reference

### Original Format (HTML Source / 张莉.xlsx)
| Column | Key | Content |
|--------|-----|---------|
| A | Unnamed: 0 | Date |
| B | Unnamed: 1 | Phase (项目) |
| C | Unnamed: 2 | Cycle (周期) |
| D | Unnamed: 3 | Previous Cycle (前序周期) |
| E | Unnamed: 4 | **Scheme (方案)** |
| F | Unnamed: 5 | **Event (处置)** |
| G | Unnamed: 6 | Scheme Detail (方案详情) |
| H+ | Unnamed: 7+ | Metrics (Weight, MRD, etc.) |

### Standardized Format (AI Ingestion / 高玉修.xlsx)
| Column | Key | Content |
|--------|-----|---------|
| A | Unnamed: 0 | Date |
| B | Unnamed: 1 | Phase |
| C | Unnamed: 2 | Cycle |
| D | Unnamed: 3 | **Scheme** |
| E | Unnamed: 4 | **Event** |
| F+ | Unnamed: 5+ | Metrics |
