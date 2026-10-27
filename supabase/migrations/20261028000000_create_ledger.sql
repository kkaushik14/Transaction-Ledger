-- Creates the private accounts and transactions schema for the ledger API.
-- Balance/ledger atomicity and API immutability require the later service layer;
-- this migration defines persistence only and contains no business procedures.

-- Private ledger schema: do not expose it through Supabase Data API.
CREATE SCHEMA IF NOT EXISTS ledger;
REVOKE ALL ON SCHEMA ledger FROM PUBLIC;
REVOKE ALL ON SCHEMA ledger FROM anon, authenticated;

-- Accounts hold the cached current balance; every new account begins at zero.
CREATE TABLE ledger.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  balance NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT accounts_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT accounts_nonnegative_balance CHECK (balance >= 0)
);

-- A transaction row records one accepted credit or debit and remains immutable
-- through the HTTP API; the account/reference pair enforces deduplication.
CREATE TABLE ledger.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES ledger.accounts(id) ON DELETE RESTRICT,
  type TEXT NOT NULL,
  amount NUMERIC(20, 2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transactions_valid_type CHECK (type IN ('credit', 'debit')),
  CONSTRAINT transactions_positive_amount CHECK (amount > 0),
  CONSTRAINT transactions_description_length CHECK (char_length(description) <= 500),
  CONSTRAINT transactions_reference_not_blank CHECK (length(btrim(reference_id)) > 0),
  CONSTRAINT transactions_account_reference_unique UNIQUE (account_id, reference_id)
);

-- Supports account-specific history with deterministic latest-first ordering.
CREATE INDEX transactions_account_history_idx
  ON ledger.transactions (account_id, created_at DESC, id DESC);

-- Remove table grants as well as schema access, including grants inherited from
-- creator defaults. Only trusted backend PostgreSQL connections may access data.
REVOKE ALL ON TABLE ledger.accounts, ledger.transactions
  FROM PUBLIC, anon, authenticated;
