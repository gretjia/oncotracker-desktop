# OncoTracker Desktop (Local-First)

![Version](https://img.shields.io/badge/version-0.8.1-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green.svg) ![Status](https://img.shields.io/badge/status-stable-success.svg)
 Electron application designed for offline use. It combines the power of Next.js 15 with the privacy of a local SQLite database.

## Features

- **Mobile Optimized**: Fully responsive design with touch support and landscape optimization.
- **Patient Journey Visualizer**: Interactive timeline of treatments, events, and metrics (D3.js).
  - **Persistent Settings**: Automatically saves your view preferences (colors, scales, visibility) for each patient.
  - **Customizable Metrics**: Adjust colors, scales, and shifts for perfect visualization.
- **Generative UI Assistant**: Data-aware chatbot that analyzes patient metrics and controls the visualization.
- **Data Management**:
  - Excel-like spreadsheet interface for editing data.
  - **Smart Ingestion**: AI-powered upload for unstructured Excel/CSV/JSON files with **real-time streaming analysis**.
  - **Manual Entry**: "Start with Template" feature for creating empty canonical datasets.
- **Role-Based Access Control (RBAC)**:
  - **Patient Portal**: View personal journey and records.
  - **Provider Portal**: Manage assigned patients and treatment plans.
  - **Supervisor Dashboard**: Approve users and oversee system operations.

## Installation

1. **Download:** Get the latest release for your OS (macOS `.dmg` or Windows `.exe`).
2. **Install:** Run the installer.
3. **Launch:** Open "OncoTracker Local".

## Development (Source)

1. **Install Dependencies**:

    ```bash
    npm install
    ```

2. **Run Dev Mode (Next.js only)**:

    ```bash
    npm run dev
    ```

3. **Run Electron Dev Mode**:

    ```bash
    npm run dev:electron
    ```

4. **Build Package**:

    ```bash
    npm run build:electron
    ```

## Initial User Accounts

For development and testing, the following accounts are available via mock authentication:

### Doctor Account

- **Email**: `scix@oncotracker.com`
- **Password**: `Zx987@`
- **Access**: Doctor Dashboard with patient "张莉 (Zhang Li)"

### Patient Account

- **Email**: `zhangli@oncotracker.com`
- **Password**: *(any password works in demo mode)*
- **Access**: Patient Dashboard showing Dr. SciX as assigned doctor

### Supervisor Account

- **Email**: `admin@oncotracker.com`
- **Password**: `OncoSciX@`
- **Access**: Supervisor Dashboard for user management

> **Note**: For production deployment, use `scripts/seed_users.sql` to create these users in Supabase with proper authentication.

## Project Structure

```
oncotracker-next/
├── app/                          # App Router (Pages, API Routes, Server Actions)
│   ├── actions/                  # Server Actions (auth, patient, upload)
│   ├── api/                      # API Routes (agent, data)
│   ├── auth/                     # Login/Register pages
│   ├── dashboard/                # Role-based dashboards
│   │   ├── doctor/               # Doctor view + Add Patient
│   │   ├── patient/              # Patient self-view
│   │   └── supervisor/           # Admin overview
│   ├── journey/                  # Patient Journey Visualization
│   └── manage-data/              # Data Editor (Spreadsheet)
├── components/                   # React Components
│   ├── PatientJourneyVisualizer.tsx  # D3.js Chart (Core)
│   ├── DataSpreadsheet.tsx      # Spreadsheet Editor
│   ├── ChatInterface.tsx         # AI Assistant
│   └── ui/                       # Shadcn/UI components
├── lib/                          # Core Libraries
│   ├── ai/                       # AI Agents & Tools
│   │   ├── agents/               # Ingestion, Journey Explainer
│   │   ├── prompts/              # Centralized AI prompts
│   │   └── tools/                # AI tool definitions
│   ├── llm/                      # LLM Integration (Qwen)
│   ├── schema/                   # Data Standardization
│   │   ├── oncology-dataset.schema.ts  # Zod validation
│   │   ├── metric-dictionary.ts  # Bilingual metric definitions
│   │   └── data-transformer.ts   # Format conversion
│   └── supabase/                 # Database clients
├── data/                         # Patient datasets (.xlsx)
├── scripts/                      # Migration & utility scripts
└── supabase/                     # Database migrations and types
```

## Data Specifications

### Canonical Data Schema

All patient data standardizes to the `张莉.xlsx` format:

| Column | Header | Description |
|--------|--------|-------------|
| A | 子类 | Date (Excel serial or ISO) |
| B | 项目 | Phase name (C1D1, AS17, etc.) |
| C | 周期 | Current cycle |
| D | — | Previous cycle |
| E | 方案 | Treatment scheme |
| F | 处置 | Clinical event |
| G | 方案 | Scheme detail |
| H+ | Metrics | Weight, CEA, MRD, etc. |

### Metric Dictionary

Bilingual support with 25+ predefined metrics:

| Category | Metrics |
|----------|---------|
| **体能负荷** | Weight, Handgrip, ECOG |
| **分子负荷** | CEA, CA19-9, CA125, AFP, MRD, CYFRA21-1 |
| **影像负荷** | 肺, 肝脏, 淋巴, 盆腔 |
| **副作用** | 白细胞, 血小板, 中性粒细胞, AST, ALT |
| **其他指标** | Custom/unknown metrics preserved |

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/data/current` | GET | Fetch current patient dataset |
| `/api/agent/run` | POST | Execute AI agent tasks |
| `/api/ai/analyze-file` | POST | Stream AI analysis of uploaded files |

Private and Confidential.

---

## Legacy Prototype (HTML Version)

The project originated as a single-file HTML prototype (`oncotracker v0.6.2.html`). This version is still available in the root directory for reference.

### Legacy Features (Ported to Next.js)

- **Timeline Visualization**: Interactive D3.js chart showing treatment cycles over time.
- **Metric Tracking**: Visualizes key tumor markers (CEA, CA19-9, etc.) with dual-axis support.
- **Event Logging**: Markers for surgeries, imaging, and other clinical events.
- **Scheme Details**: Detailed breakdown of chemotherapy regimens.
- **Responsive Design**: Tailwind CSS for a clean, modern UI.

### Legacy Usage

```bash
# Update the HTML with a new dataset
./update_data.sh

# Open the application
open "oncotracker v0.6.2.html"
```
