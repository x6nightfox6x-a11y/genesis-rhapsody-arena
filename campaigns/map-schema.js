/* Shared by the browser loader and the Node validation command. No DOM or network access. */
(function (root) {
  'use strict';
  const idPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
  function requireValue(ok, message) { if (!ok) throw Error(message); }
  function number(value, min, max) { return Number.isFinite(value) && value >= min && value <= max; }
  function validate(map) {
    requireValue(map?.format === 'gra-map' && map.version === 1 && typeof map.id === 'string' && idPattern.test(map.id), '地图格式、版本或 ID 无效');
    requireValue(typeof map.name === 'string' && map.name.length > 0 && map.name.length <= 100, '地图名称无效');
    const arena = map.arena;
    requireValue(arena && number(arena.width, 1, 128) && number(arena.height, 1, 128), '地图尺寸必须为 1–128');
    requireValue((arena.width * 100 + 20) * (arena.height * 100 + 20) <= 16777216, '地图绘制面积过大');
    requireValue(arena.artMap === map.id, '地图 ID 与 arena.artMap 不一致');
    const ids = new Set();
    for (const key of ['obstacles', 'hazards']) {
      const rectangles = arena[key] || [];
      requireValue(Array.isArray(rectangles) && rectangles.length <= 500, key + ' 必须为最多 500 项的数组');
      for (const rectangle of rectangles) {
        requireValue(rectangle && number(rectangle.x, 0, arena.width) && number(rectangle.y, 0, arena.height) && number(rectangle.w, 0.001, arena.width) && number(rectangle.h, 0.001, arena.height), key + ' 坐标或尺寸无效');
        requireValue(rectangle.x + rectangle.w <= arena.width + 0.00001 && rectangle.y + rectangle.h <= arena.height + 0.00001, key + ' 超出地图边界');
        if (rectangle.id !== undefined) { requireValue(typeof rectangle.id === 'string' && !ids.has(rectangle.id), '障碍物 ID 重复或无效'); ids.add(rectangle.id); }
      }
    }
    requireValue(Array.isArray(arena.obstacles), '地图缺少 obstacles 数组');
    requireValue(map.background === null || typeof map.background === 'string' && map.background.length > 0, '背景图路径无效');
    const campaign = map.initialCampaign;
    requireValue(campaign?.format === 'downbeat-map-campaign' && campaign.version === 1 && campaign.map === map.id && Array.isArray(campaign.cards) && campaign.cards.length <= 40, '默认布阵格式或地图引用无效');
    requireValue(Array.isArray(campaign.units) && campaign.units.length <= 40, '默认布阵最多 40 人');
    const unitIds = new Set();
    for (const unit of campaign.units) {
      requireValue(unit && typeof unit.id === 'string' && unit.id.length > 0 && unit.id.length <= 100 && !unitIds.has(unit.id), '人物 ID 重复或无效'); unitIds.add(unit.id);
      requireValue(['leon', 'grunt', 'slicer'].includes(unit.type) && ['ally', 'enemy'].includes(unit.team) && (unit.team === 'ally' ? unit.type === 'leon' : unit.type !== 'leon'), '人物模板与阵营无效');
      requireValue(typeof unit.name === 'string' && unit.name.trim().length > 0 && unit.name.length <= 60, '人物名称无效');
      const radius = unit.identity?.mechanics?.radius ?? (unit.type === 'leon' ? 0.44 : 0.4);
      requireValue(number(radius, 0.01, 4) && number(unit.x, radius, arena.width - radius) && number(unit.y, radius, arena.height - radius), '默认人物位置超出地图');
      for (const obstacle of arena.obstacles) {
        const x = Math.max(obstacle.x, Math.min(obstacle.x + obstacle.w, unit.x)), y = Math.max(obstacle.y, Math.min(obstacle.y + obstacle.h, unit.y));
        requireValue(Math.hypot(x - unit.x, y - unit.y) >= radius, '默认人物与障碍物重叠：' + unit.id);
      }
      for (const other of campaign.units) if (other !== unit) {
        const otherRadius = other.identity?.mechanics?.radius ?? (other.type === 'leon' ? 0.44 : 0.4);
        requireValue(Math.hypot(other.x - unit.x, other.y - unit.y) >= radius + otherRadius + 0.04, '默认人物位置重叠');
      }
    }
    return map;
  }
  root.ArenaMapSchema = Object.freeze({ validate, validId: value => typeof value === 'string' && idPattern.test(value) });
})(globalThis);
