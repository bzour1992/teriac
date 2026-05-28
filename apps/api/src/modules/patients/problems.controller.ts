import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ProblemsService } from "./problems.service";
import {
  CreateProblemDto,
  UpdateProblemDto,
  type ProblemListItem,
} from "./dto/problem.dto";

@ApiTags("patients")
@ApiBearerAuth()
@Controller("patients/:patientId/problems")
export class ProblemsController {
  constructor(private readonly problems: ProblemsService) {}

  @Get()
  list(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
  ): Promise<ProblemListItem[]> {
    return this.problems.list(patientId);
  }

  @Post()
  create(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateProblemDto,
  ): Promise<{ patientProblemId: string }> {
    return this.problems.create(patientId, body);
  }

  @Patch(":problemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async update(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("problemId", new ParseUUIDPipe()) problemId: string,
    @Body() body: UpdateProblemDto,
  ): Promise<void> {
    await this.problems.update(patientId, problemId, body);
  }

  @Delete(":problemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("patientId", new ParseUUIDPipe()) patientId: string,
    @Param("problemId", new ParseUUIDPipe()) problemId: string,
  ): Promise<void> {
    await this.problems.delete(patientId, problemId);
  }
}
