-- CreateEnum
CREATE TYPE "Role" AS ENUM ('KARYAWAN', 'PIC_AREA', 'SUPERVISOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "FindingSource" AS ENUM ('SAFETY_REPORT', 'AUDIT_5S');

-- CreateEnum
CREATE TYPE "SafetyCategory" AS ENUM ('UNSAFE_CONDITION', 'UNSAFE_ACT', 'NEAR_MISS');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FiveSPillar" AS ENUM ('SEIRI', 'SEITON', 'SEISO', 'SEIKETSU', 'SHITSUKE');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'ONCE');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FINDING_ASSIGNED', 'FINDING_DUE_SOON', 'FINDING_OVERDUE', 'FINDING_ESCALATED', 'FINDING_SUBMITTED_FOR_VERIFICATION', 'FINDING_VERIFIED_CLOSED', 'FINDING_REJECTED', 'FINDING_INVALIDATED', 'NEW_COMMENT', 'AUDIT_DUE');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "picUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Line" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "npk" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'KARYAWAN',
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistCriterion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "pillar" "FiveSPillar" NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSchedule" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "frequency" "ScheduleFrequency" NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AuditSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT,
    "areaId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,
    "status" "AuditStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" DATE NOT NULL,
    "conductedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "totalScore" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditScore" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "AuditScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "source" "FindingSource" NOT NULL,
    "auditId" TEXT,
    "criterionId" TEXT,
    "pillar" "FiveSPillar",
    "safetyCategory" "SafetyCategory",
    "riskLevel" "RiskLevel",
    "description" TEXT NOT NULL,
    "locationDetail" TEXT,
    "reporterId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "lineId" TEXT,
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "picId" TEXT,
    "dueDate" DATE,
    "actionNote" TEXT,
    "rejectionNote" TEXT,
    "verifiedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingPhoto" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "type" "PhotoType" NOT NULL,
    "filePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FindingStatusHistory" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "fromStatus" "FindingStatus",
    "toStatus" "FindingStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FindingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "findingId" TEXT,
    "auditId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Area_code_key" ON "Area"("code");

-- CreateIndex
CREATE INDEX "Area_departmentId_idx" ON "Area"("departmentId");

-- CreateIndex
CREATE INDEX "Line_areaId_idx" ON "Line"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "User_npk_key" ON "User"("npk");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "ChecklistCriterion_templateId_pillar_idx" ON "ChecklistCriterion"("templateId", "pillar");

-- CreateIndex
CREATE INDEX "AuditSchedule_areaId_idx" ON "AuditSchedule"("areaId");

-- CreateIndex
CREATE INDEX "AuditSchedule_auditorId_idx" ON "AuditSchedule"("auditorId");

-- CreateIndex
CREATE INDEX "Audit_areaId_scheduledDate_idx" ON "Audit"("areaId", "scheduledDate");

-- CreateIndex
CREATE INDEX "Audit_auditorId_status_idx" ON "Audit"("auditorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuditScore_auditId_criterionId_key" ON "AuditScore"("auditId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "Finding_number_key" ON "Finding"("number");

-- CreateIndex
CREATE INDEX "Finding_status_dueDate_idx" ON "Finding"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Finding_picId_status_idx" ON "Finding"("picId", "status");

-- CreateIndex
CREATE INDEX "Finding_areaId_idx" ON "Finding"("areaId");

-- CreateIndex
CREATE INDEX "Finding_reporterId_idx" ON "Finding"("reporterId");

-- CreateIndex
CREATE INDEX "Finding_createdAt_idx" ON "Finding"("createdAt");

-- CreateIndex
CREATE INDEX "FindingPhoto_findingId_idx" ON "FindingPhoto"("findingId");

-- CreateIndex
CREATE INDEX "FindingStatusHistory_findingId_createdAt_idx" ON "FindingStatusHistory"("findingId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_findingId_createdAt_idx" ON "Comment"("findingId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_picUserId_fkey" FOREIGN KEY ("picUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Line" ADD CONSTRAINT "Line_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistCriterion" ADD CONSTRAINT "ChecklistCriterion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AuditSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScore" ADD CONSTRAINT "AuditScore_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditScore" ADD CONSTRAINT "AuditScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ChecklistCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ChecklistCriterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_picId_fkey" FOREIGN KEY ("picId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingPhoto" ADD CONSTRAINT "FindingPhoto_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingPhoto" ADD CONSTRAINT "FindingPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingStatusHistory" ADD CONSTRAINT "FindingStatusHistory_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FindingStatusHistory" ADD CONSTRAINT "FindingStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
