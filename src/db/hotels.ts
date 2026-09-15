import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { hotels } from './schema.ts';

export type Hotel = typeof hotels.$inferSelect;
export type NewHotel = typeof hotels.$inferInsert;

export async function createHotel(data: NewHotel): Promise<Hotel> {
  const [created] = await db.insert(hotels).values(data).returning();
  return created;
}

export async function getHotelById(id: string): Promise<Hotel | null> {
  const [found] = await db.select().from(hotels).where(eq(hotels.id, id));
  return found || null;
}

export async function getHotels(): Promise<Hotel[]> {
  return db.select().from(hotels);
}
