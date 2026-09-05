-- Phase 003: enable pgvector for Company Brain semantic retrieval.
-- Isolated in its own migration so a permission/availability issue with the
-- extension can be diagnosed independently of the table migration that
-- depends on it (0013_knowledge_and_decisions.sql).

create extension if not exists vector;
