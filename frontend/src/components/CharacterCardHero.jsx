import React from 'react';
import MediaStudio from './MediaStudio.jsx';

/* CharacterCardHero — 图片优先的角色卡头图（电影海报 / 角色档案）。
   大图占主导 + 渐变压暗 + 衬线名字叠图；悬停浮现"更换/查看"；
   直接把图片拖到头图上即上传；空态优雅引导。一站式 MediaStudio 更换图片。

   props:
     card      : { id, name, identity?, appearance?, avatar_path? }
     editable  : 是否可编辑（owner，默认 true）
     onChanged(url) : 头像变更后回调（刷新卡）
*/
export default function CharacterCardHero({ card, editable = true, onChanged }) {
  const { useState, useRef, useEffect, useCallback } = React;
  const [studio, setStudio] = useState(false);
  const [light, setLight] = useState(false);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aspect, setAspect] = useState(null);   // 图片自然宽高比(clamp 后)，覆盖 CSS 默认
  const inputRef = useRef(null);

  const raw = card || {};
  const url = raw.avatar_path || '';
  const name = raw.name || '未命名角色';
  const sub = raw.identity || raw.appearance || '';
  const api = (typeof window !== 'undefined' && window.api) || {};

  // 换图时重置比例，待新图 onLoad 重新测量
  useEffect(() => { setAspect(null); }, [url]);

  // 读图片自然尺寸 → 比例 clamp 到 [0.62(竖) , 1.78(横)]：
  // 竖图/方图/横图都能优雅展示，极端长图也不会把卡撑爆（超出部分由模糊填充兜底）。
  const onImgLoad = useCallback((e) => {
    const w = e.target && e.target.naturalWidth;
    const h = e.target && e.target.naturalHeight;
    if (w && h) {
      const r = Math.max(0.62, Math.min(1.78, w / h));
      setAspect(`${r.toFixed(4)} / 1`);
    }
  }, []);

  useEffect(() => {
    if (!light) return;
    const h = (e) => { if (e.key === 'Escape') setLight(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [light]);

  const uploadFile = useCallback(async (file) => {
    if (!file || !/^image\//.test(file.type) || !raw.id) return;
    setUploading(true);
    try {
      const r = await api.cards.uploadAvatar(raw.id, file);
      if (r && r.url) onChanged && onChanged(r.url);
    } catch (_) { try { window.__apiToast && window.__apiToast('上传失败', { kind: 'danger' }); } catch (e) {} }
    finally { setUploading(false); }
  }, [raw.id, onChanged]);

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (!editable) return;
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) uploadFile(f);
  };

  return (
    <>
      <div
        className={`mh-hero${url ? '' : ' mh-hero--empty'}${drag ? ' is-drag' : ''}`}
        onDragOver={editable ? (e) => { e.preventDefault(); setDrag(true); } : undefined}
        onDragLeave={editable ? (e) => { e.preventDefault(); setDrag(false); } : undefined}
        onDrop={editable ? onDrop : undefined}
        onClick={url ? () => setLight(true) : (editable ? () => setStudio(true) : undefined)}
        style={{ ...(url ? { cursor: 'zoom-in' } : {}), ...(aspect ? { aspectRatio: aspect } : {}) }}
      >
        {url ? (
          <>
            <img src={url} className="mh-hero__fill" alt="" aria-hidden="true" loading="lazy" />
            <img src={url} className="mh-hero__img" alt={name} loading="lazy" onLoad={onImgLoad} />
            <div className="mh-hero__scrim" />
            <div className="mh-hero__meta">
              <div className="mh-hero__name">{name}</div>
              {sub && <div className="mh-hero__sub">{sub}</div>}
            </div>
            {editable && (
              <div className="mh-hero__actions">
                <span className="mh-chip" onClick={(e) => { e.stopPropagation(); setStudio(true); }}>✦ 更换形象</span>
              </div>
            )}
            {uploading && <div className="mh-hero__actions" style={{ opacity: 1, left: 12, right: 'auto' }}><span className="mh-chip mh-chip--ghost">上传中…</span></div>}
          </>
        ) : (
          <div className="mh-empty__inner">
            <div className="mh-empty__icon">🎴</div>
            <div className="mh-empty__title">{name}</div>
            <div className="mh-empty__hint">{editable ? '拖入图片 · 粘贴 · 或点击：生成 / 上传 / 选图库' : '暂无形象'}</div>
          </div>
        )}
      </div>

      {editable && (
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) uploadFile(f); e.target.value = ''; }} />
      )}

      {studio && (
        <MediaStudio open onClose={() => setStudio(false)} target={{ type: 'card_avatar', id: raw.id }}
          name={name} defaultPrompt={[name, raw.appearance, raw.identity].filter(Boolean).join('，')}
          onApplied={(u) => { setStudio(false); onChanged && onChanged(u); }} />
      )}

      {light && url && (
        <div className="mlb-backdrop" onClick={() => setLight(false)} role="dialog" aria-modal="true">
          <img src={url} alt={name} style={{ maxWidth: '92vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 10, boxShadow: '0 12px 60px rgba(0,0,0,.7)' }} onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLight(false)} aria-label="关闭" style={{ position: 'absolute', top: 20, right: 24, width: 38, height: 38, borderRadius: 99, border: 0, background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 19, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </>
  );
}
