import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export interface LabRequestListItem {
  patientLabRequestId: string;
  labRequest: string;
  lab: string | null;
  requestDate: string;
  expectedDeliveryDate: string;
  isDelivered: boolean;
  deliveryDate: string | null;
}

export class CreateLabRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  labRequest!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  lab?: string | null;

  @IsString()
  @IsNotEmpty()
  requestDate!: string;

  @IsString()
  @IsNotEmpty()
  expectedDeliveryDate!: string;
}

export class UpdateLabRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @IsOptional()
  labRequest?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  lab?: string | null;

  @IsBoolean()
  @IsOptional()
  isDelivered?: boolean;

  @IsString()
  @IsOptional()
  deliveryDate?: string | null;

  @IsString()
  @IsOptional()
  expectedDeliveryDate?: string;
}
