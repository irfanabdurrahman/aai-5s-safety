ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "Audit_scheduleId_scheduledDate_key" ON "Audit"("scheduleId", "scheduledDate");
