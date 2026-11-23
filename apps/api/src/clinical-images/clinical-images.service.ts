import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MEDIA_RULES, MEDIA_STORAGE, type MediaStorage } from '../media/media-storage.js';
import type { ConfirmImageInput } from './clinical-images.schemas.js';

/** Thư mục ảnh của một hồ sơ — ảnh chỉ gắn được vào đúng hồ sơ đã cấp vé upload. */
export const recordFolder = (recordId: string) => `mevita/records/${recordId}/`;

export interface ImageRow {
  id: string;
  type: string;
  cloudinaryPublicId: string;
  description: string | null;
  takenAt: Date | null;
  width: number | null;
  height: number | null;
  createdAt?: Date;
}

@Injectable()
export class ClinicalImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
  ) {}

  /** Đổi bản ghi ảnh thành dạng trả về: URL ảnh gốc & thu nhỏ đều có chữ ký. */
  toDto<T extends ImageRow>({ cloudinaryPublicId, ...rest }: T) {
    const { url, thumbnailUrl } = this.storage.deliveryUrls(cloudinaryPublicId);
    return { ...rest, secureUrl: url, thumbnailUrl };
  }

  /** Cấp vé để trình duyệt tải ảnh thẳng lên kho (signed upload). */
  async createTicket(recordId: string, user: AuthUser) {
    await this.loadDraft(recordId, user);
    const count = await this.prisma.clinicalImage.count({ where: { medicalRecordId: recordId } });
    if (count >= MEDIA_RULES.maxPerRecord) {
      throw new BadRequestException(`Mỗi hồ sơ tối đa ${MEDIA_RULES.maxPerRecord} ảnh`);
    }
    return {
      mode: this.storage.mode,
      ...this.storage.createUploadTicket(`${recordFolder(recordId)}${randomUUID()}`),
    };
  }

  /**
   * Xác nhận ảnh đã tải lên: đọc thông tin trực tiếp từ kho (không tin trình duyệt),
   * kiểm tra đúng thư mục hồ sơ, định dạng, dung lượng; ảnh không hợp lệ bị xoá khỏi kho.
   */
  async confirm(recordId: string, user: AuthUser, input: ConfirmImageInput) {
    await this.loadDraft(recordId, user);
    if (!input.publicId.startsWith(recordFolder(recordId)) || input.publicId.includes('..')) {
      throw new BadRequestException('Ảnh không thuộc hồ sơ này');
    }
    if (
      await this.prisma.clinicalImage.findUnique({ where: { cloudinaryPublicId: input.publicId } })
    ) {
      throw new ConflictException('Ảnh đã được lưu vào hồ sơ');
    }
    const asset = await this.storage.fetchAsset(input.publicId);
    if (!asset)
      throw new BadRequestException('Không tìm thấy ảnh trên kho — có thể tải lên chưa thành công');

    const problem =
      asset.bytes > MEDIA_RULES.maxBytes
        ? `Ảnh vượt quá ${MEDIA_RULES.maxBytes / 1024 / 1024} MB`
        : !(MEDIA_RULES.allowedFormats as readonly string[]).includes(asset.format)
          ? `Định dạng ${asset.format} không được hỗ trợ`
          : null;
    if (problem) {
      await this.storage.delete(asset.publicId);
      throw new BadRequestException(problem);
    }

    const image = await this.prisma.clinicalImage.create({
      data: {
        medicalRecordId: recordId,
        type: input.type,
        cloudinaryPublicId: asset.publicId,
        secureUrl: asset.canonicalUrl,
        format: asset.format,
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        description: input.description,
        takenAt: input.takenAt,
        uploadedById: user.id,
      },
      select: {
        id: true,
        type: true,
        cloudinaryPublicId: true,
        description: true,
        takenAt: true,
        width: true,
        height: true,
        createdAt: true,
      },
    });
    await this.audit.log({
      userId: user.id,
      action: 'CREATE',
      entityType: 'ClinicalImage',
      entityId: image.id,
      metadata: { recordId },
    });
    return this.toDto(image);
  }

  async remove(recordId: string, imageId: string, user: AuthUser) {
    await this.loadDraft(recordId, user);
    const image = await this.prisma.clinicalImage.findFirst({
      where: { id: imageId, medicalRecordId: recordId },
    });
    if (!image) throw new NotFoundException('Không tìm thấy ảnh');
    await this.prisma.clinicalImage.delete({ where: { id: imageId } });
    await this.storage.delete(image.cloudinaryPublicId);
    await this.audit.log({
      userId: user.id,
      action: 'DELETE',
      entityType: 'ClinicalImage',
      entityId: imageId,
      metadata: { recordId },
    });
  }

  /** Chỉ thêm/xoá ảnh khi hồ sơ còn nháp và thuộc cơ sở của nhân viên. */
  private async loadDraft(recordId: string, user: AuthUser) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: { status: true, facilityId: true },
    });
    if (!record || !user.facilityId || record.facilityId !== user.facilityId)
      throw new NotFoundException('Không tìm thấy phiếu khám');
    if (record.status !== 'DRAFT')
      throw new ConflictException('Hồ sơ đã ký, không thể thay đổi ảnh');
  }
}
