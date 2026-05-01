CREATE TABLE "installed_extensions" (
	"repo_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"extension_id" text NOT NULL,
	"display_name" text NOT NULL,
	"themes_json" text NOT NULL,
	"icon_themes_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installed_extensions_repo_id_user_id_extension_id_pk" PRIMARY KEY("repo_id","user_id","extension_id")
);
--> statement-breakpoint
ALTER TABLE "installed_extensions" ADD CONSTRAINT "installed_extensions_repo_id_repos_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_extensions" ADD CONSTRAINT "installed_extensions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;