const axios = require('axios');

async function runTests() {
  // Test Company
  try {
    console.log('--- Testing /api/company ---');
    const res = await axios.get('http://127.0.0.1:5000/api/company');
    console.log('Status:', res.status);
    console.log('Data Preview:', JSON.stringify(res.data).substring(0, 100));
  } catch (err) {
    console.log('Company Error:', err.response?.status, err.message);
  }

  // Test Branch 1
  try {
    console.log('\n--- Testing /api/branches/1 ---');
    const res = await axios.get('http://127.0.0.1:5000/api/branches/1');
    console.log('Status:', res.status);
    console.log('Data Preview:', JSON.stringify(res.data).substring(0, 100));
  } catch (err) {
    console.log('Branch 1 Error:', err.response?.status, err.message, err.response?.data);
  }

  // Test Branch Invalid
  try {
    console.log('\n--- Testing /api/branches/nan ---');
    const res = await axios.get('http://127.0.0.1:5000/api/branches/nan');
    console.log('Status:', res.status);
  } catch (err) {
    console.log('Branch Invalid Error:', err.response?.status, err.message, err.response?.data);
  }
}

runTests();
