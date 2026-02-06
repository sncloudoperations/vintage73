const axios = require('axios');

async function testMetadata() {
    try {
        console.log('Testing metadata API...');
        const res = await axios.get('http://localhost:5000/api/accounting/posting-setup/metadata');
        console.log('Success:', res.data);
    } catch (err) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response Status:', err.response.status);
            console.error('Response Data:', err.response.data);
        }
    }
}

testMetadata();
