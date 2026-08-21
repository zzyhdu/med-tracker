import { useMemo, useState } from 'react';
import { joinInventory } from '../utils/InventoryEngine';
import type { DrugProfile, DrugSpec, DrugTracker } from '../utils/InventoryEngine';
import { WEEKDAY_LABELS } from '../utils/reminders';
import {
  buildCalendarWindow,
  dosesOnDate,
  intensityOf,
  isSameDay,
} from '../utils/calendar';

interface Props {
  profiles: DrugProfile[];
  drugs: DrugSpec[];
  trackers: DrugTracker[];
}

const CELL = 16;
const GAP = 3;
// 热力档位 0-4 的配色（主题蓝由浅到深）
const LEVEL_COLORS = [
  'var(--color-bg)',
  'rgba(59, 130, 246, 0.30)',
  'rgba(59, 130, 246, 0.55)',
  'rgba(59, 130, 246, 0.80)',
  'rgba(59, 130, 246, 1)',
];

/** 该周（周一起）是否跨月首：用于在列顶标月份 */
function monthStartInWeek(week: Date[]): number | null {
  const first = week.find(day => day.getDate() === 1);
  return first ? first.getMonth() + 1 : null;
}

/**
 * 服药日程：GitHub 贡献图式热力图，一眼看清每天的服药节奏。
 * 颜色深浅 = 当天剂数；未来的日子偏淡，表示是计划而非记录。
 */
export function SchedulePage({ profiles, drugs, trackers }: Props) {
  const meds = useMemo(() => joinInventory(profiles, drugs, trackers), [profiles, drugs, trackers]);

  // 窗口在挂载时固定：前 3 周 + 本周 + 后 2 周
  const days = useMemo(() => buildCalendarWindow(), []);
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [days]);

  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState<Date>(today);
  const selectedDoses = useMemo(() => dosesOnDate(meds, selected), [meds, selected]);

  if (meds.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <p style={{ marginBottom: '16px' }}>还没有追踪任何药品。</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>请先在「规格库」建立医嘱，再到「库存」页加入新追踪。</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section className="card">
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--color-text-primary)' }}>服药日程</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
            少
            {LEVEL_COLORS.map(color => (
              <span key={color} style={{ width: 12, height: 12, borderRadius: 3, background: color, border: '1px solid var(--color-border)' }} />
            ))}
            多
          </div>
        </div>

        <div style={{ display: 'flex', gap: `${GAP}px`, overflowX: 'auto', paddingBottom: '4px' }}>
          {/* 左侧星期标签列 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px`, marginTop: '18px', marginRight: '2px' }}>
            {[1, 2, 3, 4, 5, 6, 7].map(day => (
              <div key={day} style={{ height: CELL, fontSize: '0.65rem', lineHeight: `${CELL}px`, color: 'var(--color-text-tertiary)' }}>
                {WEEKDAY_LABELS[day]}
              </div>
            ))}
          </div>

          {weeks.map((week, weekIndex) => {
            const month = monthStartInWeek(week);
            return (
              <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                <div style={{ height: '14px', fontSize: '0.65rem', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                  {month ? `${month}月` : ''}
                </div>
                {week.map(day => {
                  const doses = dosesOnDate(meds, day);
                  const level = intensityOf(doses.reduce((sum, dose) => sum + dose.times.length, 0));
                  const isFuture = day.getTime() > today.getTime() && !isSameDay(day, today);
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, selected);
                  return (
                    <button
                      key={day.getTime()}
                      type="button"
                      onClick={() => setSelected(day)}
                      title={`${day.getMonth() + 1}月${day.getDate()}日 ${WEEKDAY_LABELS[day.getDay() === 0 ? 7 : day.getDay()]} · ${doses.length === 0 ? '无服药安排' : `${doses.reduce((sum, dose) => sum + dose.times.length, 0)} 剂`}`}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 4,
                        border: '1px solid var(--color-border)',
                        background: LEVEL_COLORS[level],
                        opacity: isFuture ? 0.45 : 1,
                        cursor: 'pointer',
                        padding: 0,
                        boxShadow: isSelected
                          ? '0 0 0 2px var(--color-text-primary)'
                          : isToday
                            ? '0 0 0 2px var(--color-accent)'
                            : 'none',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '12px' }}>
          蓝框为今天；颜色偏淡的日子是未来的计划安排，不代表已服。
        </p>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.05rem', marginBottom: '12px', color: 'var(--color-text-primary)' }}>
          {selected.getMonth() + 1}月{selected.getDate()}日 {WEEKDAY_LABELS[selected.getDay() === 0 ? 7 : selected.getDay()]}
          {isSameDay(selected, today) && <span style={{ fontSize: '0.8rem', color: 'var(--color-accent)', marginLeft: '8px' }}>今天</span>}
        </h2>
        {selectedDoses.length === 0 ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>这一天没有服药安排。</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDoses.map(dose => (
              <div key={dose.name} className="flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{dose.name}</strong>
                  <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>{dose.doseText}</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {dose.times.map(time => (
                    <span
                      key={time}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg)',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {time}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
