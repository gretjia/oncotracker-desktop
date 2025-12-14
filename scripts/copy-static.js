const fs = require('fs');
const path = require('path');

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) {
        console.log(`[copy-static] Source not found: ${src}`);
        return;
    }
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        entry.isDirectory()
            ? copyRecursive(srcPath, destPath)
            : fs.copyFileSync(srcPath, destPath);
    }
    console.log(`[copy-static] Copied: ${src} -> ${dest}`);
}

const root = path.join(__dirname, '..');

// Copy .next/static → .next/standalone/.next/static
console.log('[copy-static] Copying .next/static...');
copyRecursive(
    path.join(root, '.next', 'static'),
    path.join(root, '.next', 'standalone', '.next', 'static')
);

// Copy public → .next/standalone/public
console.log('[copy-static] Copying public...');
copyRecursive(
    path.join(root, 'public'),
    path.join(root, '.next', 'standalone', 'public')
);

console.log('[copy-static] Copying .prisma/client (engines)...');
const prismaSrc = path.join(root, 'node_modules', '.prisma', 'client');
const prismaDest = path.join(root, '.next', 'standalone', 'node_modules', '.prisma', 'client');

// Ensure destination exists
if (fs.existsSync(prismaSrc)) {
    fs.mkdirSync(path.dirname(prismaDest), { recursive: true });
    copyRecursive(prismaSrc, prismaDest);
} else {
    console.warn('[copy-static] Warning: .prisma/client not found. Prisma engines might be missing!');
}

console.log('[copy-static] Done!');
