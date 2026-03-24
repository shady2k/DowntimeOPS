export type QuestId = "first_contract" | "network_fundamentals";
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
  quests: Partial<Record<QuestId, Quest>>;
  activeQuestId: QuestId | null;
  tutorialComplete: boolean;
  networkReady: boolean;
  firstClientActivated: boolean;
  firstRevenueEarned: boolean;
  visitedPages: string[];
}
