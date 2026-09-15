import dotenv from 'dotenv';
dotenv.config();

async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  console.log('--- Step 1: Testing Input Validations ---');

  // Test 1: Invalid hotelId
  const resHotel = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hotelId: 'not-a-uuid', checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, totalAmount: 50000 }),
  });
  console.log('VAL_HOTEL_ID:', resHotel.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resHotel.status}`);

  // Test 2: Invalid customerId
  const resCustomer = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerId: 'not-a-uuid', checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, totalAmount: 50000 }),
  });
  console.log('VAL_CUSTOMER_ID:', resCustomer.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resCustomer.status}`);

  // Test 3: Invalid roomTypeId
  const resRoomType = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomTypeId: 'not-a-uuid', checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, totalAmount: 50000 }),
  });
  console.log('VAL_ROOM_TYPE_ID:', resRoomType.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resRoomType.status}`);

  // Test 4: Invalid roomId
  const resRoom = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: 'not-a-uuid', checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, totalAmount: 50000 }),
  });
  console.log('VAL_ROOM_ID:', resRoom.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resRoom.status}`);

  // Test 5: checkOut <= checkIn
  const resDates = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkIn: '2026-11-05', checkOut: '2026-11-03', guests: 2, totalAmount: 50000 }),
  });
  console.log('VAL_DATES:', resDates.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resDates.status}`);

  // Test 6: guests <= 0
  const resGuests = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 0, totalAmount: 50000 }),
  });
  console.log('VAL_GUESTS:', resGuests.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resGuests.status}`);

  // Test 7: totalAmount < 0
  const resAmount = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, totalAmount: -100 }),
  });
  console.log('VAL_TOTAL_AMOUNT:', resAmount.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resAmount.status}`);

  // Test 8: depositAmount < 0
  const resDeposit = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, totalAmount: 50000, depositAmount: -50 }),
  });
  console.log('VAL_DEPOSIT_AMOUNT:', resDeposit.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resDeposit.status}`);

  // Test 9: invalid reservationStatus
  const resStatus = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, totalAmount: 50000, reservationStatus: 'INVALID' }),
  });
  console.log('VAL_RESERVATION_STATUS:', resStatus.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resStatus.status}`);

  // Test 10: invalid paymentStatus
  const resPayment = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2, totalAmount: 50000, paymentStatus: 'INVALID' }),
  });
  console.log('VAL_PAYMENT_STATUS:', resPayment.status === 400 ? 'REJECTED_AS_EXPECTED' : `FAILED_${resPayment.status}`);

  const allValidationsPassed = [
    resHotel.status,
    resCustomer.status,
    resRoomType.status,
    resRoom.status,
    resDates.status,
    resGuests.status,
    resAmount.status,
    resDeposit.status,
    resStatus.status,
    resPayment.status,
  ].every((s) => s === 400);

  console.log('ALL_VALIDATIONS_PASSED:', allValidationsPassed);

  console.log('\n--- Step 2: Creating ONE reservation via POST /api/reservations ---');
  // First, get the IDs of existing entities
  const { getHotels } = await import('../src/db/hotels.ts');
  const { getCustomersByHotel } = await import('../src/db/customers.ts');
  const { getRoomTypesByHotel } = await import('../src/db/room-types.ts');
  const { getRoomsByHotel } = await import('../src/db/rooms.ts');
  const { createPool } = await import('../src/db/index.ts');

  const hotels = await getHotels();
  const hotel = hotels[0];
  const customers = await getCustomersByHotel(hotel.id);
  const customer = customers[0];
  const roomTypes = await getRoomTypesByHotel(hotel.id);
  const roomType = roomTypes[0];
  const rooms = await getRoomsByHotel(hotel.id);
  const room = rooms[0];

  const postBody = {
    hotelId: hotel.id,
    customerId: customer.id,
    roomTypeId: roomType.id,
    roomId: room.id,
    checkIn: '2026-11-10T14:00:00.000Z',
    checkOut: '2026-11-13T10:00:00.000Z',
    guests: 2,
    totalAmount: 129000,
    depositAmount: 0,
    reservationStatus: 'PENDING',
    paymentStatus: 'NOT_REQUIRED',
    source: 'DIRECT',
    notes: 'Reserva creada via POST endpoint',
  };

  const createRes = await fetch(`${BASE_URL}/api/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postBody),
  });

  const createdData = await createRes.json();
  console.log('CREATE_STATUS:', createRes.status);
  console.log('CREATED_RESPONSE:', JSON.stringify(createdData, null, 2));

  // Verify frontend format preserved
  const hasRequiredFrontendFields =
    typeof createdData.id === 'string' &&
    typeof createdData.bookingId === 'string' &&
    typeof createdData.guestName === 'string' &&
    typeof createdData.guestDoc === 'string' &&
    typeof createdData.guestPhone === 'string' &&
    ['Doble', 'Triple'].includes(createdData.roomType) &&
    typeof createdData.guests === 'number' &&
    typeof createdData.checkIn === 'string' &&
    typeof createdData.checkOut === 'string' &&
    typeof createdData.nights === 'number' &&
    typeof createdData.totalPrice === 'number' &&
    typeof createdData.currency === 'string' &&
    typeof createdData.paymentRef === 'string' &&
    typeof createdData.paymentMethod === 'string' &&
    typeof createdData.paidAt === 'string' &&
    typeof createdData.loadedInHotelSystem === 'boolean' &&
    typeof createdData.receptionistNotified === 'boolean';

  console.log('FRONTEND_FORMAT_PRESERVED:', hasRequiredFrontendFields);

  console.log('\n--- Step 3: Querying GET /api/reservations ---');
  const getRes = await fetch(`${BASE_URL}/api/reservations`);
  const getList = await getRes.json();
  console.log('GET_STATUS:', getRes.status);
  console.log('TOTAL_RESERVATIONS_IN_POSTGRES:', getList.length);

  const foundNew = getList.find((r: any) => r.id === createdData.id || r.bookingId === createdData.bookingId);
  console.log('FOUND_NEW_RESERVATION_IN_GET:', Boolean(foundNew));
  if (foundNew) {
    console.log('MATCHED_RESERVATION:', JSON.stringify(foundNew, null, 2));
  }

  const pool = createPool();
  await pool.end();
}

runTests().catch(console.error);
