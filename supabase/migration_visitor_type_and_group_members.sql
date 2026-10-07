-- Adds visitor categorization and structured group-member data to the
-- visitors table. Additive only - nothing existing is renamed or dropped,
-- so every current row, report, and email template keeps working exactly
-- as before until the app code that reads these new columns ships.
--
-- visitor_type: the visitor-facing category picked at check-in (Business
--   Visitor, Vendor / Contractor, Delivery / Service, Other - see
--   lib/visitorTypes.js; that option list has changed once since this
--   migration was written, most recently to these four options - the
--   column itself doesn't need to change when the option list does).
--   NOT the same thing as the existing `visit_type` column, which just
--   records the channel a visitor came through ("walkin" | "prereg" |
--   "gate"). No DB-level NOT NULL/CHECK constraint, same convention this
--   table already uses for `purpose` - required-ness is enforced in the
--   API routes instead, so older rows without a value don't break anything.
--
-- group_members: a JSON array of { name, phone } objects, used only for
--   "Business Visitor" group check-ins (the structured type - see
--   STRUCTURED_GROUP_VISITOR_TYPE in lib/visitorTypes.js), where every
--   member needs to be individually reachable. Every other visitor type
--   keeps using the existing additional_visitor_count /
--   additional_visitor_names columns unchanged.
alter table visitors add column if not exists visitor_type text;
alter table visitors add column if not exists group_members jsonb;

comment on column visitors.visitor_type is
  'Visitor-facing category picked at check-in. See lib/visitorTypes.js for the option list. Distinct from visit_type (walkin/prereg/gate).';
comment on column visitors.group_members is
  'JSON array of {name, phone} for structured group check-ins (currently only "Business Visitor"). Other visitor types use additional_visitor_count/additional_visitor_names instead.';
