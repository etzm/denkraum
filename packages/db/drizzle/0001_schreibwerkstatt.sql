CREATE TABLE "sw_content_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"content_id" text NOT NULL,
	"approved_by_viewer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sw_exercise_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"station_id" text NOT NULL,
	"exercise_ids" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"passed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sw_ledger" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"kind" text NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"ref_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sw_mission_events" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"seq" integer NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"source" text NOT NULL,
	"prompt_name" text,
	"prompt_version" integer,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sw_mission_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"stufe" text NOT NULL,
	"niveau_e_enabled" boolean NOT NULL,
	"state" text NOT NULL,
	"boss_topic_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"writing_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sw_progress" (
	"learner_id" text PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"keys" integer DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"streak_last_day" text,
	"last_active_day" text,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"e_path_suggested_at" timestamp with time zone,
	"cosmetics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sw_unlocks" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"help_card_id" text NOT NULL,
	"keys_paid" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sw_content_approvals" ADD CONSTRAINT "sw_content_approvals_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sw_content_approvals" ADD CONSTRAINT "sw_content_approvals_approved_by_viewer_id_viewers_id_fk" FOREIGN KEY ("approved_by_viewer_id") REFERENCES "public"."viewers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sw_exercise_attempts" ADD CONSTRAINT "sw_exercise_attempts_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sw_ledger" ADD CONSTRAINT "sw_ledger_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sw_mission_events" ADD CONSTRAINT "sw_mission_events_run_id_sw_mission_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sw_mission_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sw_mission_runs" ADD CONSTRAINT "sw_mission_runs_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sw_progress" ADD CONSTRAINT "sw_progress_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sw_unlocks" ADD CONSTRAINT "sw_unlocks_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sw_content_approvals_group_content_idx" ON "sw_content_approvals" USING btree ("group_id","content_id");--> statement-breakpoint
CREATE INDEX "sw_exercise_attempts_learner_idx" ON "sw_exercise_attempts" USING btree ("learner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sw_ledger_once_idx" ON "sw_ledger" USING btree ("learner_id","kind","reason","ref_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sw_mission_events_run_seq_idx" ON "sw_mission_events" USING btree ("run_id","seq");--> statement-breakpoint
CREATE INDEX "sw_mission_runs_learner_idx" ON "sw_mission_runs" USING btree ("learner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sw_unlocks_learner_card_idx" ON "sw_unlocks" USING btree ("learner_id","help_card_id");