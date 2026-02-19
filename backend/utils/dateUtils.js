const { startOfDay, endOfDay, addHours, addMinutes } = require('date-fns');

/**
 * Converts a UTC Date object to an IST Date object for display/processing
 * IST is UTC + 5:30
 */
function convertToIST(date) {
    const d = new Date(date);
    return addMinutes(addHours(d, 5), 30);
}

/**
 * Gets a Date range in UTC that corresponds to a full day in IST
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Object} { gte, lte } in UTC
 */
function getISTDayRange(dateStr) {
    const istDate = new Date(dateStr);
    // 00:00:00 IST is 18:30:00 UTC previous day
    // 23:59:59 IST is 18:29:59 UTC same day

    // Start of IST day (00:00) converted to UTC
    const istStart = startOfDay(istDate);
    const utcStart = addMinutes(addHours(istStart, -5), -30);

    // End of IST day (23:59:59) converted to UTC
    const istEnd = endOfDay(istDate);
    const utcEnd = addMinutes(addHours(istEnd, -5), -30);

    return {
        gte: utcStart,
        lte: utcEnd
    };
}

/**
 * Gets a Date range in UTC that corresponds to start and end dates in IST
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {string} endDateStr - YYYY-MM-DD
 * @returns {Object} { gte, lte } in UTC
 */
function getISTRange(startDateStr, endDateStr) {
    // We want 00:00:00 IST on startDate
    // And 23:59:59 IST on endDate

    // Construct ISO strings with IST offset (+05:30)
    const gte = new Date(`${startDateStr}T00:00:00+05:30`);
    const lte = new Date(`${endDateStr}T23:59:59.999+05:30`);

    return { gte, lte };
}

module.exports = {
    convertToIST,
    getISTDayRange,
    getISTRange
};
