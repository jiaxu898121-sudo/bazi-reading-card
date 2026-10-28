#!/usr/bin/env node
/* paipan.js — 八字排盘引擎（技能「八字解读卡」专用）
 * 用法：
 *   node paipan.js --date 1996-06-01 --hour 17 --minute 50 --sex m [--lng 115.9] [--pretty]
 *   node paipan.js --date 1996-06-01 --hour 17 --sex m --json-only
 * 参数：
 *   --date   出生公历日期 YYYY-MM-DD（必填）
 *   --hour   出生钟点时辰序号 0..11 或实际小时 0..23（推荐传 0..11 时辰序号）
 *   --minute 分钟，默认 30（每个时辰取中间值）
 *   --sex    m=男 f=女（决定大运顺逆与八宅命卦）
 *   --lng    出生地经度（可选，用于真太阳时校正：偏移=(经度-120)*4 分钟）
 *   --pretty 输出带缩进 JSON（默认压缩一行）
 * 输出：排盘 JSON（四柱/十神/旺衰/格局/喜忌/起运/八步大运/神煞/冲合/称骨/命卦八方）
 * 说明：不留存任何个人信息，仅在标准输出打印。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const LIB_KEYS = ['GAN', 'ZHI', 'GAN_WX', 'ZHI_WX', 'CANG', 'SHENG', 'SHENG_ME', 'KE', 'KE_ME',
  'LIUHE', 'LIUCHONG', 'SANHE', 'LIUHE_HUA', 'LIUHAI', 'GAN_HE', 'CHANGSHENG', 'GAN_YY', 'ZHI_YY',
  'SS_THEME', 'WX_DIR', 'WX_IND', 'WX_ORGAN', 'CG_Y', 'CG_M', 'CG_D', 'CG_H', 'CG_SONG', 'CG_SONG_F',
  'GUA', 'GUA_FANG', 'STAR_TIP', 'DM_QI', 'XIYONG_TIP', 'WX_COLOR'];

function loadLib() {
  const src = fs.readFileSync(path.join(__dirname, 'lib', 'bazi_data.js'), 'utf8');
  const ret = LIB_KEYS.map((k) => (k + ': (typeof ' + k + '!=="undefined" ? ' + k + ' : undefined)')).join(',');
  const fn = new Function(src + '\nreturn {' + ret + '};');
  return fn();
}

function loadLunar() {
  const candidates = [
    path.join(__dirname, 'lib', 'lunar.js'),
    'C:/Users/徐徐/.workbuddy/binaries/node/workspace/node_modules/lunar-javascript/lunar.js'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) { const m = require(p); return m.Lunar && m.Solar ? m : (m.default || m); }
  }
  const m = require('lunar-javascript');
  return m.Lunar && m.Solar ? m : (m.default || m);
}

const argv = process.argv.slice(2);
function arg(k, d) { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; }
const has = (k) => argv.indexOf('--' + k) >= 0;

const dateStr = arg('date');
if (!dateStr) { console.error('缺少 --date YYYY-MM-DD'); process.exit(1); }
const sexArg = (arg('sex', 'm') || 'm').toLowerCase();
const female = sexArg === 'f' || sexArg === '女' || sexArg === 'female';
let hour = parseInt(arg('hour', '0'), 10);
let minute = parseInt(arg('minute', '30'), 10);
const lng = arg('lng') ? parseFloat(arg('lng')) : null;

// 时辰序号 0..11 → 区间起点（子=23-1，丑=1-3 …）；若传入 0..23 的实际小时则直接使用
if (hour >= 0 && hour <= 11) {
  const start = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21][hour];
  hour = start;
}
// 真太阳时校正
let corrNote = '';
if (lng !== null && !isNaN(lng)) {
  const total = hour * 60 + minute + Math.round((lng - 120) * 4);
  let t = ((total % 1440) + 1440) % 1440;
  hour = Math.floor(t / 60); minute = t % 60;
  corrNote = '真太阳时校正 ' + Math.round((lng - 120) * 4) + ' 分钟';
}

const { Solar } = loadLunar();
const lib = loadLib();
const WX5 = ['木', '火', '土', '金', '水'];

const [Y, M, D] = dateStr.split('-').map(Number);
const solar = Solar.fromYmdHms(Y, M, D, hour, minute, 0);
const lunar = solar.getLunar();
const ec = lunar.getEightChar();
const gz = [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()];
const dayGan = gz[2].charAt(0), dayWx = lib.GAN_WX[dayGan], monthZhi = gz[1].charAt(1);

function wxRelation(dayWx, wx) {
  if (wx === dayWx) return 'bi';
  if (lib.SHENG_ME[dayWx] === wx) return 'yin';
  if (lib.SHENG[dayWx] === wx) return 'shi';
  if (lib.KE[dayWx] === wx) return 'cai';
  return 'sha';
}
function shishen(dayGan, target, isZhi) {
  const dayWx = lib.GAN_WX[dayGan];
  const refGan = isZhi ? lib.CANG[target][0] : target;
  const rel = wxRelation(dayWx, lib.GAN_WX[refGan]);
  const same = lib.GAN_YY[dayGan] === lib.GAN_YY[refGan];
  const map = { bi: ['比肩', '劫财'], yin: ['偏印', '正印'], shi: ['食神', '伤官'], cai: ['偏财', '正财'], sha: ['七杀', '正官'] };
  const pair = map[rel];
  return same ? pair[0] : pair[1];
}

// 四柱明细
const CS_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
function starOfDayBranch(dayGan, zhi) {
  const cs = lib.CHANGSHENG[dayGan];
  const pos = cs ? cs.indexOf(zhi) : -1;
  return pos >= 0 ? CS_NAMES[pos] : '';
}

const pillarNames = ['年柱', '月柱', '日柱', '时柱'];
const pillars = gz.map((gzi, i) => {
  const gan = gzi.charAt(0), zhi = gzi.charAt(1);
  const zssTarget = i === 2 ? null : zhi; // 日支为配偶宫，十神仍按本气论，此处保留标注
  return {
    pos: pillarNames[i],
    ganzhi: gzi,
    gan, ganWx: lib.GAN_WX[gan], ganSS: shishen(dayGan, gan, false),
    zhi, zhiWx: lib.ZHI_WX[zhi], zhiSS: shishen(dayGan, zhi, true),
    cang: lib.CANG[zhi].map((c) => ({ gan: c, wx: lib.GAN_WX[c], ss: shishen(dayGan, c, false) })),
    star: starOfDayBranch(dayGan, zhi)
  };
});

// 旺衰（帮扶 vs 耗泄克，月令权重 ×2，藏干余气递减）
let help = 0, drain = 0;
for (let i = 0; i < 4; i++) {
  const g = gz[i].charAt(0), z = gz[i].charAt(1);
  const rel = wxRelation(dayWx, lib.GAN_WX[g]);
  if (rel === 'bi' || rel === 'yin') help += 1; else drain += 1;
  const cz = lib.CANG[z], weights = [1, 0.6, 0.3];
  for (let k = 0; k < cz.length; k++) {
    const r2 = wxRelation(dayWx, lib.GAN_WX[cz[k]]), w = (i === 1 ? 2 : 1) * (weights[k] || 0.3);
    if (r2 === 'bi' || r2 === 'yin') help += w; else drain += w;
  }
}
help = Math.round(help * 100) / 100; drain = Math.round(drain * 100) / 100;
const strong = help > drain * 1.15, weak = help < drain * 0.87;

// 喜忌（扶抑 + 调候修正）
const xi = [], ji = [];
const which = (relList) => WX5.filter((w) => relList.indexOf(wxRelation(dayWx, w)) >= 0);
if (strong) { xi.push(...which(['shi', 'cai', 'sha'])); ji.push(...which(['bi', 'yin'])); }
else { xi.push(...which(['yin', 'bi'])); ji.push(...which(['cai', 'sha'])); }
let tiaohou = '';
if ('亥子丑'.indexOf(monthZhi) >= 0) { tiaohou = '冬生寒重，调候喜火'; WX5.indexOf('火') >= 0 && !xi.includes('火') && xi.push('火'); const k = ji.indexOf('火'); if (k >= 0) ji.splice(k, 1); }
if ('巳午未'.indexOf(monthZhi) >= 0) { tiaohou = '夏生燥热，调候喜水'; if (!xi.includes('水')) xi.push('水'); const k = ji.indexOf('水'); if (k >= 0) ji.splice(k, 1); }

// 格局
function geju() {
  const cs = lib.CHANGSHENG[dayGan], pos = cs ? cs.indexOf(monthZhi) : -1;
  if (pos === 3) return '建禄格';
  if (pos === 4) return '月刃格';
  const cang = lib.CANG[monthZhi];
  for (let k = 0; k < cang.length; k++) {
    for (let i = 0; i < 4; i++) {
      if (i !== 2 && gz[i].charAt(0) === cang[k]) return shishen(dayGan, cang[k], false) + '格（' + cang[k] + '透干）';
    }
  }
  return shishen(dayGan, cang[0], false) + '格';
}

// 大运（顺逆由年干阴阳 × 性别决定，精确起运时刻折算周岁）
const yun = ec.getYun(female ? 0 : 1);
const daYun = yun.getDaYun(10);
const startSolar = yun.getStartSolar();
const birthMs = new Date(Y, M - 1, D, hour, minute, 0).getTime();
const startMs = new Date(startSolar.getYear(), startSolar.getMonth() - 1, startSolar.getDay(), startSolar.getHour(), startSolar.getMinute(), startSolar.getSecond()).getTime();
const age0 = Math.round((startMs - birthMs) / (365.2425 * 24 * 3600 * 1000) * 10) / 10;
const steps = [];
for (let d = 0; d < daYun.length && steps.length < 8; d++) {
  const dy = daYun[d], g2 = dy.getGanZhi();
  if (!g2) continue;
  const idx = steps.length;
  steps.push({
    ganzhi: g2,
    ganSS: shishen(dayGan, g2.charAt(0), false),
    zhiSS: shishen(dayGan, g2.charAt(1), true),
    startYear: startSolar.getYear() + idx * 10,
    startAge: Math.round((age0 + idx * 10) * 10) / 10
  });
}

// 神煞（天乙贵人 / 驿马 / 桃花，按日干、年支日支）
const TIANYI = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '卯巳', 癸: '卯巳', 辛: '寅午' };
const YIMA = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
const TAOHUA = { 申: '酉', 子: '酉', 辰: '酉', 亥: '子', 卯: '子', 未: '子', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午' };
const zhiAll = gz.map((x) => x.charAt(1));
const tianyiBranch = (TIANYI[dayGan] || '').split('');
const yimaBranch = YIMA[zhiAll[3]] || YIMA[zhiAll[2]] || '';
const taohuaBranch = TAOHUA[zhiAll[3]] || TAOHUA[zhiAll[2]] || '';
const shensha = {
  tianyi: zhiAll.filter((z) => tianyiBranch.indexOf(z) >= 0).map((z) => '天乙贵人（' + z + '）'),
  yima: zhiAll.filter((z) => z === yimaBranch).map((z) => '驿马（' + z + '）'),
  taohua: zhiAll.filter((z) => z === taohuaBranch).map((z) => '桃花（' + z + '）'),
  kongwang: (String(lunar.getDayXunKong ? lunar.getDayXunKong() : '') || '').replace(/[^子丑寅卯辰巳午未申酉戌亥]/g, '').split('')
};

// 地支关系
const relations = [];
for (let i = 0; i < 4; i++) {
  for (let j = i + 1; j < 4; j++) {
    const a = zhiAll[i], b = zhiAll[j], pair = [pillarNames[i], pillarNames[j]];
    if (lib.LIUCHONG[a] === b) relations.push(pair.join('') + '相冲（' + a + b + '）');
    else if (lib.LIUHE[a] === b) relations.push(pair.join('') + '六合（' + a + b + '）');
    else if (lib.LIUHAI[a] === b) relations.push(pair.join('') + '相害（' + a + b + '）');
  }
}
const zhiSet = zhiAll.filter((z, i) => zhiAll.indexOf(z) === i);
lib.SANHE.forEach((s) => {
  const set = [s[0], s[1], s[2]];
  const hit = zhiSet.filter((z) => set.indexOf(z) >= 0);
  if (hit.length === 3) relations.push('三合' + s[3] + '局（' + set.join('') + '）');
});
const halfHe = [];
lib.SANHE.forEach((s) => {
  const set = [s[0], s[1], s[2]];
  const hit = zhiSet.filter((z) => set.indexOf(z) >= 0);
  if (hit.length === 2) halfHe.push('半合' + s[3] + '局（' + hit.join('') + '，缺' + set.filter((z) => hit.indexOf(z) < 0)[0] + '）');
});

// 称骨（男女版歌诀）
function chengGu() {
  const yGz = lunar.getYearInGanZhi();
  const m = Math.abs(lunar.getMonth()), d = lunar.getDay(), hZhi = gz[3].charAt(1);
  const yw = lib.CG_Y[yGz] || 0, mw = lib.CG_M[m - 1] || 0, dw = lib.CG_D[d - 1] || 0, hw = lib.CG_H[hZhi] || 0;
  const tot = yw + mw + dw + hw;
  const table = female ? lib.CG_SONG_F : lib.CG_SONG;
  const song = table[tot] || lib.CG_SONG[tot] || '';
  return { detail: { year: yGz, yw, month: m, mw, day: d, dw, hour: hZhi, hw }, total: tot,
           text: Math.floor(tot / 10) + '两' + (tot % 10) + '钱',
           edition: female ? '女版' : '男版', song };
}

// 八宅命卦 + 八方
function mingGua(year) {
  const yy = year % 100;
  let n;
  if (year >= 2000) n = female ? (yy + 6) % 9 : (99 - yy) % 9;
  else n = female ? (yy + 5) % 9 : (100 - yy) % 9;
  if (n === 0) n = 9;
  if (n === 5) n = female ? 8 : 2; // 五黄寄宫：男寄坤、女寄艮
  return n;
}
const guaNum = mingGua(Y);
const gua = lib.GUA[guaNum];
const fang = (lib.GUA_FANG[guaNum] || []).map((r) => ({ dir: r[0], star: r[1], level: r[2], tip: lib.STAR_TIP[r[1]] || '' }));

const out = {
  input: { solar: dateStr + ' ' + hour + ':' + (minute < 10 ? '0' : '') + minute, sex: female ? '女' : '男', lng: lng, corrNote: corrNote },
  lunar: { text: lunar.toString().slice(0, 40), gregorian: solar.toYmdHms(), lunarText: lunar.getMonthInChinese() + '月' + lunar.getDayInChinese() },
  bazi: { pillars, dayGan, dayWx, monthZhi, dayMonthStar: starOfDayBranch(dayGan, monthZhi), dayCount: lib.DM_QI[dayGan] || '' },
  strength: { help, drain, strong, weak, verdict: strong ? '身强' : (weak ? '身弱' : '中和') },
  geju: geju(),
  yong: { xi, ji, tiaohou: tiaohou || '' },
  wxIndustry: xi.map((w) => ({ wx: w, industry: lib.WX_IND[w], dir: lib.WX_DIR[w] })),
  wxOrgan: Object.keys(lib.WX_ORGAN).map((w) => ({ wx: w, organ: lib.WX_ORGAN[w] })),
  qiyun: { age: age0, solarTime: startSolar.toYmdHms(), note: '自起运年起每十年一运' },
  dayun: steps,
  shensha,
  relations: { all: relations, halfHe },
  chengGu: chengGu(),
  mingGua: { num: guaNum, name: gua.n, xiang: gua.x, wx: gua.wx, fang: gua.fang, group: gua.grp + '命', desc: gua.d || '', fangTable: fang },
  jiyang: { dm: lib.DM_QI[dayGan] || '', xi: xi.map((w) => lib.XIYONG_TIP[w]).filter(Boolean) }
};

console.log(has('pretty') ? JSON.stringify(out, null, 2) : JSON.stringify(out));
