# Convlyx

Plataforma de gestão para escolas de condução.

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **UI**: shadcn/ui + Tailwind CSS v4
- **API**: tRPC v11
- **Database**: Supabase (PostgreSQL) + Prisma ORM
- **Auth**: Supabase Auth
- **Calendar**: FullCalendar
- **i18n**: next-intl (pt-PT)
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/convlyx/convlyx.git
   cd convlyx
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Create a Supabase project at [supabase.com](https://supabase.com)

4. Copy the env file and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```

5. Push the database schema:
   ```bash
   pnpm db:push
   ```

6. Generate the Prisma client:
   ```bash
   pnpm db:generate
   ```

7. Seed the database with demo data:
   ```bash
   pnpm db:seed
   ```

8. Start the dev server:
   ```bash
   pnpm dev
   ```

9. Open [http://localhost:3000](http://localhost:3000)

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.pt | password123 |
| Secretary | secretaria@demo.pt | password123 |
| Instructor | instrutor@demo.pt | password123 |
| Student | aluno@demo.pt | password123 |

## Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm lint             # ESLint
pnpm type-check       # TypeScript check

# Database (dev)
pnpm db:push          # Push schema to dev database
pnpm db:generate      # Regenerate Prisma client
pnpm db:studio        # Open Prisma Studio
pnpm db:seed          # Seed dev with basic data
pnpm db:seed-demo     # Seed dev with comprehensive demo data

# Database (prod) — requires .env.prod
pnpm db:push:prod     # Push schema to production
pnpm db:seed:prod     # Seed prod with basic data
pnpm db:seed-demo:prod # Seed prod with demo data
```

## Production

### Deploy to Vercel

The app deploys automatically on push to `main`. Preview deployments are created for all other branches.

### Environment Variables (Vercel)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string (port 6543 for transaction mode) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key |
| `NEXT_PUBLIC_SITE_URL` | Production URL (https://convlyx.com) |
| `CRON_SECRET` | Secret for Vercel cron job authentication |

### Production Database Operations

1. Copy the env example and fill in your prod credentials:
   ```bash
   cp env.prod.example .env.prod
   ```

2. Push schema changes:
   ```bash
   pnpm db:push:prod
   ```

3. Seed production:
   ```bash
   pnpm db:seed:prod
   pnpm db:seed-demo:prod  # comprehensive demo data
   ```

## Architecture

See [docs/MVP_PLAN.md](docs/MVP_PLAN.md) for full architecture documentation.

See [docs/FEATURES.md](docs/FEATURES.md) for complete feature inventory.

See [CLAUDE.md](CLAUDE.md) for coding conventions and guidelines.

## Multi-Tenancy

- Each school gets its own subdomain: `escola.convlyx.com`
- Schools belong to tenant groups (invisible to end users)
- All data is isolated per tenant
- Subdomain validation on login and every API request
