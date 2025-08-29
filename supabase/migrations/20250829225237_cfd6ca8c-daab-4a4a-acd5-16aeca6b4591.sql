-- Create user roles table and functions for role-based access control
create table if not exists public.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role text not null,
  primary key (user_id, role)
);

-- Enable RLS on user_roles table
alter table public.user_roles enable row level security;

-- Create policy to allow users to view their own roles
create policy "Users can view own roles" on public.user_roles
  for select using (auth.uid() = user_id);

-- Create function to check if a user has a specific role
create or replace function public.has_role(uid uuid, r text)
returns boolean language sql stable as $$
  select exists(select 1 from public.user_roles where user_id = uid and role = r);
$$;

-- Create security definer function to grant roles by email (admin use)
create or replace function public.grant_role_by_email(p_email text, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = p_email;
  if uid is null then
    raise exception 'No user with email %', p_email;
  end if;
  insert into public.user_roles(user_id, role)
  values (uid, p_role)
  on conflict do nothing;
end;
$$;

-- Create function to check if any admin users exist (for bootstrap screen)
create or replace function public.has_admin_users()
returns boolean language sql stable as $$
  select exists(select 1 from public.user_roles where role = 'admin');
$$;