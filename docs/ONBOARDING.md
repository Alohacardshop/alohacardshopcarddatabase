# TCG Database Service - Onboarding Guide

## Quick Start

### 1. Environment Setup
Copy `.env.example` to `.env` and configure your Supabase values:

```bash
# Frontend values (required)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Backend/Edge Functions (required for admin operations)
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Development bypass (optional, defaults to false)
VITE_BYPASS_ROLE_GUARD=false
```

### 2. Create Your First Admin User
1. Navigate to `/auth` and create an account
2. Go to `/admin/setup` - you'll see the bootstrap screen
3. Copy the SQL snippet (with your email pre-filled)
4. Run it in Supabase → SQL Editor
5. Refresh and access admin features

### 3. Grant Roles to Other Users
Use the SQL function to grant roles:
```sql
-- Grant admin role
select public.grant_role_by_email('user@example.com', 'admin');

-- Grant staff role  
select public.grant_role_by_email('user@example.com', 'staff');
```

## Development Features

### Role Guard Bypass
For local testing, you can bypass role checks:
```bash
VITE_BYPASS_ROLE_GUARD=true
```

**⚠️ CRITICAL: This must NEVER be enabled in production!**

### Debug Health Check
Visit `/debug/health` to verify:
- Supabase connection
- Authentication status
- Database connectivity

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Please sign in" | Not authenticated | Go to `/auth` and log in |
| "You don't have access" | Missing role | Ask admin to run `grant_role_by_email` |
| "Not authorized. You need admin." | API call failed - no admin role | Verify role was granted correctly |
| "Server error - missing env var" | Edge function missing `SUPABASE_SERVICE_ROLE_KEY` | Set service role key in environment |
| "supabaseKey is required" | Frontend missing Supabase config | Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |

## Troubleshooting

### Check Your Setup
1. Verify all environment variables are set
2. Test authentication at `/auth`
3. Check admin role assignment in Supabase dashboard
4. Review edge function logs for backend errors

### Development Workflow
1. Use bypass flag for local testing only
2. Always test with real roles before deployment
3. Monitor edge function logs for errors
4. Use `/debug/health` to verify connectivity

Need help? Check the troubleshooting documentation or review the common errors table above.