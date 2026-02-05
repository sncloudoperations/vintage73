const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testUpload() {
  try {
    // create a dummy file
    fs.writeFileSync('test-image.jpg', 'dummy content');

    const form = new FormData();
    form.append('dashboardImage', fs.createReadStream('test-image.jpg'));
    // We send just the image, similar to how frontend might if other fields are empty
    // But frontend sends other fields too. Let's try minimal first.

    console.log('Sending upload request...');
    const res = await axios.post('http://127.0.0.1:5000/api/company', form, {
      headers: {
        ...form.getHeaders()
      }
    });

    console.log('Success:', res.status);
    console.log('Data:', res.data);

  } catch (err) {
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Data:', err.response.data);
    }
  } finally {
      if (fs.existsSync('test-image.jpg')) fs.unlinkSync('test-image.jpg');
  }
}

testUpload();
