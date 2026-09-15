CREATE TABLE "hotel_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hotel_id" uuid NOT NULL,
	"check_in_time" text,
	"check_out_time" text,
	"breakfast_info" text,
	"parking_info" text,
	"pet_policy" text,
	"cancellation_policy" text,
	"deposit_policy" text,
	"services" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hotel_config_hotel_id_unique" UNIQUE("hotel_id")
);
--> statement-breakpoint
ALTER TABLE "hotel_config" ADD CONSTRAINT "hotel_config_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;