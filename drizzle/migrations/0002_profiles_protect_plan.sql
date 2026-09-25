REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT INSERT (id, email, email_reminders) ON public.profiles TO authenticated;
GRANT UPDATE (id, email, email_reminders) ON public.profiles TO authenticated;