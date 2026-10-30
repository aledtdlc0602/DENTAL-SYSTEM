import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { readSettings } from '../common/clinic-settings';
import { signatureHashOf } from './signature';

type NoteFields = { subjective?: string; objective?: string; assessment?: string; plan?: string; content?: string };

const AUTHOR = { author: { select: { id: true, firstName: true, lastName: true, role: true } } };


/**
 * RF-05: bitácora cronológica inmutable de notas SOEP.
 * - La nota queda bloqueada al firmarla o al pasar el plazo configurable de la clínica (por defecto 24 h).
 * - Solo el profesional autor puede firmarla (firma = hash SHA-256 de contenido + autor + fecha).
 * - RN-01: las correcciones se hacen con una adenda firmada que referencia la nota original.
 */
@Injectable()
export class ClinicalNotesService {
  constructor(private prisma: PrismaService) {}

  private async lockHours(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId }, select: { settings: true } });
    return readSettings(clinic?.settings).noteLockHours;
  }

  /** Bloquea las notas que superaron el plazo (se ejecuta al consultar/editar). */
  private async autoLock(clinicId: string, patientId?: string) {
    const hours = await this.lockHours(clinicId);
    await this.prisma.clinicalNote.updateMany({
      where: { clinicId, ...(patientId ? { patientId } : {}), isLocked: false, createdAt: { lt: new Date(Date.now() - hours * 3600000) } },
      data: { isLocked: true },
    });
    return hours;
  }

  async create(clinicId: string, data: NoteFields & { patientId: string; appointmentId?: string; noteType?: string }, authorId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: data.patientId, clinicId } });
    if (!patient) throw new NotFoundException('Paciente no encontrado');
    if (!data.subjective && !data.objective && !data.assessment && !data.plan && !data.content) {
      throw new BadRequestException('La nota está vacía');
    }
    if (data.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({ where: { id: data.appointmentId, clinicId, patientId: data.patientId } });
      if (!appt) throw new NotFoundException('La cita no pertenece a este paciente');
    }
    return this.prisma.clinicalNote.create({
      data: {
        clinicId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        authorId,
        noteType: data.noteType === 'EVOLUTION' ? 'EVOLUTION' : 'SOAP',
        subjective: data.subjective,
        objective: data.objective,
        assessment: data.assessment,
        plan: data.plan,
        content: data.content,
        isLocked: false,
      },
      include: AUTHOR,
    });
  }

  async findByPatient(clinicId: string, patientId: string) {
    const hours = await this.autoLock(clinicId, patientId);
    const notes = await this.prisma.clinicalNote.findMany({
      where: { clinicId, patientId },
      include: { ...AUTHOR, appointment: { select: { id: true, startAt: true, reason: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return notes.map((n) => ({
      ...n,
      lockAt: new Date(n.createdAt.getTime() + hours * 3600000),
      addenda: notes.filter((a) => a.parentNoteId === n.id).map((a) => a.id),
    }));
  }

  async sign(clinicId: string, noteId: string, userId: string) {
    const note = await this.prisma.clinicalNote.findFirst({ where: { id: noteId, clinicId } });
    if (!note) throw new NotFoundException('Nota no encontrada');
    if (note.authorId !== userId) throw new ForbiddenException('Solo el profesional autor puede firmar la nota');
    if (note.signedAt) throw new ForbiddenException('La nota ya está firmada');
    // Una nota bloqueada por plazo aún puede firmarla su autor (se firma el contenido congelado).
    const signedAt = new Date();
    if (note.isLocked) {
      throw new ForbiddenException('La nota quedó bloqueada por plazo sin firmar. Registre una adenda firmada.');
    }
    return this.prisma.clinicalNote.update({
      where: { id: noteId },
      data: { isLocked: true, signedAt, signatureHash: signatureHashOf(note, signedAt) },
      include: AUTHOR,
    });
  }

  async update(clinicId: string, noteId: string, data: NoteFields, userId: string) {
    const note = await this.prisma.clinicalNote.findFirst({ where: { id: noteId, clinicId } });
    if (!note) throw new NotFoundException('Nota no encontrada');
    if (note.authorId !== userId) throw new ForbiddenException('Solo el autor puede editar su nota');
    const hours = await this.lockHours(clinicId);
    const expired = Date.now() - note.createdAt.getTime() >= hours * 3600000;
    if (note.isLocked || expired) {
      if (!note.isLocked) await this.prisma.clinicalNote.update({ where: { id: noteId }, data: { isLocked: true } });
      throw new ForbiddenException(`Nota bloqueada (firmada o con más de ${hours} h). Registre una adenda.`);
    }
    const { subjective, objective, assessment, plan, content } = data;
    return this.prisma.clinicalNote.update({
      where: { id: noteId },
      data: { subjective, objective, assessment, plan, content },
      include: AUTHOR,
    });
  }

  /** RN-01: adenda firmada que corrige o complementa una nota bloqueada. */
  async addendum(clinicId: string, noteId: string, content: string, userId: string) {
    const original = await this.prisma.clinicalNote.findFirst({ where: { id: noteId, clinicId } });
    if (!original) throw new NotFoundException('Nota no encontrada');
    if (!content?.trim()) throw new BadRequestException('La adenda no puede estar vacía');
    const signedAt = new Date();
    const created = await this.prisma.clinicalNote.create({
      data: {
        clinicId,
        patientId: original.patientId,
        appointmentId: original.appointmentId,
        authorId: userId,
        noteType: 'ADDENDUM',
        parentNoteId: original.id,
        content: content.trim(),
        isLocked: false,
      },
    });
    return this.prisma.clinicalNote.update({
      where: { id: created.id },
      data: { isLocked: true, signedAt, signatureHash: signatureHashOf(created, signedAt) },
      include: AUTHOR,
    });
  }

  /** Verifica que la firma de una nota no haya sido alterada. */
  async verify(clinicId: string, noteId: string) {
    const note = await this.prisma.clinicalNote.findFirst({ where: { id: noteId, clinicId } });
    if (!note) throw new NotFoundException('Nota no encontrada');
    if (!note.signedAt || !note.signatureHash) return { signed: false, valid: false };
    return { signed: true, valid: signatureHashOf(note, note.signedAt) === note.signatureHash, signedAt: note.signedAt };
  }
}
