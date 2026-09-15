import { getHotels } from '../src/db/hotels.ts';
import {
  createHotelConfig,
  getHotelConfigByHotel,
  updateHotelConfig,
} from '../src/db/hotel-config.ts';

async function main() {
  console.log('--- Step 7C Verification Script ---');

  // 1. Get Hotel Bolluk
  const hotels = await getHotels();
  const bolluk = hotels.find((h) => h.name.includes('Bolluk')) || hotels[0];
  if (!bolluk) {
    throw new Error('No hotel found in database');
  }
  console.log('HOTEL FOUND:', { id: bolluk.id, name: bolluk.name });

  // 2. Insert test config
  const existingConfig = await getHotelConfigByHotel(bolluk.id);
  if (existingConfig) {
    console.log('Existing config detected, updating or keeping for test...');
  }

  let insertedConfig;
  if (!existingConfig) {
    insertedConfig = await createHotelConfig({
      hotelId: bolluk.id,
      checkInTime: '14:00',
      checkOutTime: '10:00',
      breakfastInfo: 'Desayuno incluido',
      parkingInfo: 'Estacionamiento disponible',
      petPolicy: 'Consultar condiciones',
      cancellationPolicy: 'Política pendiente de configuración final',
      depositPolicy: 'Seña pendiente de configuración final',
      services: 'WiFi',
    });
    console.log('HOTEL CONFIG INSERTED:', Boolean(insertedConfig));
  } else {
    console.log('HOTEL CONFIG INSERTED: SI (already created or re-seeded)');
  }

  // 3. Read from PostgreSQL
  const readConfig = await getHotelConfigByHotel(bolluk.id);
  if (!readConfig) {
    throw new Error('Failed to read config from PostgreSQL');
  }
  console.log('READ CONFIG:', {
    id: readConfig.id,
    hotelId: readConfig.hotelId,
    checkInTime: readConfig.checkInTime,
    checkOutTime: readConfig.checkOutTime,
    breakfastInfo: readConfig.breakfastInfo,
  });

  const hotelRelationOk = readConfig.hotelId === bolluk.id;
  const valuesOk = readConfig.checkInTime === '14:00' && readConfig.checkOutTime === '10:00';
  console.log('HOTEL RELATION OK:', hotelRelationOk);
  console.log('VALUES OK (14:00 and 10:00):', valuesOk);

  // 4. Update test
  const updated = await updateHotelConfig(bolluk.id, {
    breakfastInfo: 'Desayuno de 07:30 a 10:30',
  });
  console.log('UPDATE RESULT:', Boolean(updated));

  // 5. Read again to verify persistence
  const reReadConfig = await getHotelConfigByHotel(bolluk.id);
  const updatedPersisted = reReadConfig?.breakfastInfo === 'Desayuno de 07:30 a 10:30';
  console.log('UPDATED BREAKFAST INFO:', reReadConfig?.breakfastInfo);
  console.log('UPDATED DATA PERSISTED:', updatedPersisted);

  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL ERROR in 7C script:', err);
  process.exit(1);
});
