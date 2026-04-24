# Supabase workflow

This repo keeps backend changes in version control.

## One-time setup

1. Install Supabase CLI if needed.
2. Link this repo to your project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

3. Make sure your migration file lives in:

```text
supabase/migrations/
```

## Everyday workflow

When schema changes:

1. Create or edit a migration file in `supabase/migrations/`.
2. Push it:

```bash
npm run db:push
```

If you want to reset local dev data:

```bash
npm run db:reset
```

## First admin user

After creating a user in Supabase Auth, run a one-time insert for that user ID into `public.admin_users`.
This is only needed once per first admin account.

## Admin management edge function

The `Invite new admin` and `Remove` actions use the `admin-actions` Edge Function.

Before those actions work in a deployed environment, set the function secrets and deploy it:

```bash
supabase secrets set \
  SUPABASE_URL=YOUR_SUPABASE_URL \
  SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
  ADMIN_APP_URL=https://admin.mindbloom-wellness.com

supabase functions deploy admin-actions --project-ref YOUR_PROJECT_REF
```

If the admin page shows `Failed to send a request to the Edge Function`, the function is usually not deployed yet or the secrets are missing.

The invite email should redirect to the admin app root so the new admin lands on the overview page and sees the password setup reminder. If you change the admin domain, update `ADMIN_APP_URL` and add the matching redirect URL in Supabase Auth settings.

## Seed content

The current blog articles are stored in `supabase/migrations/20260420001000_seed_blog_posts.sql`.
The current psychologist profiles are stored in `supabase/migrations/20260422000000_seed_psychologists.sql`.

After linking the project, run:

```bash
npm run db:push
```

That migration will create the starter blog rows in Supabase so they show up in the admin web and can be edited there.
The psychologist seed does the same for the `นักจิตวิทยา` section.
