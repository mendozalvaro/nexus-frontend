#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const STATE_FILE = '.ai-workflow/STATE.md';
const OUTPUT_FILE = '.ai-workflow/AGENT_CONTEXT.md';
const REFERENCES = [
  { file: 'supabase/schema.sql', label: '🗃️ Schema DB' },
  { file: 'app/types/database.types.ts', label: '📦 Tipos TS' },
  { file: 'app/utils/constants.ts', label: '🔢 Constantes/Enums' },
  { file: 'app/utils/roles.ts', label: '🛡️ Matriz de Permisos' },
  { file: 'copilot-instructions.md', label: '📜 Instrucciones Base' }
];

if (!fs.existsSync(STATE_FILE)) {
  console.error('❌ No se encontró .ai-workflow/STATE.md. Crea el template primero.');
  process.exit(1);
}

const state = fs.readFileSync(STATE_FILE, 'utf8');

function extractSafeContext(filePath, maxLines = 55) {
  if (!fs.existsSync(filePath)) return `// ⚠️ ${filePath} no encontrado`;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  // Extrae solo cabeceras, exports, tipos y comentarios de seguridad
  const preview = lines.slice(0, maxLines).join('\n');
  return `## 📄 ${filePath}\n\`\`\`typescript/sql\n${preview}\n\`\`\`\n`;
}

const refs = REFERENCES.map(r => 
  `### ${r.label}\n${extractSafeContext(r.file)}`
).join('\n');

const context = `# 🤖 AI AGENT CONTEXT (Auto-Generated)
⏱️ Generado: ${new Date().toISOString()}
📌 Fija este archivo con \`# .ai/AGENT_CONTEXT.md\` al inicio del chat.

## 📋 ESTADO ACTUAL (Handoff)
\`\`\`markdown
${state}
\`\`\`

## 🔑 REFERENCIAS CRÍTICAS (Extracto optimizado)
${refs}

## 🚨 REGLAS INMUTABLES (Nexus POS)
- RLS obligatorio: Todo query filtra por \`organization_id\` desde JWT. Nunca hardcodear IDs.
- Auth: Usa \`useAuth()\` en componentes. En server: \`serverSupabaseUser(event)\`.
- Validación: Zod en todos los endpoints de \`/server/api\`. Cero \`any\`.
- No usar \`supabase.from()\` ni \`supabase.auth.getUser()\` en UI.
- Inventario/Logs críticos: Solo vía composables con triggers checksum.
- No modificar archivos fuera de tu dominio (backend/frontend).
- Al finalizar: actualiza \`STATE.md\` → commit → ejecuta \`npx vue-tsc --noEmit\`.
`;

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, context, 'utf8');

const tokenEst = Math.ceil(context.length / 4);
console.log(`✅ Contexto generado: ${OUTPUT_FILE}`);
console.log(`📊 Tokens estimados: ~${tokenEst} (límite seguro < 4K)`);
console.log(`💡 Úsalo en Copilot: # .ai/AGENT_CONTEXT.md`);