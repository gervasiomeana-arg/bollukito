import fetch from 'node-fetch';

async function testStep9D() {
  const baseUrl = 'http://localhost:3000';
  console.log('Testing Step 9D: Flow of reservation creation from chat...');

  // 1. Query availability via /api/chat
  const chatRes = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: '¿Tienen disponibilidad para 2 personas del 5 al 7 de octubre 2026?',
    }),
  });

  if (!chatRes.ok) {
    throw new Error(`Chat API failed with status ${chatRes.status}`);
  }

  const chatData: any = await chatRes.json();
  console.log('Chat response reply:', chatData.reply);
  console.log('Options count:', chatData.availableOptions?.length);
  console.log('Parsed checkIn:', chatData.checkIn);
  console.log('Parsed checkOut:', chatData.checkOut);
  console.log('Parsed guests:', chatData.guests);

  if (!chatData.availableOptions || chatData.availableOptions.length === 0) {
    throw new Error('No availableOptions returned from /api/chat');
  }

  const chosenOption = chatData.availableOptions[0];
  console.log('Chosen option:', chosenOption);

  // 2. Customer resolution / creation
  const testPhone = '1199887766';
  const testName = 'María González';

  const custRes = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      phone: testPhone,
    }),
  });

  if (!custRes.ok) {
    throw new Error(`Customer API failed with status ${custRes.status}`);
  }

  const custData: any = await custRes.json();
  console.log('Customer resolved/created:', custData.customer?.id, custData.customer?.name, 'Reused:', custData.reused);

  // Test customer reuse
  const custReuseRes = await fetch(`${baseUrl}/api/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'María G.',
      phone: testPhone,
    }),
  });
  const custReuseData: any = await custReuseRes.json();
  console.log('Customer reused check:', custReuseData.customer?.id === custData.customer?.id, 'Reused:', custReuseData.reused);
  if (custReuseData.customer?.id !== custData.customer?.id || !custReuseData.reused) {
    throw new Error('Customer reuse failed');
  }

  // 3. Create PENDING reservation
  const resRes = await fetch(`${baseUrl}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: custData.customer.id,
      selectedRoomTypeId: chosenOption.roomTypeId,
      selectedRoomId: chosenOption.roomId,
      selectedCheckIn: chatData.checkIn || '2026-09-20',
      selectedCheckOut: chatData.checkOut || '2026-09-22',
      selectedGuests: chatData.guests || 2,
      reservationStatus: 'PENDING',
      paymentStatus: 'NOT_REQUIRED',
      source: 'CHAT',
    }),
  });

  if (!resRes.ok) {
    const errBody = await resRes.text();
    throw new Error(`Reservation creation failed: ${resRes.status} ${errBody}`);
  }

  const resData: any = await resRes.json();
  console.log('Created Reservation Code:', resData.bookingId || resData.reservationCode);
  console.log('Reservation Status:', resData.reservationStatus || resData.status);
  console.log('Payment Status:', resData.paymentStatus);
  console.log('Room:', resData.roomTypeName || resData.roomType, 'Hab:', resData.roomNumber);

  if (resData.reservationStatus !== 'PENDING') {
    throw new Error(`Expected reservationStatus to be PENDING, got ${resData.reservationStatus}`);
  }
  if (resData.paymentStatus !== 'NOT_REQUIRED') {
    throw new Error(`Expected paymentStatus to be NOT_REQUIRED, got ${resData.paymentStatus}`);
  }

  // 4. Test 409 conflict when room is already reserved for these dates
  const conflictRes = await fetch(`${baseUrl}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: custData.customer.id,
      selectedRoomTypeId: chosenOption.roomTypeId,
      selectedRoomId: chosenOption.roomId,
      selectedCheckIn: chatData.checkIn || '2026-09-20',
      selectedCheckOut: chatData.checkOut || '2026-09-22',
      selectedGuests: chatData.guests || 2,
      reservationStatus: 'PENDING',
      paymentStatus: 'NOT_REQUIRED',
      source: 'CHAT',
    }),
  });

  console.log('Conflict test response status:', conflictRes.status);
  if (conflictRes.status !== 409) {
    throw new Error(`Expected status 409 on occupied room, got ${conflictRes.status}`);
  }
  const conflictData: any = await conflictRes.json();
  console.log('Conflict response error:', conflictData.error);

  console.log('ALL STEP 9D TESTS PASSED SUCCESSFULLY!');
}

testStep9D().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
