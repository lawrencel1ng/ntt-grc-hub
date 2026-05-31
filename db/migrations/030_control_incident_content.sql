-- Migration 030: Replace auto-seeded control descriptions and strip #N suffixes
-- from incident titles.

-- =============================================================================
-- Part 1: control.library — replace auto-seeded descriptions
-- =============================================================================

UPDATE control.library
SET description =
  title || '. ' ||
  CASE type
    WHEN 'technical' THEN
      'Technical control implemented at the infrastructure layer. Evidence is captured automatically by the Evidence Collector agent and mapped to relevant framework requirements. Automated monitoring alerts on deviation from the expected configuration baseline.'
    WHEN 'process' THEN
      'Process control executed by the accountable control owner at the defined frequency. Evidence artefacts are collected and retained to demonstrate operating effectiveness during internal and external audits.'
    WHEN 'admin' THEN
      'Administrative control governed through policy, procedure, and role accountability. Periodic review and attestation by the control owner confirms continued alignment with regulatory obligations and the board-approved control framework.'
    ELSE
      'Control implemented and monitored in line with board-approved risk appetite. Evidence captured to support internal audit, regulatory examination, and framework attestation.'
  END
WHERE description LIKE '%Auto-seeded%';

-- =============================================================================
-- Part 2: incident.incidents — strip trailing " #N" from seeded titles
-- =============================================================================

UPDATE incident.incidents
SET title = trim(regexp_replace(title, '\s*#\d+$', ''))
WHERE title ~ '#\d+$';
