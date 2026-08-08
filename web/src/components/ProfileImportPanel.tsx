import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { parseProfileImport } from '../utils/profileImport';
import type { ImportedDrug, ImportResult } from '../utils/profileImport';

interface Props {
  onImportProfiles: (items: ImportedDrug[]) => void;
  onCancel: () => void;
  importing: boolean;
}

const EXAMPLE_JSON = `[
  {
    "name": "阿莫西林",
    "frequency": "bid",
    "dosePerTime": 2,
    "packagingSize": 24,
    "packagingUnit": "盒",
    "pillUnit": "粒",
    "alertThresholdDays": 7
  }
]`;

export function ProfileImportPanel({ onImportProfiles, onCancel, importing }: Props) {
  const [jsonText, setJsonText] = useState('');
  const [parseResult, setParseResult] = useState<ImportResult | null>(null);
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
    setParseResult(parseProfileImport(jsonText));
  };

  const handleImport = () => {
    if (!parseResult || parseResult.items.length === 0) return;
    onImportProfiles(parseResult.items);
  };

  return (
    <div className="card">
      <h2>批量导入药品规格</h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--color-text-tertiary)', marginBottom: '16px' }}>
        粘贴或选择 JSON 文件，顶层为药品规格数组。frequency 可选 qd/bid/tid/qid/qod/qw/biw/tiw/prn（缺省 qd），
        alertThresholdDays 缺省 14，dailyDosage 按「单次剂量 × 频次」自动计算。
      </p>

      <details style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
        <summary style={{ cursor: 'pointer' }}>查看示例格式</summary>
        <pre style={{ marginTop: '8px', padding: '12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', overflowX: 'auto', border: '1px solid var(--color-border)' }}>{EXAMPLE_JSON}</pre>
      </details>

      <div className="input-block">
        <label>选择 JSON 文件（或直接粘贴到下方）</label>
        <input type="file" accept=".json,application/json" onChange={handleFileChange} />
      </div>
      {fileError && <p style={{ fontSize: '0.85rem', color: 'var(--color-danger)', marginBottom: '12px' }}>{fileError}</p>}

      <div className="input-block">
        <label>JSON 内容</label>
        <textarea
          value={jsonText}
          onChange={e => handleTextChange(e.target.value)}
          placeholder={EXAMPLE_JSON}
          rows={10}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-surface)', resize: 'vertical' }}
        />
      </div>

      {parseResult && (
        <div style={{ marginBottom: '16px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontSize: '0.9rem' }}>
          <p style={{ marginBottom: parseResult.errors.length > 0 ? '8px' : 0 }}>
            解析完成：<strong style={{ color: 'var(--color-success, #16a34a)' }}>可导入 {parseResult.items.length} 条</strong>
            {parseResult.errors.length > 0 && <strong style={{ color: 'var(--color-danger)' }}>，失败 {parseResult.errors.length} 条</strong>}
          </p>
          {parseResult.errors.map(error => (
            <p key={error.index} style={{ color: 'var(--color-danger)', fontSize: '0.85rem' }}>
              {error.index === -1 ? '整体' : `第 ${error.index + 1} 条`}：{error.message}
            </p>
          ))}
        </div>
      )}

      <div className="flex-between gap-4" style={{ marginTop: '8px' }}>
        <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }} disabled={importing}>取消</button>
        <button type="button" className="btn" onClick={handleParse} style={{ flex: 1 }} disabled={!jsonText.trim() || importing}>解析预览</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleImport}
          style={{ flex: 2 }}
          disabled={!parseResult || parseResult.items.length === 0 || importing}
        >
          {importing ? '导入中...' : `确认导入${parseResult && parseResult.items.length > 0 ? ` ${parseResult.items.length} 条` : ''}`}
        </button>
      </div>
    </div>
  );
}
