/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
    // Default to 500 if not specified
    const statusCode = err.statusCode || 500;
    
    // Log the error (structured for production)
    const logPayload = {
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        method: req.method,
        ip: req.ip,
        statusCode,
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    };

    // Use error level for 500s, warn for 400s
    if (statusCode >= 500) {
        console.error('❌ [SERVER ERROR]', JSON.stringify(logPayload, null, 2));
    } else {
        console.warn('⚠️ [CLIENT ERROR]', JSON.stringify(logPayload));
    }

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
        // Start validation errors standard format if needed
        errors: err.errors || undefined, 
        // Hide stack in production
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
};

module.exports = errorHandler;
