This plan is a strong starting point, but it contains three **critical technical risks** that will likely cause the migration to fail if not addressed. Specifically, the strategy to "wrap" Next.js while retaining "Server Actions" creates a fundamental conflict, and the database migration plan underestimates the complexity of moving from an ORM (Supabase) to raw SQL.

Here is the feedback and a **Wholly Updated Migration Plan** (v2.0) that ensures a successful port.

### **Critical Strategic Feedback**

1. **The "Server Action" Trap (Architecture)**

      * **The Issue:** Your plan assumes you can use Next.js Server Actions (e.g., in `actions/patient-actions.ts`) while running the app as a static file in Electron. **This is impossible.** Server Actions require a running Node.js HTTP server to process requests. They do not work in a static export (`output: 'export'`).
      * **The Fix:** Do not rewrite your actions to IPC (which is months of work). Instead, use the **"Embedded Server" Pattern**. Configure Electron to spawn a local `localhost` server (using Next.js Standalone build) in the background. This allows you to **keep your Server Actions exactly as they are**, simply swapping the database calls inside them.

2. **Database Regression (Raw SQL vs. ORM)**

      * **The Issue:** Moving from Supabase (a typed SDK) to `db.prepare('SELECT...').all()` (Raw SQL) is a massive step backward. You will lose TypeScript definitions and introduce SQL injection risks.
      * **The Fix:** Use **Prisma ORM with SQLite**. You can copy your Supabase schema definitions directly into Prisma, and it will generate a typed client (`prisma.patient.findMany()`) that mirrors the developer experience of Supabase.

3. **The "Auth Removal" Risk**

      * **The Issue:** "Remove middleware.ts." If you delete the Auth provider, every component that uses `useUser()` or checks `session` will crash.
      * **The Fix:** Do not remove Auth—**Mock it.** Create a "Dummy Auth Provider" that feeds the app a constant "Local Admin" user. This tricks the UI into working without requiring a rewrite of your frontend code.

-----

### **Wholly Updated Migration Plan: OncoTracker Local**

**Version:** 2.0 (Embedded Server Strategy)
**Target:** Windows Desktop (`.exe`)
**Core Stack:** Electron + Next.js (Standalone) + Prisma (SQLite) + Node.js

#### **Phase 1: The "Shell" (Embedded Server)**

*Goal: Get the application running locally without breaking Next.js features.*

1. **Architecture Setup**:
      * Update `next.config.js` to `output: 'standalone'`. This creates a minimal Node.js server build.
      * **Electron Main Process (`background.ts`)**:
          * **Action:** On launch, spawn the Next.js standalone server as a child process on a random free port (e.g., `127.0.0.1:45678`).
          * **Action:** Wait for the port to be active (use `wait-on`).
          * **Action:** Load `http://127.0.0.1:45678` in the Electron window.
      * *Benefit:* This preserves Image Optimization, API Routes, and **Server Actions** with zero config changes.

#### **Phase 2: Data Layer Migration (Supabase → Prisma)**

*Goal: Swap Postgres for a local file-based DB with minimal code changes.*

1. **Install Prisma**:
      * `npm install prisma @prisma/client`
      * `npx prisma init --datasource-provider sqlite`
2. **Schema Migration**:
      * Copy your tables from Supabase (SQL Editor -\> Definition) to `prisma/schema.prisma`.
      * Run `npx prisma db push` to create the local `dev.db` file.
3. **Refactor Server Actions (The Swap)**:
      * **Do not** convert to IPC yet. Just swap the client inside your actions.
      * *Before:*

        ```typescript
        const { data } = await supabase.from('patients').select('*');
        ```

      * *After:*

        ```typescript
        import prisma from '@/lib/db';
        const data = await prisma.patient.findMany();
        ```

#### **Phase 3: The "Mock Auth" & Storage**

*Goal: Trick the UI into working offline.*

1. **Mock Auth Provider**:
      * Create `src/providers/LocalAuthProvider.tsx`.
      * Hardcode a session:

        ```javascript
        const mockSession = { user: { id: 'local-admin', email: 'doctor@local' } };
        // Pass this to your AuthContext so useUser() always returns this admin.
        ```

2. **Local File Storage** (Critical Missing Piece):
      * Supabase Storage (Buckets) will not work.
      * Create a utility `utils/local-storage.ts`.
      * Replace `supabase.storage.upload` with Node.js `fs.writeFile` to save files in:
        `path.join(app.getPath('userData'), 'uploads', patientId, fileName)`

#### **Phase 4: Python & AI Strategy**

*Goal: Handle `update_data.py` efficiently.*

1. **Audit the Script**:
      * **Case A (Simple JSON/Requests):** Rewrite in TypeScript (e.g., `actions/data-sync.ts`). **(Recommended)**
      * **Case B (Pandas/Scikit-learn):** Bundle it.
          * Use **PyInstaller** to compile `update_data.py` into `data_engine.exe`.
          * Place it in `resources/bin`.
          * Spawn it via Electron: `execFile(path_to_exe)`.
2. **Qwen API**:
      * Keep the API calls in your Server Actions.
      * Store the API Key in **Electron Store** (encrypted local config) so the user can update it if needed.

#### **Phase 5: Build & Distribution (GitHub Actions)**

*Goal: Reliable Windows builds without using Wine on Mac.*

*Do not use Wine on macOS to build Windows apps with native modules (like SQLite); it is fragile.*

1. **Workflow (`.github/workflows/build.yml`)**:
      * Set up a GitHub Action with `runs-on: windows-latest`.
      * **Steps**:
        1. Checkout code.
        2. `npm install`.
        3. `npx prisma generate` (builds the client for Windows).
        4. `npm run build` (Next.js standalone).
        5. `npm run electron:build` (Electron Builder).
      * **Artifact**: The Action will upload `OncoTracker-Setup.exe` to the Release page.

### **Revised Risks & Costs**

| Item | Cloud Version | Local Version |
| :--- | :--- | :--- |
| **Hosting** | \~$50/mo | **$0/mo\*\* |
| **Database** | Postgres (Cloud) | **SQLite (Local File)** |
| **Security** | Supabase RLS | **Local Encryption (BitLocker recommended)** |
| **Backup** | Automatic | **Manual (Must add "Export DB" button)** |

### **Next Steps**

1. **Schema Dump**: Export your Supabase schema immediately.
2. **Prototype Shell**: Create a "Hello World" Electron app that successfully spawns a Next.js standalone server before migrating any data.
3. **Mock Auth**: Implement the dummy provider to ensure the UI renders without Supabase.
