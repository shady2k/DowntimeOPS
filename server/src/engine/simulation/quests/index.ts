import type { GameState, QuestState } from "@downtime-ops/shared";
import { FIRST_CONTRACT_STEPS, evaluateFirstContract } from "./firstContract";
import { evaluateNetworkFundamentals } from "./networkFundamentals";

export function createInitialQuests(): QuestState {
  return {
    quests: {
      first_contract: {
        id: "first_contract",
        title: "First Contract: PicoApp Hosting",
        description: "PicoApp, a two-person startup building a recipe app, needs hosting for their web service. Set up your datacenter infrastructure — rack, router, switch, server — cable it all together, and get them online.",
        giver: "PicoApp",
        status: "active",
        steps: FIRST_CONTRACT_STEPS.map((def) => ({
          ...def,
          completed: false,
          completedAtTick: null,
        })),
        currentStepIndex: 0,
      },
    },
    activeQuestId: "first_contract",
    tutorialComplete: false,
    networkReady: false,
    firstClientActivated: false,
    firstRevenueEarned: false,
    visitedPages: [],
  };
}

export function evaluateQuests(state: GameState): GameState {
  let newState = state;
  newState = evaluateFirstContract(newState);
  newState = evaluateNetworkFundamentals(newState);
  return newState;
}
