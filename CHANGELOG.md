# Changelog

## v0.7.6 (2025-12-06)

- **Feature:** **Excel-like Data Editor** - Completely redesigned the 'Edit Data' page for a dense, professional spreadsheet experience with compact rows and sharper borders.
- **Feature:** **Frozen Headers** - Implemented sticky positioning for the first 5 rows (Header + 4 Data Rows) to keep critical data visible while scrolling.
- **Feature:** **Adjustable Columns** - Added drag-to-resize functionality for all data columns.
- **UX:** **Morandi Header Theme** - Applied the "Morandi Rainbow" color scheme (opaque) to frozen rows, matching the Journey Visualizer's aesthetic and preventing scroll-through artifacts.

## v0.8.1-desktop

- **Fix:** Implemented Save functionality in "Manage Data" (writes to SQLite + filesystem).
- **Security:** Verified complete removal of Supabase service role dependencies.
- **UI:** Hides AI Assistant in Journey View by default.

## v0.8.0-desktop (2025-12-06)

**Major Release: Desktop Migration**

- **Architecture:**
  - **Local-First:** Fully migrated from Cloud/Supabase to Local SQLite + Filesystem storage.
  - **Electron:** Packaged as a standalone desktop application (`.dmg` / `.exe`).
  - **Embedded Server:** Runs Next.js server inside the Electron main process using native Node.js `net` and `child_process`.

- **Features:**
  - **Offline Capability:** Application runs completely offline with local database (`prisma/dev.db`) and local file storage (`app/data`).
  - **Mock Authentication:** Simplified "Local User" authentication for single-user desktop experience.

- **Refinements:**
  - **Chart Formatting:** Optimized dot rendering (Red/White alert styles) and improved layer ordering for project markers.
  - **Build Stability:** Fixed Turbopack/Tailwind 4 compilation issues by standardizing on Next.js 15.0.3 (Webpack).

## v0.7.5 (2025-12-06)

- **Feature:** **Settings Persistence** - Patient journey settings (metric visibility, colors, scale, shift, phase opacity) are now automatically saved per user and per patient.
- **Feature:** **Metric Color Picker** - Restored the ability to customize metric line and dot colors directly from the controls panel.
- **Fix:** **Database Migration** - Added missing `patient_journey_settings` table and RLS policies to enable settings persistence.
- **Fix:** **Middleware** - Migrated `middleware.ts` to `proxy.ts` to align with Next.js 16 conventions.

## v0.7.4 (2025-12-04)

- **Critical Fix:** Resolved "Missing Metric" and "Wrong Metric Name" issues in Patient Journey Visualizer.
- **Data Integrity:** Enforced strict canonical format validation. Raw files are no longer accepted; uploads must successfully map to the canonical schema.
- **Robustness:** Improved `data-loader` to intelligently detect header rows using known metric keywords, preventing data-row-as-header errors.
- **UX:** "Create Patient" button is now disabled until AI analysis completes successfully, preventing accidental unmapped uploads.
- **Fix:** Relaxed AI schema validation to handle case variations (e.g., "Custom" vs "CUSTOM") without failing.

## [v0.7.3] - 2025-12-04

### Added

- **AI Streaming Architecture**:
  - **Real-time "Thinking" UI**: Implemented `AIThinkingLog` component to visualize the AI's thought process during file analysis.
  - **Streaming API**: New `api/ai/analyze-file` route uses Vercel AI SDK's `streamObject` to stream analysis results instantly.
  - **Deep Analysis Mode**: Added toggle for `qwen-max` model for handling complex or difficult files.
  - **Client-Side Parsing**: Moved file parsing to the client to enable seamless streaming integration.

- **Manual Data Entry**:
  - **Template Generator**: Added "Start with Empty Template" button to the Add Patient page.
  - **Canonical Template**: Automatically generates an empty Excel file with standard headers (Weight, CEA, MRD, etc.) for manual filling.

### Fixed

- **Runtime Stability**: Fixed `phaseName.includes` crash in `PatientJourneyVisualizer` by safely casting column values to strings.
- **Build System**: Resolved `Module not found: Can't resolve 'ai/react'` by installing `@ai-sdk/react`.
- **Linting**: Fixed boolean type errors in visualizer logic.

## [v0.7.2] - 2025-12-03

### Added

- **Data Management Page Enhancements**:
  - **Add Row Functionality**: Users can now add new data rows directly in the spreadsheet editor.
  - **Add Metric Functionality**: Users can add new metric columns (e.g., "细胞角蛋白19片段") with automatic header row updates.
  - **Modern UI Redesign**: Complete redesign of `/manage-data` page to match Patient Journey page aesthetic.
  - **Controlled Component Architecture**: Refactored `DataSpreadsheet` to be a controlled component with proper state management.
  - **Smart Header Display**: Column headers now show friendly names from canonical schema or metric names from Row 2.

### Changed

- **Data Spreadsheet Component**:
  - Replaced `contentEditable` cells with proper `input` fields for better React state management.
  - Added sticky headers and row numbers for better navigation.
  - Improved visual styling with proper borders, hover states, and header row highlighting.
  - Column headers now display metric names from Row 2 instead of just "Unnamed: X" keys.

- **Manage Data Page**:
  - Enhanced header with patient name display and improved button styling.
  - Added toolbar with "Add Row" and "Add Metric" buttons.
  - Better loading states and empty state handling.
  - Improved layout consistency with Patient Journey page.

### Fixed

- **Patient ID Parameter**: Fixed `/manage-data` page to correctly pass `patientId` query parameter to API calls.
- **Back Navigation**: Back button now preserves `patientId` when navigating to journey page.

## [v0.7.1] - 2025-12-03

### Added

- **Data Standardization**:
  - **Canonical Schema**: Established `张莉.xlsx` as the canonical data structure for all patient uploads.
  - **Metric Dictionary**: Created `lib/schema/metric-dictionary.ts` with bilingual (Chinese/English) metric definitions.
  - **Schema Validation**: Added Zod-based validation in `lib/schema/oncology-dataset.schema.ts`.
  - **Data Transformer**: New `lib/schema/data-transformer.ts` to convert any uploaded data to canonical format.
  - **Migration Script**: Added `scripts/migrate-to-canonical.ts` for batch migration of existing files.

- **Custom Metrics Support**:
  - AI now preserves **unknown/custom metrics** (e.g., "细胞角蛋白19片段") with `category: "CUSTOM"`.
  - Added CYFRA21-1, NSE, SCC to the predefined metric dictionary.
  - Chart displays custom metrics under "其他指标" (Other Metrics) category.

- **AI Prompt Redesign**:
  - New centralized prompts in `lib/ai/prompts/data-mapping.ts`.
  - Enforces canonical schema immutability - AI transforms TO the schema, never changes it.
  - Intelligent date column detection (looks for Excel serial dates 40000-50000).
  - Explicit column index mapping for precision.

### Fixed

- **Patient Data Loading**: Fixed issue where wrong patient's data was displayed. Now correctly loads by `patientId` from URL.
- **MRD Data Not Visible**: X-axis domain now includes metric data point dates (not just phases/events).
- **Format Detection**: Fixed canonical format detection to check Chinese headers ("子类", "项目", "处置").
- **Duplicate Column Handling**: Fixed "方案" column mapping (two columns with same name).
- **Date Parsing Crash**: Added error handling for invalid date values during upload.

### Changed

- **Visualizer Columns**: Fixed column mappings to match canonical 7-column structure (Date, Phase, Cycle, PrevCycle, Scheme, Event, SchemeDetail).
- **AI Integration**: `tryQuickMapping` now requires "子类" header to detect canonical format.

## [v0.7.0] - 2025-12-03

### Added

- **Mobile Optimization**:
  - **Responsive Design**: Complete overhaul of the UI to support mobile devices (iOS/Android).
  - **Collapsible Controls**: "Controls" sidebar on mobile is now collapsible with a compact bottom toolbar.
  - **Compact Metrics**: Metric buttons on mobile and desktop now use a flexible, auto-sizing layout.
  - **Touch Support**: Enabled touch interactions (pinch-to-zoom, pan) for the Patient Journey Chart.
  - **Landscape Mode**: Added PWA manifest to suggest landscape orientation for optimal viewing.
- **Unstructured Data Handling**:
  - **LLM Integration**: Integrated Qwen-72B (via Vercel AI SDK) to analyze uploaded files (Excel/CSV/JSON).
  - **Smart Mapping**: Automatically detects date columns, metrics, and events from unstructured data.
  - **Preview UI**: Added a "Data Preview" step in the "Add Patient" flow to verify AI analysis results.
- **Print Enhancements**:
  - **WYSIWYG Printing**: Chart now prints exactly as seen on screen (preserving zoom/pan).
  - **Layout Control**: Hides controls and maximizes chart area for A4 landscape printing.

### Changed

- **UI/UX**:
  - **Chat Assistant**: Now opens as a full-screen overlay on mobile for better focus.
  - **Default View**: Chat is closed by default on mobile to prioritize the chart.
  - **Floating Action Button**: Enhanced "Journey Assistant" button with label and animation.
- **Performance**: Optimized chart re-rendering logic for resize events.

## [v0.6.3] - 2025-12-01

### Added

- **Authentication**: Migrated login flow to Server Actions (`loginAction`) for secure session management.
- **Patient Management**:
  - Auto-generated Medical Record Number (MRN) during patient creation.
  - Intelligent Chinese name parsing (Pinyin transliteration) for `family_name` and `given_name`.
  - Dataset upload support (Excel/JSON/CSV) directly within the "Add Patient" form.
  - "Delete Patient" functionality with confirmation dialog.
- **Doctor Dashboard**:
  - Enhanced "Edit Data" button with text label.
  - Added verbose logging for debugging data fetching issues.

### Fixed

- **Security**: Resolved "Infinite Recursion" error in Row Level Security (RLS) policies by implementing a `SECURITY DEFINER` helper function.
- **Database**: Fixed "Foreign Key Constraint" error by ensuring doctor records exist for authenticated users.
- **UI/UX**: Fixed React "controlled input" warning in `PatientJourneyVisualizer`.
- **Bugs**: Fixed "deletePatientAction is not a function" error by correctly exporting the server action.

### Changed

- **Documentation**: Updated `MASTERPLAN.md` to reflect completed Phase 2 tasks.
