export type QuestId = "first_contract";
export type QuestStatus = "active" | "completed";

export interface QuestStep {
  id: string;
  title: string;
  description: string;
  hint?: string;
  completed: boolean;
  completedAtTick: number | null;
}

export interface Quest {
  id: QuestId;
  title: string;
  description: string;
  giver: string;
  status: QuestStatus;
  steps: QuestStep[];
  currentStepIndex: number;
}

export interface QuestState {
  quests: Record<QuestId, Quest>;
  activeQuestId: QuestId | null;
  tutorialComplete: boolean;
  networkReady: boolean;
  firstClientActivated: boolean;
  firstRevenueEarned: boolean;
}
