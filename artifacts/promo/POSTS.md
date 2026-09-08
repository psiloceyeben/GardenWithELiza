# Pons Garden — promotional cards and captions

Prepared for review. **Nothing has been published.** Posting is Ben's decision.

Six images: three designs, each as a 1080×1080 square and a 1080×1350 portrait.
Every card is a real screenshot of the live 3D game, captured by
`tools/render-promo-3d.cjs` against `prometheus7.com/ponsgarden` with the interface
hidden. No mock-ups, no invented gameplay, no promises about anything financial.
All copy passes the project's prohibited-phrase list.

Each card carries a "development preview" label, because that is what the site is.

---

## 01 — Your land

**Files:** `01-your-land-1080x1080.png`, `01-your-land-1080x1350.png`

> Your land stays yours. Your plants are another story.
>
> Grow strange plants, build defenses, and keep an eye on the neighbours. Pons Garden
> is a small 3D village where the gardening is peaceful and the neighbours are not.
>
> Play as a guest, no wallet needed:
> https://prometheus7.com/ponsgarden/

## 02 — Grow, guard, sneak back

**Files:** `02-grow-guard-1080x1080.png`, `02-grow-guard-1080x1350.png`

> The plan was a quiet afternoon in the garden.
> Then the neighbour noticed your best plant.
>
> Grow. Guard. Sneak back.
>
> Pons Garden · development preview
> https://prometheus7.com/ponsgarden/

## 03 — The village

**Files:** `03-the-village-1080x1080.png`, `03-the-village-1080x1350.png`

> Five keepers. Ten missions. One very loud potato.
>
> Meet Mayor Gorm, Seedwife Ada, Bram the Barkeep, Warden Pell and the Oracle in the
> shrine. Take a job, run a lap around the fountain, lose a turnip to somebody quicker.
>
> Which would you try first: growing, decorating, or raiding?
>
> https://prometheus7.com/ponsgarden/

---

## Notes before posting

- The captures were taken during the game's night cycle, so they are moody rather than
  bright. If you want daytime cards, rerun the renderer during in-game daylight; the
  script takes a `--url=` argument and needs no other change.
- Say "development preview" wherever you post. The game is playable and real, but the
  chain half is still on a mock reader and the release gates are not finished.
- Do not pair these with any claim about tokens, returns or acquiring anything. The
  game is a game; that separation is the whole legal design.

## Regenerating

On Box C, with the site live:

```bash
ssh root@89.167.7.54 "cd /opt/pons && node tools/render-promo-3d.cjs"
```

Raw captures land in `artifacts/promo/shots/`; the composed cards sit beside this file.
