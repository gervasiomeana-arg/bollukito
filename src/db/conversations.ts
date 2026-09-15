import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  conversations,
  type Conversation,
  type ConversationStatus,
  type NewConversation,
} from './schema.ts';

export type { Conversation, ConversationStatus, NewConversation };

export interface CreateConversationInput {
  hotelId: string;
  phoneNumber: string;
  customerId?: string | null;
  channel?: string;
  status?: ConversationStatus;
  assignedUserId?: string | null;
}

export async function createConversation(
  data: CreateConversationInput | NewConversation
): Promise<Conversation> {
  const insertData: NewConversation = {
    hotelId: data.hotelId,
    phoneNumber: data.phoneNumber,
    customerId: data.customerId ?? null,
    channel: data.channel ?? 'WHATSAPP',
    status: (data.status as ConversationStatus) ?? 'BOT_ACTIVE',
    assignedUserId: data.assignedUserId ?? null,
  };

  const [created] = await db.insert(conversations).values(insertData).returning();
  return created;
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const [found] = await db.select().from(conversations).where(eq(conversations.id, id));
  return found || null;
}

export async function getConversationByPhone(
  hotelId: string,
  phoneNumber: string
): Promise<Conversation | null> {
  const [found] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.hotelId, hotelId),
        eq(conversations.phoneNumber, phoneNumber)
      )
    );
  return found || null;
}

export async function getConversationsByHotel(hotelId: string): Promise<Conversation[]> {
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.hotelId, hotelId))
    .orderBy(desc(conversations.updatedAt));
}

export async function updateConversationStatus(
  id: string,
  status: ConversationStatus
): Promise<Conversation | null> {
  const [updated] = await db
    .update(conversations)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, id))
    .returning();
  return updated || null;
}
