-- Drop redundant related_appointment_id from transactions
-- The bidirectional link is already handled by appointments.transaction_id

alter table transactions drop column if exists related_appointment_id;
