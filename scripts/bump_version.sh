#!/usr/bin/env bash
# bump_version.sh <new-version>  — 版本号单一真源维护脚本(SemVer)。
#
# 把根 VERSION 设为 <new-version>,并同步派生位:frontend/package.json、rpg/pyproject.toml,
# 再把 CHANGELOG 的 [Unreleased] 收口为 [<new-version>] - <today> 并新建空 [Unreleased]。
# 不自动 commit / tag —— 末尾打印建议命令,由发版者确认后执行(tag 只打在 OSS origin)。
#
# 版本规则:MAJOR.MINOR.PATCH[-channel.N];新增 DB migration 至少 bump MINOR。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEW="${1:-}"

if [[ -z "$NEW" ]]; then echo "用法: $0 <new-version>  例如 0.6.0 / 0.6.0-beta.1" >&2; exit 1; fi
# 宽松 SemVer 校验(MAJOR.MINOR.PATCH 可带 -prerelease)
if ! [[ "$NEW" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$ ]]; then
  echo "✗ 非法 SemVer: $NEW (期望 X.Y.Z 或 X.Y.Z-channel.N)" >&2; exit 1
fi

OLD="$(cat "$ROOT/VERSION" 2>/dev/null || echo none)"
TODAY="$(date +%F)"
SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo nogit)"

echo "$NEW" > "$ROOT/VERSION"
# package.json: 仅改顶层 "version"(第一处)。
# ⚠️别用 sed 的 `0,/re/` 地址——那是 GNU 扩展,macOS BSD sed 上**静默无操作且 exit 0**
# (v1.67.3–1.67.5 连续三版 package.json 被静默漏改,2026-07-11 实锤),改用 python3 可移植。
python3 - "$ROOT/frontend/package.json" "$NEW" <<'PY'
import pathlib, re, sys
p = pathlib.Path(sys.argv[1]); s = p.read_text(encoding="utf-8")
s2 = re.sub(r'"version":\s*"[^"]*"', '"version": "%s"' % sys.argv[2], s, count=1)
p.write_text(s2, encoding="utf-8")
PY
# pyproject.toml: 顶层 version
sed -i.bak "s/^version = \"[^\"]*\"/version = \"$NEW\"/" "$ROOT/rpg/pyproject.toml" && rm -f "$ROOT/rpg/pyproject.toml.bak"
# 事后断言:三处派生位必须都已是 $NEW,任何一处静默漏改立即红(杜绝同类哑火)
for f in "$ROOT/frontend/package.json" "$ROOT/rpg/pyproject.toml"; do
  grep -q "\"$NEW\"" "$f" || { echo "✗ 版本位未更新: $f(期望 $NEW)" >&2; exit 1; }
done
# CHANGELOG: [Unreleased] → [NEW] - today (@ sha) + 新空 [Unreleased]
if grep -q '^## \[Unreleased\]' "$ROOT/CHANGELOG.md"; then
  perl -0pi -e "s/## \\[Unreleased\\]/## [Unreleased]\n\n## [$NEW] - $TODAY (\@ $SHA)/" "$ROOT/CHANGELOG.md"
fi

echo "✓ VERSION $OLD → $NEW;已同步 package.json / pyproject.toml / CHANGELOG"
echo ""
echo "下一步(确认后手动执行):"
echo "  git add VERSION frontend/package.json rpg/pyproject.toml CHANGELOG.md"
echo "  git commit -m \"chore(release): v$NEW\""
echo "  # 仅在 OSS origin 打 tag(打包/发版触发):"
echo "  git tag -a v$NEW -m \"v$NEW\"   &&   git push origin v$NEW"
