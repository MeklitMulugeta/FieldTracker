-- 0001_extensions_and_types.sql
-- FieldTrack initial PostgreSQL extensions and sequence primitives.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Concurrency-safe sequence for collision-free FieldTrack report numbers
-- across simultaneous online submissions and offline synchronization batches.
CREATE SEQUENCE IF NOT EXISTS public.report_number_seq
  AS BIGINT
  INCREMENT BY 1
  MINVALUE 1
  START WITH 1
  CACHE 1;

COMMIT;
