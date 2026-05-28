import { IsString, MinLength, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "doctor@example.com" })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  username!: string;

  @ApiProperty({ example: "correct horse battery staple" })
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export interface TokenPair {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession {
  user: {
    userId: string;
    userName: string;
    firstName: string | null;
    lastName: string | null;
    userType: number;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    language: string;
  };
  hcenter: {
    hcenterId: string;
    hcenterName: string;
    /** Module keys (e.g. "finance", "reports", "pediatrics") that are turned on
     *  for this clinic by the superadmin. Missing modules are disabled. */
    enabledModules: string[];
  };
  tokens: TokenPair;
}
