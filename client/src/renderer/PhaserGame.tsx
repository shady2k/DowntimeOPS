import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { PreloadScene } from "./PreloadScene";
import { RackScene } from "./RackScene";
import { WorldScene } from "../game/scenes/WorldScene";
import { UIScene } from "../game/scenes/UIScene";

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "#1e1814",
      scene: [PreloadScene, WorldScene, UIScene, RackScene],
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
        width: 960,
        height: 540,
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

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden" }}
    />
  );
}
