export type HdUpgradeItemStatus = "pending" | "running" | "complete" | "failed" | "conflict";
export interface HdUpgradeStatus {
  job: { id: string; createdAt: string } | null;
  items: {
    language: string;
    lessonNumber: number;
    status: HdUpgradeItemStatus;
    attempts: number;
    message: string | null;
  }[];
  counts: Record<HdUpgradeItemStatus | "total", number>;
  environment: "production" | "development";
  existingLessons: number;
}
