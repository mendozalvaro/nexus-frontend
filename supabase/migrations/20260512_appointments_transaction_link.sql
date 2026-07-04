-- Migration: Link appointments with POS transactions
-- Date: 2026-05-12
-- Purpose: Bidirectional relationship between appointments and transactions
--   1. appointments.transaction_id -> links to the transaction that paid for this appointment
--   2. appointments.source -> tracks how the appointment was created (manual, pos_checkout, client_booking)
--   3. transaction_items.appointment_id -> links a specific line item to its appointment

-- 1. Add transaction_id to appointments (bidirectional link)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;

-- 2. Add source enum for appointment origin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_source') THEN
    CREATE TYPE appointment_source AS ENUM ('manual', 'pos_checkout', 'client_booking');
  END IF;
END $$;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source appointment_source NOT NULL DEFAULT 'manual';

-- 3. Add appointment_id to transaction_items (line-item level link)
ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;

-- 4. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_appointments_transaction_id ON appointments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_appointments_source ON appointments(source);
CREATE INDEX IF NOT EXISTS idx_transaction_items_appointment_id ON transaction_items(appointment_id);

-- 5. Comment for documentation
COMMENT ON COLUMN appointments.transaction_id IS 'ID of the POS transaction that paid for this appointment. NULL if not yet paid or paid outside POS.';
COMMENT ON COLUMN appointments.source IS 'Origin of the appointment: manual (created in agenda module), pos_checkout (auto-created during POS sale), client_booking (created by client via portal).';
COMMENT ON COLUMN transaction_items.appointment_id IS 'ID of the appointment linked to this line item. NULL for products or services sold without scheduling.';
