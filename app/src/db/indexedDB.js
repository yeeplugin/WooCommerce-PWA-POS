import Dexie from 'dexie';

// Changed DB name to YeePOS_v1 to force a clean schema initialization 
// since IndexedDB doesn't allow changing primary keys in-place.
export const db = new Dexie('YeePOS_v1');

db.version(2).stores({
  products: 'id, name, price, sku, categories, image',
  orders: 'id, status, syncStatus, remote_id, _isNewOnline, date',
  customers: 'id, first_name, last_name, email, username',
  dining_tables: 'id, name, capacity',
  settings: 'id'
});
