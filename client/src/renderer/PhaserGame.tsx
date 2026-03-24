import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { PreloadScene } from "./PreloadScene";
import { RackScene } from "./RackScene";
import { RackUIScene } from "./RackUIScene";
import { WorldScene } from "../game/scenes/WorldScene";
import { UIScene } from "../game/scenes/UIScene";
import { QuestTrackerScene } from "../game/scenes/QuestTrackerScene";
import { useGameStore } from "../store/gameStore";

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const pauseMenuOpen = useGameStore((s) => s.pauseMenuOpen);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    // Render at native DPI for sharp text — scale manager shrinks it back
    const dpr = window.devicePixelRatio || 1;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "#1a1410",
      scene: [PreloadScene, WorldScene, UIScene, RackScene, RackUIScene, QuestTrackerScene],
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 960 * dpr,
        height: 540 * dpr,
      },
      input: {
        mouse: {
          preventDefaultWheel: true,
        },
      },
      render: {
        antialias: true,
        pixelArt: false,
      },
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Block keyboard events from reaching Phaser when menu is open
  useEffect(() => {
    if (!pauseMenuOpen) return;

    const blockForPhaser = (e: KeyboardEvent) => {
      // Let ESC through so the App-level handler can toggle menu
      if (e.key === "Escape") return;
      e.stopImmediatePropagation();
    };

    // Capture phase runs before Phaser's window listeners
    window.addEventListener("keydown", blockForPhaser, true);
    window.addEventListener("keyup", blockForPhaser, true);

    return () => {
      window.removeEventListener("keydown", blockForPhaser, true);
      window.removeEventListener("keyup", blockForPhaser, true);
    };
  }, [pauseMenuOpen]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", zIndex: 1 }}
    />
  );
}
