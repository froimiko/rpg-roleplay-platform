// GitHub /login/device 式设备授权页。外部客户端(本地部署/CLI)发起设备码流后,
// 用户在浏览器打开本页,输入/确认配对码,看清请求方 + 权限 + 防钓鱼提示后批准。
// 未登录时由平台 auth gate 引导登录再回跳本页(/device)。
import React from 'react';
import { useState as useStatePL, useEffect as useEffectPL } from 'react';
import { useTranslation } from 'react-i18next';
import CSContainer from '@cloudscape-design/components/container';
import CSHeader from '@cloudscape-design/components/header';
import CSSpaceBetween from '@cloudscape-design/components/space-between';
import CSBox from '@cloudscape-design/components/box';
import CSButton from '@cloudscape-design/components/button';
import CSInput from '@cloudscape-design/components/input';
import CSAlert from '@cloudscape-design/components/alert';
import CSBadge from '@cloudscape-design/components/badge';

export function DeviceAuthorizePage() {
  const { t } = useTranslation();
  const initialCode = (() => {
    try { return (new URLSearchParams(location.search).get('code') || '').toUpperCase(); } catch { return ''; }
  })();
  const [code, setCode] = useStatePL(initialCode);
  const [info, setInfo] = useStatePL(null);          // {client_name, scopes}
  const [phase, setPhase] = useStatePL('input');      // input | confirm | done | denied | error
  const [busy, setBusy] = useStatePL(false);
  const [err, setErr] = useStatePL('');
  const [provider, setProvider] = useStatePL(null);   // null=loading, true/false

  useEffectPL(() => {
    window.api?.federation?.providerInfo?.()
      .then((r) => setProvider(!!r?.provider_enabled))
      .catch(() => setProvider(false));
  }, []);

  const lookup = async (c) => {
    const uc = (c || code).trim().toUpperCase();
    if (!uc) return;
    setBusy(true); setErr('');
    try {
      const r = await window.api.federation.deviceLookup(uc);
      setInfo(r.device); setPhase('confirm');
    } catch (e) {
      setErr(e?.payload?.error || t('device_page.err_code_not_found')); setPhase('error');
    } finally { setBusy(false); }
  };

  useEffectPL(() => { if (initialCode) lookup(initialCode); /* eslint-disable-next-line */ }, []);

  const decide = async (deny) => {
    setBusy(true); setErr('');
    try {
      await window.api.federation.deviceApprove(code.trim().toUpperCase(), deny);
      setPhase(deny ? 'denied' : 'done');
    } catch (e) {
      setErr(e?.payload?.error || t('device_page.err_action_failed')); setPhase('error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 520, margin: '48px auto', padding: '0 16px' }}>
      <CSContainer header={<CSHeader variant="h1">{t('device_page.page_title')}</CSHeader>}>
        <CSSpaceBetween size="l">
          {provider === false && (
            <CSAlert type="info" header={t('device_page.not_provider_header')}>
              {t('device_page.not_provider_body')}
            </CSAlert>
          )}
          {provider !== false && phase === 'input' && (
            <CSSpaceBetween size="s">
              <CSBox color="text-body-secondary">
                {t('device_page.input_hint')}
              </CSBox>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <CSInput value={code} placeholder="WXYZ-7K9M" autoFocus
                    onChange={({ detail }) => setCode(detail.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.detail.key === 'Enter') lookup(); }} />
                </div>
                <CSButton variant="primary" loading={busy} disabled={!code.trim()} onClick={() => lookup()}>{t('device_page.next_step')}</CSButton>
              </div>
            </CSSpaceBetween>
          )}

          {phase === 'confirm' && info && (
            <CSSpaceBetween size="m">
              <CSBox variant="awsui-key-label">{t('device_page.label_code')}</CSBox>
              <CSBox fontSize="display-l" fontWeight="bold" padding="n" style={{ letterSpacing: 3 }}>{code.toUpperCase()}</CSBox>

              <div>
                <CSBox variant="awsui-key-label">{t('device_page.label_requester')}</CSBox>
                <CSBox>{info.client_name || t('device_page.unnamed_client')}</CSBox>
              </div>
              <div>
                <CSBox variant="awsui-key-label">{t('device_page.label_scopes')}</CSBox>
                <CSSpaceBetween direction="horizontal" size="xs">
                  {(info.scopes || []).map((s) => <CSBadge key={s} color="blue">{t(`device_page.scope_${s.replace(':', '_')}`, s)}</CSBadge>)}
                </CSSpaceBetween>
              </div>

              <CSAlert type="warning" header={t('device_page.confirm_warning_header')}>
                {t('device_page.confirm_warning_body')}
              </CSAlert>

              <CSSpaceBetween direction="horizontal" size="xs">
                <CSButton variant="primary" loading={busy} onClick={() => decide(false)}>{t('device_page.btn_approve')}</CSButton>
                <CSButton loading={busy} onClick={() => decide(true)}>{t('device_page.btn_deny')}</CSButton>
              </CSSpaceBetween>
            </CSSpaceBetween>
          )}

          {phase === 'done' && (
            <CSAlert type="success" header={t('device_page.done_header')}>
              {t('device_page.done_body')}
            </CSAlert>
          )}
          {phase === 'denied' && (
            <CSAlert type="info" header={t('device_page.denied_header')}>{t('device_page.denied_body')}</CSAlert>
          )}
          {phase === 'error' && (
            <CSSpaceBetween size="s">
              <CSAlert type="error" header={t('device_page.error_header')}>{err}</CSAlert>
              <CSButton onClick={() => { setPhase('input'); setInfo(null); setErr(''); }}>{t('device_page.btn_retry')}</CSButton>
            </CSSpaceBetween>
          )}
        </CSSpaceBetween>
      </CSContainer>
    </div>
  );
}

export default DeviceAuthorizePage;
