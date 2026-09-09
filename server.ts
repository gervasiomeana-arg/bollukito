import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ limit: '60mb', extended: true }));

// In-memory store for demo & reservations
interface ReservationRecord {
  id: string;
  bookingId: string;
  guestName: string;
  guestDoc: string;
  guestPhone: string;
  roomType: 'Doble' | 'Triple';
  guests: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  currency: string;
  paymentRef: string;
  paymentMethod: string;
  paidAt: string;
  loadedInHotelSystem: boolean;
  loadedAt?: string;
  receptionistNotified: boolean;
}

const reservations: ReservationRecord[] = [
  {
    id: 'res-1',
    bookingId: 'BOL-8491',
    guestName: 'Mariana Gomez',
    guestDoc: '38.921.402',
    guestPhone: '+54 9 11 4402-9912',
    roomType: 'Doble',
    guests: 2,
    checkIn: '2026-09-12',
    checkOut: '2026-09-14',
    nights: 2,
    totalPrice: 86,
    currency: 'US$',
    paymentRef: 'MP-9812401',
    paymentMethod: 'Mercado Pago (Tarjeta de Crédito)',
    paidAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    loadedInHotelSystem: true,
    loadedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    receptionistNotified: true,
  },
  {
    id: 'res-2',
    bookingId: 'BOL-8492',
    guestName: 'Roberto Fernandez',
    guestDoc: '29.310.884',
    guestPhone: '+54 9 223 512-8841',
    roomType: 'Triple',
    guests: 3,
    checkIn: '2026-09-18',
    checkOut: '2026-09-21',
    nights: 3,
    totalPrice: 186,
    currency: 'US$',
    paymentRef: 'MP-9812550',
    paymentMethod: 'Mercado Pago (Débito)',
    paidAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    loadedInHotelSystem: false,
    receptionistNotified: true,
  },
];

// Lazy Gemini AI initialization
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hotel: 'Hotel Bolluk', mascot: 'Bollukito' });
});

// API Get Reservations
app.get('/api/reservations', (req, res) => {
  res.json(reservations);
});

// API Create Confirmed Reservation
app.post('/api/reservations', (req, res) => {
  const data = req.body;
  const newReservation: ReservationRecord = {
    id: `res-${Date.now()}`,
    bookingId: data.bookingId || `BOL-${Math.floor(1000 + Math.random() * 9000)}`,
    guestName: data.guestName || 'Huésped Hotel Bolluk',
    guestDoc: data.guestDoc || 'S/D',
    guestPhone: data.guestPhone || '+54 9 11 0000-0000',
    roomType: data.roomType || 'Doble',
    guests: Number(data.guests) || 2,
    checkIn: data.checkIn || new Date().toISOString().split('T')[0],
    checkOut: data.checkOut || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    nights: Number(data.nights) || 2,
    totalPrice: Number(data.totalPrice) || 86,
    currency: data.currency || 'US$',
    paymentRef: data.paymentRef || `MP-${Math.floor(1000000 + Math.random() * 9000000)}`,
    paymentMethod: data.paymentMethod || 'Mercado Pago (Tarjeta)',
    paidAt: new Date().toISOString(),
    loadedInHotelSystem: false,
    receptionistNotified: true,
  };

  reservations.unshift(newReservation);
  res.status(201).json(newReservation);
});

// API Update Reservation (mark loaded in hotel system)
app.patch('/api/reservations/:id', (req, res) => {
  const { id } = req.params;
  const { loadedInHotelSystem } = req.body;
  const reservation = reservations.find((r) => r.id === id || r.bookingId === id);

  if (!reservation) {
    return res.status(404).json({ error: 'Reserva no encontrada' });
  }

  if (typeof loadedInHotelSystem === 'boolean') {
    reservation.loadedInHotelSystem = loadedInHotelSystem;
    if (loadedInHotelSystem) {
      reservation.loadedAt = new Date().toISOString();
    } else {
      delete reservation.loadedAt;
    }
  }

  res.json(reservation);
});

// API Chat with Bollukito
app.post('/api/chat', async (req, res) => {
  const { message, history = [], hotelConfig } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mensaje vacío' });
  }

  const hotel = hotelConfig || {
    hotelName: 'Hotel Bolluk',
    mascotName: 'Bollukito',
    doubleRoomPrice: 43,
    tripleRoomPrice: 62,
    checkInTime: '14:00',
    checkOutTime: '10:00',
    breakfastHours: '07:30 a 10:30',
    receptionistPhone: '+54 9 11 4055-7788',
  };

  const kbText = Array.isArray(hotel.knowledgeBase) && hotel.knowledgeBase.length > 0
    ? `\nBASE DE CONOCIMIENTO Y RESPUESTAS EDUCADAS POR HOTEL BOLLUK:\n` +
      hotel.knowledgeBase.map((item: any) => `• TEMA/PREGUNTA: ${item.topic}\n  RESPUESTA OFICIAL DEL HOTEL: ${item.answer}`).join('\n') +
      `\nUtiliza siempre estas respuestas oficiales cuando el cliente pregunte sobre estos temas.\n`
    : '';

  // Format conversational context
  const systemPrompt = `Eres Bollukito 🐾🛎️, la mascota oficial y conserje virtual de ${hotel.hotelName}.
Eres un adorable y carismático Bulldog Francés vaquita (blanco con manchas negras), con una elegante gorrita bordó de botones, chalequito con botones dorados y una llave dorada de recepción.

Tu personalidad:
- Hablas en español de forma muy cálida, amable, hospitalaria y amigable (con emojis simpáticos como 🐾, 🛎️, 🛏️, ✨).
- Eres servicial y rápido.
- Tu misión principal es responder dudas de los huéspedes y guiarlos paso a paso para reservar su estadía en ${hotel.hotelName} SIN intervención humana.

Información oficial de ${hotel.hotelName}:
- Habitaciones disponibles:
  * Habitación Doble: US$ ${hotel.doubleRoomPrice}/noche (sommier matrimonial o 2 individuales, baño privado, TV LED, aire acondicionado frío/calor, wifi de alta velocidad, desayuno buffet incluido).
  * Habitación Triple: US$ ${hotel.tripleRoomPrice}/noche (cama matrimonial + cama individual, baño privado, aire acondicionado, frigobar, wifi, desayuno buffet incluido).
- Servicios: Desayuno buffet (${hotel.breakfastHours}), cochera/estacionamiento privado techado gratuito, wifi libre en todo el hotel, ¡somos 100% Pet-Friendly! (a Bollukito le encantan los amiguitos de 4 patas).
- Horarios: Check-in a partir de las ${hotel.checkInTime} hs. Check-out hasta las ${hotel.checkOutTime} hs.
- Forma de pago: Link de pago seguro inmediato (Mercado Pago o Tarjeta de crédito/débito).
${kbText}
Pautas de interacción:
1. Si el cliente saluda o pregunta en general, salúdalo con alegría presentándote como Bollukito y pregúntale para qué fechas o cuántas personas está planeando el viaje.
2. Si el cliente menciona fechas y/o cantidad de personas, calcula la cantidad de noches, recomienda la habitación correcta (Doble para 1-2 personas, Triple para 3 personas), calcula el monto total en US$ y pregúntale amablemente si desea avanzar con la reserva.
3. Si el cliente quiere reservar o te da sus datos, pídele amablemente: Nombre y apellido, DNI/Pasaporte y teléfono.
4. IMPORTANTE: Cuando el cliente ya ha indicado fechas o personas y está listo para reservar, o pide precio final, genera en tu respuesta de forma explícita el desglose para que pueda pagar.

FORMATO DE RESPUESTA:
Debes responder SIEMPRE en formato JSON válido con esta estructura:
{
  "reply": "Tu mensaje conversacional como Bollukito con tono amigable y emojis",
  "reservationOffer": {
    "detected": true o false,
    "roomType": "Doble" o "Triple",
    "guests": numero,
    "checkIn": "YYYY-MM-DD",
    "checkOut": "YYYY-MM-DD",
    "nights": numero,
    "pricePerNight": numero,
    "totalPrice": numero,
    "currency": "US$",
    "readyForPayment": true o false
  },
  "quickReplies": ["Ver fotos de habitaciones", "Consultar fechas", "¿Tienen cochera?", "Quiero reservar"]
}
Si aún no hay fechas o intención de reserva específica, pon "detected": false en reservationOffer.`;

  try {
    const ai = getAIClient();

    if (ai) {
      // Build conversation contents
      const contents = history.map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.text === 'string' ? msg.text : '' }],
      }));

      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // Try resilient model cascade to bypass temporary 503 demand spikes
      const candidateModels = [
        'gemini-2.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];

      let responseText = '';
      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          });
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (modelErr: any) {
          // If model is busy or unavailable (503), try next model in cascade
          console.warn(`Model ${modelName} unavailable (${modelErr?.status || modelErr?.message || '503'}), trying alternative...`);
        }
      }

      if (responseText) {
        try {
          const parsed = JSON.parse(responseText);
          return res.json({
            reply: parsed.reply,
            reservationOffer: parsed.reservationOffer?.detected ? parsed.reservationOffer : null,
            quickReplies: parsed.quickReplies || [],
          });
        } catch (parseErr) {
          return res.json({
            reply: responseText,
            reservationOffer: null,
            quickReplies: ['Quiero una Doble', 'Quiero una Triple', '¿Tienen cochera?'],
          });
        }
      }
    }
  } catch (error: any) {
    console.warn('Recovering gracefully with intelligent hotel rules:', error?.message || error);
  }

  // Smart fallback when Gemini API key is missing or offline
  const lowerMsg = message.toLowerCase();
  let reply = '';
  let offer: any = null;
  let quickReplies = ['Habitación Doble', 'Habitación Triple', '¿Tienen cochera?', 'Horarios de Check-in'];

  // Check if any knowledgeBase topic matches the user's question
  if (Array.isArray(hotel.knowledgeBase) && !reply) {
    for (const kbItem of hotel.knowledgeBase) {
      if (!kbItem.topic || !kbItem.answer) continue;
      const topicLower = kbItem.topic.toLowerCase();
      // Match keywords
      const keywords = topicLower
        .replace(/[¿?¡!(),.-]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 3 && !['como', 'para', 'este', 'esta', 'tienen', 'tienes', 'hotel'].includes(w));
      
      const hasMatch = keywords.some((kw: string) => lowerMsg.includes(kw));
      if (hasMatch) {
        reply = `¡Guau! Con gusto te cuento: ${kbItem.answer} 🐾🛎️ ¿Te gustaría consultar disponibilidad de habitaciones o fechas?`;
        quickReplies = ['Consultar Habitación Doble', 'Consultar Habitación Triple', '¿Cómo reservar?'];
        break;
      }
    }
  }

  if (!reply) {
    if (lowerMsg.includes('hola') || lowerMsg.includes('buenas') || lowerMsg.includes('buen dia') || lowerMsg.includes('buenas tardes')) {
      reply = `¡Hola! 🐾🛎️ ¡Guau! Soy **Bollukito**, el anfitrión de cuatro patas de **${hotel.hotelName}**. Qué alegría que nos escribas. Estoy listo para ayudarte a encontrar la habitación perfecta. ¿En qué fechas estás planeando visitarnos y para cuántas personas?`;
      quickReplies = ['Para 2 personas', 'Para 3 personas (familia)', '¿Tienen cochera?'];
    } else if (lowerMsg.includes('cochera') || lowerMsg.includes('estacionamiento') || lowerMsg.includes('auto')) {
      reply = `¡Sí, por supuesto! 🚗✨ En **${hotel.hotelName}** contamos con estacionamiento privado y techado gratuito para todos nuestros huéspedes con vigilancia. ¿Para qué fechas querés venir con tu vehículo?`;
      quickReplies = ['Este fin de semana', 'Ver tarifas', 'Para 2 personas'];
    } else if (lowerMsg.includes('desayuno') || lowerMsg.includes('comida')) {
      reply = `¡Mmm, qué rico! ☕🥐 Nuestro desayuno buffet está incluido en todas las tarifas y se sirve de ${hotel.breakfastHours} hs. Incluye medialunas, café en grano, jugos naturales, frutas y opciones para celíacos. ¿Te gustaría consultar disponibilidad?`;
    } else if (lowerMsg.includes('mascota') || lowerMsg.includes('perro') || lowerMsg.includes('gato') || lowerMsg.includes('pet')) {
      reply = `¡Siii! 🐾❤️ En **${hotel.hotelName}** somos 100% Pet-Friendly. Como yo soy un perrito, ¡acá recibimos a todos los amiguitos peludos con los brazos y las patitas abiertas! No tiene costo adicional. ¿Cuántos vienen?`;
    } else if (lowerMsg.includes('3 personas') || lowerMsg.includes('triple') || lowerMsg.includes('hijo') || lowerMsg.includes('familia')) {
      const nights = 2;
      const total = nights * hotel.tripleRoomPrice;
      reply = `¡Genial! 🛏️ Para 3 personas te recomiendo nuestra **Habitación Triple** (cama matrimonial + cama individual, aire acondicionado, baño privado y frigobar). La tarifa es de US$ ${hotel.tripleRoomPrice} por noche con desayuno incluido. Por 2 noches serían US$ ${total}. ¿Te gustaría reservarla ahora?`;
      offer = {
        detected: true,
        roomType: 'Triple',
        guests: 3,
        checkIn: '2026-09-12',
        checkOut: '2026-09-14',
        nights: 2,
        pricePerNight: hotel.tripleRoomPrice,
        totalPrice: total,
        currency: 'US$',
        readyForPayment: true,
      };
      quickReplies = ['Quiero reservarla', '¿Aceptan tarjetas?', 'Cambiar fechas'];
    } else if (lowerMsg.includes('2 personas') || lowerMsg.includes('doble') || lowerMsg.includes('pareja') || lowerMsg.includes('precio') || lowerMsg.includes('tarifa')) {
      const nights = 2;
      const total = nights * hotel.doubleRoomPrice;
      reply = `¡Excelente elección! 💑🏨 Para 2 personas tenemos nuestra **Habitación Doble** (sommier matrimonial, baño privado, aire acondicionado y TV). La tarifa es de US$ ${hotel.doubleRoomPrice} por noche con desayuno buffet incluido. Por 2 noches el total es US$ ${total}. ¿Querés que te prepare el link de pago para asegurarla?`;
      offer = {
        detected: true,
        roomType: 'Doble',
        guests: 2,
        checkIn: '2026-09-12',
        checkOut: '2026-09-14',
        nights: 2,
        pricePerNight: hotel.doubleRoomPrice,
        totalPrice: total,
        currency: 'US$',
        readyForPayment: true,
      };
      quickReplies = ['¡Sí, quiero reservar!', '¿Cómo es el pago?', 'Habitación Triple'];
    } else if (lowerMsg.includes('reservar') || lowerMsg.includes('pagar') || lowerMsg.includes('link') || lowerMsg.includes('tarjeta') || lowerMsg.includes('si')) {
      reply = `¡Maravilloso! 🎉 Te genero aquí mismo tu tarjeta de pre-reserva con el botón de pago seguro de Mercado Pago. Al completar el pago, tu habitación queda bloqueada al instante y el recepcionista recibe la confirmación con tus datos. ¡Te esperamos con las patitas abiertas! 🐾`;
      offer = {
        detected: true,
        roomType: 'Doble',
        guests: 2,
        checkIn: '2026-09-12',
        checkOut: '2026-09-14',
        nights: 2,
        pricePerNight: hotel.doubleRoomPrice,
        totalPrice: hotel.doubleRoomPrice * 2,
        currency: 'US$',
        readyForPayment: true,
      };
      quickReplies = ['Pagar ahora', '¿Dónde queda el hotel?'];
    } else {
      reply = `¡Entendido! 🐾 Como anfitrión de **${hotel.hotelName}**, puedo darte tarifas de nuestras Habitaciones Dobles (US$ ${hotel.doubleRoomPrice}/n) y Triples (US$ ${hotel.tripleRoomPrice}/n), horarios, fotos y generarte el enlace de reserva directa al instante. ¿Qué fechas tenés en mente?`;
    }
  }

  res.json({
    reply,
    reservationOffer: offer,
    quickReplies,
  });
});

// Ensure permanent video persistence across restarts
const videoPaths = [
  path.join(process.cwd(), 'storage', 'luma_walking_video.mp4'),
  path.join(process.cwd(), 'public', 'luma_walking_video.mp4'),
  path.join(process.cwd(), 'src', 'assets', 'luma_walking_video.mp4'),
  path.join(process.cwd(), 'dist', 'luma_walking_video.mp4'),
];

// Restore video if any replica is missing
try {
  const existingMaster = videoPaths.find((p) => fs.existsSync(p));
  if (existingMaster) {
    for (const targetPath of videoPaths) {
      if (!fs.existsSync(targetPath)) {
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(existingMaster, targetPath);
      }
    }
  }
} catch (err) {
  console.warn('Video replication check error:', err);
}

// Check status of saved video
app.get('/api/video-status', (req, res) => {
  const foundPath = videoPaths.find((p) => fs.existsSync(p));
  if (foundPath) {
    const stats = fs.statSync(foundPath);
    return res.json({
      exists: true,
      url: '/luma_walking_video.mp4',
      size: stats.size,
      updatedAt: stats.mtime,
    });
  }
  return res.json({ exists: false });
});

// Upload video file (Base64) for custom Luma animation
app.post('/api/upload-video', (req, res) => {
  try {
    const { videoBase64 } = req.body;
    if (!videoBase64) {
      return res.status(400).json({ error: 'No video provided' });
    }
    const cleanBase64 = videoBase64.replace(/^data:video\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Save to all redundant persistence locations
    for (const targetPath of videoPaths) {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetPath, buffer);
    }

    res.json({ success: true, url: '/luma_walking_video.mp4' });
  } catch (error) {
    console.error('Error saving video:', error);
    res.status(500).json({ error: 'Failed to save video file' });
  }
});

// Serve uploaded video reliably in both dev and production
app.get('/luma_walking_video.mp4', (req, res) => {
  const foundPath = videoPaths.find((p) => fs.existsSync(p));
  if (foundPath) {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.sendFile(foundPath);
  }
  res.status(404).send('Video not found');
});

// Meta WhatsApp Webhook Endpoint (For future live connection)
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'hotel_bolluk_token')) {
    console.log('WhatsApp Webhook verified successfully!');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Start server with Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
