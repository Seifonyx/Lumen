import { safeFileName } from './util';

export const MAX_ANALYSIS_FILES = 5;
export const MAX_ANALYSIS_BYTES = 20 * 1024 * 1024;
export interface AnalysisInput { name: string; data: Uint8Array }
export function analysisFileName(name: string, existing: string[]): string {
  const originalDot = name.lastIndexOf('.');
  const extension = originalDot > 0 ? name.slice(originalDot).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 10) : '';
  const clean = safeFileName(originalDot > 0 ? name.slice(0, originalDot) : name, 'data').slice(0, 90) + extension;
  const dot = clean.lastIndexOf('.');
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  const ext = dot > 0 ? clean.slice(dot) : '';
  let result = clean, n = 2;
  while (existing.some(value => value.toLowerCase() === result.toLowerCase())) result = `${stem} (${n++})${ext}`;
  return result;
}
export function analysisFilesFit(files: AnalysisInput[]): boolean {
  return files.length <= MAX_ANALYSIS_FILES && files.reduce((sum, file) => sum + file.data.byteLength, 0) <= MAX_ANALYSIS_BYTES;
}
export function analysisMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', txt: 'text/plain', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as Record<string, string>)[ext || ''] || 'application/octet-stream';
}

const LOAD_DATA = `from pathlib import Path
import pandas as pd

if not input_files:
    raise ValueError("Upload a CSV or Excel file, then run again.")
path = Path(input_files[0])
if path.suffix.lower() in (".xlsx", ".xlsm", ".xls"):
    sheets = pd.read_excel(path, sheet_name=None)
    print("Workbook sheets:", list(sheets))
    df = next(iter(sheets.values()))  # Change this to sheets["Your sheet name"] if needed.
else:
    df = pd.read_csv(path, sep="\\t" if path.suffix.lower() == ".tsv" else ",")
print("Rows:", len(df), "Columns:", len(df.columns))
print(df.head(10).to_string(index=False))
`;
export const ANALYSIS_TEMPLATES = {
  overview: { label: 'Explore data', code: `${LOAD_DATA}
print("\\nColumn types:")
print(df.dtypes)
print("\\nMissing values:")
print(df.isna().sum())
print("\\nDuplicate rows:", int(df.duplicated().sum()))
print("\\nSummary:")
print(df.describe(include="all").to_string())
df.describe(include="all").to_csv("/output/summary.csv")
` },
  clean: { label: 'Clean & export', code: `${LOAD_DATA}
# Keep every nonempty row. Review duplicates and missing values before changing them.
clean = df.dropna(how="all").copy()
clean.columns = [str(column).strip() for column in clean.columns]
print("Removed fully empty rows:", len(df) - len(clean))
print("Duplicates kept for review:", int(clean.duplicated().sum()))
print("Missing values kept for review:")
print(clean.isna().sum())
clean.to_csv("/output/cleaned.csv", index=False, encoding="utf-8-sig")
clean.to_excel("/output/cleaned.xlsx", index=False, engine="openpyxl")
print("Saved cleaned.csv and cleaned.xlsx")
` },
  chart: { label: 'Make a chart', code: `${LOAD_DATA}
import matplotlib.pyplot as plt

numeric = df.select_dtypes(include="number")
if numeric.empty:
    raise ValueError("No numeric columns found. Choose a column and convert it explicitly first.")
column = numeric.columns[0]  # Change to the numeric column you want.
fig, ax = plt.subplots(figsize=(8, 4))
numeric[column].dropna().plot.hist(ax=ax, bins=12, color="#477c68", edgecolor="white")
ax.set_title(str(column))
ax.set_xlabel(str(column))
ax.set_ylabel("Count")
fig.tight_layout()
print("Chart ready — download figure-1.png below")
` },
} as const;

