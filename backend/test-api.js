const axios = require('axios');

async function testCompanyEndpoint() {
  try {
    console.log('Testing company endpoint at http://127.0.0.1:5000/api/company');
    const response = await axios.get('http://127.0.0.1:5000/api/company');
    console.log('Success! Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error occurred:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Data:', error.response?.data);
    console.error('Message:', error.message);
  }
}

testCompanyEndpoint();
