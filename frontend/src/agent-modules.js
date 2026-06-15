/* agent-modules — 单一「模块模型」清单(语义统一 #19)
 *
 * 桌面端 ModuleModelsSection(pages/settings.jsx)与移动端(mobile/pages/MobileSettings.jsx)
 * 此前各抄一份逐字相同的模块结构数组(id / prefPrefix / persistShape / dictKey /
 * capabilityFilter / inherit / defaultModel / preferProvider / fallbackPrefix)。
 * 这些是「落库形态 + 能力过滤」的载荷字段,改一处必须改两处,极易漂移 —— 抽到此处单一来源。
 *
 * ⚠️ label / tip 文案两端刻意不同(桌面端详尽、移动端精简),且后续要 i18n,
 *    因此「显示文案」不放进这里(放进来会强行统一 → 改变某端现有显示 = 行为变化)。
 *    各渲染端用 i18nKey 走自己的 i18n / 本地文案表,结构字段则全部来自本数组。
 *
 * ModelConfigInterceptModal 的 CAP_CONFIG(image/embedding/llm 三态)是本表的子集投影:
 *    capability → { prefPrefix, capabilityFilter },由 moduleByPrefix 派生,避免再抄一份 key。
 *
 * 见: pages/settings.jsx::ModuleModelsSection · mobile/pages/MobileSettings.jsx::ModuleModelsSection
 *     components/ModelConfigInterceptModal.jsx::CAP_CONFIG
 */

/**
 * @typedef {Object} AgentModule
 * @property {string}  id               模块稳定标识(渲染端按 id 取本地/i18n 文案)
 * @property {string=} prefPrefix       flat 落库前缀(<prefPrefix>.api_id / .model_real_name)
 * @property {string}  i18nKey          i18n / 本地文案表的键(label/tip 走它)
 * @property {('flat'|'dict')=} persistShape  落库形态(默认 flat)
 * @property {string=} dictKey          dict 形态的单 key({api_id, model})
 * @property {string=} capabilityFilter AgentModelPicker 只展示含此 capability 的模型
 * @property {boolean=} inherit         是否允许「跟随主 GM」
 * @property {string=} defaultModel     无偏好时的默认模型
 * @property {string=} preferProvider   默认优先 provider
 * @property {string=} fallbackPrefix   未配时回退到哪个模块的偏好
 */

/** @type {AgentModule[]} */
export const MODULES = [
  { id: "gm",            i18nKey: "gm",            prefPrefix: "gm" },
  { id: "sub_agent",     i18nKey: "sub_agent",     persistShape: "dict", dictKey: "sub_agent_model_override", inherit: true },
  { id: "set_parser",    i18nKey: "set_parser",    prefPrefix: "set_parser",               inherit: true },
  { id: "console",       i18nKey: "console",       persistShape: "dict", dictKey: "console_assistant_model_override", inherit: true },
  { id: "extractor",     i18nKey: "extractor",     prefPrefix: "extractor",                inherit: true },
  { id: "card_gen",      i18nKey: "card_gen",      prefPrefix: "character_card_generator", inherit: true },
  { id: "card_import",   i18nKey: "card_import",   prefPrefix: "card_import",              inherit: true },
  { id: "critic",        i18nKey: "critic",        prefPrefix: "critic",                   inherit: true },
  { id: "verifier",      i18nKey: "verifier",      prefPrefix: "acceptance_verifier",      inherit: true },
  { id: "phase_digest",  i18nKey: "phase_digest",  prefPrefix: "phase_digest",             inherit: true },
  { id: "black_swan",    i18nKey: "black_swan",    prefPrefix: "black_swan_agent",         inherit: true },
  { id: "agent",         i18nKey: "agent",         prefPrefix: "agent",                    inherit: true },
  { id: "embedder",      i18nKey: "embedder",      prefPrefix: "embed",     capabilityFilter: "embedding", inherit: false, defaultModel: "text-embedding-004", preferProvider: "vertex_ai" },
  { id: "image_gen",     i18nKey: "image_gen",     prefPrefix: "image_gen", capabilityFilter: "image_gen", inherit: false, fallbackPrefix: "gm" },
];

/** prefPrefix → 模块(供 CAP_CONFIG 等子集投影派生 capabilityFilter)。 */
export const moduleByPrefix = MODULES.reduce((acc, m) => {
  if (m.prefPrefix) acc[m.prefPrefix] = m;
  return acc;
}, {});

if (typeof window !== "undefined") {
  window.AGENT_MODULES = MODULES;
}
