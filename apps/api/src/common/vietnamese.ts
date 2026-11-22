/**
 * Chuyển chuỗi tiếng Việt về dạng không dấu, chữ thường, phân tách bằng "_"
 * — cùng định dạng với cột `code_name` của danh mục hành chính.
 *
 * @example toCodeName('Mường Khương') === 'muong_khuong'
 */
export function toCodeName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Chuỗi tìm kiếm: bỏ dấu, chữ thường, gộp khoảng trắng (giữ dấu chấm của mã ICD). */
export function toSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();
}
