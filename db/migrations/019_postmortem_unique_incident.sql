-- Migration 019: Add UNIQUE constraint to incident.postmortems(incident_id)
-- One postmortem per incident — enables ON CONFLICT upsert from the UI.

ALTER TABLE incident.postmortems
  ADD CONSTRAINT postmortems_incident_id_unique UNIQUE (incident_id);
