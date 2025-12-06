# OncoTracker Masterplan: AI-Native Oncology Case Management

## 1. Vision: Three Curves, One Timeline, One Guardian

The core philosophy of OncoTracker is to manage the complexity of cancer treatment by visualizing three key curves on a single timeline, guarded by an AI agent.

### 1.1 The Three Curves

1. **Tumor Load**: MRD, Tumor Markers (CEA, CA125), Imaging Lesion Sizes.
2. **Treatment Load**: Chemotherapy Cycles (C1-C12), Regimens, Surgeries, Key Events.
3. **Body & QoL Load**: Weight, ECOG, Lab Results (WBC, Liver/Kidney function), Symptoms.

### 1.2 The Guardian AI

An AI system that doesn't just record data but acts as a **Guardian**:

* **Aligns**: Automatically maps "Rhythm-Event-Metric" onto the timeline.
* **Explains**: Translates medical anomalies into patient-understandable context.
* **Predicts**: Warns of risks (e.g., neutropenia windows) based on historical patterns.

---

## 2. Technical Architecture (Local-First & AI-Native)

We are building a **Local-First, AI-Native** application optimized for the Chinese network environment.

### 2.1 Technology Stack

* **Framework**: **Next.js 14** (App Router, TypeScript).
* **UI System**: **Shadcn/UI** + **Tailwind CSS**.
* **Backend (BaaS)**: **Supabase** (Self-Hosted via Docker for local data sovereignty).
  * Database: PostgreSQL with `pgvector` for semantic search.
  * Auth: Supabase Auth (RBAC).
  * Storage: Supabase Storage.
* **AI Engine**: **Alibaba Qwen (Tongyi Qianwen)** via **Vercel AI SDK**.
  * Model: `qwen-plus` / `qwen-max`.
  * Integration: OpenAI Compatibility Mode.
* **Visualization**: **D3.js** (Ported to React) for pixel-perfect timeline rendering.

### 2.2 Agentic Architecture

We employ a lightweight "Guardian" architecture with four specialized agents:

1. **Ingestion Agent**: Parses unstructured data (PDF/Images) into `FormalDataset` (mCODE standard).
2. **Journey Explainer Agent**: Generates dynamic UI and textual explanations for patient queries.
3. **Safety Watchdog Agent**: Monitors rules (e.g., fever > 38°C) and triggers alerts.
4. **Care Companion Agent**: Provides empathy and education based on patient context.

---

## 3. Implementation Roadmap

### Phase 1: Foundation (Current Status: Active)

* [x] **Project Init**: Next.js 14 + Supabase + Shadcn/UI.
* [x] **Visualizer Port**: Port D3.js timeline to React (`<PatientJourneyVisualizer />`).
* [x] **AI Runtime**: Unified Agent API (`/api/agent/run`) with Qwen integration.
* [x] **Data Ingestion**: Excel/JSON parsing to `FormalDataset`.
* [x] **Chat Interface**: Generative UI for data interaction.

### Phase 2: Security & RBAC (Completed)

* [x] **Auth System**: Supabase Auth with Role-Based Access Control (Patient, Doctor, Supervisor).
* [x] **Dashboards**: Role-specific views (Doctor Portal, Patient Dashboard).
* [x] **Row Level Security (RLS)**: Strict data isolation policies (Fixed recursion issues).
* [x] **Patient Management**:
  * [x] Auto-generated MRN and Credentials.
  * [x] Intelligent Chinese Name Parsing (Pinyin).
  * [x] Dataset Upload during creation.
  * [x] Delete Patient functionality.

### Phase 3: Advanced AI & Automation

* [ ] **Smart Scan**: Integrate PaddleOCR for medical report table extraction.
* [ ] **RAG Pipeline**: Ingest NCCN/CSCO guidelines for evidence-based Q&A.
* [ ] **Automated Alerts**: `pg_cron` jobs for safety monitoring.

---

## 6. Next Actions

### Upcoming (Phase 3: Advanced AI & Automation)

* [ ] **Smart Scan**: Integrate PaddleOCR for medical report table extraction.

* [ ] **RAG Pipeline**: Ingest NCCN/CSCO guidelines for evidence-based Q&A.
* [ ] **Automated Alerts**: Setup `pg_cron` jobs for safety monitoring.
