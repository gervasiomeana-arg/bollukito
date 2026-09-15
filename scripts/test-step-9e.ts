/**
 * Test Step 9E:
 * A) Create PENDING reservation -> PATCH /api/reservations/:id with CONFIRMAR DATOS -> reservationStatus = AWAITING_PAYMENT, paymentStatus = PENDING
 * B) Create PENDING reservation -> MODIFICAR -> reservation remains PENDING, paymentStatus NOT_REQUIRED
 */
import fetch from 'node-fetch';

async function testStep9E() {
  const baseUrl = 'http://localhost:3000';
  console.log('Testing Step 9E: Confirmation step and status transitions...');

  // Ensure server is reachable
  let retries = 5;
  while (retries > 0) {
    try {
      const ping = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'ping' }),
      });
      if (ping.ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      retries--;
    }
  }

  // 1. Customer resolution
  const custRes = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Carlos Menéndez',
      phone: '1144556677',
    }),
  });
  if (!custRes.ok) throw new Error('Customer creation failed');
  const custData: any = await custRes.json();
  const customerId = custData.customer?.id;
  console.log('Customer ID:', customerId);

  // Test Case A: Create PENDING reservation -> CONFIRMAR DATOS
  console.log('\n--- TEST CASE A: PENDING -> CONFIRMAR DATOS -> AWAITING_PAYMENT & PENDING ---');
  // Use unique year/month/day offset to avoid collisions across test runs
  const randOffset = Math.floor(Math.random() * 200) + 50;
  const baseDateA = new Date(2030, 0, 1 + randOffset);
  const checkInA = baseDateA.toISOString().split('T')[0];
  const checkOutA = new Date(baseDateA.getTime() + 2 * 86400000).toISOString().split('T')[0];

  const resA = await fetch(`${baseUrl}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      roomType: 'Doble',
      checkIn: checkInA,
      checkOut: checkOutA,
      guests: 2,
      reservationStatus: 'PENDING',
      paymentStatus: 'NOT_REQUIRED',
      source: 'CHAT',
    }),
  });

  if (!resA.ok) {
    const errText = await resA.text();
    throw new Error(`Failed to create reservation A: ${resA.status} - ${errText}`);
  }
  const dataA: any = await resA.json();
  console.log('Reservation A created:', dataA.id, dataA.reservationCode, 'Status:', dataA.reservationStatus, 'Payment:', dataA.paymentStatus);

  if (dataA.reservationStatus !== 'PENDING') {
    throw new Error(`Expected reservationStatus PENDING, got ${dataA.reservationStatus}`);
  }

  // Perform PATCH simulating CONFIRMAR DATOS
  const patchResA = await fetch(`${baseUrl}/api/reservations/${dataA.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reservationStatus: 'AWAITING_PAYMENT',
      paymentStatus: 'PENDING',
    }),
  });

  if (!patchResA.ok) {
    const errText = await patchResA.text();
    throw new Error(`Failed to patch reservation A: ${patchResA.status} - ${errText}`);
  }
  const updatedA: any = await patchResA.json();
  console.log('Reservation A after CONFIRMAR DATOS:');
  console.log('  reservationStatus:', updatedA.reservationStatus);
  console.log('  paymentStatus:', updatedA.paymentStatus);

  if (updatedA.reservationStatus !== 'AWAITING_PAYMENT') {
    throw new Error(`Expected AWAITING_PAYMENT, got ${updatedA.reservationStatus}`);
  }
  if (updatedA.paymentStatus !== 'PENDING') {
    throw new Error(`Expected paymentStatus PENDING, got ${updatedA.paymentStatus}`);
  }

  // Test Case B: Create PENDING reservation -> MODIFICAR (stays PENDING)
  console.log('\n--- TEST CASE B: PENDING -> MODIFICAR -> REMAINS PENDING ---');
  const baseDateB = new Date(2030, 6, 1 + randOffset);
  const checkInB = baseDateB.toISOString().split('T')[0];
  const checkOutB = new Date(baseDateB.getTime() + 2 * 86400000).toISOString().split('T')[0];

  const resB = await fetch(`${baseUrl}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      roomType: 'Doble',
      checkIn: checkInB,
      checkOut: checkOutB,
      guests: 2,
      reservationStatus: 'PENDING',
      paymentStatus: 'NOT_REQUIRED',
      source: 'CHAT',
    }),
  });

  if (!resB.ok) {
    const errText = await resB.text();
    throw new Error(`Failed to create reservation B: ${resB.status} - ${errText}`);
  }
  const dataB: any = await resB.json();
  console.log('Reservation B created:', dataB.id, dataB.reservationCode, 'Status:', dataB.reservationStatus, 'Payment:', dataB.paymentStatus);

  // In the MODIFICAR action, no PATCH is sent, reservation remains PENDING
  // Verify with GET /api/reservations
  const listRes = await fetch(`${baseUrl}/api/reservations`);
  const listData: any = await listRes.json();
  const foundB = listData.find((r: any) => r.id === dataB.id || r.bookingId === dataB.bookingId);
  console.log('Reservation B checked in DB:');
  console.log('  reservationStatus:', foundB?.reservationStatus);
  console.log('  paymentStatus:', foundB?.paymentStatus);

  if (foundB?.reservationStatus !== 'PENDING') {
    throw new Error(`Expected reservation B to remain PENDING, found ${foundB?.reservationStatus}`);
  }

  console.log('\nALL STEP 9E TESTS PASSED SUCCESSFULLY!');
}

testStep9E().catch((err) => {
  console.error('Test Step 9E failed:', err);
  process.exit(1);
});
