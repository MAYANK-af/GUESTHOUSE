// Runs BOTH real migration files on an in-process PostgreSQL (PGlite) and checks the database-level guarantees.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIG = join(__dirname, '../../supabase/migrations');
let db: PGlite;

const AUTH_STUB = `
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.sub', true), '')::uuid $$;
`;
const ADMIN = '00000000-0000-4000-8000-0000000000a1';
const STAFF = '00000000-0000-4000-8000-0000000000b2';
const MGR   = '00000000-0000-4000-8000-0000000000c3';

async function as(uid: string | null, sql: string) {
  await db.exec(`SET request.jwt.sub = '${uid ?? ''}'; SET ROLE authenticated;`);
  try { return await db.query(sql); } finally { await db.exec('RESET ROLE;'); }
}
async function fails(uid: string, sql: string) {
  let err: any = null;
  try { await as(uid, sql); } catch (e) { err = e; }
  return err;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist } });
  await db.exec(AUTH_STUB);
  for (const f of readdirSync(MIG).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIG, f), 'utf8'));
  }
  await db.exec('GRANT USAGE ON SCHEMA public, auth TO authenticated;');
  await db.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;');
  await db.exec('GRANT SELECT ON auth.users TO authenticated;');
  // The sign-up trigger (installed by migration 1, hardened by v2) creates a 'staff' profile for every new auth user.
  await db.exec(`
    INSERT INTO auth.users VALUES ('${ADMIN}','{"full_name":"Admin"}'),('${STAFF}','{"full_name":"Staff"}'),('${MGR}','{"full_name":"Manager"}');
    UPDATE profiles SET role='admin' WHERE id='${ADMIN}';
    UPDATE profiles SET role='duty_manager' WHERE id='${MGR}';
  `);
});

describe('migrations', () => {
  it('apply cleanly in order and seed rooms are re-categorised', async () => {
    const r = await db.query<{ room_type: string; n: number }>('SELECT room_type, count(*)::int n FROM rooms GROUP BY 1 ORDER BY 1');
    const m = Object.fromEntries(r.rows.map((x) => [x.room_type, x.n]));
    expect(m.standard).toBe(3);                   // 101-103 were 'single'
    expect(m.deluxe + m.executive).toBe(5);       // doubles split by price
    expect(m.single).toBeUndefined();
  });

  it('room status accepts the new cleaning state and rejects junk', async () => {
    await db.exec("UPDATE rooms SET status='cleaning' WHERE room_number='102'");
    await expect(db.exec("UPDATE rooms SET status='dirty' WHERE room_number='102'")).rejects.toThrow();
    await db.exec("UPDATE rooms SET status='available' WHERE room_number='102'");
  });
});

describe('double-booking guard (exclusion constraint)', () => {
  let g: string, r: string;
  beforeAll(async () => {
    g = (await db.query<{ id: string }>('SELECT id FROM guests LIMIT 1')).rows[0].id;
    r = (await db.query<{ id: string }>("SELECT id FROM rooms WHERE room_number='102'")).rows[0].id;
    await db.exec(`INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date) VALUES ('${g}','${r}','2027-03-10','2027-03-13')`);
  });
  it('rejects an overlapping stay on the same room', async () => {
    await expect(db.exec(`INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date) VALUES ('${g}','${r}','2027-03-12','2027-03-15')`)).rejects.toThrow(/bookings_no_overlap|conflicting key/);
  });
  it('rejects a stay fully inside an existing one', async () => {
    await expect(db.exec(`INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date) VALUES ('${g}','${r}','2027-03-11','2027-03-12')`)).rejects.toThrow();
  });
  it('allows same-day turnover (check-out day == next check-in day)', async () => {
    await db.exec(`INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date) VALUES ('${g}','${r}','2027-03-13','2027-03-14')`);
  });
  it('allows the same dates on a different room', async () => {
    const r2 = (await db.query<{ id: string }>("SELECT id FROM rooms WHERE room_number='103'")).rows[0].id;
    await db.exec(`INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date) VALUES ('${g}','${r2}','2027-03-10','2027-03-13')`);
  });
  it('ignores cancelled bookings', async () => {
    await db.exec(`UPDATE bookings SET status='cancelled' WHERE room_id='${r}' AND check_in_date='2027-03-10'`);
    await db.exec(`INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date) VALUES ('${g}','${r}','2027-03-10','2027-03-13')`);
  });
  it('rejects check-out on or before check-in', async () => {
    await expect(db.exec(`INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date) VALUES ('${g}','${r}','2027-05-10','2027-05-10')`)).rejects.toThrow(/bookings_dates_check/);
  });
});

describe('guest identity constraints', () => {
  it('rejects a malformed Aadhaar number', async () => {
    await expect(db.exec("INSERT INTO guests (first_name,last_name,id_type,id_number) VALUES ('A','B','aadhaar','123')")).rejects.toThrow(/aadhaar/);
  });
  it('accepts a 12-digit Aadhaar number', async () => {
    await db.exec("INSERT INTO guests (first_name,last_name,id_type,id_number) VALUES ('A','B','aadhaar','298347562011')");
  });
});

describe('role-based row-level security', () => {
  it('staff cannot delete rooms; admin can', async () => {
    await db.exec("INSERT INTO rooms (room_number,room_type,price_per_night) VALUES ('T1','standard',2000)");
    await as(STAFF, "DELETE FROM rooms WHERE room_number='T1'");
    expect((await db.query("SELECT 1 FROM rooms WHERE room_number='T1'")).rows.length).toBe(1); // RLS filtered the delete: 0 rows affected
    await as(ADMIN, "DELETE FROM rooms WHERE room_number='T1'");
    expect((await db.query("SELECT 1 FROM rooms WHERE room_number='T1'")).rows.length).toBe(0);
  });
  it('only admin can insert rooms', async () => {
    expect(await fails(STAFF, "INSERT INTO rooms (room_number,room_type,price_per_night) VALUES ('T2','standard',1)")).toBeTruthy();
    expect(await fails(MGR, "INSERT INTO rooms (room_number,room_type,price_per_night) VALUES ('T2','standard',1)")).toBeTruthy();
    await as(ADMIN, "INSERT INTO rooms (room_number,room_type,price_per_night) VALUES ('T2','standard',1)");
  });
  it('duty manager cannot create bookings or guests; staff can', async () => {
    const g = (await db.query<{ id: string }>('SELECT id FROM guests LIMIT 1')).rows[0].id;
    const r = (await db.query<{ id: string }>("SELECT id FROM rooms WHERE room_number='201'")).rows[0].id;
    const ins = `INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date) VALUES ('${g}','${r}','2028-01-01','2028-01-03')`;
    expect(await fails(MGR, ins)).toBeTruthy();
    expect(await fails(MGR, "INSERT INTO guests (first_name,last_name) VALUES ('X','Y')")).toBeTruthy();
    await as(STAFF, ins);
  });
  it('duty manager can check a guest in (update booking) but not delete it', async () => {
    await as(MGR, "UPDATE bookings SET status='checked_in' WHERE check_in_date='2028-01-01'");
    expect((await db.query("SELECT status FROM bookings WHERE check_in_date='2028-01-01'")).rows[0]).toEqual({ status: 'checked_in' });
    await as(MGR, "DELETE FROM bookings WHERE check_in_date='2028-01-01'");
    expect((await db.query("SELECT 1 FROM bookings WHERE check_in_date='2028-01-01'")).rows.length).toBe(1);
  });
  it('a user cannot promote themselves to admin', async () => {
    expect(await fails(STAFF, `UPDATE profiles SET role='admin' WHERE id='${STAFF}'`)).toBeTruthy();
    expect((await db.query(`SELECT role FROM profiles WHERE id='${STAFF}'`)).rows[0]).toEqual({ role: 'staff' });
  });
  it('an admin can change another user\'s role', async () => {
    await as(ADMIN, `UPDATE profiles SET role='duty_manager' WHERE id='${STAFF}'`);
    expect((await db.query(`SELECT role FROM profiles WHERE id='${STAFF}'`)).rows[0]).toEqual({ role: 'duty_manager' });
    await as(ADMIN, `UPDATE profiles SET role='staff' WHERE id='${STAFF}'`);
  });
  it('sign-up trigger ignores a client-supplied role', async () => {
    const id = '00000000-0000-4000-8000-0000000000e5';
    await db.exec(`INSERT INTO auth.users VALUES ('${id}', '{"full_name":"Mallory","role":"admin"}')`);
    expect((await db.query(`SELECT role FROM profiles WHERE id='${id}'`)).rows[0]).toEqual({ role: 'staff' });
  });
});
