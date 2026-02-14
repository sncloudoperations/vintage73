const requiredEnv = [
    'DATABASE_URL',
    'PORT',
    'JWT_SECRET',
    'NODE_ENV',
    'CORS_ORIGIN'
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
        console.warn('WARNING: DATABASE_URL might be invalid (expected postgresql://)');
    }

    if (!['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
         console.warn(`WARNING: NODE_ENV is set to '${process.env.NODE_ENV}'. Expected 'development', 'production', or 'test'.`);
    }

    console.log('Environment variables validated successfully.');
}

module.exports = validateEnv;
