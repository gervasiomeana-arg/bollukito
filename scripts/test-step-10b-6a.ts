import dotenv from 'dotenv';
dotenv.config();

import { getHotels } from '../src/db/hotels.ts';
import {
  createConversation,
  getConversationByPhone,
} from '../src/db/conversations.ts';
import {
  createMessage,
  getMessagesByConversation,
} from '../src/db/messages.ts';
import { createPool } from '../src/db/index.ts';

async function run() {
  try {
    console.log('--- TEST STEP 10B-6A: Conversations and Messages ---');

    // 1. Get Hotel Bolluk
    const hotelsList = await getHotels();
    const hotel = hotelsList.find((h) => h.name === 'Hotel Bolluk') || hotelsList[0];
    if (!hotel) {
      throw new Error('Hotel Bolluk not found in database');
    }
    console.log('HOTEL_NAME:', hotel.name, 'HOTEL_ID:', hotel.id);

    // 2. Create conversation
    const conversation = await createConversation({
      hotelId: hotel.id,
      phoneNumber: '2231111111',
      channel: 'WHATSAPP',
      status: 'BOT_ACTIVE',
    });
    console.log('CONVERSATION_CREATED_ID:', conversation.id);
    const convCreatedOk = Boolean(conversation && conversation.id);

    // 3. Read conversation by phone
    const readConversation = await getConversationByPhone(hotel.id, '2231111111');
    console.log('CONVERSATION_READ_BY_PHONE:', Boolean(readConversation));
    const convReadOk = Boolean(
      readConversation && readConversation.phoneNumber === '2231111111'
    );

    // 4. Create message
    const message = await createMessage({
      conversationId: conversation.id,
      senderType: 'CUSTOMER',
      content: 'Hola, quiero consultar disponibilidad',
    });
    console.log('MESSAGE_CREATED_ID:', message.id);
    const msgCreatedOk = Boolean(message && message.id);

    // 5. Read messages from PostgreSQL
    const messages = await getMessagesByConversation(conversation.id);
    console.log('MESSAGES_COUNT:', messages.length);
    const msgReadOk = messages.length > 0;

    // 6. Check content
    const foundMsg = messages.find((m) => m.id === message.id);
    const msgContentOk =
      foundMsg?.content === 'Hola, quiero consultar disponibilidad';
    console.log('MESSAGE_CONTENT_MATCH:', msgContentOk);

    console.log('--- RESULTS ---');
    console.log('CONVERSATION CREATED:', convCreatedOk ? 'SI' : 'NO');
    console.log('CONVERSATION READ BY PHONE:', convReadOk ? 'SI' : 'NO');
    console.log('MESSAGE CREATED:', msgCreatedOk ? 'SI' : 'NO');
    console.log('MESSAGE READ FROM POSTGRES:', msgReadOk ? 'SI' : 'NO');
    console.log('MESSAGE CONTENT OK:', msgContentOk ? 'SI' : 'NO');

    const pool = createPool();
    await pool.end();
  } catch (err) {
    console.error('TEST ERROR:', err);
    process.exit(1);
  }
}

run();
