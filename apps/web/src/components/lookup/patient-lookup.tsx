'use client';

import { useRef, useState } from 'react';
import { Loader2, Search, ScanLine } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { lookupPatients } from '@/lib/actions/patients';
import type { LookupKind, PatientLookupResult } from '@/lib/data/types';
import { PatientSummaryCard } from './patient-summary-card';
import { WalkInForm } from './walk-in-form';

const KIND_LABEL: Record<LookupKind, string> = {
  NATIONAL_ID: 'Số CCCD',
  HEALTH_INSURANCE: 'Mã thẻ BHYT',
  APPOINTMENT_CODE: 'Mã lịch hẹn',
  PHONE_OR_INSURANCE: 'Số điện thoại / mã BHXH',
  NAME: 'Họ tên (bệnh nhân của cơ sở)',
};

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; query: string; kind: LookupKind; patients: PatientLookupResult[] };

/** Ô tra cứu tức thì: tự nhận diện CCCD / BHYT / SĐT / mã lịch hẹn / tên. */
export function PatientLookup({ portal }: { portal: 'commune' | 'province' }) {
  const [q, setQ] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  function search(value: string, delay: number) {
    if (timer.current) clearTimeout(timer.current);
    const query = value.trim();
    if (query.length < 2) return setState({ status: 'idle' });
    timer.current = setTimeout(async () => {
      const id = ++seq.current;
      setState({ status: 'loading' });
      const res = await lookupPatients(query);
      if (id !== seq.current) return; // đã có lượt tra cứu mới hơn
      setState(
        res.ok ? { status: 'done', query, ...res.data } : { status: 'error', message: res.message },
      );
    }, delay);
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(q, 0);
        }}
        className="relative"
      >
        <Search
          className="text-muted-foreground absolute left-3 top-1/2 size-5 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={q}
          autoFocus
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setNotice(null);
            search(e.target.value, 350);
          }}
          placeholder="Số CCCD, mã thẻ BHYT, số điện thoại, mã lịch hẹn hoặc họ tên…"
          aria-label="Tra cứu bệnh nhân"
          className="h-12 pl-11 text-base"
        />
        {state.status === 'loading' && (
          <Loader2 className="text-muted-foreground absolute right-3 top-1/2 size-5 -translate-y-1/2 animate-spin" />
        )}
      </form>

      {state.status === 'idle' && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <ScanLine className="size-4" aria-hidden />
          Nhập đầy đủ mã định danh để tra trên toàn hệ thống; tìm theo tên chỉ trong bệnh nhân đã
          từng khám/đặt lịch tại cơ sở. Mọi lần tra cứu đều được ghi nhật ký.
        </p>
      )}
      {state.status === 'error' && <p className="text-destructive text-sm">{state.message}</p>}
      {notice && (
        <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {state.status === 'done' && (
        <div className="flex flex-col gap-4" aria-live="polite">
          <p className="text-muted-foreground text-sm">
            Tra theo <span className="text-foreground font-medium">{KIND_LABEL[state.kind]}</span> ·{' '}
            {state.patients.length} kết quả
          </p>
          {state.patients.map((p) => (
            <PatientSummaryCard
              key={p.id}
              patient={p}
              portal={portal}
              now={new Date().toISOString()}
            />
          ))}
          {state.patients.length === 0 && state.kind !== 'APPOINTMENT_CODE' && (
            <WalkInForm
              key={state.query}
              query={state.query}
              kind={state.kind}
              onEncounter={(code) => {
                // Tra lại để hiện thẻ bệnh nhân vừa tạo kèm phiếu khám đang mở
                search(state.query, 0);
                setNotice(`Đã mở phiếu khám ${code}.`);
              }}
            />
          )}
          {state.patients.length === 0 && state.kind === 'APPOINTMENT_CODE' && (
            <p className="text-muted-foreground text-sm">
              Không có lịch hẹn nào với mã này tại cơ sở.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
