import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller.js';
import { PatientLookupService } from './patient-lookup.service.js';
import { PatientsService } from './patients.service.js';

@Module({ controllers: [PatientsController], providers: [PatientsService, PatientLookupService] })
export class PatientsModule {}
