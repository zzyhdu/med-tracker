import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { parseBackup } from '../utils/dataTransfer';
import type { BackupData, BackupParseResult } from '../utils/dataTransfer';

interface Props {
  onExport: () => void;
  onImport: (data: BackupData) => void;
  onCancel: () => void;
  importing: boolean;
}

const SECTION_LABELS = { drugs: '规格', profiles: '医嘱', trackers: '追踪' } as const;

/**
 * 备份与迁移：把当前账号的数据快照导出成 JSON 文件，
 * 在另一台实例（或另一个账号）登录后导入同一文件即可完成迁移。
 * 关联键是药品名，与实例无关；重复导入按名字幂等覆盖，不产生重复数据。
 */
export function BackupPanel({ onExport, onImport, onCancel, importing }: Props) {
  const [jsonText, setJsonText] = useState('');
  const [parseResult, setParseResult] = useState<BackupParseResult | null>(null);
  const [fileError, setFileError] = useState('');

  const handleTextChange = (value: string) => {
    setJsonText(value);
    setParseResult(null);
    setFileError('');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      handleTextChange(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      setFileError('文件读取失败，请重试或直接粘贴 JSON 文本。');
    };
    reader.readAsText(file);
    // 允许重复选择同一个文件
    e.target.value = '';
  };

  const handleParse = () => {
    if (!jsonText.trim()) return;
    setParseResult(parseBackup(jsonText));
  };

  const handleImport = () => {
    if (!parseResult?.data) return;
    onImport(parseResult.data);
  };

  const data = parseResult?.data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card">
        <h2>导出备份</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)', marginBottom: '16px' }}>
          下载当前账号的全部数据：我创建的规格、医嘱引用的规格、医嘱、库存追踪。
          在另一台部署实例（如线上）登录后，用下方「导入备份」选择该文件即可完成迁移。
        </p>
        <button type="button" className="btn btn-primary" onClick={onExport} disabled={importing}>
          下载备份文件（JSON）
        </button>
      </div>

      <div className="card">
        <h2>导入备份</h2>
        <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)', marginBottom: '16px' }}>
          选择之前导出的备份文件。规格按名字复用或新建，医嘱与追踪按药品名对齐覆盖；重复导入不会产生重复数据。
        </p>

        <div className="input-block">
          <label>选择备份文件（或直接粘贴到下方）</label>
          <input type="file" accept=".json,application/json" onChange={handleFileChange} />
        </div>
        {fileError && <p style={{ fontSize: '0.85rem', color: 'var(--color-danger)', marginBottom: '12px' }}>{fileError}</p>}

        <div className="input-block">
          <label>JSON 内容</label>
          <textarea
            value={jsonText}
            onChange={e => handleTextChange(e.target.value)}
            placeholder='{"version": 1, "drugs": [...], "profiles": [...], "trackers": [...]}'
            rows={8}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', resize: 'vertical' }}
          />
        </div>

        {parseResult && (
          <div style={{ marginBottom: '16px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}>
            {data ? (
              <p>
                解析完成：将导入 <strong>规格 {data.drugs.length} 条、医嘱 {data.profiles.length} 条、库存追踪 {data.trackers.length} 条</strong>
                {data.exportedAt && <span style={{ color: 'var(--color-text-tertiary)' }}>（导出于 {new Date(data.exportedAt).toLocaleString()}）</span>}
              </p>
            ) : (
              <>
                <p style={{ marginBottom: '8px', color: 'var(--color-danger)' }}>备份文件无效，请修正后重新解析：</p>
                {parseResult.errors.map((error, idx) => (
                  <p key={idx} style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
                    {error.section === 'global'
                      ? `整体：${error.message}`
                      : `${SECTION_LABELS[error.section]} 第 ${error.index + 1} 条：${error.message}`}
                  </p>
                ))}
              </>
            )}
          </div>
        )}

        <div className="flex-between gap-4" style={{ marginTop: '8px' }}>
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }} disabled={importing}>返回</button>
          <button type="button" className="btn" onClick={handleParse} style={{ flex: 1 }} disabled={!jsonText.trim() || importing}>解析预览</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
            style={{ flex: 2 }}
            disabled={!data || importing}
          >
            {importing ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  );
}
