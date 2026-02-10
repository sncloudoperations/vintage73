const requiredEnv = [
    'DATABASE_URL',
    'PORT',
    'JWT_SECRET'
];

function validateEnv() {
    const missing = requiredEnv.filter(env => !process.env[env]);

    if (missing.length > 0) {
        console.error('FATAL ERROR: Missing required environment variables:');
        missing.forEach(env => console.error(` - ${env}`));
        process.exit(1);
    }

    // Specific validations
    if (isNaN(process.env.PORT)) {
        console.error('FATAL ERROR: PORT must be a number');
        process.exit(1);
    }

    if (!process.env.DATABASE_URL.startsWith('postgresql://')) {
        console.error('WARNING: DATABASE_URL might be invalid (expected postgresql://)');
    }

    console.log('Environment variables validated successfully.');
}

module.exports = validateEnv;
