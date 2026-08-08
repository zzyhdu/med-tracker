/**
 * 数据同步脚本：把一台实例的数据（药物规格 + 个人医嘱 + 库存追踪）搬到另一台实例。
 *
 * 走 HTTP API 而不是数据库直连，因此：
 * - 不需要 SSH / 数据库端口暴露，线上只开 443 即可
 * - 字段校验、归属判断全部由目标实例的 API 把关
 * - 两端的 UUID 各自生成，脚本按「药品名」对齐规格、按「用户 + 药品」对齐医嘱
 *
 * 幂等：重复执行不会产生重复数据 —— 规格按名字复用，医嘱按 (用户, 药品) 更新，追踪天然 upsert。
 *
 * 用法：
 *   SOURCE_EMAIL=dev@example.com SOURCE_PASSWORD=xxx \
 *   TARGET_EMAIL=you@example.com TARGET_PASSWORD=yyy \
 *   npm run sync-remote
 *
 * 可选环境变量：
 *   SOURCE_BASE  源实例地址，默认 http://localhost:3000
 *   TARGET_BASE  目标实例地址，默认 https://med.yangsan.online
 *
 * 预演（只读，不写目标）：
 *   npm run sync-remote -- --dry-run
 */

const SOURCE_BASE = (process.env.SOURCE_BASE || 'http://localhost:3000').replace(/\/$/, '');
const TARGET_BASE = (process.env.TARGET_BASE || 'https://med.yangsan.online').replace(/\/$/, '');
const DRY_RUN = process.argv.includes('--dry-run');

const SOURCE_EMAIL = process.env.SOURCE_EMAIL;
const SOURCE_PASSWORD = process.env.SOURCE_PASSWORD;
const TARGET_EMAIL = process.env.TARGET_EMAIL;
const TARGET_PASSWORD = process.env.TARGET_PASSWORD;

if (!SOURCE_EMAIL || !SOURCE_PASSWORD) {
  console.error('缺少 SOURCE_EMAIL / SOURCE_PASSWORD。');
  process.exit(1);
}
if (!DRY_RUN && (!TARGET_EMAIL || !TARGET_PASSWORD)) {
  console.error('缺少 TARGET_EMAIL / TARGET_PASSWORD（或用 --dry-run 预演）。');
  process.exit(1);
}

/**
 * 带 cookie 会话的最小 API 客户端。登录后自动携带 session cookie。
 */
function createClient(base, label) {
  let cookie = '';

  async function request(method, path, body) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      cookie = setCookies.map(line => line.split(';')[0]).join('; ');
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error?.message || `HTTP ${response.status}`;
      throw new Error(`[${label}] ${method} ${path} 失败：${message}`);
    }
    return data;
  }

  return {
    async login(email, password) {
      const { user } = await request('POST', '/api/login', { email, password });
      console.log(`[${label}] 已登录：${user.email} (${base})`);
    },
    get: path => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
  };
}

/** 医嘱 payload：只取业务字段，丢弃源端的 id / drugId（目标端各自映射）。 */
function profilePayloadOf(profile, drugId) {
  return {
    drugId,
    frequency: profile.frequency,
    dosePerTime: profile.dosePerTime,
    dailyDosage: profile.dailyDosage,
    alertThresholdDays: profile.alertThresholdDays,
    timingInstruction: profile.timingInstruction,
    doseTimes: profile.doseTimes,
    doseSlots: profile.doseSlots,
    doseWeekdays: profile.doseWeekdays,
    doseAnchorDate: profile.doseAnchorDate,
  };
}

function describeProfile(profile) {
  const parts = [profile.frequency || '无频次'];
  if (profile.doseWeekdays) parts.push(`周${profile.doseWeekdays.join('/')}`);
  if (profile.doseAnchorDate) parts.push(`锚定${profile.doseAnchorDate}`);
  if (profile.doseSlots) parts.push(profile.doseSlots.join('+'));
  if (profile.doseTimes) parts.push(profile.doseTimes.join('+'));
  if (profile.timingInstruction) parts.push(profile.timingInstruction);
  return parts.join(' ');
}

async function main() {
  const source = createClient(SOURCE_BASE, '源');
  await source.login(SOURCE_EMAIL, SOURCE_PASSWORD);

  const [{ drugs: sourceDrugs }, { profiles: sourceProfiles }, { trackers: sourceTrackers }] = await Promise.all([
    source.get('/api/drugs'),
    source.get('/api/profiles'),
    source.get('/api/trackers'),
  ]);
  console.log(`[源] 规格 ${sourceDrugs.length} 条，医嘱 ${sourceProfiles.length} 条，追踪 ${sourceTrackers.length} 条`);

  if (DRY_RUN && !TARGET_EMAIL) {
    console.log('\n--dry-run（未提供目标账号，仅列出源数据）');
    for (const drug of sourceDrugs) console.log(`  规格  ${drug.name}`);
    for (const profile of sourceProfiles) {
      const drug = sourceDrugs.find(item => item.id === profile.drugId);
      console.log(`  医嘱  ${drug?.name || profile.drugId} → ${describeProfile(profile)}`);
    }
    for (const tracker of sourceTrackers) console.log(`  追踪  ${tracker.profileId} → ${tracker.baseInventory} @ ${tracker.baseDate}`);
    return;
  }

  // 预演也登录目标（只读 GET），让计划更接近真实执行
  const target = createClient(TARGET_BASE, '目标');
  await target.login(TARGET_EMAIL, TARGET_PASSWORD);
  const [{ drugs: targetDrugs }, { profiles: targetProfiles }] = await Promise.all([
    target.get('/api/drugs'),
    target.get('/api/profiles'),
  ]);
  console.log(`[目标] 已有规格 ${targetDrugs.length} 条，医嘱 ${targetProfiles.length} 条\n`);

  const write = (verb, detail) => console.log(`  ${DRY_RUN ? '[预演] ' : ''}${verb}  ${detail}`);
  let createdDrugs = 0;
  let createdProfiles = 0;
  let updatedProfiles = 0;

  // 1. 规格：按名字对齐，目标已有同名规格则复用（不覆盖别人的数据），否则以目标账号新建
  const targetDrugByName = new Map(targetDrugs.map(drug => [drug.name, drug]));
  const drugIdBySourceId = new Map();
  for (const drug of sourceDrugs) {
    const existing = targetDrugByName.get(drug.name);
    if (existing) {
      drugIdBySourceId.set(drug.id, existing.id);
      write('复用规格', drug.name);
      continue;
    }
    if (!DRY_RUN) {
      const { drug: created } = await target.post('/api/drugs', {
        name: drug.name,
        packagingSize: drug.packagingSize,
        packagingUnit: drug.packagingUnit,
        pillUnit: drug.pillUnit,
      });
      drugIdBySourceId.set(drug.id, created.id);
    }
    createdDrugs += 1;
    write('新建规格', drug.name);
  }

  // 2. 医嘱：按 (当前用户, 药品) 对齐，已存在则整单更新
  const targetProfileByDrugId = new Map(targetProfiles.map(profile => [profile.drugId, profile]));
  const profileIdBySourceId = new Map();
  for (const profile of sourceProfiles) {
    const drugId = drugIdBySourceId.get(profile.drugId);
    const drugName = sourceDrugs.find(drug => drug.id === profile.drugId)?.name || profile.drugId;
    if (!drugId && DRY_RUN) {
      // 预演时新建规格还没有目标 id，用占位表示「将随新规格创建」
      write('新建医嘱', `${drugName} → ${describeProfile(profile)}`);
      createdProfiles += 1;
      continue;
    }
    const existing = targetProfileByDrugId.get(drugId);
    if (existing) {
      if (!DRY_RUN) {
        const { profile: updated } = await target.put(`/api/profiles/${existing.id}`, profilePayloadOf(profile, drugId));
        profileIdBySourceId.set(profile.id, updated.id);
      }
      updatedProfiles += 1;
      write('更新医嘱', `${drugName} → ${describeProfile(profile)}`);
    } else {
      if (!DRY_RUN) {
        const { profile: created } = await target.post('/api/profiles', profilePayloadOf(profile, drugId));
        profileIdBySourceId.set(profile.id, created.id);
      }
      createdProfiles += 1;
      write('新建医嘱', `${drugName} → ${describeProfile(profile)}`);
    }
  }

  // 3. 追踪：POST 本身是 upsert，按目标医嘱 id 挂靠
  for (const tracker of sourceTrackers) {
    const profileId = profileIdBySourceId.get(tracker.profileId);
    if (!profileId) {
      write('跳过追踪', `${tracker.profileId}（预演中新医嘱暂无目标 id，正式执行时会写入）`);
      continue;
    }
    if (!DRY_RUN) {
      await target.post('/api/trackers', {
        profileId,
        baseInventory: tracker.baseInventory,
        baseDate: tracker.baseDate,
      });
    }
    write('写入追踪', `库存 ${tracker.baseInventory} @ ${tracker.baseDate}`);
  }

  console.log(`\n${DRY_RUN ? '预演完成（未写入）' : '同步完成'}：规格新建 ${createdDrugs}，医嘱新建 ${createdProfiles} / 更新 ${updatedProfiles}，追踪 ${sourceTrackers.length} 条`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
