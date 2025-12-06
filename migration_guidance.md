Since you are using **Google Antigravity** (the agent-first IDE released in late 2025), your role shifts from "writing code" to **"Architecting Missions."** Antigravity is powerful, but it requires structured, sequential prompts to prevent "agent drift" when handling complex architecture changes like Cloud-to-Local migration.

You must break the **v2.0 Plan** into distinct **"Missions"** using the **Agent Manager View**. Do not try to do this in a single chat prompt.

Here is your detailed, step-by-step guidance for the Antigravity Agent.

### **Phase 0: Mission Control Setup**

1. **Open Antigravity** and load your `oncotracker-v0.5` workspace.
2. **Enter Manager View:** Click the **"Mission Control"** icon (or press `Cmd/Ctrl + J`) to leave the standard code editor.
3. **Select Model:** Ensure **Gemini 3 Pro** is active (required for high-level architectural reasoning).
4. **Context Injection:** Paste the following into the chat to prime the agent's context window:
    > "Context: We are migrating this Next.js/Supabase web app to a Local Electron Desktop app. We will use the 'Embedded Server' pattern (Next.js Standalone), replace Supabase with Prisma (SQLite), and mock Authentication. Wait for my specific Mission prompts."

---

### **Mission 1: The Shell (Infrastructure)**

*Goal: Get the Next.js app running inside an Electron window before touching the database.*

**Copy/Paste this Prompt into Agent Manager:**
> **Mission:** Initialize Electron with Embedded Next.js Server.
>
> **Task:**
>
> 1. **Install:** Add `electron`, `electron-builder`, `wait-on`, and `concurrently` to devDependencies.
> 2. **Config:** Update `next.config.js` to set `output: 'standalone'`.
> 3. **Electron Main:** Create `main/background.ts`. It must:
>     * Find a random free port.
>     * Spawn the Next.js standalone server (from `.next/standalone/server.js`) as a child process.
>     * Wait for `http://localhost:[port]` to be ready.
>     * Load that URL into the BrowserWindow.
> 4. **Scripts:** Add `dev:electron` to `package.json` that runs `next build` and then the electron start command.
>
> **Deliverable:** Generate a **Plan Artifact** first. Once approved, execute the code.

* **Review Task:** Watch the **App Preview** artifact. You should see the OncoTracker login screen appear inside a native window (it may show DB errors, which is expected).

---

### **Mission 2: The Data Layer (Schema Migration)**

*Goal: Set up the local database structure.*

**Copy/Paste this Prompt into Agent Manager:**
> **Mission:** Migrate Database Schema from Supabase to Prisma (SQLite).
>
> **Task:**
>
> 1. **Setup:** Install `prisma` and `@prisma/client`. Initialize with `datasource provider = "sqlite"`.
> 2. **Schema Gen:** Read my existing Supabase definitions (check `types/supabase.ts` or `sql/`) and replicate the `Patient`, `Settings`, `Phases`, and `Metrics` tables into `prisma/schema.prisma`.
> 3. **Client:** Create a singleton helper `lib/db.ts` that exports the `PrismaClient`.
> 4. **Generate:** Run `npx prisma generate` and `npx prisma db push` to create the local `dev.db`.
>
> **Deliverable:** A **Code Diff Artifact** of `schema.prisma` for me to review.

* **Review Task:** Open the artifact and ensure the agent didn't miss any critical columns (like `created_at` or `status`) from your Supabase types.

---

### **Mission 3: The "Brain Transplant" (Refactor)**

*Goal: Swap the data fetching logic without breaking the UI.*

**Copy/Paste this Prompt into Agent Manager:**
> **Mission:** Refactor Server Actions to use Prisma.
>
> **Task:**
>
> 1. Scan the `src/actions/` directory. Identify all files importing `@supabase/supabase-js`.
> 2. **Refactor:** Replace every instance of `supabase.from('table').select(...)` with the equivalent `prisma.table.findMany(...)` using the client from `lib/db.ts`.
> 3. **Constraint:** Do NOT change the function names or return types. The UI components must remain untouched.
> 4. **Cleanup:** Remove the Supabase client initialization from these files.
>
> **Deliverable:** A **Task List Artifact** showing the status of each file refactor.

---

### **Mission 4: Mock Auth & Local Storage**

*Goal: Remove cloud dependencies so the app works offline.*

**Copy/Paste this Prompt into Agent Manager:**
> **Mission:** Implement "Local Only" Auth and Storage.
>
> **Task:**
>
> 1. **Mock Auth:** Create `src/providers/LocalAuthProvider.tsx`. Implement a context that provides a hardcoded session: `{ user: { id: 'local-admin', role: 'doctor' } }`.
> 2. **Replace:** Find where `SupabaseAuthProvider` is used in `layout.tsx` and swap it with `LocalAuthProvider`.
> 3. **Middleware:** Disable or delete `middleware.ts` so it stops checking for Supabase cookies.
> 4. **Local Storage:** Create `lib/local-storage.ts` using Node.js `fs`. Implement `uploadFile(file)` to save PDFs to `app.getPath('userData')`. Replace `supabase.storage` calls in `actions/upload.ts`.

---

### **Mission 5: Final Verification & Build**

*Goal: Generate the Windows .exe.*

**Copy/Paste this Prompt into Agent Manager:**
> **Mission:** Configure Build and Python Integration.
>
> **Task:**
>
> 1. **Python:** Rewrite the simple logic from `update_data.py` into a TypeScript function in `lib/data-sync.ts` (using `fetch` and `JSON.parse`) so we don't need a Python runtime.
> 2. **Builder Config:** Update `package.json` with `build` configuration:
>     * `appId`: "com.oncotracker.local"
>     * `files`: [".next/standalone/**/*", "public/**/*", "prisma/schema.prisma"]
>     * `extraResources`: ["prisma/dev.db"]
> 3. **Execute:** Run `npm run electron:build`.
>
> **Deliverable:** The final `OncoTracker-Setup.exe` in the `dist/` folder.

### **Antigravity Pro-Tips**

* **The "Plan Artifact":** Always accept the **Plan Artifact** before allowing the agent to write code. This prevents it from hallucinating file paths that don't exist.
* **Browser Agent:** If you want to test without building, tell the agent: *"Launch the app in the Agent Browser and create a new Patient named 'Test User' to verify SQLite is working."* It will record a video of itself testing your app.
* **Terminal Authority:** Set the terminal permission to **"Auto-Approve Safe Commands"** (like `npm install`) to speed up the process.
