import dotenv from 'dotenv';
dotenv.config();

async function testGet() {
  try {
    const res = await fetch('http://localhost:3000/api/reservations');
    const data = await res.json();
    console.log('STATUS:', res.status);
    console.log('DATA_LENGTH:', Array.isArray(data) ? data.length : 'Not array');
    console.log('RESERVATIONS:', JSON.stringify(data, null, 2));

    if (Array.isArray(data) && data.length > 0) {
      const postgresRes = data.find(
        (r: any) => r.bookingId?.startsWith('BOL-2026') || r.guestName === 'Cliente Prueba'
      );
      if (postgresRes) {
        console.log('FOUND_POSTGRES_RESERVATION:', postgresRes);
      } else {
        console.log('POSTGRES_RESERVATION_NOT_FOUND_IN_DATA');
      }
    }
  } catch (err: any) {
    console.error('FETCH_ERROR:', err.message);
  }
}

testGet();
