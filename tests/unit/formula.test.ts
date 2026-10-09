import { FormulaError, formulaResult, Workbook } from '../../src/lib/generate/formula';
import { parseWorkbook } from '../../src/lib/generate/sheet-spec';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };

// The tracker from the bug report: a Status column of =IF(D{row}>=60,"PASS","FAIL").
const wb = parseWorkbook(JSON.stringify({
  sheets: [
    {
      name: 'Student Results', title: 'Results',
      columns: [{ header: 'Name' }, { header: 'Class' }, { header: 'Test' }, { header: 'Score', type: 'integer' }, { header: 'Percentage', type: 'percent' }, { header: 'Status' }, { header: 'Grade' }],
      rows: [
        ['Ali', 'A', 'T1', 85, '=D{row}/100', '=IF(D{row}>=60,"PASS","FAIL")', "=VLOOKUP(D{row},'Grade Boundaries'!A2:B5,2,TRUE)"],
        ['Mona', 'A', 'T1', 42, '=D{row}/100', '=IF(D{row}>=60,"PASS","FAIL")', "=VLOOKUP(D{row},'Grade Boundaries'!A2:B5,2,TRUE)"],
        ['Omar', 'B', 'T1', 60, '=D{row}/100', '=IF(AND(D{row}>=60,E{row}<1),"PASS","FAIL")', '=IFERROR(1/0,"n/a")'],
      ],
      totals: true,
    },
    { name: 'Grade Boundaries', columns: [{ header: 'Min', type: 'integer' }, { header: 'Grade' }], rows: [[0, 'F'], [50, 'C'], [70, 'B'], [85, 'A']] },
  ],
}))!;
const book = new Workbook(wb.sheets);
const s = wb.sheets[0];
const at = (f: string, row = 4) => formulaResult(book, s, f, row); // title → header at row 3, data from 4
check(at('=IF(D{row}>=60,"PASS","FAIL")', 4) === 'PASS' && at('=IF(D{row}>=60,"PASS","FAIL")', 5) === 'FAIL', 'IF with text results');
check(at('=D{row}/100') === 0.85, 'arithmetic with {row}');
check(at("=VLOOKUP(D{row},'Grade Boundaries'!A2:B5,2,TRUE)", 4) === 'A' && at("=VLOOKUP(D{row},'Grade Boundaries'!A2:B5,2,TRUE)", 5) === 'F', 'VLOOKUP into another sheet (approximate)');
check(at('=IF(AND(D{row}>=60,E{row}<1),"PASS","FAIL")', 6) === 'PASS', 'AND + formula referencing a formula');
check(at('=IFERROR(1/0,"n/a")') === 'n/a' && (at('=1/0') as FormulaError).code === '#DIV/0!', 'errors and IFERROR');
check(at('=SUM(D{first}:D{last})') === 187 && at('=AVERAGE(D4:D6)') === 187 / 3 && at('=MAX(D4:D6)-MIN(D4:D6)') === 43, 'SUM/AVERAGE/MIN/MAX');
check(at('=COUNTIF(F4:F6,"PASS")') === 2 && at('=COUNTIF(D4:D6,">=60")') === 2 && at('=SUMIF(B4:B6,"A",D4:D6)') === 127, 'COUNTIF/SUMIF with criteria');
check(at('=COUNTIFS(B4:B6,"A",D4:D6,">50")') === 1, 'COUNTIFS');
check(at('=A{row}&" ("&TEXT(E{row},"0%")&")"') === 'Ali (85%)', '& joins and TEXT');
check(at('=ROUND(2.345,2)') === 2.35 && at('=ROUNDUP(2.301,1)') === 2.4 && at('=-2^2') === 4 && at('=50%*2') === 1, 'rounding, power, percent');
check(at('=INDEX(A4:A6,MATCH(95,D4:D6,0))') !== undefined && (at('=INDEX(A4:A6,MATCH(95,D4:D6,0))') as FormulaError).code === '#N/A', 'INDEX/MATCH not found');
check(at('=INDEX(A4:A6,MATCH(60,D4:D6,0))') === 'Omar', 'INDEX/MATCH found');
check(at('=RANK(D4,D4:D6)') === 1 && at('=UPPER(LEFT(A4,2))') === 'AL' && at('=LEN(TRIM("  a  b "))') === 3, 'RANK and text functions');
check(at('=D7') === 187, 'totals row is a real cell');
check(at('=FOO(1)') === undefined && at('=A1:') === undefined, 'unknown functions are left to Excel');
check(at('=IF(D4>=60;"yes";"no")') === 'yes', 'semicolon separators');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
