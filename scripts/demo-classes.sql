-- ═══════════════════════════════════════════════════════════════════════════
--  DEMO MOCK DATA — aulas (class_sessions) + inscrições (enrollments)
--  Tenant  576604ff-56c9-45d5-aebd-3d9e2a28b760
--  School  2dcc5c3c-86e6-4512-a7c5-20b6da377efa
--
--  Uses the instructors / students that ALREADY exist in that school —
--  no UUIDs to fill in. Anchored on CURRENT_DATE, so it is always
--  "around today" whenever you run it.
--
--  Run STEP 0 first (only if your students have no active course),
--  then STEP 1. Paste each step into the Supabase SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══ STEP 0 (optional) ═════════════════════════════════════════════════════
--  Students only see PRACTICAL classes matching their active StudentCourse
--  category, and see no classes at all without one. This gives every student
--  without a course an in-progress category B course. Skip if yours have one.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO student_courses
  (id, tenant_id, school_id, student_id, category, status, started_at, created_at, updated_at)
SELECT gen_random_uuid(), m.tenant_id, m.school_id, m.user_id,
       'B'::"LicenseCategory", 'IN_PROGRESS'::"CourseStatus",
       (now() AT TIME ZONE 'UTC') - interval '3 months',
       (now() AT TIME ZONE 'UTC') - interval '3 months',
       (now() AT TIME ZONE 'UTC')
FROM memberships m
WHERE m.tenant_id = '576604ff-56c9-45d5-aebd-3d9e2a28b760'::uuid
  AND m.school_id = '2dcc5c3c-86e6-4512-a7c5-20b6da377efa'::uuid
  AND m.role   = 'STUDENT'
  AND m.status = 'ACTIVE'
  AND NOT EXISTS (
        SELECT 1 FROM student_courses c
        WHERE c.student_id = m.user_id AND c.tenant_id = m.tenant_id
      );


-- ═══ STEP 1 — the classes ══════════════════════════════════════════════════
BEGIN;

-- ── 1a. Config (tune days_back / days_fwd here) ────────────────────────────
CREATE TEMP TABLE _cfg ON COMMIT DROP AS
SELECT s.tenant_id,
       s.id        AS school_id,
       s.time_zone,                 -- wall-clock times are converted through this
       28          AS days_back,    -- history depth
       21          AS days_fwd      -- future depth
FROM schools s
WHERE s.id        = '2dcc5c3c-86e6-4512-a7c5-20b6da377efa'::uuid
  AND s.tenant_id = '576604ff-56c9-45d5-aebd-3d9e2a28b760'::uuid;

-- ── 1b. Who already exists in that school ──────────────────────────────────
CREATE TEMP TABLE _instr ON COMMIT DROP AS
SELECT m.user_id,
       (row_number() OVER (ORDER BY m.created_at, m.user_id))::int - 1 AS idx,
       (count(*)     OVER ())::int                                     AS n
FROM memberships m
JOIN _cfg c ON c.tenant_id = m.tenant_id AND c.school_id = m.school_id
WHERE m.role = 'INSTRUCTOR' AND m.status = 'ACTIVE';

CREATE TEMP TABLE _stud ON COMMIT DROP AS
SELECT m.user_id,
       COALESCE(sc.category, 'B'::"LicenseCategory")                   AS category,
       (row_number() OVER (ORDER BY m.created_at, m.user_id))::int - 1 AS idx,
       (count(*)     OVER ())::int                                     AS n
FROM memberships m
JOIN _cfg c ON c.tenant_id = m.tenant_id AND c.school_id = m.school_id
LEFT JOIN LATERAL (
    SELECT co.category
    FROM student_courses co
    WHERE co.student_id = m.user_id
      AND co.tenant_id  = m.tenant_id
      AND co.status     = 'IN_PROGRESS'
    ORDER BY co.started_at DESC
    LIMIT 1
) sc ON TRUE
WHERE m.role = 'STUDENT' AND m.status = 'ACTIVE';

-- created_by / updated_by audit columns
CREATE TEMP TABLE _actor ON COMMIT DROP AS
SELECT m.user_id
FROM memberships m
JOIN _cfg c ON c.tenant_id = m.tenant_id AND c.school_id = m.school_id
WHERE m.status = 'ACTIVE' AND m.role IN ('ADMIN', 'SECRETARY')
ORDER BY (m.role = 'ADMIN') DESC, m.created_at
LIMIT 1;

-- ── 1c. Fail loudly instead of silently inserting nothing ──────────────────
DO $$
DECLARE ni int; ns int; na int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _cfg) THEN
    RAISE EXCEPTION 'School/tenant pair not found — check the two UUIDs.';
  END IF;
  SELECT count(*) INTO ni FROM _instr;
  SELECT count(*) INTO ns FROM _stud;
  SELECT count(*) INTO na FROM _actor;
  IF ni = 0 THEN RAISE EXCEPTION 'No ACTIVE INSTRUCTOR membership in this school.'; END IF;
  IF ns = 0 THEN RAISE EXCEPTION 'No ACTIVE STUDENT membership in this school.';    END IF;
  IF na = 0 THEN RAISE EXCEPTION 'No ACTIVE ADMIN/SECRETARY membership (needed for created_by).'; END IF;
  RAISE NOTICE 'Found % instructors, % students.', ni, ns;
END $$;

-- ── 1d. Build the plan ─────────────────────────────────────────────────────
--  Theory   : Mon/Wed/Fri 19:00–20:30, capacity 20, 8–13 students each
--  Practical: Mon–Fri 09/11/14/16, 90 min, capacity 1, up to 3 concurrent
--  Deterministic (no random()) so it is reproducible.
CREATE TEMP TABLE _plan ON COMMIT DROP AS
WITH dims AS (
  SELECT LEAST(3, (SELECT count(*) FROM _instr), (SELECT count(*) FROM _stud))::int AS slots
),
days AS (
  SELECT g::date                       AS d,
         (g::date - CURRENT_DATE)::int AS dayoff,
         EXTRACT(isodow FROM g)::int   AS dow
  FROM _cfg c,
       generate_series((CURRENT_DATE - c.days_back)::timestamp,
                       (CURRENT_DATE + c.days_fwd)::timestamp,
                       interval '1 day') g
),
theory AS (
  SELECT gen_random_uuid()                                     AS id,
         'THEORY'::"ClassType"                                 AS class_type,
         'B'::"LicenseCategory"                                AS category,
         i.user_id                                             AS instructor_id,
         (ARRAY['Código da Estrada — Sinais',
                'Código da Estrada — Prioridades',
                'Código da Estrada — Manobras',
                'Segurança Rodoviária',
                'Mecânica Básica',
                'Condução Defensiva',
                'Primeiros Socorros',
                'Legislação Rodoviária',
                'Velocidade e Travagem',
                'Condução Noturna'])[(abs(d.dayoff) % 10) + 1] AS title,
         d.d + interval '19 hours'                             AS starts_local,
         d.d + interval '20 hours 30 minutes'                  AS ends_local,
         20                                                    AS capacity,
         ((abs(d.dayoff) * 13) % 31 = 0)                       AS cancelled,
         NULL::uuid                                            AS student_id,
         d.dayoff                                              AS dayoff,
         19                                                    AS hr
  FROM days d
  JOIN _instr i ON i.idx = (abs(d.dayoff) % i.n)
  WHERE d.dow IN (1, 3, 5)
),
practical AS (
  SELECT gen_random_uuid(),
         'PRACTICAL'::"ClassType",
         s.category,                                  -- matches the student's course
         i.user_id,
         'Aula Prática',
         d.d + make_interval(hours => h.hr),
         d.d + make_interval(hours => h.hr, mins => 90),
         1,
         ((abs(d.dayoff) * 7 + h.hr) % 37 = 0),
         s.user_id,
         d.dayoff,
         h.hr
  FROM days d
  CROSS JOIN (VALUES (9), (11), (14), (16)) AS h(hr)
  CROSS JOIN dims dm
  CROSS JOIN LATERAL generate_series(0, dm.slots - 1) AS g(k)
  -- consecutive k => distinct instructor AND distinct student in the same slot
  JOIN _instr i ON i.idx = ((abs(d.dayoff) * 7 + h.hr     + g.k) % i.n)
  JOIN _stud  s ON s.idx = ((abs(d.dayoff) * 5 + h.hr * 3 + g.k) % s.n)
  WHERE d.dow BETWEEN 1 AND 5
),
all_rows AS (
  SELECT * FROM theory
  UNION ALL
  SELECT * FROM practical
)
SELECT a.id, c.tenant_id, c.school_id,
       a.class_type, a.category, a.instructor_id, a.title,
       -- TIMESTAMP(3) columns are naive UTC: convert wall-clock via school tz
       ((a.starts_local AT TIME ZONE c.time_zone) AT TIME ZONE 'UTC') AS starts_at,
       ((a.ends_local   AT TIME ZONE c.time_zone) AT TIME ZONE 'UTC') AS ends_at,
       a.capacity,
       -- lifecycle is derived from the clock by the app; only CANCELLED persists
       CASE WHEN (a.ends_local AT TIME ZONE c.time_zone) < now() AND a.cancelled
            THEN 'CANCELLED' ELSE 'SCHEDULED' END::"ClassStatus"      AS status,
       (SELECT user_id FROM _actor)                                   AS actor_id,
       a.student_id, a.dayoff, a.hr
FROM all_rows a
CROSS JOIN _cfg c;

-- ── 1e. Insert the classes ─────────────────────────────────────────────────
INSERT INTO class_sessions
  (id, tenant_id, school_id, class_type, category, instructor_id, title,
   starts_at, ends_at, capacity, status, created_at, updated_at, created_by, updated_by)
SELECT p.id, p.tenant_id, p.school_id, p.class_type, p.category, p.instructor_id, p.title,
       p.starts_at, p.ends_at, p.capacity, p.status,
       -- deliberately "now": nothing in the app reads class_sessions.created_at
       -- for trends (those use enrolled_at / starts_at), and it makes the UNDO
       -- block at the bottom able to find exactly these rows.
       (now() AT TIME ZONE 'UTC'),
       (now() AT TIME ZONE 'UTC'),
       p.actor_id, p.actor_id
FROM _plan p;

-- ── 1f. Practical enrolments (1 student per class) ─────────────────────────
INSERT INTO enrollments
  (id, tenant_id, school_id, session_id, student_id, status, notes, enrolled_at, updated_at)
SELECT gen_random_uuid(), p.tenant_id, p.school_id, p.id, p.student_id,
       CASE WHEN p.ends_at >= (now() AT TIME ZONE 'UTC')    THEN 'ENROLLED'
            WHEN (abs(p.dayoff) * 17 + p.hr) % 13 = 0       THEN 'NO_SHOW'
            ELSE 'ATTENDED' END::"EnrollmentStatus",
       CASE WHEN p.ends_at < (now() AT TIME ZONE 'UTC')
                 AND (abs(p.dayoff) * 17 + p.hr) % 13 <> 0
            THEN (ARRAY['Boa evolução na condução urbana.',
                        'Precisa de mais prática em rotundas.',
                        'Estacionamento paralelo a melhorar.',
                        'Condução em autoestrada — bom desempenho.',
                        'Manobras de marcha-atrás a evoluir.',
                        'Muito bem nas ultrapassagens.',
                        'Atento à sinalização. Continuar assim.',
                        'Trabalhar a antecipação em cruzamentos.',
                        NULL, NULL])[(abs(p.dayoff) * 3 + p.hr) % 10 + 1]
            ELSE NULL END,
       p.starts_at - interval '2 days',
       (now() AT TIME ZONE 'UTC')
FROM _plan p
WHERE p.student_id IS NOT NULL
  AND p.status <> 'CANCELLED'
ON CONFLICT (session_id, student_id) DO NOTHING;

-- ── 1g. Theory enrolments (8–13 students per class) ────────────────────────
INSERT INTO enrollments
  (id, tenant_id, school_id, session_id, student_id, status, notes, enrolled_at, updated_at)
SELECT gen_random_uuid(), p.tenant_id, p.school_id, p.id, s.user_id,
       CASE WHEN p.ends_at >= (now() AT TIME ZONE 'UTC')  THEN 'ENROLLED'
            WHEN (abs(p.dayoff) * 19 + s.idx * 7) % 9 = 0 THEN 'NO_SHOW'
            ELSE 'ATTENDED' END::"EnrollmentStatus",
       NULL::text,
       p.starts_at - make_interval(days => 3 + (abs(p.dayoff) + s.idx) % 7),
       (now() AT TIME ZONE 'UTC')
FROM _plan p
JOIN _stud s
  ON ((s.idx + abs(p.dayoff) * 3) % s.n) < LEAST(8 + (abs(p.dayoff) % 6), s.n)
WHERE p.class_type = 'THEORY'
  AND p.status <> 'CANCELLED'
ON CONFLICT (session_id, student_id) DO NOTHING;

COMMIT;


-- ═══ STEP 2 — verify ═══════════════════════════════════════════════════════
SELECT cs.class_type,
       cs.status,
       count(*)                                     AS aulas,
       count(*) FILTER (WHERE cs.ends_at   < now()) AS passadas,
       count(*) FILTER (WHERE cs.starts_at > now()) AS futuras,
       sum((SELECT count(*) FROM enrollments e WHERE e.session_id = cs.id)) AS inscricoes
FROM class_sessions cs
WHERE cs.tenant_id = '576604ff-56c9-45d5-aebd-3d9e2a28b760'::uuid
  AND cs.school_id = '2dcc5c3c-86e6-4512-a7c5-20b6da377efa'::uuid
GROUP BY cs.class_type, cs.status
ORDER BY 1, 2;


-- ═══ UNDO (only if you need to start over) ═════════════════════════════════
--  Deletes everything the script above inserted in the last hour.
-- ───────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DELETE FROM enrollments e
--  USING class_sessions cs
--  WHERE e.session_id = cs.id
--    AND cs.tenant_id = '576604ff-56c9-45d5-aebd-3d9e2a28b760'::uuid
--    AND cs.school_id = '2dcc5c3c-86e6-4512-a7c5-20b6da377efa'::uuid
--    AND cs.created_at > (now() AT TIME ZONE 'UTC') - interval '1 hour';
-- DELETE FROM class_sessions cs
--  WHERE cs.tenant_id = '576604ff-56c9-45d5-aebd-3d9e2a28b760'::uuid
--    AND cs.school_id = '2dcc5c3c-86e6-4512-a7c5-20b6da377efa'::uuid
--    AND cs.created_at > (now() AT TIME ZONE 'UTC') - interval '1 hour';
-- COMMIT;
