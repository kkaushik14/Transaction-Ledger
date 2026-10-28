-- Adds transfer identity and linked debit/credit entries without changing existing ledger rows.
-- Apply after the initial migration; the API owns the one-transaction, two-account write boundary.
CREATE TABLE ledger.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
  destination_account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(20, 2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transfers_positive_amount CHECK (amount > 0),
  CONSTRAINT transfers_different_accounts CHECK (source_account_id <> destination_account_id),
  CONSTRAINT transfers_reference_not_blank CHECK (length(btrim(reference_id)) > 0),
  CONSTRAINT transfers_description_length CHECK (char_length(description) <= 500),
  CONSTRAINT transfers_source_reference_unique UNIQUE (source_account_id, reference_id)
);

-- Existing standalone entries remain unlinked. Restrict deleting a transfer referenced by history.
ALTER TABLE ledger.transactions
  ADD COLUMN transfer_id UUID REFERENCES ledger.transfers(id) ON DELETE RESTRICT;

-- At most one debit and one credit per transfer; the prefix also supports transfer-to-entry lookup.
-- Exactly two matching entries are guaranteed by the atomic service and integrity tests.
CREATE UNIQUE INDEX transactions_transfer_type_unique
  ON ledger.transactions (transfer_id, type) WHERE transfer_id IS NOT NULL;

-- Keep the new table private even when creator default privileges grant Data API roles access.
REVOKE ALL ON TABLE ledger.transfers FROM PUBLIC, anon, authenticated;
