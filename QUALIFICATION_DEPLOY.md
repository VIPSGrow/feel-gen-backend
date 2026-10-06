# 28-day Qualification Cycle – Server Deployment Steps

## 1. Backup (recommended)
```
pg_dump -U <DB_USER> -h <DB_HOST> <DB_NAME> > backup_before_qualification.sql
```

## 2. Pull code
```
git pull
npm install        # no new dependencies, only needed if package.json changed
```

## 3. Run migration
Only the new file (idempotent, additive, safe to re-run):
```
psql -U <DB_USER> -h <DB_HOST> -d <DB_NAME> -f migrations/20261006_user_qualification_cycle.sql
```
(`npm run migrate` also works, it runs every file in `migrations/`.)

Adds: `users.is_qualified`, `users.qualification_cycle_start`,
`users.downline_purchased_count`, table `qualification_cycle_purchases`.
Existing users start their first cycle at migration time.

## 4. Restart server
```
pm2 restart <app-name>      # or: npm start / docker restart
```
The cron (`utils/qualificationCycleCron.js`) is auto-registered from `index.js`:
daily 00:00 Asia/Kolkata, resets users whose 28-day cycle ended.

## 5. Verify
- Log in, call `GET /api/users/me/qualification`
- `GET /api/dashboard/me` now has `data.qualification`

Response:
```json
{
  "is_qualified": false,
  "qualification_cycle_start": "2026-10-06T11:26:05.393Z",
  "qualification_cycle_end": "2026-11-03T11:26:05.393Z",
  "downline_purchased_count": 3,
  "required_count": 10,
  "progress_text": "3/10 completed",
  "days_remaining": 25
}
```

## Where purchases are counted
- Distributor orders: `placeDistributorOrder` (orderController), `d_p_o` (distributor_OrderController) – inside the order transaction (savepoint, failure never breaks the order).
- Customer orders: Razorpay webhook when order becomes `paid`.
- Each buyer counts once per upline per cycle (DB unique constraint) so retries/multiple orders do not inflate the count. Upline = buyer's `referrer_id`.

## Rollback
```sql
DROP TABLE IF EXISTS qualification_cycle_purchases;
ALTER TABLE users DROP COLUMN IF EXISTS is_qualified,
  DROP COLUMN IF EXISTS qualification_cycle_start,
  DROP COLUMN IF EXISTS downline_purchased_count;
```
Then revert the code and restart.

## Frontend (separate repo) – sample
```jsx
const q = data.qualification;
<span className={q.is_qualified ? "badge-green" : "badge-gray"}>
  {q.is_qualified ? "Qualified" : "Not qualified"} • {q.downline_purchased_count}/{q.required_count} completed
</span>
<progress value={q.downline_purchased_count} max={q.required_count} />
<small>{q.days_remaining} days left in cycle</small>
```
