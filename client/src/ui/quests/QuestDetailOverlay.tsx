import { useGameStore } from "../../store/gameStore";
import { QuestDetailModal } from "./QuestDetailModal";

export function QuestDetailOverlay() {
  const open = useGameStore((s) => s.questDetailOpen);
  const close = useGameStore((s) => s.closeQuestDetail);
  const quests = useGameStore((s) => s.state?.quests);
  const activeId = quests?.activeQuestId;
  const quest = activeId ? quests?.quests?.[activeId] : undefined;

  if (!open || !quest) return null;

  return <QuestDetailModal quest={quest} onClose={close} />;
}
