const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let token = '';

async function login() {
    try {
        const res = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'password123'
        });
        token = res.data.token;
        console.log('Login successful');
    } catch (err) {
        console.error('Login failed', err.response?.data || err.message);
    }
}

async function testStats() {
    try {
        const res = await axios.get(`${BASE_URL}/tickets/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Stats Response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Fetch Stats failed', err.response?.data || err.message);
    }
}

async function run() {
    await login();
    if (token) {
        await testStats();
    }
}

run();
