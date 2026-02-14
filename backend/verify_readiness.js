const fs = require('fs');
const path = require('path');

console.log('--- Production Readiness Verification ---');

// 1. Check package.json engines
const packageJson = require('./package.json');
if (packageJson.engines && packageJson.engines.node) {
    console.log(`✅ Engines Verified: node ${packageJson.engines.node}`);
} else {
    console.error('❌ Engines Check Failed: node engine missing');
}

// Load environment
require('dotenv').config();

// Mock process.exit to test validation without crashing
const originalExit = process.exit;
process.exit = (code) => {
    throw new Error(`Process exit called with code ${code}`);
};

// 2. Check Environment Validation (Dry Run)
// We'll mock process.env to test validation logic
const validateEnv = require('./utils/envValidator');
try {
    console.log('Running Env Validator...');
    validateEnv();
    console.log('✅ Env Validator Passed (Current Env)');
} catch (e) {
    console.error('❌ Env Validator Failed:', e.message);
} finally {
    process.exit = originalExit; // Restore
}

// 3. Check Server CORS config (Static Analysis)
const serverContent = fs.readFileSync('./server.js', 'utf8');
if (serverContent.includes('origin: process.env.CORS_ORIGIN')) {
    console.log('✅ CORS Configured via Env');
} else {
    console.error('❌ CORS Check Failed: Hardcoded or missing origin');
}

// 4. Check Prisma Exit Logic (Static Analysis)
const prismaContent = fs.readFileSync('./utils/prismaClient.js', 'utf8');
if (!prismaContent.includes('process.exit(1)')) {
    console.log('✅ Prisma Resilience Verified (No process.exit found)');
} else {
    // It might differ if commented out, check if it's commented
    if (prismaContent.match(/\/\/\s*process\.exit\(1\)/)) {
         console.log('✅ Prisma Resilience Verified (process.exit commented out)');
    } else {
         console.warn('⚠️ Prisma Check Warning: process.exit(1) might still be active. Check file manually.');
    }
}

console.log('--- Verification Complete ---');
