import { parseCsv, toIcd10Rows } from './icd10-csv.js';

describe('ICD-10 CSV', () => {
  it('đọc ô có dấu phẩy, ngoặc kép và BOM', () => {
    expect(parseCsv('\uFEFFa,"b, c","d ""e"""\r\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('nhận tiêu đề tiếng Việt, chuẩn hoá mã thiếu dấu chấm, bỏ dòng không phải mã', () => {
    const csv =
      'Mã bệnh;Tên bệnh;Tên tiếng Anh;Chương\nS065;Xuất huyết dưới màng cứng;Traumatic subdural haemorrhage;XIX\nA00-A09;Bệnh nhiễm trùng đường ruột;;I\ni10;Tăng huyết áp vô căn;;IX\n';
    const { rows, skipped } = toIcd10Rows(parseCsv(csv));
    expect(skipped).toBe(1);
    expect(rows.map((r) => r.code)).toEqual(['S06.5', 'I10']);
    expect(rows[0]).toMatchObject({
      chapter: 'XIX',
      searchText: 's06.5 xuat huyet duoi mang cung traumatic subdural haemorrhage',
    });
  });

  it('tự nhận diện dấu phân tách — tên có dấu phẩy trong file dùng ";" không bị tách cột', () => {
    const csv =
      'Mã bệnh;Tên bệnh;Tên tiếng Anh\nZ99.9;Lệ thuộc thiết bị hỗ trợ, không đặc hiệu;Dependence on machine, unspecified\n';
    expect(toIcd10Rows(parseCsv(csv)).rows[0]).toMatchObject({
      nameVi: 'Lệ thuộc thiết bị hỗ trợ, không đặc hiệu',
      nameEn: 'Dependence on machine, unspecified',
    });
    expect(parseCsv('a\tb, c\n1\t2')).toEqual([
      ['a', 'b, c'],
      ['1', '2'],
    ]);
  });

  it('báo lỗi khi thiếu cột bắt buộc', () => {
    expect(() => toIcd10Rows(parseCsv('foo,bar\n1,2'))).toThrow(/cột mã/);
  });
});
