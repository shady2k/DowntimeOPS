import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { PreloadScene } from "./PreloadScene";
import { RackScene } from "./RackScene";

export function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      backgroundColor: "#1e1814",
      scene: [PreloadScene, RackScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: "100%",
        height: "100%",
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
