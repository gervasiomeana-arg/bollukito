CREATE TABLE "hotels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"timezone" text DEFAULT 'America/Argentina/Buenos_Aires',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
