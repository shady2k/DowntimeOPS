import { useGameStore } from "../../store/gameStore";
import { QuestDetailModal } from "./QuestDetailModal";

export function QuestDetailOverlay() {
  const open = useGameStore((s) => s.questDetailOpen);
  const close = useGameStore((s) => s.closeQuestDetail);
  const quest = useGameStore((s) => s.state?.quests?.quests?.first_contract);

  if (!open || !quest) return null;

  return <QuestDetailModal quest={quest} onClose={close} />;
}
