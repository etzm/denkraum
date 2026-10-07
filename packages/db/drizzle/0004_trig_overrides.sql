CREATE TABLE "trig_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"result_id" text NOT NULL,
	"viewer_id" text,
	"kind" text NOT NULL,
	"status" text,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trig_overrides" ADD CONSTRAINT "trig_overrides_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trig_overrides" ADD CONSTRAINT "trig_overrides_result_id_trig_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."trig_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trig_overrides" ADD CONSTRAINT "trig_overrides_viewer_id_viewers_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."viewers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trig_overrides_learner_idx" ON "trig_overrides" USING btree ("learner_id");--> statement-breakpoint
CREATE INDEX "trig_overrides_result_idx" ON "trig_overrides" USING btree ("result_id");