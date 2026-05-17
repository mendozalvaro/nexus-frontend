---
name: release-manager
description: Gestiona commits convencionales y versionado Semantic Versioning para este repositorio usando pnpm y flujo de PR de release. Usar cuando el usuario pida preparar commits desde handoff, validar mensajes de commit, decidir bump MAJOR.MINOR.PATCH, o preparar una version prerelease opcional con rama/commit de release.
---

# Release Manager

## Ejecutar objetivo

Aplicar un flujo simple y consistente para:
1. Convertir trabajo de handoff en commit convencional correcto.
2. Determinar bump SemVer (`major`, `minor`, `patch`) segun cambios reales.
3. Preparar release por PR sin depender de GitHub Actions.
4. Soportar prerelease solo cuando se solicite explicitamente (`--prerelease beta`).

## Reglas obligatorias

1. Usar siempre Conventional Commits.
2. Basar tipo/scope/descripcion en el cambio real del handoff, no en intencion futura.
3. No usar `major` salvo `BREAKING CHANGE` real o `!` justificado.
4. Mantener SemVer estable por defecto (`MAJOR.MINOR.PATCH`).
5. Solo usar prerelease cuando el usuario lo pida explicitamente.

## Mapeo de commit a SemVer

- `feat:` -> `minor`
- `fix:` -> `patch`
- `type!:` o footer `BREAKING CHANGE:` -> `major`
- `docs|chore|test|refactor|build|ci` -> sin bump por defecto

Si hay multiples commits desde el ultimo tag:
- priorizar `major` sobre `minor` sobre `patch`.

## Formato de commit

Usar:

```text
<type>(<scope>): <resumen>

[body opcional]

[footer opcional]
```

Ejemplos:

```text
feat(inventory): add transfer batch precheck endpoint
fix(auth): prevent null profile crash on onboarding callback
refactor(reports): move aggregation logic into service layer
feat(billing)!: replace legacy subscription status mapping

BREAKING CHANGE: status enum removed and replaced by lifecycle state
```

## Flujo operativo

1. Revisar handoff y diffs staged/no staged.
2. Proponer un commit por unidad de cambio.
3. Validar mensaje con commitlint.
4. Si se pide release:
- calcular bump por commits desde ultimo tag
- decidir version objetivo (`x.y.z` o `x.y.z-beta.n` si prerelease)
- actualizar artefactos de release del repo (version/changelog)
- crear commit `chore(release): v<version>`
- crear rama `release/v<version>` para PR

## Comandos de referencia (pnpm)

```bash
pnpm commitlint --edit .git/COMMIT_EDITMSG
pnpm run commitlint:ci
pnpm run release
pnpm run release -- --prerelease beta
```

## Checklist de salida

1. Commit(es) convencionales validos y coherentes con handoff.
2. Bump SemVer justificado por evidencia de cambios.
3. Si hubo release: rama `release/v<version>` lista para PR.
4. Resumen final con:
- tipo de bump
- version previa y nueva
- comandos ejecutados
- riesgos o pendientes
