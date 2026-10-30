import { Module } from '@nestjs/common';
import { PeriodontogramService } from './periodontogram.service';
import { PeriodontogramController } from './periodontogram.controller';

@Module({
  controllers: [PeriodontogramController],
  providers: [PeriodontogramService],
})
export class PeriodontogramModule {}
