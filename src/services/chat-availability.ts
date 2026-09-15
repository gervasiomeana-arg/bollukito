import { getHotels } from '../db/hotels.ts';
import { getAvailableRooms, type AvailableRoom } from '../db/rooms.ts';
import { getRoomTypesByHotel } from '../db/room-types.ts';

export interface AvailabilityParseResult {
  isAvailabilityIntent: boolean;
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  roomTypeName: string | null;
  missingField: 'dates' | 'checkOut' | 'guests' | null;
  missingPrompt?: string;
}

export interface AvailableOption {
  roomTypeId: string;
  roomTypeName: string;
  roomId: string;
  roomNumber: string;
  capacity: number;
  baseRate: number;
}

export interface ChatAvailabilityResponse {
  handled: boolean;
  reply: string;
  available: boolean;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  availableOptions: AvailableOption[];
  availableRooms: AvailableOption[];
  reservationOffer?: any;
  quickReplies: string[];
}

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Extracts availability intent and parameters from user message and recent history.
 */
export function parseAvailabilityIntent(message: string, history: any[] = []): AvailabilityParseResult {
  const text = message.toLowerCase();
  
  // Also scan recent user messages from history to retain context
  const pastUserMessages = history
    .filter((m) => m && m.sender === 'user' && typeof m.text === 'string')
    .map((m) => m.text.toLowerCase())
    .slice(-4);
  const combinedText = [...pastUserMessages, text].join(' ');

  // 1. Detect if this is an availability or booking inquiry
  const availabilityKeywords = [
    'disponib',
    'disponible',
    'reserva',
    'reservar',
    'habitacion',
    'habitación',
    'lugar',
    'hospeda',
    'alojam',
    'estadia',
    'estadía',
    'somos',
    'personas',
    'huesped',
    'huésped',
    'noche',
    'noches',
    'del ',
    'para mañana',
    'para hoy',
    'este finde',
    'este fin de semana',
    'el viernes',
    'el sabado',
    'el sábado',
    'tenes lugar',
    'tenés lugar',
    'tienen lugar',
    'tenes libre',
    'tenés libre',
    'tienen libre',
    'tienen habitacion',
    'tienen habitación',
    'tenes habitacion',
    'tenés habitación',
    'precio',
    'tarifa',
    'cuanto cuesta',
    'cuánto cuesta',
    'cuanto sale',
    'cuánto sale',
  ];

  const hasIntent = availabilityKeywords.some((kw) => text.includes(kw) || combinedText.includes(kw));
  if (!hasIntent) {
    return {
      isAvailabilityIntent: false,
      checkIn: null,
      checkOut: null,
      guests: null,
      roomTypeName: null,
      missingField: null,
    };
  }

  // 2. Extract Room Type (Doble, Triple)
  let roomTypeName: string | null = null;
  if (combinedText.includes('triple') || combinedText.includes('familiar')) {
    roomTypeName = 'Triple';
  } else if (combinedText.includes('doble') || combinedText.includes('matrimonial') || combinedText.includes('pareja')) {
    roomTypeName = 'Doble';
  }

  // 3. Extract Guests count
  let guests: number | null = null;
  const guestsRegexes = [
    /somos\s+(\d+)/i,
    /para\s+(\d+)\s+personas?/i,
    /(\d+)\s+personas?/i,
    /(\d+)\s+huesped(?:es)?/i,
    /(\d+)\s+huésped(?:es)?/i,
    /(\d+)\s+adultos?/i,
  ];

  for (const re of guestsRegexes) {
    const match = text.match(re) || combinedText.match(re);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (num > 0 && num <= 10) {
        guests = num;
        break;
      }
    }
  }

  // Word-based numbers
  if (!guests) {
    if (combinedText.includes('somos dos') || combinedText.includes('para dos') || combinedText.includes('dos personas')) {
      guests = 2;
    } else if (combinedText.includes('somos tres') || combinedText.includes('para tres') || combinedText.includes('tres personas')) {
      guests = 3;
    } else if (combinedText.includes('somos cuatro') || combinedText.includes('para cuatro') || combinedText.includes('cuatro personas')) {
      guests = 4;
    } else if (combinedText.includes('una persona') || combinedText.includes('para uno') || combinedText.includes('solo yo')) {
      guests = 1;
    }
  }

  // 4. Extract Dates
  let checkIn: string | null = null;
  let checkOut: string | null = null;
  const baseDate = new Date(); // Today's local date context

  // 4a. Check for ISO dates: YYYY-MM-DD
  const isoDates = text.match(/\b\d{4}-\d{2}-\d{2}\b/g) || combinedText.match(/\b\d{4}-\d{2}-\d{2}\b/g);
  if (isoDates && isoDates.length >= 2) {
    checkIn = isoDates[0];
    checkOut = isoDates[1];
  } else if (isoDates && isoDates.length === 1) {
    checkIn = isoDates[0];
  }

  // 4b. Check for DD/MM/YYYY or DD-MM-YYYY
  if (!checkIn) {
    const slashDates = text.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g);
    if (slashDates && slashDates.length >= 2) {
      const parseSlash = (str: string) => {
        const parts = str.split(/[\/\-]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parts[2] ? (parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10)) : baseDate.getFullYear();
        return formatDateIso(new Date(year, month, day));
      };
      checkIn = parseSlash(slashDates[0]);
      checkOut = parseSlash(slashDates[1]);
    }
  }

  // 4c. Check for Spanish patterns like "del 20 al 22 de noviembre" or "del 20 al 22" or "20 al 22"
  if (!checkIn) {
    const rangeMatch = combinedText.match(/(?:del\s+)?(\d{1,2})\s+al\s+(\d{1,2})(?:\s+de\s+([a-záéíóú]+))?(?:\s+(?:de\s+)?(\d{4}))?/i);
    if (rangeMatch) {
      const dayStart = parseInt(rangeMatch[1], 10);
      const dayEnd = parseInt(rangeMatch[2], 10);
      const monthName = rangeMatch[3] ? rangeMatch[3].toLowerCase() : null;
      const yearGiven = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : null;

      let monthIndex = baseDate.getMonth();
      if (monthName && MONTHS[monthName] !== undefined) {
        monthIndex = MONTHS[monthName];
      }

      let year = yearGiven || baseDate.getFullYear();
      const dIn = new Date(year, monthIndex, dayStart);
      const dOut = new Date(year, monthIndex, dayEnd);

      if (dOut > dIn) {
        checkIn = formatDateIso(dIn);
        checkOut = formatDateIso(dOut);
      }
    }
  }

  // 4d. Relative dates like "para mañana", "para hoy", "el viernes"
  if (!checkIn) {
    if (combinedText.includes('para mañana') || combinedText.includes('a partir de mañana')) {
      const tomorrow = new Date(baseDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      checkIn = formatDateIso(tomorrow);
      // checkOut is not specified unless nights mentioned
      const nightsMatch = combinedText.match(/(\d+)\s+noches?/i);
      if (nightsMatch) {
        const nights = parseInt(nightsMatch[1], 10);
        const outDate = new Date(tomorrow);
        outDate.setDate(outDate.getDate() + nights);
        checkOut = formatDateIso(outDate);
      }
    } else if (combinedText.includes('para hoy') || combinedText.includes('esta noche')) {
      checkIn = formatDateIso(baseDate);
      const nightsMatch = combinedText.match(/(\d+)\s+noches?/i);
      if (nightsMatch) {
        const nights = parseInt(nightsMatch[1], 10);
        const outDate = new Date(baseDate);
        outDate.setDate(outDate.getDate() + nights);
        checkOut = formatDateIso(outDate);
      }
    } else if (combinedText.includes('el viernes') || combinedText.includes('este viernes')) {
      // Find upcoming Friday
      const currentDay = baseDate.getDay();
      const daysUntilFriday = (5 - currentDay + 7) % 7 || 7;
      const nextFriday = new Date(baseDate);
      nextFriday.setDate(nextFriday.getDate() + daysUntilFriday);
      checkIn = formatDateIso(nextFriday);
      // checkOut not specified unless mentioned
      const nightsMatch = combinedText.match(/(\d+)\s+noches?/i);
      if (nightsMatch) {
        const nights = parseInt(nightsMatch[1], 10);
        const outDate = new Date(nextFriday);
        outDate.setDate(outDate.getDate() + nights);
        checkOut = formatDateIso(outDate);
      }
    }
  }

  // Check indispensable data
  // If dates are completely missing
  if (!checkIn) {
    return {
      isAvailabilityIntent: true,
      checkIn: null,
      checkOut: null,
      guests,
      roomTypeName,
      missingField: 'dates',
      missingPrompt: '¿Para qué fecha sería la estadía?',
    };
  }

  // If checkIn exists but checkOut is missing
  if (checkIn && !checkOut) {
    return {
      isAvailabilityIntent: true,
      checkIn,
      checkOut: null,
      guests,
      roomTypeName,
      missingField: 'checkOut',
      missingPrompt: '¿Hasta qué fecha sería la estadía o cuántas noches te gustaría quedarte?',
    };
  }

  // If guests is missing
  if (!guests) {
    return {
      isAvailabilityIntent: true,
      checkIn,
      checkOut,
      guests: null,
      roomTypeName,
      missingField: 'guests',
      missingPrompt: '¿Para cuántas personas sería la estadía?',
    };
  }

  return {
    isAvailabilityIntent: true,
    checkIn,
    checkOut,
    guests,
    roomTypeName,
    missingField: null,
  };
}

/**
 * Executes real availability check using getAvailableRooms() from PostgreSQL.
 */
export async function handleChatAvailability(
  parsed: AvailabilityParseResult
): Promise<ChatAvailabilityResponse> {
  // If missing indispensable data, ask ONLY for the missing field
  if (parsed.missingField) {
    return {
      handled: true,
      reply: parsed.missingPrompt || '¿Para qué fecha sería la estadía?',
      available: false,
      availableOptions: [],
      availableRooms: [],
      reservationOffer: null,
      quickReplies: ['Para 2 personas', 'Para 3 personas', 'Ver fotos de habitaciones'],
    };
  }

  if (!parsed.checkIn || !parsed.checkOut || !parsed.guests) {
    return {
      handled: true,
      reply: '¿Para qué fecha sería la estadía?',
      available: false,
      availableOptions: [],
      availableRooms: [],
      reservationOffer: null,
      quickReplies: ['Consultar fechas', 'Para 2 personas'],
    };
  }

  // Resolve hotel from PostgreSQL
  const hotelsList = await getHotels();
  const hotel = hotelsList.find((h) => h.name === 'Hotel Bolluk') || hotelsList[0];
  if (!hotel) {
    throw new Error('No se encontró el hotel en la base de datos');
  }

  // Query REAL availability in PostgreSQL
  const checkInDate = new Date(`${parsed.checkIn}T14:00:00Z`);
  const checkOutDate = new Date(`${parsed.checkOut}T10:00:00Z`);

  let availableRooms = await getAvailableRooms(hotel.id, checkInDate, checkOutDate, parsed.guests);

  // If user requested a specific room type (e.g. Doble, Triple), filter by that type
  if (parsed.roomTypeName) {
    const reqType = parsed.roomTypeName.toLowerCase();
    availableRooms = availableRooms.filter((r) => r.roomType.name.toLowerCase().includes(reqType));
  }

  if (availableRooms.length === 0) {
    // 6. Si no hay disponibilidad: availableOptions: [] y responder "No tengo disponibilidad para esas fechas."
    return {
      handled: true,
      reply: 'No tengo disponibilidad para esas fechas.',
      available: false,
      availableOptions: [],
      availableRooms: [],
      reservationOffer: null,
      quickReplies: ['Consultar otras fechas', 'Ver servicios del hotel', 'Hablar con recepción'],
    };
  }

  // Map structured options
  const structuredRooms: AvailableOption[] = availableRooms.map((r) => ({
    roomTypeId: r.roomTypeId,
    roomTypeName: r.roomType.name,
    roomId: r.id,
    roomNumber: r.number,
    capacity: r.roomType.capacity,
    baseRate: Number(r.roomType.baseRate),
  }));

  // 4. Ordenar opciones por: tipo de habitación, luego precio/baseRate ascendente
  structuredRooms.sort((a, b) => {
    const typeCompare = a.roomTypeName.localeCompare(b.roomTypeName);
    if (typeCompare !== 0) return typeCompare;
    return a.baseRate - b.baseRate;
  });

  // 3. Limitar la respuesta inicialmente a máximo 3 opciones
  const availableOptions = structuredRooms.slice(0, 3);

  const firstRoom = availableRooms[0];
  const diffDays = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
  const pricePerNight = Number(firstRoom.roomType.baseRate);

  const reservationOffer = {
    detected: true,
    roomType: firstRoom.roomType.name.toLowerCase().includes('triple') ? 'Triple' : 'Doble',
    guests: parsed.guests,
    checkIn: parsed.checkIn,
    checkOut: parsed.checkOut,
    nights: diffDays,
    pricePerNight,
    totalPrice: diffDays * pricePerNight,
    currency: 'US$',
    readyForPayment: false, // Step 9A & 9B: No crear todavía la reserva desde el chat
  };

  // 5. El texto de Bollukito debe ser breve: "Sí, tengo estas opciones disponibles para esas fechas:"
  return {
    handled: true,
    reply: 'Sí, tengo estas opciones disponibles para esas fechas:',
    available: true,
    checkIn: parsed.checkIn,
    checkOut: parsed.checkOut,
    guests: parsed.guests,
    availableOptions,
    availableRooms: availableOptions,
    reservationOffer,
    quickReplies: ['Quiero reservar', 'Ver tarifas detalladas', 'Consultar otras fechas'],
  };
}
