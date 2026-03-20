# DowntimeOPS Asset Production Guide

## Directory Structure

```
assets/
  backgrounds/    — Room/environment backgrounds (1200x900 base)
  racks/          — Rack frame sprites, rails, caps
  devices/        — Device faceplate sprites and atlases
  cables/         — Cable textures, connector sprites
  fx/             — Particle sprites, glow textures, sparks
  ui/             — UI icons, badges, overlays
```

## Naming Convention

```
{category}-{name}[-{variant}][-{state}].png

Examples:
  device-server-1u.png
  device-server-1u-failed.png
  device-switch-24p.png
  rack-frame-42u.png
  cable-cat6.png
  fx-spark-01.png
  ui-led-green.png
```

Atlas files use matching `.json` sidecar:
```
devices.png + devices.json     (Phaser atlas format)
```

## Sprite Scale & Dimensions

| Asset          | Base Size (px)      | Scale   | Notes                          |
|----------------|--------------------:|---------|--------------------------------|
| Room background | 1200 x 900        | 1x      | Fills world bounds             |
| Rack frame     | 460 x 880          | 1x      | 42U + top/bottom caps (20px)   |
| Device 1U      | 420 x 18           | 1x      | Inner width - 4, slot height - 2 |
| Device 2U      | 420 x 38           | 1x      | Scaled from 1U height          |
| Port LED       | 14 x 14            | 1x      | PORT.RADIUS * 2 + 4 padding   |
| Slot highlight  | 420 x 18           | 1x      | Matches device 1U              |

All sprites are designed at 1x. Phaser handles zoom scaling via camera.

## Color Palette

### Environment
| Role          | Hex       | Usage                    |
|---------------|-----------|--------------------------|
| Room BG       | #0d0d1a   | Darkest background       |
| Floor          | #12121f   | Floor area               |
| Rack frame    | #3a3a4a   | Main rack body           |
| Rack rail     | #505068   | Side rails               |
| Rack inner    | #1e1e30   | Empty slot cavity        |

### Devices
| Type      | Base      | Face      |
|-----------|-----------|-----------|
| Server    | #1a6b42   | #22855a   |
| Switch    | #1a5a8a   | #2278b0   |
| Router    | #8a5a1a   | #b07828   |
| Firewall  | #8a2a2a   | #b03838   |

### Status LEDs
| State   | Color     |
|---------|-----------|
| Up      | #30d060   |
| Down    | #d04040   |
| Error   | #d0a030   |
| Off     | #404050   |

## Export Rules

1. Export as PNG with alpha transparency
2. No anti-aliasing against colored backgrounds — use transparent edges
3. Keep pixel-aligned at 1x — avoid sub-pixel positioning
4. Atlases: pack with 1px padding, power-of-two dimensions preferred
5. Keep source files (Aseprite/PSD) in a separate `art-source/` repo (not in game repo)

## Swap Points

The renderer uses **texture keys** to reference assets. The system has two layers:

1. **TextureGenerator.ts** — generates placeholder textures at runtime using the same keys
2. **PreloadScene.ts** — loads file-based assets that override generated textures

To swap a placeholder for real art:
1. Place the PNG in the correct `assets/` subdirectory
2. Add a `this.load.image("texture-key", "assets/path/to/file.png")` call in PreloadScene
3. The file-loaded texture automatically overrides the generated placeholder

### Current Texture Keys

| Key               | Type     | Size        | Description                    |
|-------------------|----------|-------------|--------------------------------|
| room-bg           | image    | 1200x900    | Datacenter room background     |
| rack-frame        | image    | 460x880     | Rack shell with rails/screws   |
| device-server     | image    | 420x18      | Server 1U faceplate            |
| device-switch     | image    | 420x18      | Switch 1U faceplate            |
| device-router     | image    | 420x18      | Router 1U faceplate            |
| device-firewall   | image    | 420x18      | Firewall 1U faceplate          |
| overlay-selected  | image    | 420x18      | Gold selection tint             |
| overlay-degraded  | image    | 420x18      | Amber degraded tint            |
| overlay-failed    | image    | 420x18      | Red failure tint               |
| overlay-active    | image    | 420x18      | Green active tint              |
| port-up           | image    | 14x14       | Port LED — up state            |
| port-down         | image    | 14x14       | Port LED — down state          |
| port-err          | image    | 14x14       | Port LED — error state         |
| port-off          | image    | 14x14       | Port LED — off state           |
| port-connected    | image    | 14x14       | Connected port ring overlay    |
| slot-valid        | image    | 420x18      | Valid placement highlight       |
| slot-invalid      | image    | 420x18      | Invalid placement highlight    |
| slot-hover        | image    | 420x18      | Hover highlight                |
