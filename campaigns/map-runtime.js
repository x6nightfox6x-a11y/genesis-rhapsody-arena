(function (window) {
  'use strict';
  const api = window.ArenaMap = { data: null, error: null };
  api.fail = function (error) {
    api.error = error.message || String(error);
    const show = () => {
      const app = document.getElementById('app'); if (!app) return;
      app.replaceChildren();
      const message = document.createElement('p'); message.id = 'arena-map-error'; message.setAttribute('role', 'alert');
      message.style.cssText = 'color:#ffd1c7;padding:28px;font:16px system-ui;white-space:pre-wrap';
      message.textContent = '地图加载失败：' + api.error + '\n请检查 campaigns/ 中的战役、地图和背景文件，然后刷新重试。'; app.append(message);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true }); else show();
  };
  function localURL(value, base) {
    if (typeof value !== 'string' || !value || /[\\?#\0]/.test(value) || value.startsWith('/') || /^[a-z]+:/i.test(value)) throw Error('战役资源路径无效');
    const url = new URL(value, base), site = new URL('./', location.href);
    if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) throw Error('战役资源必须在当前游戏目录内');
    return url;
  }
  async function getJSON(url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw Error('读取 ' + url.pathname + ' 失败（HTTP ' + response.status + '）');
    return response.json();
  }
  async function load() {
    if (location.protocol === 'file:') throw Error('开发版需要本地预览服务；离线使用请从游戏导出完整 HTML');
    const manifestURL = new URL('campaigns/manifest.json', location.href), manifest = await getJSON(manifestURL);
    const id = new URLSearchParams(location.search).get('campaign') || manifest.defaultCampaign;
    if (manifest.version !== 1 || !ArenaMapSchema.validId(id) || !Array.isArray(manifest.campaigns)) throw Error('战役清单或所选战役 ID 无效');
    const selected = manifest.campaigns.find(campaign => campaign.id === id);
    if (!selected) throw Error('找不到战役：' + id);
    const descriptorURL = localURL(selected.data, location.href), descriptor = await getJSON(descriptorURL);
    if (descriptor.format !== 'gra-campaign' || descriptor.version !== 1 || descriptor.id !== id || typeof descriptor.map !== 'string') throw Error('战役描述无效：' + id);
    const mapURL = localURL(descriptor.map, descriptorURL), map = ArenaMapSchema.validate(await getJSON(mapURL));
    let background = null;
    if (map.background !== null) {
      const response = await fetch(localURL(map.background, mapURL));
      if (!response.ok) throw Error('背景图读取失败（HTTP ' + response.status + '）');
      const blob = await response.blob();
      if (!/^image\/(png|jpeg|webp)$/.test(blob.type) || blob.size > 25000000) throw Error('背景图需要 PNG、JPEG 或 WebP，且小于 25 MB');
      background = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(Error('背景图读取失败')); reader.readAsDataURL(blob); });
      await new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = () => reject(Error('背景图无法解码')); image.src = background; });
    }
    api.data = { ...map, background, campaignId: id };
    return api.data;
  }
  api.ready = load().catch(error => { api.fail(error); throw error; });
  api.ready.catch(() => {});
})(window);
