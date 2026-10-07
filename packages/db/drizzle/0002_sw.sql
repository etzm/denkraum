CREATE TABLE "sw_mission_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"state" text NOT NULL,
	"data" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"stars" jsonb,
	"xp" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sw_mission_runs" ADD CONSTRAINT "sw_mission_runs_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sw_mission_runs_learner_idx" ON "sw_mission_runs" USING btree ("learner_id","mission_id");