CREATE TYPE "public"."global_role" AS ENUM('owner', 'admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."repo_permission" AS ENUM('read', 'write');--> statement-breakpoint
CREATE TABLE "global_roles" (
	"user_id" uuid NOT NULL,
	"role" "global_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "global_roles_user_id_pk" PRIMARY KEY("user_id")
);
--> statement-breakpoint
CREATE TABLE "repo_permissions" (
	"repo_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission" "repo_permission" NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "repo_permissions_repo_id_user_id_pk" PRIMARY KEY("repo_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"github_full_name" text NOT NULL,
	"github_owner" text NOT NULL,
	"github_name" text NOT NULL,
	"default_branch" text NOT NULL,
	"storage_path" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"github_user_id" text NOT NULL,
	"login" text NOT NULL,
	"avatar_url" text,
	"access_token_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "global_roles" ADD CONSTRAINT "global_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_permissions" ADD CONSTRAINT "repo_permissions_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_permissions" ADD CONSTRAINT "repo_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_permissions" ADD CONSTRAINT "repo_permissions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repos" ADD CONSTRAINT "repos_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "repos_slug_unique" ON "repos" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_github_full_name_unique" ON "repos" USING btree ("github_full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_storage_path_unique" ON "repos" USING btree ("storage_path");--> statement-breakpoint
CREATE UNIQUE INDEX "users_github_user_id_unique" ON "users" USING btree ("github_user_id");