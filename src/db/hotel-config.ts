import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { hotelConfig } from './schema.ts';

export type HotelConfig = typeof hotelConfig.$inferSelect;
export type NewHotelConfig = typeof hotelConfig.$inferInsert;

export async function createHotelConfig(data: NewHotelConfig): Promise<HotelConfig> {
  const [created] = await db.insert(hotelConfig).values(data).returning();
  return created;
}

export async function getHotelConfigByHotel(hotelId: string): Promise<HotelConfig | null> {
  const [found] = await db.select().from(hotelConfig).where(eq(hotelConfig.hotelId, hotelId));
  return found || null;
}

export async function updateHotelConfig(
  hotelId: string,
  data: Partial<Omit<NewHotelConfig, 'id' | 'hotelId' | 'createdAt'>>
): Promise<HotelConfig | null> {
  const [updated] = await db
    .update(hotelConfig)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(hotelConfig.hotelId, hotelId))
    .returning();
  return updated || null;
}
