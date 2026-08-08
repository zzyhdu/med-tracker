/**
 * 数据行 → API DTO 映射层。
 * DB 列是 snake_case，对外 JSON 统一 camelCase；
 * numeric 列转 Number，null 转 undefined（前端可选字段约定）。
 */

export function mapDrug(row) {
  return {
    id: row.id,
    createdBy: row.created_by,
    name: row.name,
    packagingSize: row.packaging_size === null ? undefined : Number(row.packaging_size),
    packagingUnit: row.packaging_unit || undefined,
    pillUnit: row.pill_unit || undefined,
  };
}

/** date 列 → 'YYYY-MM-DD' 字符串；pg 把 date 解析为本地零点 Date，必须用本地 getter 还原（toISOString 会偏到 UTC 前一天） */
function mapDateOnly(value) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

export function mapProfile(row) {
  return {
    id: row.id,
    drugId: row.drug_id,
    frequency: row.frequency || undefined,
    dosePerTime: row.dose_per_time === null ? undefined : Number(row.dose_per_time),
    dailyDosage: Number(row.daily_dosage),
    alertThresholdDays: Number(row.alert_threshold_days),
    timingInstruction: row.timing_instruction || undefined,
    doseTimes: row.dose_times ?? undefined,
    doseSlots: row.dose_slots ?? undefined,
    doseWeekdays: row.dose_weekdays ?? undefined,
    doseAnchorDate: mapDateOnly(row.dose_anchor_date),
  };
}

export function mapTracker(row) {
  return {
    profileId: row.profile_id,
    baseInventory: Number(row.base_inventory),
    baseDate: new Date(row.base_date).toISOString(),
  };
}
