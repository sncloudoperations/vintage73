const { getISTRange } = require('./utils/dateUtils');
const { format } = require('date-fns');

function testISTRange() {
    console.log("Testing IST Range Logic...");

    const startDate = "2026-02-20";
    const endDate = "2026-02-20";

    const range = getISTRange(startDate, endDate);

    console.log(`Input IST Date: ${startDate}`);
    console.log(`UTC Range GTE: ${range.gte.toISOString()}`);
    console.log(`UTC Range LTE: ${range.lte.toISOString()}`);

    // 00:00:00 IST is 18:30:00 UTC previous day
    // 23:59:59 IST is 18:29:59 UTC same day

    const expectedGTE = "2026-02-19T18:30:00";
    const expectedLTE = "2026-02-20T18:29:59";

    const successGTE = range.gte.toISOString().startsWith(expectedGTE);
    const successLTE = range.lte.toISOString().startsWith(expectedLTE);

    if (successGTE && successLTE) {
        console.log("SUCCESS: IST range correctly maps to UTC offsets.");
    } else {
        console.log("FAILURE: IST range mismatch.");
        console.log(`Expected GTE starts with: ${expectedGTE}`);
        console.log(`Expected LTE starts with: ${expectedLTE}`);
    }
}

testISTRange();
