CREATE TABLE "trig_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"task_id" text NOT NULL,
	"niveau" text NOT NULL,
	"attempt_no" integer NOT NULL,
	"correct" boolean NOT NULL,
	"misconception_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"hint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trig_results" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"worksheet_id" text NOT NULL,
	"upload_id" text NOT NULL,
	"transcript_id" text,
	"task_id" text NOT NULL,
	"attempt_no" integer NOT NULL,
	"status" text NOT NULL,
	"misconception_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification" jsonb NOT NULL,
	"feedback_id" text,
	"feedback_source" text NOT NULL,
	"solution_viewed" boolean DEFAULT false NOT NULL,
	"solution_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trig_worksheets" (
	"id" text PRIMARY KEY NOT NULL,
	"learner_id" text NOT NULL,
	"lesson" integer NOT NULL,
	"niveau" text NOT NULL,
	"seed" text NOT NULL,
	"sheet_code" text NOT NULL,
	"task_ids" jsonb NOT NULL,
	"params" jsonb NOT NULL,
	"attempts" jsonb NOT NULL,
	"with_help" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trig_checks" ADD CONSTRAINT "trig_checks_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trig_results" ADD CONSTRAINT "trig_results_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trig_results" ADD CONSTRAINT "trig_results_worksheet_id_trig_worksheets_id_fk" FOREIGN KEY ("worksheet_id") REFERENCES "public"."trig_worksheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trig_results" ADD CONSTRAINT "trig_results_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trig_results" ADD CONSTRAINT "trig_results_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trig_results" ADD CONSTRAINT "trig_results_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trig_worksheets" ADD CONSTRAINT "trig_worksheets_learner_id_learners_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."learners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trig_checks_learner_idx" ON "trig_checks" USING btree ("learner_id","task_id");--> statement-breakpoint
CREATE INDEX "trig_results_learner_idx" ON "trig_results" USING btree ("learner_id","task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trig_results_sheet_task_idx" ON "trig_results" USING btree ("worksheet_id","task_id");--> statement-breakpoint
CREATE INDEX "trig_worksheets_learner_idx" ON "trig_worksheets" USING btree ("learner_id");