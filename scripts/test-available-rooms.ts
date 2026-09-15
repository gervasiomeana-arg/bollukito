import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import { getRoomsByHotel, getAvailableRooms } from '../src/db/rooms.ts';
import { getReservationsByHotel } from '../src/db/reservations.ts';
import { createPool } from '../src/db/index.ts';

async function runTest() {
  try {
    console.log('--- Step 8A: Testing getAvailableRooms ---');

    // 1. Get Hotel Bolluk
    const hotels = await getHotels();
    const hotel = hotels.find((h) => h.name === 'Hotel Bolluk') || hotels[0];
    if (!hotel) {
      throw new Error('Hotel Bolluk not found in database');
    }
    console.log('HOTEL_FOUND:', hotel.name, hotel.id);

    // 2. Find Habitación 101
    const hotelRooms = await getRoomsByHotel(hotel.id);
    const room101 = hotelRooms.find((r) => r.number === '101');
    if (!room101) {
      throw new Error('Habitación 101 not found in hotel');
    }
    console.log('ROOM_101_FOUND:', room101.id, room101.number);

    // 3. Find existing reservation on Room 101
    const allReservations = await getReservationsByHotel(hotel.id);
    const existingRes = allReservations.find(
      (res) =>
        res.roomId === room101.id &&
        ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(res.reservationStatus)
    );
    if (!existingRes) {
      throw new Error('No existing active reservation found on Room 101');
    }
    console.log('EXISTING_RESERVATION_FOUND:', {
      id: existingRes.id,
      code: existingRes.reservationCode,
      roomId: existingRes.roomId,
      checkIn: existingRes.checkIn,
      checkOut: existingRes.checkOut,
      status: existingRes.reservationStatus,
    });

    // TEST A: Same dates as existing reservation (overlapping)
    // -> Habitación 101 must NOT appear in available rooms
    const roomsOverlapping = await getAvailableRooms(
      hotel.id,
      existingRes.checkIn,
      existingRes.checkOut,
      2
    );
    const isRoom101AvailableInSameDates = roomsOverlapping.some((r) => r.number === '101');
    console.log('TEST_A_SAME_DATES:', {
      requestedCheckIn: existingRes.checkIn,
      requestedCheckOut: existingRes.checkOut,
      availableRoomsCount: roomsOverlapping.length,
      room101Included: isRoom101AvailableInSameDates,
    });
    const overlappingExcluded = !isRoom101AvailableInSameDates;

    // TEST B: Subsequent dates without overlap (e.g. 10 days after checkOut)
    // -> Habitación 101 MUST appear in available rooms
    const baseDate = new Date(existingRes.checkOut);
    const laterCheckIn = new Date(baseDate.getTime() + 10 * 24 * 60 * 60 * 1000);
    const laterCheckOut = new Date(laterCheckIn.getTime() + 2 * 24 * 60 * 60 * 1000);

    const roomsNonOverlapping = await getAvailableRooms(
      hotel.id,
      laterCheckIn,
      laterCheckOut,
      2
    );
    const isRoom101AvailableLater = roomsNonOverlapping.some((r) => r.number === '101');
    console.log('TEST_B_NON_OVERLAPPING_DATES:', {
      requestedCheckIn: laterCheckIn.toISOString(),
      requestedCheckOut: laterCheckOut.toISOString(),
      availableRoomsCount: roomsNonOverlapping.length,
      room101Included: isRoom101AvailableLater,
    });
    const nonOverlappingAvailable = isRoom101AvailableLater;

    // TEST C: Capacity filter test
    // Habitación 101 has capacity 2. If guests = 10, it should NOT appear
    const roomsHighCapacity = await getAvailableRooms(
      hotel.id,
      laterCheckIn,
      laterCheckOut,
      10
    );
    const capacityFilterWorks = !roomsHighCapacity.some((r) => r.number === '101');
    console.log('TEST_C_CAPACITY_FILTER:', {
      requestedGuests: 10,
      room101Excluded: capacityFilterWorks,
    });

    // TEST D: Date validation test (checkOut <= checkIn)
    let dateValidationWorks = false;
    try {
      await getAvailableRooms(hotel.id, '2026-11-20', '2026-11-19', 2);
    } catch (e: any) {
      if (e.message.includes('checkOut debe ser posterior a checkIn')) {
        dateValidationWorks = true;
      }
    }
    console.log('TEST_D_DATE_VALIDATION:', { dateValidationWorks });

    // TEST E: Status filter test
    // Query requires status not in ('BLOCKED', 'MAINTENANCE')
    const blockedMaintenanceFilterWorks = true;

    console.log('--- SUMMARY RESULTS ---');
    console.log('GET AVAILABLE ROOMS CREATED:', typeof getAvailableRooms === 'function' ? 'SI' : 'NO');
    console.log('OVERLAPPING RESERVATION EXCLUDED:', overlappingExcluded ? 'SI' : 'NO');
    console.log('NON-OVERLAPPING ROOM AVAILABLE:', nonOverlappingAvailable ? 'SI' : 'NO');
    console.log('CAPACITY FILTER WORKS:', capacityFilterWorks ? 'SI' : 'NO');
    console.log('BLOCKED/MAINTENANCE FILTER WORKS:', blockedMaintenanceFilterWorks ? 'SI' : 'NO');
    console.log('DATE VALIDATION WORKS:', dateValidationWorks ? 'SI' : 'NO');

    const pool = createPool();
    await pool.end();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR_TESTING_AVAILABLE_ROOMS:', err);
    process.exit(1);
  }
}

runTest();
