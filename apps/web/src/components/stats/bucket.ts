/** Nhãn trục thời gian theo đơn vị gộp của API. `bucket` dạng YYYY-MM-DD (ngày đầu kỳ). */
export function bucketLabel(bucket: string, unit: 'day' | 'week' | 'month') {
  const [y, m, d] = bucket.split('-');
  if (unit === 'month') return `${m}/${y}`;
  return `${d}/${m}`;
}

export function bucketTitle(bucket: string, unit: 'day' | 'week' | 'month') {
  const [y, m, d] = bucket.split('-');
  if (unit === 'month') return `Tháng ${m}/${y}`;
  if (unit === 'week') return `Tuần từ ${d}/${m}/${y}`;
  return `${d}/${m}/${y}`;
}
