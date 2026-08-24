# Deployment Guide

The frontend is a Vite React application deployed to Netlify. Supabase provides PostgreSQL, authentication, row-level security, and private file storage.

Required Netlify variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Apply SQL migrations in filename order before deploying matching frontend changes. Build with `npm run build` and publish `dist`.

Before production deployment, run `npm run validate`. Configure the same variables in GitHub Actions and the hosting provider; never commit `.env` files or SMTP/provider secrets. Supabase database backups must be enabled with the selected plan, and a restore drill should be recorded in `backup_verifications` after every material schema release.
