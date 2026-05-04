const testAPI = async () => {
  try {
    console.log('--- Testing Public Rooms API ---');
    const roomsRes = await fetch('http://127.0.0.1:5004/api/public/rooms');
    const roomsData = await roomsRes.json();
    console.log(roomsData);

    console.log('\n--- Testing Admin Login API ---');
    const loginRes = await fetch('http://127.0.0.1:5004/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    const loginData = await loginRes.json();
    console.log(loginData);

    if (loginData.token) {
      console.log('\n--- Testing Admin Protected Route (Get Staff) ---');
      const staffRes = await fetch('http://127.0.0.1:5004/api/staff', {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      });
      const staffData = await staffRes.json();
      console.log(staffData);
    }
  } catch (error) {
    console.error('Error during testing:', error);
  }
};

testAPI();
