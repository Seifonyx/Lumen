import assert from 'node:assert/strict';
import { analysisFileName, analysisFilesFit, analysisMime, ANALYSIS_TEMPLATES, MAX_ANALYSIS_BYTES } from '../../src/lib/analysis';
assert.equal(analysisFileName('Data.csv', ['data.csv', 'Data (2).csv']), 'Data (3).csv');
assert.ok(!/[\\/]/.test(analysisFileName('../data.csv', [])));
assert.equal(analysisMime('REPORT.XLSX'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
assert.equal(analysisMime('chart.png'), 'image/png');
assert.equal(analysisMime('unknown.bin'), 'application/octet-stream');
assert.ok(analysisFilesFit([{ name: 'a.csv', data: new Uint8Array(MAX_ANALYSIS_BYTES) }]));
assert.ok(!analysisFilesFit([{ name: 'a.csv', data: new Uint8Array(MAX_ANALYSIS_BYTES + 1) }]));
assert.ok(!analysisFilesFit(Array.from({ length: 6 }, () => ({ name: 'a.csv', data: new Uint8Array(1) }))));
for (const template of Object.values(ANALYSIS_TEMPLATES)) {
  assert.ok(template.code.includes('input_files[0]'));
  assert.ok(template.code.includes('pd.read_excel'));
}
assert.ok(!ANALYSIS_TEMPLATES.clean.code.includes('drop_duplicates('));
assert.ok(ANALYSIS_TEMPLATES.clean.code.includes('dropna(how="all")'));
console.log('PASS analysis names, download types, limits and conservative cleaning templates');
