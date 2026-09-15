import { and, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { customers } from './schema.ts';

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export async function createCustomer(data: NewCustomer): Promise<Customer> {
  const [created] = await db.insert(customers).values(data).returning();
  return created;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const [found] = await db.select().from(customers).where(eq(customers.id, id));
  return found || null;
}

export async function getCustomerByPhone(hotelId: string, phone: string): Promise<Customer | null>;
export async function getCustomerByPhone(phone: string): Promise<Customer | null>;
export async function getCustomerByPhone(arg1: string, arg2?: string): Promise<Customer | null> {
  if (arg2) {
    const hotelId = arg1;
    const phone = arg2;
    const [found] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.hotelId, hotelId), eq(customers.phone, phone)));
    return found || null;
  } else {
    const phone = arg1;
    const [found] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, phone));
    return found || null;
  }
}

export async function getCustomersByHotel(hotelId: string): Promise<Customer[]> {
  return db.select().from(customers).where(eq(customers.hotelId, hotelId));
}
