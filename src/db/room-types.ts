import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { roomTypes } from './schema.ts';

export type RoomType = typeof roomTypes.$inferSelect;
export type NewRoomType = typeof roomTypes.$inferInsert;

export async function createRoomType(data: NewRoomType): Promise<RoomType> {
  const [created] = await db.insert(roomTypes).values(data).returning();
  return created;
}

export async function getRoomTypeById(id: string): Promise<RoomType | null> {
  const [found] = await db.select().from(roomTypes).where(eq(roomTypes.id, id));
  return found || null;
}

export async function getRoomTypesByHotel(hotelId: string): Promise<RoomType[]> {
  return db.select().from(roomTypes).where(eq(roomTypes.hotelId, hotelId));
}

export async function updateRoomType(
  id: string,
  data: Partial<Omit<NewRoomType, 'id' | 'createdAt'>>
): Promise<RoomType | null> {
  const [updated] = await db
    .update(roomTypes)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(roomTypes.id, id))
    .returning();
  return updated || null;
}
