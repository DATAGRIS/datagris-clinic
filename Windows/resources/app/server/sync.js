const db = require('./db');
const path = require('path');
const fs = require('fs');

// In-memory sync state
const syncState = {
  status: 'offline', // synced, pending, offline
  lastSyncTime: 'Never',
  pendingCount: 0,
  failedCount: 0
};

const PRIMARY_KEYS = {
  settings: 'key',
  users: 'id',
  patients: 'mobile_number',
  companions: 'id',
  medical_services: 'id',
  visits: 'id',
  visit_services: 'visit_id',
  employees: 'id',
  inventory_items: 'id',
  maintenance_records: 'id',
  vouchers: 'id',
  audit_logs: 'id',
  examination_templates: 'id',
  refunds: 'id',
  external_partners: 'id',
  referrals: 'id',
  chat_messages: 'id',
  inventory_transactions: 'id',
  visit_inventory_items: 'id',
  treasury_sessions: 'id',
  treasury_transactions: 'id',
  treasury_expenses: 'id',
  whatsapp_logs: 'id',
  notifications: 'id',
  reports: 'id'
};

async function getClinicId() {
  try {
    const configPath = path.join(process.env.USER_DATA_PATH || __dirname, 'clinic_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.clinicId || '';
    }
  } catch (e) {
    console.error('Failed to read config for sync engine:', e);
  }
  return '';
}

function getBillingUrl() {
  try {
    const configPath = path.join(process.env.USER_DATA_PATH || __dirname, 'clinic_config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.billingUrl || 'https://billing.datagris.com';
    }
  } catch (e) {}
  return 'https://billing.datagris.com';
}

async function checkInternet() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout

    // Ping Supabase project URL directly to check internet and database reachability
    const res = await fetch('https://whfegxabypqkvnmfwfqj.supabase.co', {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res.status >= 200 && res.status < 500;
  } catch (err) {
    return false;
  }
}

async function runSyncCycle() {
  const clinicId = await getClinicId();
  
  // 1. Check network
  const isOnline = await checkInternet();
  if (!isOnline) {
    syncState.status = 'offline';
    const countRow = await db.queryOne('SELECT COUNT(*) as count FROM pending_sync_queue');
    syncState.pendingCount = countRow ? countRow.count : 0;
    return;
  }

  if (!clinicId || !global.userJwt) {
    // Online but sync is inactive (not logged in online or no billing site deployed)
    syncState.status = 'connected-inactive';
    const countRow = await db.queryOne('SELECT COUNT(*) as count FROM pending_sync_queue');
    syncState.pendingCount = countRow ? countRow.count : 0;
    return;
  }

  try {
    // 2. Upload Phase (Push local changes)
    let pendingItems = await db.queryAll('SELECT * FROM pending_sync_queue ORDER BY id ASC');
    syncState.pendingCount = pendingItems.length;

    if (pendingItems.length > 0) {
      syncState.status = 'pending';
      let failedItemsCount = 0;

      for (const item of pendingItems) {
        const pk = PRIMARY_KEYS[item.table_name];
        if (!pk) {
          // Unsupported table, delete from queue to prevent block
          await db.runCommand('DELETE FROM pending_sync_queue WHERE id = ?', [item.id]);
          continue;
        }

        try {
          if (item.action === 'DELETE') {
            // Delete record in Supabase
            const res = await fetch(`${getBillingUrl()}/api/sync/delete`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${global.userJwt}`
              },
              body: JSON.stringify({
                tableName: item.table_name,
                recordId: item.record_id,
                clinicId: clinicId
              })
            });

            if (res.ok) {
              await db.runCommand('DELETE FROM pending_sync_queue WHERE id = ?', [item.id]);
            } else {
              failedItemsCount++;
            }
          } else {
            // INSERT or UPDATE
            const localRecord = await db.queryOne(`SELECT * FROM "${item.table_name}" WHERE "${pk}" = ?`, [item.record_id]);
            if (!localRecord) {
              // Deleted locally later, just remove from queue
              await db.runCommand('DELETE FROM pending_sync_queue WHERE id = ?', [item.id]);
              continue;
            }

            const res = await fetch(`${getBillingUrl()}/api/sync/upsert`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${global.userJwt}`
              },
              body: JSON.stringify({
                tableName: item.table_name,
                record: localRecord,
                clinicId: clinicId
              })
            });

            if (res.ok) {
              const data = await res.json();
              if (data.conflict && data.record) {
                // Conflict resolved (Remote won): overwrite local record
                console.log(`Conflict resolved (Remote wins). Overwriting local row in ${item.table_name} id: ${item.record_id}`);
                
                const remoteRecord = data.record;
                const columns = Object.keys(remoteRecord).filter(c => c !== 'clinic_id');
                const placeholders = columns.map(() => '?').join(', ');
                const colNames = columns.map(c => `"${c}"`).join(', ');
                
                const updateExpr = columns
                  .filter(c => c !== pk)
                  .map(c => `"${c}" = ?`)
                  .join(', ');

                const maxQueueIdRow = await db.queryOne('SELECT MAX(id) as id FROM pending_sync_queue');
                const maxQueueId = maxQueueIdRow ? (maxQueueIdRow.id || 0) : 0;

                // Perform direct SQLite update
                const updateSql = `UPDATE "${item.table_name}" SET ${updateExpr} WHERE "${pk}" = ?`;
                const params = [...columns.filter(c => c !== pk).map(c => remoteRecord[c]), remoteRecord[pk]];
                
                await db.runCommand(updateSql, params);

                // Clean up trigger entry caused by our local write
                await db.runCommand(
                  `DELETE FROM pending_sync_queue WHERE table_name = ? AND record_id = ? AND id > ?`,
                  [item.table_name, String(item.record_id), maxQueueId]
                );
              }
              await db.runCommand('DELETE FROM pending_sync_queue WHERE id = ?', [item.id]);
            } else {
              failedItemsCount++;
            }
          }
        } catch (itemErr) {
          console.error(`Sync cycle failure on queue item ${item.id}:`, itemErr);
          failedItemsCount++;
        }
      }
      syncState.failedCount = failedItemsCount;
    }

    // 3. Download Phase (Pull cloud changes)
    const lastSyncRow = await db.queryOne("SELECT value FROM settings WHERE key = 'lastSyncTime'");
    const lastSyncTime = lastSyncRow ? lastSyncRow.value : '';

    const pullRes = await fetch(`${getBillingUrl()}/api/sync/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${global.userJwt}`
      },
      body: JSON.stringify({
        clinicId: clinicId,
        lastSyncTime: lastSyncTime
      })
    });

    if (pullRes.ok) {
      const pullData = await pullRes.json(); // { updates: { table: [records] }, serverTime }
      const updates = pullData.updates || {};

      for (const [table, rows] of Object.entries(updates)) {
        const pk = PRIMARY_KEYS[table];
        if (!pk || !Array.isArray(rows)) continue;

        for (const row of rows) {
          const pkValue = row[pk];
          const localRecord = await db.queryOne(`SELECT updated_at FROM "${table}" WHERE "${pk}" = ?`, [pkValue]);

          let applyUpdate = false;
          if (!localRecord) {
            applyUpdate = true;
          } else {
            const localDate = new Date(localRecord.updated_at);
            const remoteDate = new Date(row.updated_at);
            if (remoteDate > localDate) {
              applyUpdate = true;
            }
          }

          if (applyUpdate) {
            const maxQueueIdRow = await db.queryOne('SELECT MAX(id) as id FROM pending_sync_queue');
            const maxQueueId = maxQueueIdRow ? (maxQueueIdRow.id || 0) : 0;

            const columns = Object.keys(row).filter(c => c !== 'clinic_id');
            const colNames = columns.map(c => `"${c}"`).join(', ');
            const placeholders = columns.map(() => '?').join(', ');
            
            // Build UPSERT statement for local SQLite
            const sql = `INSERT OR REPLACE INTO "${table}" (${colNames}) VALUES (${placeholders})`;
            const params = columns.map(c => row[c]);
            
            await db.runCommand(sql, params);

            // Clean up CDC trigger generated entry
            await db.runCommand(
              `DELETE FROM pending_sync_queue WHERE table_name = ? AND record_id = ? AND id > ?`,
              [table, String(pkValue), maxQueueId]
            );
          }
        }
      }

      // Update local lastSyncTime settings
      await db.runCommand(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('lastSyncTime', ?)",
        [pullData.serverTime]
      );
      
      const syncDate = new Date(pullData.serverTime);
      syncState.lastSyncTime = syncDate.toLocaleDateString() + ' ' + syncDate.toLocaleTimeString();
    }

    const finalCountRow = await db.queryOne('SELECT COUNT(*) as count FROM pending_sync_queue');
    syncState.pendingCount = finalCountRow ? finalCountRow.count : 0;
    
    if (syncState.pendingCount === 0) {
      syncState.status = 'synced';
    } else {
      syncState.status = 'pending';
    }

  } catch (syncCycleErr) {
    console.error('Error during synchronization cycle:', syncCycleErr);
    syncState.status = 'offline';
  }
}

function startSyncEngine() {
  console.log('Background Sync Engine successfully started.');
  // Run immediately on boot
  setTimeout(runSyncCycle, 2000);
  
  // Periodically every 10 seconds
  setInterval(runSyncCycle, 10000);
}

module.exports = {
  startSyncEngine,
  getSyncStatus: () => ({ ...syncState })
};
