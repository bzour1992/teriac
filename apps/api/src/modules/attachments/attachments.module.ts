import { Module } from "@nestjs/common";
import { AttachmentsController } from "./attachments.controller";
import { AttachmentsService } from "./attachments.service";
import { LocalStorageProvider } from "./storage/local-storage.provider";
import { TenantContextService } from "../../common/tenant/tenant-context";

@Module({
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    LocalStorageProvider,
    TenantContextService,
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
