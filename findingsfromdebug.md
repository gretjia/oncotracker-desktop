What I found

oncotracker-windows/oncotracker-debug.log shows 703 rapid restarts (12:35:04–12:45:19) and 7,148 occurrences of Startup failed: Error: Timeout waiting for port <port>. The app keeps picking a new port and quits before any Next.js server ever answers.
The child Next.js process then exits cleanly (Next.js server exited with code 0, signal null), and after thousands of cycles the OS reports handle exhaustion (message_window.cc:183 … used all of its system allowance of handles), which is a symptom of the crash/restart loop.
No [NEXT STDOUT]/[NEXT STDERR] from the spawned server appear in the log, so whatever is killing the child happens before it prints anything (or that output isn’t being captured).
The built server itself looks fine: running .next/standalone/server.js locally with both Node and ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron binds and serves in <100 ms (ot-next-standalone.log, ot-electron-run.log), so the build artifacts aren’t the blocker.
Likely issue
Something in the packaged Windows runtime is stopping the spawned Next.js server immediately (or never spawning it), causing the port check to time out and the watchdog to relaunch endlessly.

Recommended next steps

Capture the child’s output in production: in oncotracker-windows/dist-electron/background.js, pipe nextServer.stdout/stderr to console.log/error (not just logStream) and log the spawn path/env so it appears in the main log. Also treat “child exited before port ready” as an error and include the exit code.
On the Windows box, manually run the bundled server to see the real error:
cd "%LocalAppData%\\Temp\\<random>\\resources\\app\\.next\\standalone"
set ELECTRON_RUN_AS_NODE=1
"<path_to_app_exe>" server.js (or node server.js)
Whatever prints there is likely what’s killing it.
Raise the port wait and avoid handle leaks: bump the timeout (e.g., 60 s) and kill the spawned server when timing out so repeated retries don’t accumulate processes/handles.
