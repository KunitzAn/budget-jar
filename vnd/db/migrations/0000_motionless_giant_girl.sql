CREATE TABLE "vnd_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vnd_exchanges" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"rub" bigint NOT NULL,
	"vnd" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vnd_expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"vnd" bigint NOT NULL,
	"category_id" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"server_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vnd_login_code_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vnd_login_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vnd_login_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "vnd_passkeys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vnd_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vnd_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "vnd_categories" ADD CONSTRAINT "vnd_categories_user_id_vnd_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."vnd_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vnd_exchanges" ADD CONSTRAINT "vnd_exchanges_user_id_vnd_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."vnd_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vnd_expenses" ADD CONSTRAINT "vnd_expenses_user_id_vnd_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."vnd_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vnd_login_codes" ADD CONSTRAINT "vnd_login_codes_user_id_vnd_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."vnd_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vnd_passkeys" ADD CONSTRAINT "vnd_passkeys_user_id_vnd_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."vnd_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vnd_categories_user_sync_idx" ON "vnd_categories" USING btree ("user_id","server_updated_at");--> statement-breakpoint
CREATE INDEX "vnd_exchanges_user_sync_idx" ON "vnd_exchanges" USING btree ("user_id","server_updated_at");--> statement-breakpoint
CREATE INDEX "vnd_expenses_user_sync_idx" ON "vnd_expenses" USING btree ("user_id","server_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vnd_login_codes_hash_uidx" ON "vnd_login_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "vnd_passkeys_user_idx" ON "vnd_passkeys" USING btree ("user_id");