-- Update RLS policies to allow edge functions to write data
-- This allows the sync-games function to create jobs and upsert games

-- Allow authenticated requests to insert sync jobs (edge functions use anon key + auth header)
CREATE POLICY "Allow edge functions to create sync jobs" 
ON public.sync_jobs 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow edge functions to update sync jobs they created
CREATE POLICY "Allow edge functions to update sync jobs" 
ON public.sync_jobs 
FOR UPDATE 
TO authenticated
USING (true);

-- Allow edge functions to upsert games
CREATE POLICY "Allow edge functions to upsert games" 
ON public.games 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow edge functions to update games" 
ON public.games 
FOR UPDATE 
TO authenticated
USING (true);