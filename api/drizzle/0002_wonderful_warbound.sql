ALTER TABLE "installed_extensions" DROP CONSTRAINT "installed_extensions_repo_id_repos_id_fk";
--> statement-breakpoint
ALTER TABLE "installed_extensions" DROP CONSTRAINT "installed_extensions_repo_id_user_id_extension_id_pk";--> statement-breakpoint
ALTER TABLE "installed_extensions" ADD CONSTRAINT "installed_extensions_user_id_extension_id_pk" PRIMARY KEY("user_id","extension_id");--> statement-breakpoint
ALTER TABLE "installed_extensions" DROP COLUMN "repo_id";