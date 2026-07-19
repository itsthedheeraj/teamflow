ALTER TABLE tasks ADD COLUMN latest_note TEXT;
ALTER TABLE tasks ADD COLUMN latest_note_updated_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN latest_note_by UUID REFERENCES users(id);
