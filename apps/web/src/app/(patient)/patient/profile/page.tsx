import type { Metadata } from 'next';

import { Field } from '@/components/shared/field';
import { PageHeader } from '@/components/shared/page-header';
import { WireframeNote } from '@/components/shared/wireframe-note';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { patients } from '@/lib/mock-data';

export const metadata: Metadata = { title: 'Hồ sơ sức khoẻ' };

export default function ProfilePage() {
  const me = patients[0]!;
  return (
    <>
      <PageHeader
        title="Hồ sơ sức khoẻ"
        description="Thông tin định danh và tiền sử dùng khi đi khám."
      />
      <WireframeNote task="2.2">form React Hook Form + Zod, lưu qua API</WireframeNote>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin định danh</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ và tên" htmlFor="fullName">
            <Input id="fullName" defaultValue={me.fullName} />
          </Field>
          <Field label="Ngày sinh" htmlFor="dob">
            <Input id="dob" type="date" defaultValue={me.dateOfBirth} />
          </Field>
          <Field label="Số CCCD" htmlFor="nationalId" hint="12 chữ số">
            <Input id="nationalId" inputMode="numeric" defaultValue={me.nationalId} />
          </Field>
          <Field label="Mã thẻ BHYT" htmlFor="bhyt">
            <Input id="bhyt" defaultValue={me.healthInsuranceNumber} />
          </Field>
          <Field label="Số điện thoại" htmlFor="phone">
            <Input id="phone" type="tel" defaultValue={me.phone} />
          </Field>
          <Field label="Giới tính" htmlFor="gender">
            <NativeSelect id="gender" defaultValue={me.gender}>
              <option>Nam</option>
              <option>Nữ</option>
              <option>Khác</option>
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Địa chỉ</CardTitle>
          <CardDescription>Theo đơn vị hành chính 2 cấp (không còn cấp huyện).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Tỉnh / Thành phố" htmlFor="p-province">
            <NativeSelect id="p-province">
              <option>Tỉnh Lào Cai</option>
            </NativeSelect>
          </Field>
          <Field label="Xã / Phường / Đặc khu" htmlFor="p-commune">
            <NativeSelect id="p-commune">
              <option>Xã Mường Khương</option>
            </NativeSelect>
          </Field>
          <Field label="Số nhà, thôn/bản" htmlFor="p-detail">
            <Input id="p-detail" defaultValue="Thôn Pạc Bo" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tiền sử</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nhóm máu" htmlFor="blood">
            <NativeSelect id="blood" defaultValue={me.bloodType}>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Chưa rõ'].map((b) => (
                <option key={b}>{b}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Dị ứng" htmlFor="allergies">
            <Input id="allergies" defaultValue={me.allergies.join(', ')} />
          </Field>
          <Field label="Bệnh mạn tính" htmlFor="chronic" className="sm:col-span-2">
            <Textarea id="chronic" defaultValue={me.chronicConditions.join(', ')} />
          </Field>
          <Button className="justify-self-end sm:col-span-2" disabled>
            Lưu thay đổi
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
