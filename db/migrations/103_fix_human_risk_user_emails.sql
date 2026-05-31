-- Migration 103: Replace synthetic user1-20@domain emails in human_risk.users
-- with realistic Singapore professional addresses.
-- 20 users × 3 tenants = 60 rows across t_grab, t_maybank, t_mindef.
-- Names repeat (user1 and user11 share the same name) so second set uses
-- initial-based variant (e.g. a.binchen@, w.lwong@) to stay unique.

-- ── Grab Fintech APAC ────────────────────────────────────────────────────────
UPDATE human_risk.users SET email = 'ahmad.binchen@grab.com'    WHERE email = 'user1@grab.com';
UPDATE human_risk.users SET email = 'wl.wong@grab.com'           WHERE email = 'user2@grab.com';
UPDATE human_risk.users SET email = 'priya.santos@grab.com'      WHERE email = 'user3@grab.com';
UPDATE human_risk.users SET email = 'ravi.ng@grab.com'           WHERE email = 'user4@grab.com';
UPDATE human_risk.users SET email = 'sarah.binte@grab.com'       WHERE email = 'user5@grab.com';
UPDATE human_risk.users SET email = 'james.koh@grab.com'         WHERE email = 'user6@grab.com';
UPDATE human_risk.users SET email = 'maria.hassan@grab.com'      WHERE email = 'user7@grab.com';
UPDATE human_risk.users SET email = 'kevin.lim@grab.com'         WHERE email = 'user8@grab.com';
UPDATE human_risk.users SET email = 'nurul.sharma@grab.com'      WHERE email = 'user9@grab.com';
UPDATE human_risk.users SET email = 'tan.ahkumar@grab.com'       WHERE email = 'user10@grab.com';
UPDATE human_risk.users SET email = 'a.binchen2@grab.com'        WHERE email = 'user11@grab.com';
UPDATE human_risk.users SET email = 'weilinwong@grab.com'        WHERE email = 'user12@grab.com';
UPDATE human_risk.users SET email = 'p.santos2@grab.com'         WHERE email = 'user13@grab.com';
UPDATE human_risk.users SET email = 'r.ng2@grab.com'             WHERE email = 'user14@grab.com';
UPDATE human_risk.users SET email = 's.binte2@grab.com'          WHERE email = 'user15@grab.com';
UPDATE human_risk.users SET email = 'j.koh2@grab.com'            WHERE email = 'user16@grab.com';
UPDATE human_risk.users SET email = 'm.hassan2@grab.com'         WHERE email = 'user17@grab.com';
UPDATE human_risk.users SET email = 'k.lim2@grab.com'            WHERE email = 'user18@grab.com';
UPDATE human_risk.users SET email = 'n.sharma2@grab.com'         WHERE email = 'user19@grab.com';
UPDATE human_risk.users SET email = 't.ahkumar2@grab.com'        WHERE email = 'user20@grab.com';

-- ── Maybank Singapore ────────────────────────────────────────────────────────
UPDATE human_risk.users SET email = 'ahmad.binchen@maybank.com.sg'  WHERE email = 'user1@maybank.com';
UPDATE human_risk.users SET email = 'wl.wong@maybank.com.sg'        WHERE email = 'user2@maybank.com';
UPDATE human_risk.users SET email = 'priya.santos@maybank.com.sg'   WHERE email = 'user3@maybank.com';
UPDATE human_risk.users SET email = 'ravi.ng@maybank.com.sg'        WHERE email = 'user4@maybank.com';
UPDATE human_risk.users SET email = 'sarah.binte@maybank.com.sg'    WHERE email = 'user5@maybank.com';
UPDATE human_risk.users SET email = 'james.koh@maybank.com.sg'      WHERE email = 'user6@maybank.com';
UPDATE human_risk.users SET email = 'maria.hassan@maybank.com.sg'   WHERE email = 'user7@maybank.com';
UPDATE human_risk.users SET email = 'kevin.lim@maybank.com.sg'      WHERE email = 'user8@maybank.com';
UPDATE human_risk.users SET email = 'nurul.sharma@maybank.com.sg'   WHERE email = 'user9@maybank.com';
UPDATE human_risk.users SET email = 'tan.ahkumar@maybank.com.sg'    WHERE email = 'user10@maybank.com';
UPDATE human_risk.users SET email = 'a.binchen2@maybank.com.sg'     WHERE email = 'user11@maybank.com';
UPDATE human_risk.users SET email = 'weilinwong@maybank.com.sg'     WHERE email = 'user12@maybank.com';
UPDATE human_risk.users SET email = 'p.santos2@maybank.com.sg'      WHERE email = 'user13@maybank.com';
UPDATE human_risk.users SET email = 'r.ng2@maybank.com.sg'          WHERE email = 'user14@maybank.com';
UPDATE human_risk.users SET email = 's.binte2@maybank.com.sg'       WHERE email = 'user15@maybank.com';
UPDATE human_risk.users SET email = 'j.koh2@maybank.com.sg'         WHERE email = 'user16@maybank.com';
UPDATE human_risk.users SET email = 'm.hassan2@maybank.com.sg'      WHERE email = 'user17@maybank.com';
UPDATE human_risk.users SET email = 'k.lim2@maybank.com.sg'         WHERE email = 'user18@maybank.com';
UPDATE human_risk.users SET email = 'n.sharma2@maybank.com.sg'      WHERE email = 'user19@maybank.com';
UPDATE human_risk.users SET email = 't.ahkumar2@maybank.com.sg'     WHERE email = 'user20@maybank.com';

-- ── MINDEF Defence Cloud ─────────────────────────────────────────────────────
UPDATE human_risk.users SET email = 'ahmad.binchen@defence.gov.sg'  WHERE email = 'user1@mindef.gov.sg';
UPDATE human_risk.users SET email = 'wl.wong@defence.gov.sg'        WHERE email = 'user2@mindef.gov.sg';
UPDATE human_risk.users SET email = 'priya.santos@defence.gov.sg'   WHERE email = 'user3@mindef.gov.sg';
UPDATE human_risk.users SET email = 'ravi.ng@defence.gov.sg'        WHERE email = 'user4@mindef.gov.sg';
UPDATE human_risk.users SET email = 'sarah.binte@defence.gov.sg'    WHERE email = 'user5@mindef.gov.sg';
UPDATE human_risk.users SET email = 'james.koh@defence.gov.sg'      WHERE email = 'user6@mindef.gov.sg';
UPDATE human_risk.users SET email = 'maria.hassan@defence.gov.sg'   WHERE email = 'user7@mindef.gov.sg';
UPDATE human_risk.users SET email = 'kevin.lim@defence.gov.sg'      WHERE email = 'user8@mindef.gov.sg';
UPDATE human_risk.users SET email = 'nurul.sharma@defence.gov.sg'   WHERE email = 'user9@mindef.gov.sg';
UPDATE human_risk.users SET email = 'tan.ahkumar@defence.gov.sg'    WHERE email = 'user10@mindef.gov.sg';
UPDATE human_risk.users SET email = 'a.binchen2@defence.gov.sg'     WHERE email = 'user11@mindef.gov.sg';
UPDATE human_risk.users SET email = 'weilinwong@defence.gov.sg'     WHERE email = 'user12@mindef.gov.sg';
UPDATE human_risk.users SET email = 'p.santos2@defence.gov.sg'      WHERE email = 'user13@mindef.gov.sg';
UPDATE human_risk.users SET email = 'r.ng2@defence.gov.sg'          WHERE email = 'user14@mindef.gov.sg';
UPDATE human_risk.users SET email = 's.binte2@defence.gov.sg'       WHERE email = 'user15@mindef.gov.sg';
UPDATE human_risk.users SET email = 'j.koh2@defence.gov.sg'         WHERE email = 'user16@mindef.gov.sg';
UPDATE human_risk.users SET email = 'm.hassan2@defence.gov.sg'      WHERE email = 'user17@mindef.gov.sg';
UPDATE human_risk.users SET email = 'k.lim2@defence.gov.sg'         WHERE email = 'user18@mindef.gov.sg';
UPDATE human_risk.users SET email = 'n.sharma2@defence.gov.sg'      WHERE email = 'user19@mindef.gov.sg';
UPDATE human_risk.users SET email = 't.ahkumar2@defence.gov.sg'     WHERE email = 'user20@mindef.gov.sg';

\echo ' >> 60 human_risk user emails updated to realistic professional addresses'
