-- Adds optional in-database raw-file storage for uploaded documents, so the
-- on-device (browser/Android) runtime can keep provenance without assuming a
-- filesystem exists. Purely additive: nullable column, existing rows
-- untouched, server-side disk storage (file_path) is unaffected.
ALTER TABLE document ADD COLUMN blob_data BLOB;
