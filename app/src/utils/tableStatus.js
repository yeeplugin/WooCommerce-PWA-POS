export function normalizeTableKey(value) {
  return String(value || '').trim().toLowerCase();
}

export function getOrderTableName(order) {
  return order?.table || order?._yeepos_table_number || '';
}

export function isActiveDineInOrder(order) {
  const status = String(order?.status || '').toLowerCase();
  const tableName = getOrderTableName(order);

  // If order is parked or on-hold and HAS a table name, it is an active dine-in table
  return (status === 'parked' || status === 'on-hold') && !!tableName;
}

export function buildTableLookup(tables = []) {
  const lookup = {};

  tables.forEach((table) => {
    const key = normalizeTableKey(table?.name);
    if (key) {
      lookup[key] = table;
    }
  });

  return lookup;
}

export function buildOccupiedTableMap(orders = [], tables = []) {
  const tableLookup = buildTableLookup(tables);
  const occupiedMap = {};

  orders.forEach((order) => {
    if (!isActiveDineInOrder(order)) return;

    const tableKey = normalizeTableKey(getOrderTableName(order));
    if (!tableKey || !tableLookup[tableKey]) return;

    occupiedMap[tableKey] = order;
  });

  return occupiedMap;
}
