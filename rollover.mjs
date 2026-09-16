// D1 batch is a transaction. Candidates, destination writes, and source removal
// are evaluated within that transaction so concurrent tabs cannot duplicate tasks.
export async function carryForward(env,userId,today){
 const settings=await env.DB.prepare('SELECT rollover FROM dog_settings WHERE user_id=?').bind(userId).first();
 if(settings?.rollover===0)return {moved:0,pending:0};
 const results=await env.DB.batch([
  env.DB.prepare('DELETE FROM dog_rollover_moves WHERE user_id=?').bind(userId),
  env.DB.prepare(`INSERT INTO dog_rollover_moves(user_id,source_day,task_id,payload)
   SELECT d.user_id,d.day,json_extract(t.value,'$.id'),
    json_set(json_remove(t.value,'$.scheduledStart'),'$.id',lower(hex(randomblob(16))))
   FROM dog_days d,json_each(d.data,'$.tasks') t
   WHERE d.user_id=? AND d.day<? AND json_extract(t.value,'$.done')=0
   AND COALESCE((SELECT rollover FROM dog_settings WHERE user_id=?),1)=1
   ORDER BY d.day,CAST(t.key AS INTEGER)
   LIMIT MAX(0,100-COALESCE((SELECT json_array_length(data,'$.tasks') FROM dog_days WHERE user_id=? AND day=?),0))`).bind(userId,today,userId,userId,today),
  env.DB.prepare(`INSERT OR IGNORE INTO dog_days(user_id,day,data,revision)
   SELECT ?,?, '{"start":540,"tasks":[]}',0 WHERE EXISTS (SELECT 1 FROM dog_rollover_moves WHERE user_id=?)`).bind(userId,today,userId),
  env.DB.prepare(`UPDATE dog_days SET data=json_set(data,'$.tasks',json((
   SELECT json_group_array(json(value)) FROM (
    SELECT value FROM json_each(dog_days.data,'$.tasks')
    UNION ALL SELECT payload AS value FROM dog_rollover_moves WHERE user_id=?
   )))),revision=revision+1 WHERE user_id=? AND day=?
   AND EXISTS (SELECT 1 FROM dog_rollover_moves WHERE user_id=?)`).bind(userId,userId,today,userId),
  env.DB.prepare(`UPDATE dog_days SET data=json_set(data,'$.tasks',json((
   SELECT json_group_array(json(t.value)) FROM json_each(dog_days.data,'$.tasks') t
   WHERE NOT EXISTS (SELECT 1 FROM dog_rollover_moves m WHERE m.user_id=dog_days.user_id AND m.source_day=dog_days.day AND m.task_id=json_extract(t.value,'$.id'))
   ))),revision=revision+1 WHERE user_id=? AND day<?
   AND EXISTS (SELECT 1 FROM dog_rollover_moves m WHERE m.user_id=dog_days.user_id AND m.source_day=dog_days.day)`).bind(userId,today),
  env.DB.prepare('DELETE FROM dog_rollover_moves WHERE user_id=?').bind(userId),
 ]);
 const pending=await env.DB.prepare(`SELECT COUNT(*) AS count FROM dog_days d,json_each(d.data,'$.tasks') t WHERE d.user_id=? AND d.day<? AND json_extract(t.value,'$.done')=0`).bind(userId,today).first();
 return {moved:results[1].meta.changes,pending:pending.count};
}
