import { pgTable, uuid, text, timestamp, integer, decimal, boolean, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const hotels = pgTable('hotels', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  address: text('address'),
  timezone: text('timezone').default('America/Argentina/Buenos_Aires'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const roomTypes = pgTable('room_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  hotelId: uuid('hotel_id')
    .notNull()
    .references(() => hotels.id),
  name: text('name').notNull(),
  description: text('description'),
  capacity: integer('capacity').notNull(),
  baseRate: decimal('base_rate', { precision: 10, scale: 2 }).notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED' | 'MAINTENANCE';

export const rooms = pgTable('rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  hotelId: uuid('hotel_id')
    .notNull()
    .references(() => hotels.id),
  roomTypeId: uuid('room_type_id')
    .notNull()
    .references(() => roomTypes.id),
  number: text('number').notNull(),
  status: text('status').$type<RoomStatus>().default('AVAILABLE').notNull(),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: uuid('hotel_id')
      .notNull()
      .references(() => hotels.id),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    document: text('document'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('customers_hotel_id_phone_unique').on(t.hotelId, t.phone),
  ]
);

export type ReservationStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';

export type PaymentStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  reservationCode: text('reservation_code').notNull().unique(),
  hotelId: uuid('hotel_id')
    .notNull()
    .references(() => hotels.id),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  roomTypeId: uuid('room_type_id')
    .notNull()
    .references(() => roomTypes.id),
  roomId: uuid('room_id')
    .references(() => rooms.id),
  checkIn: timestamp('check_in').notNull(),
  checkOut: timestamp('check_out').notNull(),
  guests: integer('guests').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  depositAmount: decimal('deposit_amount', { precision: 10, scale: 2 }).default('0'),
  reservationStatus: text('reservation_status')
    .$type<ReservationStatus>()
    .notNull()
    .default('PENDING'),
  paymentStatus: text('payment_status')
    .$type<PaymentStatus>()
    .notNull()
    .default('NOT_REQUIRED'),
  source: text('source').default('DIRECT'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const reservationsRelations = relations(reservations, ({ one }) => ({
  hotel: one(hotels, {
    fields: [reservations.hotelId],
    references: [hotels.id],
  }),
  customer: one(customers, {
    fields: [reservations.customerId],
    references: [customers.id],
  }),
  roomType: one(roomTypes, {
    fields: [reservations.roomTypeId],
    references: [roomTypes.id],
  }),
  room: one(rooms, {
    fields: [reservations.roomId],
    references: [rooms.id],
  }),
}));

export const hotelConfig = pgTable(
  'hotel_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hotelId: uuid('hotel_id')
      .notNull()
      .references(() => hotels.id),
    checkInTime: text('check_in_time'),
    checkOutTime: text('check_out_time'),
    breakfastInfo: text('breakfast_info'),
    parkingInfo: text('parking_info'),
    petPolicy: text('pet_policy'),
    cancellationPolicy: text('cancellation_policy'),
    depositPolicy: text('deposit_policy'),
    services: text('services'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    unique('hotel_config_hotel_id_unique').on(t.hotelId),
  ]
);

export const hotelConfigRelations = relations(hotelConfig, ({ one }) => ({
  hotel: one(hotels, {
    fields: [hotelConfig.hotelId],
    references: [hotels.id],
  }),
}));

export type HotelConfig = typeof hotelConfig.$inferSelect;
export type NewHotelConfig = typeof hotelConfig.$inferInsert;

export type ConversationStatus =
  | 'BOT_ACTIVE'
  | 'WAITING_HUMAN'
  | 'HUMAN_ACTIVE'
  | 'BOT_RESUMED'
  | 'CLOSED';

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  hotelId: uuid('hotel_id')
    .notNull()
    .references(() => hotels.id),
  customerId: uuid('customer_id'),
  phoneNumber: text('phone_number').notNull(),
  channel: text('channel').notNull().default('WHATSAPP'),
  status: text('status')
    .$type<ConversationStatus>()
    .notNull()
    .default('BOT_ACTIVE'),
  assignedUserId: uuid('assigned_user_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const conversationsRelations = relations(conversations, ({ one }) => ({
  hotel: one(hotels, {
    fields: [conversations.hotelId],
    references: [hotels.id],
  }),
}));

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  senderType: text('sender_type').notNull(),
  content: text('content').notNull(),
  externalMessageId: text('external_message_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;



