drop policy if exists "Authenticated users can insert onboarding and dashboard audit logs"
on public.audit_logs;

create policy "Authenticated users can insert onboarding and dashboard audit logs"
on public.audit_logs
for insert
to authenticated
with check (
  auth.uid() is not null
  and user_id = auth.uid()
  and table_name in (
    'auth_sessions',
    'payment_validations',
    'onboarding_success',
    'dashboard_blocked_features',
    'pending_route_guard'
  )
  and action = 'INSERT'
);
