# MindBloom Admin Web

Admin web app for managing MindBloom public content.

## Stack

- React
- Vite
- TypeScript
- Supabase

## Local setup

1. Install dependencies.
2. Add `.env.local` with:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. Run `npm run dev`.

## Backend workflow

Use the files in `supabase/migrations/` as the source of truth for schema changes.

Recommended commands:

```bash
npm run db:push
npm run db:reset
```

## Next steps

- Supabase schema and RLS
- Admin authentication
- Blog and psychologist CRUD
