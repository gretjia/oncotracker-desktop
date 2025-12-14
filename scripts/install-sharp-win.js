/**
 * Install Sharp Windows binaries for cross-platform Electron build
 * Run this before building Windows exe on macOS: node scripts/install-sharp-win.js
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const standaloneNodeModules = path.join(root, '.next', 'standalone', 'node_modules', '@img');

console.log('[install-sharp-win] Installing Sharp Windows x64 binaries...');

// Sharp uses @img/sharp-win32-x64 and @img/sharp-libvips-win32-x64
const packages = [
    '@img/sharp-win32-x64',
    '@img/sharp-libvips-win32-x64'
];

// Create @img directory in standalone if it doesn't exist
if (!fs.existsSync(standaloneNodeModules)) {
    fs.mkdirSync(standaloneNodeModules, { recursive: true });
}

try {
    // Use npm view to get the tarball URL, then curl to download
    for (const pkg of packages) {
        const pkgDir = pkg.split('/')[1]; // e.g., "sharp-win32-x64"
        const destDir = path.join(standaloneNodeModules, pkgDir);

        if (fs.existsSync(destDir)) {
            console.log(`[install-sharp-win] ${pkg} already exists, skipping...`);
            continue;
        }

        console.log(`[install-sharp-win] Downloading ${pkg}...`);

        // Get tarball URL
        const tarballUrl = execSync(`npm view ${pkg} dist.tarball`, { encoding: 'utf8' }).trim();

        // Create temp file for tarball
        const tmpTar = path.join('/tmp', `${pkgDir}.tgz`);

        // Download tarball using curl
        execSync(`curl -sL "${tarballUrl}" -o "${tmpTar}"`, { stdio: 'inherit' });

        // Extract to destination
        fs.mkdirSync(destDir, { recursive: true });
        execSync(`tar -xzf "${tmpTar}" -C "${destDir}" --strip-components=1`, { stdio: 'inherit' });

        // Cleanup
        fs.unlinkSync(tmpTar);

        console.log(`[install-sharp-win] Installed ${pkg}`);
    }

    console.log('[install-sharp-win] Done! Windows Sharp binaries installed.');
} catch (err) {
    console.error('[install-sharp-win] Error:', err.message);
    process.exit(1);
}
