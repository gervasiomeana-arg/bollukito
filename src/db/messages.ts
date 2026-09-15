import { asc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { messages, type Message, type NewMessage } from './schema.ts';

export type MessageSenderType = 'CUSTOMER' | 'BOT' | 'HUMAN' | 'SYSTEM';

export const ALLOWED_SENDER_TYPES: readonly MessageSenderType[] = [
  'CUSTOMER',
  'BOT',
  'HUMAN',
  'SYSTEM',
] as const;

export interface CreateMessageInput {
  conversationId: string;
  senderType: MessageSenderType;
  content: string;
  externalMessageId?: string | null;
}

export function isValidSenderType(type: unknown): type is MessageSenderType {
  return typeof type === 'string' && (ALLOWED_SENDER_TYPES as readonly string[]).includes(type);
}

export async function createMessage(data: CreateMessageInput): Promise<Message> {
  if (!isValidSenderType(data.senderType)) {
    throw new Error(
      `Invalid senderType: "${data.senderType}". Allowed values: CUSTOMER, BOT, HUMAN, SYSTEM`
    );
  }

  const insertData: NewMessage = {
    conversationId: data.conversationId,
    senderType: data.senderType,
    content: data.content,
    externalMessageId: data.externalMessageId ?? null,
  };

  const [created] = await db.insert(messages).values(insertData).returning();
  return created;
}

export async function getMessagesByConversation(conversationId: string): Promise<Message[]> {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

export type { Message, NewMessage };
