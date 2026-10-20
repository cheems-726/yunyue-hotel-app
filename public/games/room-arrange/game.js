/* 客房摆放 · 摆一摆  ——  v2（多房型 + 选房开场） */
window.__err = null;
window.addEventListener('error', function (e) { window.__err = e.message + ' @' + e.lineno; });
(function () {
  const THREE = window.THREE;
  if (!THREE) {
    document.body.innerHTML = '<div style="padding:40px;font:16px/1.6 sans-serif">three.js 没加载上，检查 vendor/three.min.js</div>';
    return;
  }

  const C = {
    floorBase: '#C79B6C',
    wall: 0xF6F1E6, base: 0xD6CAB6,
    walnut: 0x6A4C36, walnutLt: 0x7C5C42, wood: 0x96704F,
    linen: 0xFBFAF6, duvet: 0xF1E7D4, fabric: 0xC7B9A2,
    metal: 0xB7B0A4, accent: 0x2F6F62, gold: 0xC9A45B,
    glass: 0xD8E8E4, cream: 0xF1E7D3, paper: 0xFFFDF7
  };
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign(
    { color, roughness: .86, metalness: 0 }, o));
  /* 圆角盒：把直角换成圆角，整体立刻变"玩具感" */
  const _geoCache = {};
  function roundedGeo(w, h, d, r) {
    r = Math.max(.004, Math.min(r, w / 2 - .002, h / 2 - .002, d / 2 - .002));
    const key = [w, h, d, r].map(v => v.toFixed(3)).join('|');
    if (_geoCache[key]) return _geoCache[key];
    const x0 = -w / 2 + r, y0 = -h / 2 + r, x1 = w / 2 - r, y1 = h / 2 - r;
    const s = new THREE.Shape();
    s.moveTo(x0, -h / 2);
    s.lineTo(x1, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, y0);
    s.lineTo(w / 2, y1);
    s.quadraticCurveTo(w / 2, h / 2, x1, h / 2);
    s.lineTo(x0, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y1);
    s.lineTo(-w / 2, y0);
    s.quadraticCurveTo(-w / 2, -h / 2, x0, -h / 2);
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: Math.max(.004, d - 2 * r),
      bevelEnabled: true, bevelSize: r, bevelThickness: r,
      bevelSegments: 2, curveSegments: 3, steps: 1
    });
    geo.center();
    _geoCache[key] = geo;
    return geo;
  }
  /* 木纹贴图：灰度纹理 + 材质颜色相乘，避免家具是纯色大块面 */
  const grainTex = (function () {
    const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * s;
      g.strokeStyle = 'rgba(120,90,60,' + (0.05 + Math.random() * 0.09) + ')';
      g.lineWidth = 0.6 + Math.random() * 1.6;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * .3, y + (Math.random() - .5) * 10, s * .7, y + (Math.random() - .5) * 10, s, y + (Math.random() - .5) * 6);
      g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = 'rgba(90,64,40,.10)';
      g.lineWidth = 2;
      const y = Math.random() * s;
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    t.encoding = THREE.sRGBEncoding;
    return t;
  })();

  function woodMat(color, o) {
    o = o || {};
    return new THREE.MeshStandardMaterial({
      color: color, map: grainTex,
      roughness: o.roughness != null ? o.roughness : .72,
      metalness: o.metalness != null ? o.metalness : 0
    });
  }

  /* 织物纹理：细密织纹，避免软装像塑料 */
  const fabricTex = (function () {
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        g.fillStyle = 'rgba(110,90,70,' + (0.03 + Math.random() * 0.05) + ')';
        g.fillRect(x + (y % 4 === 0 ? 1 : 0), y, 1, 1);
      }
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(8, 8);
    t.encoding = THREE.sRGBEncoding;
    return t;
  })();

  function fabricMat(color, o) {
    o = o || {};
    return new THREE.MeshStandardMaterial({
      color: color, map: fabricTex,
      roughness: o.roughness != null ? o.roughness : .97,
      metalness: 0, side: o.side || THREE.FrontSide
    });
  }

  const box = (w, h, d, color, o) => {
    const r = Math.min(.08, w * .30, h * .47, d * .30);
    const m = (o && o.wood) ? woodMat(color, o) : (o && o.fabric) ? fabricMat(color, o) : mat(color, o);
    return new THREE.Mesh(roundedGeo(w, h, d, r), m);
  };
  const cyl = (rt, rb, h, color, o, seg = 22) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, o));
  const put = (m, x, y, z) => { m.position.set(x, y, z); return m; };

  /* ---------- 音效 ---------- */
  let actx = null;
  function beep(freq, dur, vol, type) {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t0 = actx.currentTime;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  const soundSnap = () => { beep(1240, .09, .05); setTimeout(() => beep(1860, .07, .028), 55); };
  const soundPlace = () => beep(460, .07, .025, 'triangle');
  const soundDone = () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .3, .045), i * 105));

  /* ---------- 渲染器 ---------- */
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  if (THREE.ColorManagement) { THREE.ColorManagement.legacyMode = false; THREE.ColorManagement.enabled = true; }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xEFE7D9, 15, 38);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 160);

  scene.add(new THREE.HemisphereLight(0xFFF7E8, 0x6E6A64, .44));
  const key = new THREE.DirectionalLight(0xFFF3DC, 1.62);
  key.position.set(-2.0, 7.5, 9.0);
  key.castShadow = true;
  key.shadow.mapSize.set(3072, 3072);
  key.shadow.camera.left = -6.5; key.shadow.camera.right = 6.5;
  key.shadow.camera.top = 6.5; key.shadow.camera.bottom = -6.5;
  key.shadow.camera.near = .5; key.shadow.camera.far = 36;
  key.shadow.bias = -0.00035; key.shadow.normalBias = 0.018; key.shadow.radius = 3.5;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xDCE8FF, .26); fill.position.set(6, 4, 3); scene.add(fill);
  const bounce = new THREE.DirectionalLight(0xFFEBD2, .26); bounce.position.set(-4, 1.2, -3); scene.add(bounce);
  const winGlow = new THREE.PointLight(0xFFE9C8, .7, 9, 2); winGlow.position.set(-1.2, 1.9, -2.2); scene.add(winGlow);
  // 床顶一碗暖光，制造"灯下"的层次
  const bedSpot = new THREE.SpotLight(0xFFE7C2, .85, 7, .78, 1, 1.4);
  bedSpot.position.set(0, 2.62, 0.4);
  bedSpot.target.position.set(0, 0, 0.2);
  scene.add(bedSpot); scene.add(bedSpot.target);

  /* ---------- 贴图 ---------- */
  function woodTex() {
    const s = 512, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d');
    g.fillStyle = C.floorBase; g.fillRect(0, 0, s, s);
    const rows = 7, h = s / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * h, t = (Math.random() - .5) * 24;
      g.fillStyle = `rgba(${150 + t},${112 + t * .8},${76 + t * .6},.28)`;
      g.fillRect(0, y, s, h);
      g.strokeStyle = 'rgba(96,68,44,.26)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(0, y + h); g.lineTo(s, y + h); g.stroke();
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = `rgba(${112 + Math.random() * 36},${80 + Math.random() * 26},${50 + Math.random() * 18},.15)`;
        g.lineWidth = .6 + Math.random() * 1.5;
        const yy = y + Math.random() * h;
        g.beginPath(); g.moveTo(0, yy);
        g.bezierCurveTo(s * .3, yy + (Math.random() - .5) * 5, s * .6, yy + (Math.random() - .5) * 5, s, yy);
        g.stroke();
      }
      const off = Math.random() * s;
      g.strokeStyle = 'rgba(96,68,44,.22)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(off, y); g.lineTo(off, y + h); g.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2.0, 3.2);
    t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
    return t;
  }

  function wallTex() {
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 256;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#FCF8F0'); gr.addColorStop(.55, '#F3EBDC'); gr.addColorStop(1, '#E2D5BE');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  }

  const blobTex = (function () {
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(70,48,28,.42)');
    gr.addColorStop(.55, 'rgba(70,48,28,.16)');
    gr.addColorStop(1, 'rgba(70,48,28,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  })();

  const aoTex = (function () {
    const s = 64, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, s, 0);
    gr.addColorStop(0, 'rgba(46,36,26,.42)');
    gr.addColorStop(.35, 'rgba(46,36,26,.14)');
    gr.addColorStop(1, 'rgba(46,36,26,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  })();

  const sunTex = (function () {
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'destination-in';
    const gh = g.createLinearGradient(0, 0, s, 0);
    gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(.18, 'rgba(0,0,0,1)');
    gh.addColorStop(.82, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gh; g.fillRect(0, 0, s, s);
    const gv = g.createLinearGradient(0, 0, 0, s);
    gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(.22, 'rgba(0,0,0,1)');
    gv.addColorStop(.78, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gv; g.fillRect(0, 0, s, s);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; return t;
  })();

  function blob(x, z, w, d, y, op) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: op || .9, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + .003, z);
    m.userData.blob = true;
    return m;
  }

  /* ---------- 家具构件 ---------- */
  function addBed(g, f) {
    const W = f.w, L = f.l;
    const grp = new THREE.Group();
    // 四条床腿（底下留出阴影缝）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      grp.add(put(box(.07, .09, .07, 0x3E2A1B, { wood: 1 }), sx * (L / 2 - .13), .045, sz * (W / 2 - .13)));
    }
    // 床架（比床垫内收，形成一圈暗缝）
    grp.add(put(box(L - .06, .11, W - .02, 0x4A3524, { wood: 1 }), 0, .145, 0));
    // 床垫
    grp.add(put(box(L, .26, W, C.linen, { roughness: .94 }), 0, .33, 0));
    // 床垫滚边（一圈浅灰缝线）
    grp.add(put(box(L + .008, .012, W + .008, 0xE6DED0, { roughness: .95 }), 0, .40, 0));
    // 被子（外扩，边缘压出阴影）
    grp.add(put(box(L * .72, .10, W + .14, C.duvet, { fabric: 1 }), L * .14, .49, 0));
    // 被头卷边
    const roll = cyl(.045, .045, W + .12, C.duvet, { roughness: .97 }, 14);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(L * .14 - L * .36 + .04, .525, 0);
    grp.add(roll);
    // 床尾搭毯（随手搭上去的感觉）
    const thr = box(.42, .05, W * .55, 0xD9BE95, { fabric: 1 });
    thr.position.set(L * .40, .565, W * .18);
    thr.rotation.y = .10;
    grp.add(thr);
    // 床旗 + 折边
    grp.add(put(box(.30, .024, W + .16, (f.accent || C.accent), { roughness: .98 }), L * .42, .552, 0));
    grp.add(put(box(.24, .05, W + .12, 0xE4D7C0, { roughness: .95 }), L * .34, .522, 0));
    const hb = new THREE.Group();
    hb.add(put(box(.09, 1.02, W + .16, C.walnut), 0, .72, 0));
    for (let i = -1; i <= 1; i++)
      hb.add(put(box(.03, .78, W * .3, C.fabric, { fabric: 1 }), .02, .70, i * W * .3));
    hb.position.set(-L / 2 + .02, 0, 0);
    grp.add(hb);
    grp.position.set(f.x, 0, f.z);
    if (f.rot) grp.rotation.y = f.rot;
    g.add(grp);
    g.add(blob(f.x, f.z, L + 1.0, W + 1.1, .001, 1.0));
  }

  function addNightstand(g, f) {
    const grp = new THREE.Group();
    grp.add(put(box(.42, .48, .42, C.walnutLt, { wood: 1 }), 0, .30, 0));
    grp.add(put(box(.45, .03, .45, C.wood), 0, .555, 0));
    grp.add(put(box(.006, .012, .3, 0x4E3826), .215, .38, 0));
    grp.add(put(box(.008, .012, .30, 0x3E2A1B), .216, .24, 0));
    const pull = cyl(.012, .012, .12, 0xB9B2A2, { metalness: .6, roughness: .35 }, 10);
    pull.rotation.x = Math.PI / 2;
    pull.position.set(.235, .33, 0);
    grp.add(pull);
    for (const dx of [-.16, .16]) for (const dz of [-.16, .16])
      grp.add(put(cyl(.015, .015, .06, C.walnut, {}, 8), dx, .03, dz));
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, .8, .8, .001, .7));
  }

  function addDesk(g, f) {
    const len = f.len || 2.9, grp = new THREE.Group();
    grp.add(put(box(.44, .045, len, C.wood, { wood: 1 }), 0, .735, 0));
    grp.add(put(box(.38, .09, len - .09, C.walnutLt), .01, .672, 0));
    for (const dz of [-len / 2 + .06, len / 2 - .06]) for (const dx of [-.17, .17])
      grp.add(put(box(.05, .70, .05, C.walnutLt), dx, .35, dz));
    grp.add(put(box(.36, .32, .42, C.walnutLt), .02, .52, -len / 2 + .35));
    grp.add(put(box(.34, .01, .40, 0x4E3826), .02, .62, -len / 2 + .35));
    grp.add(put(box(.34, .01, .40, 0x4E3826), .02, .45, -len / 2 + .35));
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, .8, len + .2, .001, .8));
  }

  function addWardrobe(g, f) {
    const WW = f.len || 1.15, WH = 2.05, WDEP = .52;
    const grp = new THREE.Group();
    grp.add(put(box(.035, WH, WW, 0x6E5138, { wood: 1 }), -.235, WH / 2, 0));
    grp.add(put(box(WDEP, .04, WW, C.wood), 0, WH - .02, 0));
    grp.add(put(box(WDEP, .04, WW, C.wood), 0, .02, 0));
    grp.add(put(box(WDEP, WH, .035, C.wood), 0, WH / 2, -WW / 2 + .017));
    grp.add(put(box(WDEP, WH, .035, C.wood), 0, WH / 2, WW / 2 - .017));
    grp.add(put(box(WDEP - .05, .03, WW - .08, C.wood), 0, 1.30, 0));
    const rail = cyl(.014, .014, WW - .1, C.metal, { metalness: .4, roughness: .45 });
    rail.rotation.x = Math.PI / 2;
    grp.add(put(rail, .1, 1.62, 0));
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, .8, WW + .3, .001, .8));
  }

  function addRack(g, f) {
    const grp = new THREE.Group();
    grp.add(put(box(.56, .035, .84, 0x8A6A50), 0, .42, 0));
    for (const dx of [-.24, .24]) for (const dz of [-.37, .37])
      grp.add(put(cyl(.015, .015, .42, C.walnut, {}, 8), dx, .21, dz));
    for (let i = 0; i < 3; i++)
      grp.add(put(box(.52, .01, .05, 0x54402F), 0, .442, -.28 + i * .28));
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, .78, 1.05, .001, .7));
  }

  function addChair(g, f) {
    const grp = new THREE.Group();
    grp.add(put(box(.42, .05, .42, 0x6E5442), 0, .45, 0));
    grp.add(put(box(.42, .38, .04, 0x6E5442), 0, .67, -.19));
    for (const dx of [-.17, .17]) for (const dz of [-.17, .17])
      grp.add(put(cyl(.016, .016, .45, C.walnut, {}, 8), dx, .225, dz));
    grp.position.set(f.x, 0, f.z);
    if (f.rot) grp.rotation.y = f.rot;
    g.add(grp);
    g.add(blob(f.x, f.z, .8, .8, .001, .6));
  }

  function addArmchair(g, f) {
    const grp = new THREE.Group();
    const ac1 = f.c1 || 0x415C55, ac2 = f.c2 || 0xE0A272, ac3 = f.c3 || 0x3A524C;
    grp.add(put(box(.64, .3, .6, ac1, { fabric: 1 }), 0, .33, 0));
    grp.add(put(box(.60, .1, .54, ac2, { fabric: 1 }), 0, .445, .01));
    grp.add(put(box(.64, .5, .12, ac1, { fabric: 1 }), 0, .64, -.24));
    grp.add(put(box(.1, .24, .56, ac3, { fabric: 1 }), -.27, .55, 0));
    grp.add(put(box(.1, .24, .56, ac3, { fabric: 1 }), .27, .55, 0));
    for (const dx of [-.25, .25]) for (const dz of [-.22, .22])
      grp.add(put(cyl(.016, .016, .18, 0x54402F, {}, 8), dx, .09, dz));
    grp.position.set(f.x, 0, f.z);
    if (f.rot) grp.rotation.y = f.rot;
    g.add(grp);
    g.add(blob(f.x, f.z, .95, .95, .001, .7));
  }

  function addTable(g, f) {
    const grp = new THREE.Group();
    grp.add(put(cyl(.21, .21, .03, C.wood), 0, .46, 0));
    grp.add(put(cyl(.02, .02, .44, C.walnut, {}, 10), 0, .23, 0));
    grp.add(put(cyl(.15, .15, .02, C.walnut), 0, .02, 0));
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, .52, .52, .001, .6));
  }

  function addPlant(g, f) {
    const grp = new THREE.Group();
    grp.add(put(cyl(.13, .16, .28, 0x8A7A66, { roughness: .9 }), 0, .14, 0));
    grp.add(put(cyl(.115, .115, .02, 0x4A3B2C), 0, .28, 0));
    const lm = mat(0x3E5B47, { roughness: .92 });
    [[0, .46, 0, .22], [.12, .54, .05, .16], [-.11, .58, -.04, .14], [.03, .68, .02, .12]].forEach(function (p) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(p[3], 14, 10), lm);
      l.position.set(p[0], p[1], p[2]); l.scale.y = .82; grp.add(l);
    });
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, .6, .6, .001, .55));
  }

  function addRug(g, f) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const q = cv.getContext('2d');
    q.fillStyle = f.base || '#D9A57F'; q.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      q.fillStyle = 'rgba(120,96,64,' + (Math.random() * .07) + ')';
      q.fillRect(Math.random() * 256, Math.random() * 256, 3, 2);
    }
    q.strokeStyle = f.edge || '#B7764F'; q.lineWidth = 12; q.strokeRect(6, 6, 244, 244);
    q.strokeStyle = f.line || '#C98A62'; q.lineWidth = 4; q.strokeRect(20, 20, 216, 216);
    // 中间菱形纹样
    q.strokeStyle = 'rgba(183,118,79,.55)'; q.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      q.beginPath();
      q.moveTo(128, 74 + i * 34); q.lineTo(168, 108 + i * 34);
      q.lineTo(128, 142 + i * 34); q.lineTo(88, 108 + i * 34);
      q.closePath(); q.stroke();
    }
    // 两端流苏
    q.strokeStyle = '#C9AE88'; q.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const x = 12 + i * 9.2;
      q.beginPath(); q.moveTo(x, 0); q.lineTo(x + 1.5, 12); q.stroke();
      q.beginPath(); q.moveTo(x, 256); q.lineTo(x + 1.5, 244); q.stroke();
    }
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.BoxGeometry(f.w || 2.3, .014, f.d || 1.7),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    m.position.set(f.x, .008, f.z);
    g.add(m);
  }

  const tvScreens = [];
  let tvAnimUntil = 0;
  function addTV(g, f) {
    const tv = new THREE.Group();
    tv.add(put(box(.05, .6, 1.02, 0x222A2A), 0, .30, 0));
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 144;
    const q = cv.getContext('2d');
    const gr = q.createLinearGradient(0, 0, 256, 144);
    gr.addColorStop(0, '#1A343C'); gr.addColorStop(.5, '#12262C'); gr.addColorStop(1, '#1D333A');
    q.fillStyle = gr; q.fillRect(0, 0, 256, 144);
    const rg = q.createRadialGradient(118, 76, 6, 118, 76, 130);
    rg.addColorStop(0, 'rgba(140,205,210,.42)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    q.fillStyle = rg; q.fillRect(0, 0, 256, 144);
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tvScreens.push(tex);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(.92, .52), new THREE.MeshBasicMaterial({ map: tex }));
    sc.position.set(-.034, .30, 0); sc.rotation.y = -Math.PI / 2;
    tv.add(sc);
    tv.add(put(box(.14, .03, .22, 0x3A4242), .05, .015, 0));
    tv.position.set(f.x, .755, f.z);
    tv.rotation.y = .12;
    g.add(tv);
  }

  function addArt(g, f) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160;
    const q = cv.getContext('2d');
    const v = Math.abs(Math.round((f.z || 0) * 10)) % 4;
    q.fillStyle = '#EFE9DA'; q.fillRect(0, 0, 128, 160);
    if (v === 0) {
      q.fillStyle = '#B7C1B2'; q.fillRect(10, 14, 72, 92);
      q.fillStyle = '#D9CDB4'; q.fillRect(60, 60, 54, 74);
      q.fillStyle = '#C9A45B'; q.fillRect(16, 120, 46, 4);
    } else if (v === 1) {
      q.fillStyle = '#C9A98A'; q.beginPath(); q.arc(48, 58, 34, 0, Math.PI * 2); q.fill();
      q.fillStyle = '#8FA396'; q.beginPath(); q.arc(84, 104, 26, 0, Math.PI * 2); q.fill();
      q.fillStyle = '#5E4330'; q.fillRect(14, 128, 100, 3);
    } else if (v === 2) {
      q.fillStyle = '#D8CBB4'; q.fillRect(12, 18, 104, 66);
      q.fillStyle = '#B0705A'; q.fillRect(12, 84, 104, 30);
      q.fillStyle = '#3E4A44'; q.fillRect(12, 114, 46, 26);
      q.fillStyle = '#E9DFCB'; q.fillRect(58, 114, 58, 26);
    } else {
      q.strokeStyle = '#8C9A8E'; q.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        q.beginPath(); q.moveTo(14, 30 + i * 24); q.lineTo(114, 24 + i * 24); q.stroke();
      }
      q.fillStyle = '#C98B62'; q.beginPath(); q.arc(64, 84, 22, 0, Math.PI * 2); q.fill();
    }
    const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    const grp = new THREE.Group();
    grp.add(put(box(.04, .62, 1.0, 0x8A6A4A), 0, 0, 0));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.88, .5), new THREE.MeshBasicMaterial({ map: tex }));
    pic.rotation.y = Math.PI / 2;
    pic.position.x = .022;
    grp.add(pic);
    grp.position.set(f.x, f.y || 2.02, f.z);
    g.add(grp);
  }

  function addSlats(g, f, W) {
    const sm = mat(0x7A5A3F, { roughness: .74 });
    for (let z = f.z0; z <= f.z1; z += 0.082) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(.03, 2.46, .05), sm);
      s.position.set(-W / 2 + .015, 1.23, z);
      g.add(s);
    }
  }

  function addCase(g, f) {
    const grp = new THREE.Group();
    grp.add(put(box(.5, .62, .38, 0x3B4A46, { roughness: .55 }), 0, .31, 0));
    grp.add(put(box(.52, .04, .40, 0x2C3835), 0, .60, 0));
    grp.add(put(box(.06, .12, .06, 0x8C8A82, { metalness: .5 }), 0, .66, 0));
    for (const dz of [-.10, .10]) grp.add(put(box(.515, .03, .02, 0x8A6A4A), 0, .40, dz));
    grp.position.set(f.x, .44, f.z);
    g.add(grp);
  }

  function addBlock(g, f) {
    const m = new THREE.Mesh(roundedGeo(f.w, f.h, f.d, .025),
      mat(f.color || 0xEFE7DA, { roughness: f.rough || .95 }));
    m.position.set(f.x, f.y != null ? f.y : f.h / 2, f.z);
    g.add(m);
  }

  function addSofa(g, f) {
    const grp = new THREE.Group();
    const L = f.len || 1.7, D = .86;
    const c1 = f.c1 || 0x6E7B70, c2 = f.c2 || 0x91A094;
    grp.add(put(box(L, .32, D, c1, { fabric: 1 }), 0, .30, 0));
    grp.add(put(box(L - .12, .16, D - .12, c2, { fabric: 1 }), 0, .49, .02));
    grp.add(put(box(L, .55, .16, c1, { fabric: 1 }), 0, .68, -.35));
    grp.add(put(box(.16, .34, D, c1, { fabric: 1 }), -L / 2 + .08, .52, 0));
    grp.add(put(box(.16, .34, D, c1, { fabric: 1 }), L / 2 - .08, .52, 0));
    const cu = box(.42, .3, .12, 0xE8D6BC, { fabric: 1 });
    cu.position.set(-.34, .68, -.24); cu.rotation.x = -.16; grp.add(cu);
    const cu2 = box(.3, .24, .1, 0xC98B62, { fabric: 1 });
    cu2.position.set(.36, .64, -.24); cu2.rotation.x = -.14; grp.add(cu2);
    for (const dx of [-L / 2 + .14, L / 2 - .14]) for (const dz of [-.3, .3])
      grp.add(put(cyl(.02, .02, .16, 0x4A3826, {}, 8), dx, .08, dz));
    grp.position.set(f.x, 0, f.z);
    if (f.rot) grp.rotation.y = f.rot;
    g.add(grp);
    g.add(blob(f.x, f.z, L + .5, D + .4, .001, .85));
  }

  function addCoffee(g, f) {
    const grp = new THREE.Group();
    grp.add(put(box(.92, .05, .52, 0x8A6448, { wood: 1 }), 0, .38, 0));
    grp.add(put(box(.86, .04, .46, 0xC9AE88, { wood: 1 }), 0, .16, 0));
    for (const dx of [-.38, .38]) for (const dz of [-.18, .18])
      grp.add(put(cyl(.018, .018, .38, 0x4A3826, {}, 8), dx, .19, dz));
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, 1.1, .7, .001, .7));
  }

  function addFloorLamp(g, f) {
    const grp = new THREE.Group();
    grp.add(put(cyl(.16, .18, .03, 0x4A3826, {}, 18), 0, .015, 0));
    grp.add(put(cyl(.014, .014, 1.42, 0x6A4E3B, { metalness: .3 }, 10), 0, .73, 0));
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(.13, .21, .24, 22, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xF3E3C6, roughness: .9, side: THREE.DoubleSide, emissive: 0xFFD79A, emissiveIntensity: .45 }));
    sh.position.y = 1.52; grp.add(sh);
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, .5, .5, .001, .55));
  }

  /* ---------- 卫浴 / 玄关构件 ---------- */
  function addBathroom(g, f) {
    const W = f.w, D = f.d, H = 2.62;   // 通高，下实上磨砂玻璃
    const grp = new THREE.Group();
    const wallM = mat(0xEFE7DA, { roughness: .92 });
    const frostMat = new THREE.MeshStandardMaterial({
      color: 0xE8F0EC, transparent: true, opacity: .22, roughness: .35, metalness: .05
    });

    grp.add(put(box(W, .04, D, 0xD6D0C3, { roughness: .5 }), 0, .02, 0));

    // 前墙（朝客房）：下实上玻
    grp.add(put(box(W, 1.05, .07, wallM), 0, .525, -D / 2));
    const fg = new THREE.Mesh(new THREE.BoxGeometry(W, H - 1.05, .05), frostMat);
    fg.position.set(0, 1.05 + (H - 1.05) / 2, -D / 2);
    grp.add(fg);
    // 侧墙（朝走廊）：下实上玻
    grp.add(put(box(.07, .48, D, wallM), W / 2, .24, 0));
    const pg = new THREE.Mesh(new THREE.BoxGeometry(.05, H - .48, D), frostMat);
    pg.position.set(W / 2, .48 + (H - .48) / 2, 0);
    grp.add(pg);

    const shW = .85;
    const shGlass = new THREE.Mesh(new THREE.BoxGeometry(.04, 1.95, .85),
      new THREE.MeshStandardMaterial({ color: 0xDCE7E4, transparent: true, opacity: .22, roughness: .08 }));
    shGlass.position.set(-W / 2 + shW, .98, -D / 2 + .45);
    grp.add(shGlass);
    grp.add(put(box(.02, .95, .02, 0x8E8C86, { metalness: .6, roughness: .3 }), -W / 2 + .16, 1.75, -D / 2 + .18));
    grp.add(put(cyl(.09, .09, .03, 0xB8B6AE, { metalness: .7, roughness: .25 }), -W / 2 + .22, 2.15, -D / 2 + .3));
    grp.add(put(box(shW - .1, .02, .7, 0xB9B3A6, { roughness: .5 }), -W / 2 + shW / 2 + .05, .045, -D / 2 + .45));

    const toilet = new THREE.Group();
    toilet.add(put(box(.36, .38, .52, 0xF4F2EC, { roughness: .35 }), 0, .19, 0));
    toilet.add(put(cyl(.19, .17, .1, 0xF7F5F0, { roughness: .3 }), 0, .42, .04));
    toilet.add(put(box(.34, .5, .12, 0xF4F2EC, { roughness: .4 }), 0, .45, -.22));
    toilet.position.set(W / 2 - .42, 0, D / 2 - .45);
    grp.add(toilet);

    grp.add(put(box(.5, .02, .02, 0xB8B4AA, { metalness: .6, roughness: .3 }), W / 2 - .3, 1.05, D / 2 - .1));

    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, W + .3, D + .3, .001, .55));
  }

  function addVanity(g, f) {
    const grp = new THREE.Group();
    grp.add(put(box(.58, .06, 1.0, 0xE9E2D4, { roughness: .5 }), 0, .84, 0));
    grp.add(put(box(.56, .05, .96, 0xC9BCA4, { roughness: .7 }), 0, .80, 0));
    grp.add(put(box(.52, .42, .92, 0x8A6A50, { roughness: .7 }), 0, .56, 0));
    grp.add(put(box(.5, .02, .88, 0xCBB89A, { roughness: .8 }), 0, .34, 0));
    grp.add(put(cyl(.19, .16, .13, 0xFAF9F5, { roughness: .2 }), 0, .90, -.12));
    grp.add(put(cyl(.15, .15, .02, 0xFFFFFF, { roughness: .3 }), 0, .965, -.12));
    grp.add(put(cyl(.012, .012, .22, 0xB9B6AE, { metalness: .8, roughness: .2 }, 10), -.19, 1.0, -.12));
    grp.add(put(box(.12, .02, .02, 0xB9B6AE, { metalness: .8, roughness: .2 }), -.13, 1.10, -.12));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.28, .022, 10, 40),
      mat(0xD9D3C6, { metalness: .5, roughness: .35 }));
    ring.position.set(.28, 1.52, 0);
    ring.rotation.y = -Math.PI / 2;
    grp.add(ring);
    const mir = new THREE.Mesh(new THREE.CircleGeometry(.27, 32),
      new THREE.MeshStandardMaterial({ color: 0xCFDAD8, roughness: .08, metalness: .65 }));
    mir.position.set(.275, 1.52, 0);
    mir.rotation.y = -Math.PI / 2;
    grp.add(mir);
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
    g.add(blob(f.x, f.z, .8, 1.2, .001, .6));
  }

  function addNiche(g, f) {
    const grp = new THREE.Group();
    grp.add(put(box(.34, .04, .9, 0xC9BCA4, { roughness: .8 }), 0, 1.72, 0));
    grp.add(put(box(.34, .04, .9, 0xC9BCA4, { roughness: .8 }), 0, 1.05, 0));
    grp.add(put(box(.34, 1.9, .04, 0xBFAE94, { roughness: .85 }), 0, 1.0, -.45));
    grp.add(put(box(.34, 1.9, .04, 0xBFAE94, { roughness: .85 }), 0, 1.0, .45));
    const rail = cyl(.014, .014, .8, 0xB7B0A4, { metalness: .5, roughness: .4 });
    rail.rotation.x = Math.PI / 2;
    grp.add(put(rail, .03, 1.62, 0));
    grp.position.set(f.x, 0, f.z);
    g.add(grp);
  }

  function addHeadwall(g, f) {
    const grp = new THREE.Group();
    grp.add(put(box(f.len, 2.35, .08, 0xC3AE94, { roughness: .95 }), 0, 1.175, 0));
    for (let x = -f.len / 2 + .08; x <= f.len / 2 - .08; x += .115) {
      grp.add(put(box(.045, 2.2, .02, 0xB09A80, { roughness: .95 }), x, 1.15, .05));
    }
    const strip = new THREE.Mesh(new THREE.BoxGeometry(f.len - .1, .035, .03),
      new THREE.MeshStandardMaterial({ color: 0xFFE3B8, emissive: 0xFFC98A, emissiveIntensity: 1.2 }));
    strip.position.set(0, 2.22, .06);
    grp.add(strip);
    grp.position.set(f.x, 0, f.z);
    if (f.rot) grp.rotation.y = f.rot;
    g.add(grp);
  }

  /* ---------- 物品模型 ---------- */
  const DEFS = [
    { id: 'slippers', name: '拖鞋', build: function () {
        const g = new THREE.Group();
        for (const dx of [-.068, .068]) {
          g.add(put(box(.105, .032, .26, C.cream, { roughness: .96 }), dx, .017, 0));
          g.add(put(box(.095, .030, .065, 0xE3D5B9), dx, .048, .018));
        }
        return g;
      } },
    { id: 'remote', name: '遥控器', build: function () {
        const g = new THREE.Group();
        g.add(put(box(.05, .022, .165, 0x333B3B, { roughness: .7 }), 0, .011, 0));
        for (const dz of [-.05, -.02, .01]) g.add(put(box(.03, .004, .014, 0x6C7676), 0, .024, dz));
        return g;
      } },
    { id: 'glass', name: '水杯', build: function () {
        const g = new THREE.Group();
        g.add(put(cyl(.036, .029, .105, C.glass, { transparent: true, opacity: .55, roughness: .18, metalness: .05 }), 0, .053, 0));
        g.add(put(cyl(.032, .032, .05, 0x9CC7D4, { transparent: true, opacity: .45, roughness: .1 }), 0, .033, 0));
        return g;
      } },
    { id: 'bottle', name: '矿泉水', build: function () {
        const g = new THREE.Group();
        g.add(put(cyl(.032, .032, .17, 0xB9D9E4, { transparent: true, opacity: .72, roughness: .3 }), 0, .087, 0));
        g.add(put(cyl(.021, .028, .03, 0x8FB9C6), 0, .187, 0));
        g.add(put(cyl(.026, .026, .012, 0x3F7A8C), 0, .207, 0));
        g.add(put(cyl(.033, .033, .055, 0xF2F4F0, { roughness: .8 }), 0, .085, 0));
        return g;
      } },
    { id: 'card', name: '晚安卡', build: function () {
        const g = new THREE.Group();
        g.add(put(box(.115, .008, .165, C.paper, { roughness: .9 }), 0, .004, 0));
        g.add(put(box(.10, .001, .002, C.gold), 0, .009, -.062));
        g.add(put(box(.06, .001, .002, 0xBFA275), 0, .009, .02));
        g.add(put(box(.045, .001, .002, 0xBFA275), 0, .009, .045));
        return g;
      } },
    { id: 'hangers', name: '衣架', build: function () {
        const g = new THREE.Group();
        const mk = (dz) => {
          const h = new THREE.Group();
          const bar = cyl(.008, .008, .36, 0x8A6A50, {}, 8);
          bar.rotation.z = Math.PI / 2; h.add(put(bar, 0, -.16, 0));
          const l = put(box(.012, .13, .012, 0x8A6A50), -.086, -.10, 0); l.rotation.z = .55; h.add(l);
          const r = put(box(.012, .13, .012, 0x8A6A50), .086, -.10, 0); r.rotation.z = -.55; h.add(r);
          h.add(put(new THREE.Mesh(new THREE.TorusGeometry(.032, .007, 6, 12, Math.PI * 1.35),
            mat(0xA9A296, { metalness: .4, roughness: .45 })), 0, .015, 0));
          h.position.z = dz; return h;
        };
        g.add(mk(-.10)); g.add(mk(0)); g.add(mk(.10));
        return g;
      } },
    { id: 'bin', name: '垃圾桶', build: function () {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(.115, .095, .28, 26, 1, true),
          mat(0x4A5252, { side: THREE.DoubleSide, roughness: .75 }));
        body.position.y = .14; g.add(body);
        g.add(put(new THREE.Mesh(new THREE.CylinderGeometry(.095, .095, .012, 26), mat(0x3C4444)), 0, .008, 0));
        g.add(put(new THREE.Mesh(new THREE.TorusGeometry(.113, .006, 6, 26), mat(0x5B6565)), 0, .278, 0));
        return g;
      } },
    { id: 'notepad', name: '便签纸笔', build: function () {
        const g = new THREE.Group();
        g.add(put(box(.13, .012, .185, C.paper), 0, .006, 0));
        g.add(put(box(.125, .004, .18, 0xF0EBDD), 0, .014, 0));
        const pen = cyl(.005, .005, .125, 0x2E4B45, { roughness: .6 }, 10);
        pen.rotation.z = Math.PI / 2; pen.position.set(.02, .022, .105); g.add(pen);
        return g;
      } },
    { id: 'lamp', name: '台灯', build: function () {
        const g = new THREE.Group();
        g.add(put(cyl(.062, .070, .022, 0x4E3A2C), 0, .011, 0));
        g.add(put(cyl(.011, .011, .30, 0x6A4E3B, { metalness: .2 }, 12), 0, .165, 0));
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(.055, .092, .13, 24, 1, true),
          new THREE.MeshStandardMaterial({ color: 0xF6E6C8, roughness: .9, side: THREE.DoubleSide, emissive: 0xFFD79A, emissiveIntensity: .35 }));
        shade.position.y = .365; g.add(shade);
        g.add(put(cyl(.054, .054, .004, 0xFFF1D6, { emissive: 0xFFC97A, emissiveIntensity: .8 }), 0, .305, 0));
        return g;
      } },
    { id: 'pillow', name: '枕头', build: function () {
        const g = new THREE.Group();
        const geo = new THREE.SphereGeometry(1, 20, 14);
        for (const dz of [-.30, .30]) {
          const s = new THREE.Mesh(geo, mat(C.linen, { roughness: .96 }));
          s.scale.set(.23, .105, .34); s.position.set(0, .105, dz); g.add(s);
        }
        return g;
      } },
    { id: 'towel', name: '浴巾', build: function () {
        const g = new THREE.Group();
        g.add(put(box(.24, .035, .34, C.linen, { roughness: .97 }), 0, .017, 0));
        g.add(put(box(.23, .030, .33, 0xF7F3E8, { roughness: .97 }), 0, .048, 0));
        g.add(put(box(.05, .012, .36, 0xD9CBB2), 0, .036, 0));
        return g;
      } },
    { id: 'kettle', name: '电水壶', build: function () {
        const g = new THREE.Group();
        g.add(put(cyl(.062, .070, .135, 0xDCD8CE, { roughness: .55, metalness: .25 }), 0, .068, 0));
        g.add(put(cyl(.055, .062, .022, 0x8C8A82, { metalness: .5, roughness: .35 }), 0, .146, 0));
        g.add(put(cyl(.014, .014, .018, 0x4E4C46), 0, .166, 0));
        const h = new THREE.Mesh(new THREE.TorusGeometry(.048, .011, 8, 18, Math.PI * 1.1), mat(0x3E3C38, { roughness: .6 }));
        h.rotation.y = Math.PI / 2; h.rotation.z = -.35; h.position.set(.072, .085, 0); g.add(h);
        return g;
      } },
    { id: 'tissue', name: '纸巾盒', build: function () {
        const g = new THREE.Group();
        g.add(put(box(.125, .062, .125, 0xE8DFCB, { roughness: .9 }), 0, .031, 0));
        g.add(put(box(.085, .028, .028, C.paper, { roughness: .95 }), 0, .072, 0));
        return g;
      } },
    { id: 'phone', name: '电话', build: function () {
        const g = new THREE.Group();
        g.add(put(box(.185, .045, .15, 0x333B3B, { roughness: .7 }), 0, .022, 0));
        g.add(put(box(.165, .012, .085, 0x9AA3A3, { roughness: .5 }), 0, .050, -.025));
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
          g.add(put(box(.022, .004, .016, 0x6E7878), -.045 + i * .045, .046, .025 + j * .022));
        return g;
      } }
  ];

  /* ================= 房型配置 ================= */
  const SPECS = {
    jj: {
      key: 'jj', brand: '全 季', name: '大床房',
      desc: '28㎡ · 1.8m 大床 · 床头木格栅 · 窗边长桌',
      w: 3.8, d: 6.4, h: 2.7,
      window: { x0: -1.35, x1: 1.35, y0: .30, y1: 2.30 },
      furniture: [
        { t: 'slats', z0: -2.36, z1: 0.18 },
        { t: 'rug', x: 0.18, z: 0.30, w: 2.30, d: 1.70 },
        { t: 'bed', x: -0.86, z: -1.10, w: 1.8, l: 2.08 },
        { t: 'nightstand', x: -1.66, z: -2.21 },
        { t: 'nightstand', x: -1.66, z: 0.01 },
        { t: 'desk', x: 1.62, z: -0.95, len: 2.95 },
        { t: 'tv', x: 1.66, z: -1.75 },
        { t: 'chair', x: 1.06, z: -0.55, rot: -1.5708 },
        { t: 'wardrobe', x: -1.66, z: 1.72, len: 1.15 },
        { t: 'rack', x: -1.62, z: 2.72 },
        { t: 'case', x: -1.62, z: 2.72 },
        { t: 'armchair', x: -0.35, z: -2.86, rot: .15 },
        { t: 'table', x: -1.18, z: -2.86 },
        { t: 'plant', x: -1.72, z: -2.98 },
        { t: 'art', x: -1.83, z: -1.10, y: 2.02 }
      ],
      items: {
        slippers: [[0.42, .012, 0.20, Math.PI / 2]],
        remote: [[-1.66, .572, -0.16, 0]],
        glass: [[1.62, .762, -0.42, 0]],
        bottle: [[1.62, .762, -0.05, 0]],
        card: [[-1.28, .556, -1.58, .18]],
        hangers: [[-1.66, 1.62, 1.72, 0]],
        bin: [[1.14, .002, -2.32, 0]],
        notepad: [[1.62, .762, -0.80, 0]],
        lamp: [[1.62, .762, -2.10, 0]],
        pillow: [[-1.45, .466, -1.10, 0]],
        towel: [[-0.12, .548, -1.10, 0]],
        kettle: [[1.62, .762, 0.70, 0]],
        tissue: [[1.66, .762, 0.32, 0]],
        phone: [[-1.66, .572, -2.21, 0]]
      },
      surfaces: [
        { y: 1.30, x: [-1.92, -1.40], z: [1.15, 2.30] },
        { y: 0.757, x: [1.40, 1.84], z: [-2.42, 0.52] },
        { y: 0.570, x: [-1.87, -1.45], z: [-2.42, -2.00] },
        { y: 0.570, x: [-1.87, -1.45], z: [-0.20, 0.22] },
        { y: 0.540, x: [-1.33, 0.17], z: [-1.85, -0.35] },
        { y: 0.460, x: [-1.90, -1.33], z: [-2.00, -0.20] },
        { y: 0.440, x: [-1.90, -1.34], z: [2.30, 3.14] },
        { y: 0.000, x: [-1.88, 1.88], z: [-3.10, 3.10] }
      ],
      beds: [{ x: -0.86, z: -1.10, w: 1.8, l: 2.08 }]
    },

    ht3: {
      key: 'ht3', brand: '汉 庭', type: '大床房', name: '大床房（3.0）',
      desc: '26㎡ · 三段式：玄关开放洗手台 / 独立卫浴 / 客房主体',
      w: 3.6, d: 7.2, h: 2.7,
      window: { x0: -1.50, x1: 0.30, y0: .30, y1: 2.30 },
      cam: { dir: [.48, .72, .50], tgt: [.05, .38, .22], fov: 32, ew: 1.86, eh: 3.88 },
      furniture: [
        { t: 'bathroom', x: -1.05, z: 2.50, w: 1.5, d: 1.9 },
        { t: 'vanity', x: 1.50, z: 2.95 },
        { t: 'niche', x: 1.60, z: 2.05 },
        { t: 'rug', x: 0.30, z: -2.25, w: 1.70, d: 1.45 },
        { t: 'bed', x: -0.76, z: -0.20, w: 1.8, l: 2.08 },
        { t: 'headwall', x: -1.74, z: -0.20, len: 2.0, rot: Math.PI / 2 },
        { t: 'nightstand', x: -1.59, z: -1.14 },
        { t: 'nightstand', x: -1.59, z: 0.96 },
        { t: 'desk', x: 1.55, z: 0.30, len: 1.70 },
        { t: 'tv', x: 1.59, z: 0.30 },
        { t: 'chair', x: 1.02, z: 1.35, rot: -1.5708 },
        { t: 'armchair', x: -0.55, z: -2.95, rot: .2 },
        { t: 'table', x: -1.30, z: -3.00 },
        { t: 'plant', x: 0.90, z: -3.22 }
      ],
      items: {
        slippers: [[0.55, .012, 0.95, Math.PI / 2]],
        remote: [[-1.59, .572, 0.96, 0]],
        glass: [[1.55, .762, 0.75, 0]],
        bottle: [[1.55, .762, 0.45, 0]],
        card: [[-1.15, .556, -0.20, .2]],
        hangers: [[1.60, 1.62, 2.05, 0]],
        bin: [[1.10, .002, 1.60, 0]],
        notepad: [[1.55, .762, 1.00, 0]],
        lamp: [[1.55, .762, -0.35, 0]],
        pillow: [[-1.50, .466, -0.20, 0]],
        towel: [[-0.05, .548, -0.20, 0]],
        kettle: [[1.50, .872, 3.05, 0]],
        tissue: [[1.50, .872, 2.70, 0]],
        phone: [[-1.59, .572, -1.14, 0]]
      },
      surfaces: [
        { y: 1.72, x: [1.43, 1.77], z: [1.60, 2.50] },
        { y: 0.872, x: [1.21, 1.79], z: [2.45, 3.45] },
        { y: 0.757, x: [1.33, 1.77], z: [-0.55, 1.15] },
        { y: 0.570, x: [-1.80, -1.38], z: [-1.35, -0.93] },
        { y: 0.570, x: [-1.80, -1.38], z: [0.75, 1.17] },
        { y: 0.540, x: [-1.22, 0.28], z: [-1.15, 0.75] },
        { y: 0.460, x: [-1.80, -1.22], z: [-1.10, 0.70] },
        { y: 0.000, x: [-1.78, 1.78], z: [-3.55, 3.55] }
      ],
      beds: [{ x: -0.76, z: -0.20, w: 1.8, l: 2.08 }]
    },

    ht: {
      key: 'ht', brand: '汉 庭', name: '标准双床房',
      desc: '22㎡ · 两张 1.2m 单床 · 中间床头柜 · 长桌电视墙',
      w: 3.6, d: 6.2, h: 2.7,
      window: { x0: -1.18, x1: 1.18, y0: .35, y1: 2.25 },
      furniture: [
        { t: 'slats', z0: -2.62, z1: 0.50 },
        { t: 'rug', x: 0.55, z: -1.05, w: 1.35, d: 2.55 },
        { t: 'bed', x: -0.80, z: -1.95, w: 1.2, l: 2.0 },
        { t: 'bed', x: -0.80, z: -0.15, w: 1.2, l: 2.0 },
        { t: 'nightstand', x: -1.50, z: -1.05 },
        { t: 'nightstand', x: -1.50, z: 0.66 },
        { t: 'desk', x: 1.55, z: -1.05, len: 2.70 },
        { t: 'tv', x: 1.59, z: -1.55 },
        { t: 'chair', x: 1.02, z: -0.40, rot: -1.5708 },
        { t: 'wardrobe', x: -1.55, z: 1.75, len: 1.15 },
        { t: 'rack', x: -1.45, z: 2.72 },
        { t: 'plant', x: -1.62, z: -2.92 },
        { t: 'art', x: -1.73, z: -1.05, y: 2.02 }
      ],
      items: {
        slippers: [[0.42, .012, -1.05, Math.PI / 2]],
        remote: [[-1.50, .572, -1.05, 0]],
        glass: [[1.55, .762, -0.55, 0]],
        bottle: [[1.55, .762, -0.20, 0]],
        card: [[-1.05, .548, -1.95, .18]],
        hangers: [[-1.55, 1.62, 1.75, 0]],
        bin: [[1.15, .002, -2.45, 0]],
        notepad: [[1.55, .762, -1.00, 0]],
        lamp: [[1.55, .762, -2.00, 0]],
        pillow: [[-1.55, .466, -1.95, 0]],
        pillow2: [[-1.55, .466, -0.15, 0]],
        towel: [[-0.45, .548, -1.95, 0]],
        towel2: [[-0.45, .548, -0.15, 0]],
        kettle: [[1.55, .762, 0.15, 0]],
        tissue: [[1.55, .762, -1.50, 0]],
        phone: [[-1.50, .572, 0.66, 0]]
      },
      surfaces: [
        { y: 1.30, x: [-1.80, -1.30], z: [1.20, 2.30] },
        { y: 0.757, x: [1.33, 1.77], z: [-2.40, 0.30] },
        { y: 0.570, x: [-1.71, -1.29], z: [-1.26, -0.84] },
        { y: 0.570, x: [-1.71, -1.29], z: [0.45, 0.87] },
        { y: 0.540, x: [-1.24, 0.20], z: [-2.61, -1.29] },
        { y: 0.540, x: [-1.24, 0.20], z: [-0.81, 0.51] },
        { y: 0.460, x: [-1.80, -1.24], z: [-2.55, -1.35] },
        { y: 0.460, x: [-1.80, -1.24], z: [-0.75, 0.45] },
        { y: 0.440, x: [-1.73, -1.17], z: [2.30, 3.14] },
        { y: 0.000, x: [-1.78, 1.78], z: [-3.05, 3.05] }
      ],
      beds: [
        { x: -0.80, z: -1.95, w: 1.2, l: 2.0 },
        { x: -0.80, z: -0.15, w: 1.2, l: 2.0 }
      ]
    }
  };

  /* ===== 三段式重构：全季 / 汉庭双床 也按「玄关→卫浴→客房」重排 ===== */
  Object.assign(SPECS.jj, {
    type: '大床房',
    desc: '28㎡ · 玄关洗手台 / 独立卫浴 / 客房主体 · 窗边长桌',
    d: 7.0,
    furniture: [
      { t: 'bathroom', x: -1.10, z: 2.55, w: 1.55, d: 1.75 },
      { t: 'vanity', x: 1.58, z: 2.90 },
      { t: 'niche', x: 1.66, z: 2.00 },
      { t: 'slats', z0: -1.30, z1: 1.20 },
      { t: 'rug', x: 0.15, z: -1.60, w: 2.20, d: 1.60 },
      { t: 'bed', x: -0.86, z: 0.20, w: 1.8, l: 2.08 },
      { t: 'nightstand', x: -1.66, z: -0.91 },
      { t: 'nightstand', x: -1.66, z: 1.31 },
      { t: 'desk', x: 1.62, z: -2.00, len: 2.60 },
      { t: 'tv', x: 1.66, z: -1.70 },
      { t: 'chair', x: 1.05, z: -2.55, rot: -1.5708 },
      { t: 'armchair', x: -0.55, z: -2.95, rot: .15 },
      { t: 'table', x: -1.30, z: -3.00 },
      { t: 'plant', x: 0.90, z: -3.22 },
      { t: 'art', x: -1.84, z: 0.20, y: 2.02 }
    ],
    items: {
      slippers: [[0.45, .012, 1.05, Math.PI / 2]],
      remote: [[-1.66, .572, 1.31, 0]],
      glass: [[1.62, .762, -1.00, 0]],
      bottle: [[1.62, .762, -0.65, 0]],
      card: [[-1.28, .556, 0.10, .18]],
      hangers: [[1.66, 1.62, 2.00, 0]],
      bin: [[1.20, .002, 1.70, 0]],
      notepad: [[1.62, .762, -1.35, 0]],
      lamp: [[1.62, .762, -2.90, 0]],
      pillow: [[-1.45, .466, 0.20, 0]],
      towel: [[-0.12, .548, 0.20, 0]],
      kettle: [[1.58, .872, 3.10, 0]],
      tissue: [[1.58, .872, 2.70, 0]],
      phone: [[-1.66, .572, -0.91, 0]]
    },
    surfaces: [
      { y: 1.72, x: [1.49, 1.83], z: [1.55, 2.45] },
      { y: 0.872, x: [1.29, 1.87], z: [2.40, 3.40] },
      { y: 0.757, x: [1.40, 1.84], z: [-3.30, -0.70] },
      { y: 0.570, x: [-1.87, -1.45], z: [-1.12, -0.70] },
      { y: 0.570, x: [-1.87, -1.45], z: [1.10, 1.52] },
      { y: 0.540, x: [-1.24, 0.28], z: [-0.75, 1.15] },
      { y: 0.460, x: [-1.90, -1.24], z: [-0.84, 1.24] },
      { y: 0.000, x: [-1.88, 1.88], z: [-3.45, 3.45] }
    ],
    beds: [{ x: -0.86, z: 0.20, w: 1.8, l: 2.08 }]
  });

  Object.assign(SPECS.ht, {
    type: '双床房',
    desc: '22㎡ · 玄关洗手台 / 独立卫浴 / 两张 1.2m 单床 · 长桌电视墙',
    d: 7.0,
    furniture: [
      { t: 'bathroom', x: -1.05, z: 2.55, w: 1.5, d: 1.75 },
      { t: 'vanity', x: 1.48, z: 2.90 },
      { t: 'niche', x: 1.55, z: 2.00 },
      { t: 'slats', z0: -1.75, z1: 1.55 },
      { t: 'rug', x: 0.55, z: -2.30, w: 1.35, d: 1.60 },
      { t: 'bed', x: -0.80, z: -0.95, w: 1.2, l: 2.0 },
      { t: 'bed', x: -0.80, z: 0.75, w: 1.2, l: 2.0 },
      { t: 'nightstand', x: -1.50, z: -0.10 },
      { t: 'nightstand', x: -1.50, z: 1.56 },
      { t: 'desk', x: 1.55, z: -1.90, len: 2.60 },
      { t: 'tv', x: 1.59, z: -1.50 },
      { t: 'chair', x: 1.02, z: -2.45, rot: -1.5708 },
      { t: 'plant', x: 0.90, z: -3.20 }
    ],
    items: {
      slippers: [[0.42, .012, -0.10, Math.PI / 2]],
      remote: [[-1.50, .572, -0.10, 0]],
      glass: [[1.55, .762, -0.95, 0]],
      bottle: [[1.55, .762, -0.60, 0]],
      card: [[-1.10, .548, -0.95, .18]],
      hangers: [[1.55, 1.62, 2.00, 0]],
      bin: [[1.15, .002, -2.60, 0]],
      notepad: [[1.55, .762, -1.30, 0]],
      lamp: [[1.55, .762, -2.90, 0]],
      pillow: [[-1.55, .466, -0.95, 0]],
      pillow2: [[-1.55, .466, 0.75, 0]],
      towel: [[-0.45, .548, -0.95, 0]],
      towel2: [[-0.45, .548, 0.75, 0]],
      kettle: [[1.48, .872, 3.05, 0]],
      tissue: [[1.48, .872, 2.65, 0]],
      phone: [[-1.50, .572, 1.56, 0]]
    },
    surfaces: [
      { y: 1.72, x: [1.38, 1.72], z: [1.55, 2.45] },
      { y: 0.872, x: [1.19, 1.77], z: [2.40, 3.40] },
      { y: 0.757, x: [1.33, 1.77], z: [-3.20, -0.60] },
      { y: 0.570, x: [-1.71, -1.29], z: [-0.31, 0.11] },
      { y: 0.570, x: [-1.71, -1.29], z: [1.35, 1.77] },
      { y: 0.540, x: [-1.24, 0.20], z: [-1.61, -0.29] },
      { y: 0.540, x: [-1.24, 0.20], z: [0.09, 1.41] },
      { y: 0.460, x: [-1.80, -1.24], z: [-1.55, -0.35] },
      { y: 0.460, x: [-1.80, -1.24], z: [0.15, 1.35] },
      { y: 0.000, x: [-1.78, 1.78], z: [-3.45, 3.45] }
    ],
    beds: [
      { x: -0.80, z: -0.95, w: 1.2, l: 2.0 },
      { x: -0.80, z: 0.75, w: 1.2, l: 2.0 }
    ]
  });
  /* ===== 第三种结构：单人房（小、一张 1.2 床、没有休闲椅） ===== */
  SPECS.single = {
    key: 'single', brand: '汉 庭', type: '单人房', name: '单人房',
    desc: '18㎡ · 一张 1.2m 单床 · 紧凑书桌 · 玄关洗手台',
    w: 3.0, d: 6.0, h: 2.7,
    window: { x0: -1.00, x1: 0.90, y0: .30, y1: 2.30 },
    cam: { dir: [.52, .70, .48], tgt: [.05, .34, .22], fov: 32, ew: 1.58, eh: 3.26 },
    furniture: [
      { t: 'bathroom', x: -0.875, z: 2.20, w: 1.25, d: 1.40 },
      { t: 'vanity', x: 1.20, z: 2.40 },
      { t: 'niche', x: 1.25, z: 1.65 },
      { t: 'slats', z0: -1.10, z1: 0.30 },
      { t: 'rug', x: 0.15, z: -2.05, w: 1.20, d: 1.00 },
      { t: 'bed', x: -0.50, z: -0.40, w: 1.2, l: 2.0 },
      { t: 'nightstand', x: -1.29, z: 0.85 },
      { t: 'desk', x: 1.20, z: -1.40, len: 2.00 },
      { t: 'tv', x: 1.24, z: -1.30 },
      { t: 'chair', x: 0.75, z: -1.90, rot: -1.5708 },
      { t: 'plant', x: -0.85, z: -2.75 }
    ],
    items: {
      slippers: [[0.35, .012, 0.90, Math.PI / 2]],
      remote: [[-1.29, .572, 0.85, 0]],
      glass: [[1.20, .762, -0.90, 0]],
      bottle: [[1.20, .762, -0.60, 0]],
      card: [[-1.05, .556, -0.40, .18]],
      hangers: [[1.25, 1.62, 1.65, 0]],
      bin: [[0.90, .002, 0.30, 0]],
      notepad: [[1.20, .762, -1.20, 0]],
      lamp: [[1.20, .762, -2.20, 0]],
      pillow: [[-1.15, .466, -0.40, 0]],
      towel: [[-0.15, .548, -0.40, 0]],
      kettle: [[1.20, .872, 2.55, 0]],
      tissue: [[1.20, .872, 2.20, 0]],
      phone: [[-1.29, .572, 1.10, 0]]
    },
    surfaces: [
      { y: 1.72, x: [1.08, 1.42], z: [1.20, 2.10] },
      { y: 0.872, x: [0.91, 1.49], z: [1.90, 2.90] },
      { y: 0.757, x: [0.98, 1.42], z: [-2.40, -0.40] },
      { y: 0.570, x: [-1.50, -1.08], z: [0.64, 1.06] },
      { y: 0.540, x: [-0.94, 0.50], z: [-0.98, 0.18] },
      { y: 0.460, x: [-1.50, -0.94], z: [-1.00, 0.20] },
      { y: 0.000, x: [-1.45, 1.45], z: [-2.95, 2.95] }
    ],
    beds: [{ x: -0.50, z: -0.40, w: 1.2, l: 2.0 }]
  };

  /* ===== 第四种结构：家庭房（1.8 大床 + 1.2 单床） ===== */
  SPECS.family = {
    key: 'family', brand: '汉 庭', type: '家庭房', name: '家庭房',
    desc: '30㎡ · 1.8m 大床 + 1.2m 单床 · 两张床不同尺寸',
    w: 3.8, d: 7.4, h: 2.7,
    window: { x0: -1.40, x1: 1.40, y0: .30, y1: 2.30 },
    cam: { dir: [.48, .72, .50], tgt: [.05, .38, .22], fov: 32, ew: 1.92, eh: 3.98 },
    furniture: [
      { t: 'bathroom', x: -1.15, z: 2.65, w: 1.50, d: 1.50 },
      { t: 'vanity', x: 1.60, z: 2.95 },
      { t: 'niche', x: 1.65, z: 2.05 },
      { t: 'slats', z0: -1.75, z1: 1.85 },
      { t: 'rug', x: 0.55, z: -2.60, w: 1.50, d: 1.30 },
      { t: 'bed', x: -0.86, z: 0.90, w: 1.8, l: 2.08 },
      { t: 'bed', x: -0.90, z: -1.00, w: 1.2, l: 2.0 },
      { t: 'nightstand', x: -1.66, z: -0.20 },
      { t: 'nightstand', x: -1.66, z: 2.00 },
      { t: 'desk', x: 1.60, z: -2.50, len: 2.40 },
      { t: 'tv', x: 1.64, z: -2.20 },
      { t: 'chair', x: 1.02, z: -2.90, rot: -1.5708 },
      { t: 'armchair', x: 0.60, z: -3.30, rot: .3 },
      { t: 'table', x: -1.10, z: -3.35 },
      { t: 'plant', x: -1.70, z: -0.10 }
    ],
    items: {
      slippers: [[0.45, .012, 2.05, Math.PI / 2]],
      remote: [[-1.66, .572, 2.00, 0]],
      glass: [[1.60, .762, -1.50, 0]],
      bottle: [[1.60, .762, -1.15, 0]],
      card: [[-1.25, .556, 0.70, .18]],
      hangers: [[1.65, 1.62, 2.05, 0]],
      bin: [[1.15, .002, 1.60, 0]],
      notepad: [[1.60, .762, -1.85, 0]],
      lamp: [[1.60, .762, -3.10, 0]],
      pillow: [[-1.45, .466, 0.90, 0]],
      pillow2: [[-1.55, .466, -1.00, 0]],
      towel: [[-0.10, .548, 0.90, 0]],
      towel2: [[-0.30, .548, -1.00, 0]],
      kettle: [[1.60, .872, 3.15, 0]],
      tissue: [[1.60, .872, 2.75, 0]],
      phone: [[-1.66, .572, -0.20, 0]]
    },
    surfaces: [
      { y: 1.72, x: [1.48, 1.82], z: [1.60, 2.50] },
      { y: 0.872, x: [1.31, 1.89], z: [2.45, 3.45] },
      { y: 0.757, x: [1.38, 1.82], z: [-3.70, -1.30] },
      { y: 0.570, x: [-1.87, -1.45], z: [-0.41, 0.01] },
      { y: 0.570, x: [-1.87, -1.45], z: [1.79, 2.21] },
      { y: 0.540, x: [-1.24, 0.28], z: [-0.15, 1.75] },
      { y: 0.460, x: [-1.90, -1.24], z: [-0.14, 1.74] },
      { y: 0.540, x: [-1.28, 0.20], z: [-1.58, -0.26] },
      { y: 0.460, x: [-1.90, -1.28], z: [-1.60, -0.28] },
      { y: 0.000, x: [-1.88, 1.88], z: [-3.65, 3.65] }
    ],
    beds: [
      { x: -0.86, z: 0.90, w: 1.8, l: 2.08 },
      { x: -0.90, z: -1.00, w: 1.2, l: 2.0 }
    ]
  };


  /* ===== 品牌变体：桔子（灰紫墙 + 橙色点缀，骨架同汉庭 3.0） ===== */
  SPECS.or = JSON.parse(JSON.stringify(SPECS.ht3));
  SPECS.or.key = 'or';
  SPECS.or.brand = '桔 子';
  SPECS.or.type = '大床房';
  SPECS.or.name = '大床房';
  SPECS.or.desc = '26㎡ · 灰紫墙 + 橙色点缀 · 设计感壁灯';
  SPECS.or.tint = 0xE8E2EF;
  SPECS.or.furniture.forEach(function (f) {
    if (f.t === 'bed') f.accent = 0xE2703A;
    if (f.t === 'armchair') { f.c1 = 0xE2703A; f.c2 = 0xF6D3B4; f.c3 = 0xC65A2C; }
    if (f.t === 'rug') { f.base = '#D9C9BC'; f.edge = '#B79B86'; f.line = '#C9AE97'; }
    if (f.t === 'art') f.z = f.z + 0.0;
  });
  SPECS.or.furniture.push({ t: 'art', x: -1.83, z: 0.55, y: 2.02 });


  /* ===== 第五种结构：套房（玄关 → 起居区 → 隔断 → 卧室 → 窗） ===== */
  SPECS.suite = {
    key: 'suite', brand: '全 季', type: '套房', name: '套房',
    desc: '44㎡ · 起居区 + 隔断 + 卧室 · 两段式空间',
    w: 4.4, d: 10.0, h: 2.85,
    window: { x0: -1.50, x1: 1.50, y0: .30, y1: 2.40 },
    cam: { dir: [.52, .66, .54], tgt: [.05, .55, .30], fov: 30, ew: 2.35, eh: 5.35 },
    furniture: [
      // 玄关 + 卫浴
      { t: 'bathroom', x: -1.40, z: 4.05, w: 1.60, d: 1.50 },
      { t: 'vanity', x: 1.80, z: 4.30 },
      { t: 'niche', x: 1.90, z: 3.40 },
      // 起居区
      { t: 'rug', x: 0.00, z: 1.70, w: 2.40, d: 1.90, base: '#CDBBB0', edge: '#A98F7C', line: '#BFA894' },
      { t: 'sofa', x: -1.15, z: 1.70, len: 1.80, rot: Math.PI / 2 },
      { t: 'coffee', x: 0.05, z: 1.70 },
      { t: 'desk', x: 1.75, z: 1.70, len: 1.70 },
      { t: 'tv', x: 1.78, z: 1.70 },
      { t: 'floorlamp', x: -1.95, z: 3.05 },
      { t: 'plant', x: -1.95, z: 0.55 },
      // 隔断（中间留 1.6m 门洞）
      { t: 'block', x: -1.60, z: 0.20, w: 1.20, h: 2.55, d: .14, color: 0xEFE7DA },
      { t: 'block', x: 1.40, z: 0.20, w: 1.60, h: 2.55, d: .14, color: 0xEFE7DA },
      // 卧室
      { t: 'rug', x: 0.20, z: -2.20, w: 2.10, d: 1.50 },
      { t: 'bed', x: -1.15, z: -2.00, w: 1.8, l: 2.1 },
      { t: 'nightstand', x: -1.99, z: -0.71 },
      { t: 'nightstand', x: -1.99, z: -3.29 },
      { t: 'desk', x: 1.75, z: -2.60, len: 2.60 },
      { t: 'chair', x: 1.15, z: -3.20, rot: -1.5708 },
      { t: 'armchair', x: 0.70, z: -4.30, rot: 2.9 }
    ],
    items: {
      slippers: [[0.40, .012, -0.70, Math.PI / 2]],
      remote: [[-1.99, .572, -0.71, 0]],
      glass: [[1.75, .762, -2.20, 0]],
      bottle: [[1.75, .762, -1.85, 0]],
      card: [[-1.60, .556, -2.00, .18]],
      hangers: [[1.90, 1.62, 3.40, 0]],
      bin: [[1.30, .002, 0.70, 0]],
      notepad: [[1.75, .762, -2.60, 0]],
      lamp: [[1.75, .762, -3.60, 0]],
      pillow: [[-1.75, .466, -2.00, 0]],
      towel: [[-0.35, .548, -2.00, 0]],
      kettle: [[1.80, .872, 4.35, 0]],
      tissue: [[1.80, .872, 3.95, 0]],
      phone: [[-1.99, .572, -3.29, 0]]
    },
    surfaces: [
      { y: 1.72, x: [1.73, 2.07], z: [2.95, 3.85] },
      { y: 0.872, x: [1.51, 2.09], z: [3.80, 4.80] },
      { y: 0.757, x: [1.53, 1.97], z: [-3.90, -1.30] },
      { y: 0.570, x: [-2.20, -1.78], z: [-3.50, -3.08] },
      { y: 0.570, x: [-2.20, -1.78], z: [-0.92, -0.50] },
      { y: 0.540, x: [-1.52, -0.18], z: [-2.96, -1.04] },
      { y: 0.460, x: [-2.20, -1.52], z: [-3.05, -0.95] },
      { y: 0.000, x: [-2.15, 2.15], z: [-4.95, 4.95] }
    ],
    beds: [{ x: -1.15, z: -2.00, w: 1.8, l: 2.1 }]
  };

  /* 多出来的枕头/浴巾复用同一个模型 */
  DEFS.push(
    { id: 'pillow2', name: '枕头', build: function () { return DEFS.find(d => d.id === 'pillow').build(); } },
    { id: 'towel2', name: '浴巾', build: function () { return DEFS.find(d => d.id === 'towel').build(); } }
  );
  const DEF_MAP = {};
  DEFS.forEach(d => { DEF_MAP[d.id] = d; });

  /* ================= 造房间 ================= */
  function buildRoom(spec) {
    const g = new THREE.Group();
    g.visible = false;
    scene.add(g);

    const W = spec.w, D = spec.d, H = spec.h;
    const floorMat = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: .8, metalness: 0 });
    const sideMat = mat(0x93714F);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, .12, D),
      [sideMat, sideMat, floorMat, sideMat, sideMat, sideMat]);
    floor.position.y = -.06; g.add(floor);

    const wTex = wallTex();
    const backMat = new THREE.MeshStandardMaterial({ map: wTex, color: 0xFFFFFF, roughness: .95 });
    const leftMat = new THREE.MeshStandardMaterial({ map: wTex, color: (spec.tint || 0xF4EBDB), roughness: .95 });

    g.add(put(new THREE.Mesh(new THREE.BoxGeometry(.12, H, D + .3), leftMat), -W / 2 - .06, H / 2, 0));

    const wd = spec.window;
    const WZ = -D / 2;
    function backSeg(x0, x1, y0, y1) {
      const w = x1 - x0, h = y1 - y0;
      if (w <= 0 || h <= 0) return;
      g.add(put(new THREE.Mesh(new THREE.BoxGeometry(w, h, .12), backMat), x0 + w / 2, y0 + h / 2, WZ - .06));
    }
    backSeg(-W / 2 - .15, wd.x0, 0, H);
    backSeg(wd.x1, W / 2 + .15, 0, H);
    backSeg(wd.x0, wd.x1, 0, wd.y0);
    backSeg(wd.x0, wd.x1, wd.y1, H);

    g.add(put(box(.03, .1, D, C.base), -W / 2 + .015, .05, 0));
    // 窗口落在地上的阳光（加色混合，柔边）
    const sunMat = new THREE.MeshBasicMaterial({
      map: sunTex, transparent: true, opacity: .17,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const sunPatch = new THREE.Mesh(new THREE.PlaneGeometry(wd.x1 - wd.x0 + .5, 2.5), sunMat);
    sunPatch.rotation.x = -Math.PI / 2;
    sunPatch.rotation.z = -.16;
    sunPatch.position.set((wd.x0 + wd.x1) / 2, .016, -D / 2 + 1.30);
    g.add(sunPatch);
    const sunCore = new THREE.Mesh(new THREE.PlaneGeometry(wd.x1 - wd.x0 - .3, 1.5), sunMat.clone());
    sunCore.material.opacity = .10;
    sunCore.rotation.x = -Math.PI / 2;
    sunCore.rotation.z = -.16;
    sunCore.position.set((wd.x0 + wd.x1) / 2, .018, -D / 2 + 1.05);
    g.add(sunCore);

    // 墙角接触阴影（渐变贴图，靠墙深、往外淡）
    const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, opacity: .9 });
    const aoL = new THREE.Mesh(new THREE.PlaneGeometry(1.1, D), aoMat);
    aoL.rotation.x = -Math.PI / 2;
    aoL.rotation.z = -Math.PI / 2;
    aoL.position.set(-W / 2 + .55, .010, 0);
    g.add(aoL);
    const aoB = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.1), aoMat);
    aoB.rotation.x = -Math.PI / 2;
    aoB.position.set(0, .009, -D / 2 + .55);
    g.add(aoB);
    g.add(put(box(wd.x0 + W / 2, .1, .03, C.base), (-W / 2 + wd.x0) / 2, .05, WZ + .015));
    g.add(put(box(W / 2 - wd.x1, .1, .03, C.base), (wd.x1 + W / 2) / 2, .05, WZ + .015));

    const skyCv = document.createElement('canvas'); skyCv.width = 512; skyCv.height = 320;
    (function () {
      const q = skyCv.getContext('2d');
      const gr = q.createLinearGradient(0, 0, 0, 320);
      gr.addColorStop(0, '#CDE3EE'); gr.addColorStop(.45, '#EAF1F1');
      gr.addColorStop(.75, '#F6EFE0'); gr.addColorStop(1, '#EADFCB');
      q.fillStyle = gr; q.fillRect(0, 0, 512, 320);
      q.fillStyle = 'rgba(150,165,170,.28)';
      let x = 0, i = 0;
      const hs = [96, 130, 74, 150, 110, 88, 160, 120, 100, 140, 92, 126];
      while (x < 512) {
        const w = 28 + (i * 13) % 34, h = hs[i % hs.length];
        q.fillRect(x, 250 - h * .55, w, h * .55 + 70);
        x += w + 6; i++;
      }
      q.fillStyle = 'rgba(120,135,138,.16)';
      q.fillRect(0, 268, 512, 52);
    })();
    const skyTex = new THREE.CanvasTexture(skyCv); skyTex.encoding = THREE.sRGBEncoding;
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(wd.x1 - wd.x0 + .5, wd.y1 - wd.y0 + .5),
      new THREE.MeshBasicMaterial({ map: skyTex }));
    sky.position.set(0, (wd.y0 + wd.y1) / 2, WZ - .18);
    g.add(sky);

    const glassM = new THREE.Mesh(new THREE.PlaneGeometry(wd.x1 - wd.x0, wd.y1 - wd.y0),
      new THREE.MeshStandardMaterial({ color: 0xD5E4E6, transparent: true, opacity: .13, roughness: .05, metalness: .1 }));
    glassM.position.set(0, (wd.y0 + wd.y1) / 2, WZ - .02);
    g.add(glassM);

    const frameMat = mat(0x4A3A2C, { roughness: .6, metalness: .2 });
    function fbar(w, h, d, x, y, z) { return put(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat), x, y, z); }
    g.add(fbar(wd.x1 - wd.x0 + .1, .06, .07, 0, wd.y0, WZ - .03));
    g.add(fbar(wd.x1 - wd.x0 + .1, .06, .07, 0, wd.y1, WZ - .03));
    g.add(fbar(.06, wd.y1 - wd.y0, .07, wd.x0, (wd.y0 + wd.y1) / 2, WZ - .03));
    g.add(fbar(.06, wd.y1 - wd.y0, .07, wd.x1, (wd.y0 + wd.y1) / 2, WZ - .03));
    const mid = (wd.x0 + wd.x1) / 2;
    [mid - .45, mid + .45].forEach(function (x) {
      g.add(fbar(.05, wd.y1 - wd.y0, .05, x, (wd.y0 + wd.y1) / 2, WZ - .03));
    });

    function curtain(x0, x1) {
      const grp = new THREE.Group();
      const w = x1 - x0;
      for (let i = 0; i < 9; i++) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(.042, .042, wd.y1 + .12, 8, 1, true),
          mat(0xEFE7D8, { roughness: 1, side: THREE.DoubleSide }));
        p.position.set(x0 + w * (i + .5) / 9, (wd.y1 + .1) / 2, WZ + .11);
        p.scale.x = .5;
        grp.add(p);
      }
      return grp;
    }
    g.add(curtain(-W / 2 - .1, wd.x0 + .1));
    g.add(curtain(wd.x1 - .1, W / 2 + .1));
    g.add(put(box(wd.x1 - wd.x0 + 1.5, .1, .26, 0xD9CDB8), 0, wd.y1 + .16, WZ + .14));

    const sheer = new THREE.Mesh(new THREE.PlaneGeometry(wd.x1 - wd.x0, wd.y1 - wd.y0),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, transparent: true, opacity: .14, roughness: 1, side: THREE.DoubleSide, depthWrite: false }));
    sheer.position.set(0, (wd.y0 + wd.y1) / 2, WZ + .04);
    g.add(sheer);

    g.add(put(box(1.0, .012, .58, 0x7B6A52), .35, .006, D / 2 - .28));

    // 床头壁灯（带真实点光源，打出墙面光斑）
    const bd = spec.beds || [];
    if (bd.length) {
      const wallX = -W / 2 + .10;
      const zs = bd.length > 1
        ? [bd[0].z, bd[bd.length - 1].z]
        : [bd[0].z - bd[0].w / 2 + .20, bd[0].z + bd[0].w / 2 - .20];
      zs.forEach(function (zz) {
        const sg = new THREE.Group();
        sg.add(put(cyl(.045, .05, .13, 0xE9D9B8, { emissive: 0xFFD9A0, emissiveIntensity: .95, roughness: .8 }), 0, 0, 0));
        sg.add(put(box(.05, .05, .05, 0x4A3A2C), .05, .085, 0));
        sg.position.set(wallX, 1.40, zz);
        g.add(sg);
        const pl = new THREE.PointLight(0xFFD9A6, .5, 2.4, 2);
        pl.position.set(wallX + .20, 1.42, zz);
        g.add(pl);
      });
    }

    spec.furniture.forEach(function (f) {
      switch (f.t) {
        case 'bed': addBed(g, f); break;
        case 'nightstand': addNightstand(g, f); break;
        case 'desk': addDesk(g, f); break;
        case 'wardrobe': addWardrobe(g, f); break;
        case 'rack': addRack(g, f); break;
        case 'chair': addChair(g, f); break;
        case 'armchair': addArmchair(g, f); break;
        case 'table': addTable(g, f); break;
        case 'plant': addPlant(g, f); break;
        case 'rug': addRug(g, f); break;
        case 'tv': addTV(g, f); break;
        case 'art': addArt(g, f); break;
        case 'case': addCase(g, f); break;
        case 'slats': addSlats(g, f, W); break;
        case 'bathroom': addBathroom(g, f); break;
        case 'vanity': addVanity(g, f); break;
        case 'niche': addNiche(g, f); break;
        case 'headwall': addHeadwall(g, f); break;
        case 'block': addBlock(g, f); break;
        case 'sofa': addSofa(g, f); break;
        case 'coffee': addCoffee(g, f); break;
        case 'floorlamp': addFloorLamp(g, f); break;
      }
    });

    const items = [], pickables = [];
    Object.keys(spec.items).forEach(function (id) {
      const def = DEF_MAP[id];
      if (!def) return;
      const anchors = spec.items[id].map(function (a) {
        return { p: new THREE.Vector3(a[0], a[1], a[2]), rot: a[3] };
      });
      const g2 = def.build();
      g2.position.copy(anchors[0].p);
      g2.rotation.y = anchors[0].rot;
      g2.visible = false;
      g2.scale.setScalar(1.05);
      g.add(g2);

      const bb0 = new THREE.Box3().setFromObject(g2);
      const sw = Math.max(bb0.max.x - bb0.min.x, .12), sd = Math.max(bb0.max.z - bb0.min.z, .12);
      const shd = new THREE.Mesh(new THREE.PlaneGeometry(sw * 1.8, sd * 1.8),
        new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: .42, depthWrite: false }));
      shd.rotation.x = -Math.PI / 2; shd.position.y = .004; shd.userData.blob = true;
      g2.add(shd);

      const it = {
        id: id, name: def.name, group: g2, placed: false, dragging: false,
        anchors: anchors, rings: [], chip: null, tween: null
      };

      g2.traverse(function (o) {
        if (o.isMesh) { o.userData.item = it; pickables.push(o); }
      });

      anchors.forEach(function (a) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(.14, .175, 40),
          new THREE.MeshBasicMaterial({ color: 0xC9A45B, transparent: true, opacity: 0, side: THREE.DoubleSide, depthTest: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(a.p.x, a.p.y + .006, a.p.z);
        ring.renderOrder = 999; ring.visible = false;
        g.add(ring); it.rings.push(ring);
      });

      items.push(it);
    });

    g.traverse(function (o) {
      if (!o.isMesh || o.userData.blob) return;
      o.castShadow = true; o.receiveShadow = true;
    });
    glassM.castShadow = false;

    return { key: spec.key, spec: spec, group: g, items: items, pickables: pickables };
  }

  const rooms = {};
  Object.keys(SPECS).forEach(function (k) { rooms[k] = buildRoom(SPECS[k]); });

  /* ================= 相机 ================= */
  let active = null;
  let camTween = null;
  let needsRender = true;
  const camTarget = new THREE.Vector3(0, .7, -.4);
  let activeView = 'iso';

  function viewFor(k) {
    const portrait = innerWidth / innerHeight < 1.05;
    const w = active.spec.w, d = active.spec.d;
    if (k === 'top') {
      return { dir: [0, 1, .001], tgt: [0, .05, 0], fov: 16, up: [1, 0, 0], ew: d / 2 + .18, eh: w / 2 + .18 };
    }
    if (k === 'front') {
      return { dir: [.015, .13, .99], tgt: [0, 1.05, -.45], fov: 40, up: [0, 1, 0], ew: w / 2 + .42, eh: 2.15 };
    }
    if (active.spec.cam && !portrait) {
      const cm = active.spec.cam;
      return { dir: cm.dir, tgt: cm.tgt, fov: cm.fov || 42, up: [0, 1, 0], ew: cm.ew || w / 2 + .55, eh: cm.eh || d / 2 + .75 };
    }
    return portrait
      ? { dir: [.15, .27, .95], tgt: [.05, .85, -.55], fov: 44, up: [0, 1, 0], ew: w / 2 + .45, eh: d / 2 + .45 }
      : { dir: [.60, .60, .53], tgt: [.08, .45, -.30], fov: 34, up: [0, 1, 0], ew: w / 2 + .26, eh: d / 2 + .40 };
  }

  function camPosFor(v, zoom) {
    const aspect = innerWidth / innerHeight;
    const tanV = Math.tan(v.fov * Math.PI / 180 / 2);
    const tanH = tanV * aspect;
    const d = Math.max(v.eh / tanV, v.ew / tanH) * 1.04 * (zoom || 1);
    const dir = new THREE.Vector3(v.dir[0], v.dir[1], v.dir[2]).normalize().multiplyScalar(d);
    const tgt = new THREE.Vector3(v.tgt[0], v.tgt[1], v.tgt[2]);
    return { pos: tgt.clone().add(dir), tgt: tgt };
  }

  function applyView(k, instant, zoom, dur) {
    activeView = k;
    const v = viewFor(k);
    const c = camPosFor(v, zoom);
    if (instant) {
      camera.up.set(v.up[0], v.up[1], v.up[2]);
      camera.fov = v.fov; camera.updateProjectionMatrix();
      camera.position.copy(c.pos);
      camTarget.copy(c.tgt);
      camera.lookAt(camTarget);
      needsRender = true;
      return;
    }
    camTween = {
      t0: performance.now(), dur: dur || 620,
      fromP: camera.position.clone(), toP: c.pos,
      fromT: camTarget.clone(), toT: c.tgt,
      fromF: camera.fov, toF: v.fov,
      fromU: camera.up.clone(), toU: new THREE.Vector3(v.up[0], v.up[1], v.up[2])
    };
    needsRender = true;
  }

  /* ================= 托盘 ================= */
  const chipsEl = document.getElementById('chips');
  const trayEl = document.getElementById('tray');
  const cntEl = document.getElementById('cnt');
  const scrollL = document.getElementById('scrollL');
  const scrollR = document.getElementById('scrollR');
  let thumbs = {};

  function buildThumbs(list) {
    const out = {};
    let r;
    try {
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setSize(160, 160); r.setPixelRatio(1);
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      r.setClearColor(0xEFE5D3, 1);
    } catch (e) { return out; }
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xFFFFFF, 0x8B8072, 1.0));
    const d1 = new THREE.DirectionalLight(0xFFFFFF, 1.1); d1.position.set(3, 5, 4); sc.add(d1);
    const d2 = new THREE.DirectionalLight(0xFFFFFF, .35); d2.position.set(-3, 2, -3); sc.add(d2);
    list.forEach(function (d) {
      const g = d.build(); sc.add(g);
      const bb = new THREE.Box3().setFromObject(g);
      const size = bb.getSize(new THREE.Vector3());
      const ctr = bb.getCenter(new THREE.Vector3());
      const m = Math.max(size.x, size.y, size.z) || .2;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(m * 1.6, m * 1.6),
        new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: .45, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.set(ctr.x, bb.min.y + .001, ctr.z);
      sc.add(sh);
      const cam = new THREE.OrthographicCamera(-m * .62, m * .62, m * .62, -m * .62, .001, 60);
      cam.position.set(ctr.x + m * .85, ctr.y + m * .95, ctr.z + m * 1.25);
      cam.lookAt(ctr);
      r.render(sc, cam);
      out[d.id] = r.domElement.toDataURL('image/png');
      sc.remove(g); sc.remove(sh);
    });
    r.dispose();
    return out;
  }

  function buildTray() {
    chipsEl.innerHTML = '';
    active.items.forEach(function (it) {
      if (it.placed) { it.chip = null; return; }
      const el = document.createElement('div');
      el.className = 'chip';
      el.dataset.id = it.id;
      el.innerHTML = '<img alt="" src="' + (thumbs[it.id] || '') + '"><span>' + it.name + '</span>';
      chipsEl.appendChild(el);
      it.chip = el;
    });
    const empty = active.items.every(i => i.placed);
    trayEl.classList.toggle('empty', empty);
    if (empty && !document.getElementById('doneNote')) {
      const d = document.createElement('div');
      d.className = 'done-note'; d.id = 'doneNote';
      d.textContent = '全部摆完了 —— 点右上角「完成布置」看评级';
      trayEl.appendChild(d);
    }
    setTimeout(updateScrollBtns, 30);
  }

  function updateScrollBtns() {
    const max = chipsEl.scrollWidth - chipsEl.clientWidth;
    scrollL.classList.toggle('show', chipsEl.scrollLeft > 4);
    scrollR.classList.toggle('show', chipsEl.scrollLeft < max - 4);
  }
  chipsEl.addEventListener('scroll', updateScrollBtns);
  chipsEl.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      chipsEl.scrollLeft += e.deltaY;
    }
  }, { passive: false });
  scrollL.addEventListener('click', () => { chipsEl.scrollLeft -= 260; });
  scrollR.addEventListener('click', () => { chipsEl.scrollLeft += 260; });

  function updateCount() {
    if (!active) return;
    cntEl.textContent = active.items.filter(i => i.placed).length;
    document.getElementById('total').textContent = active.items.length;
  }

  /* ================= 拖拽 ================= */
  const landDisc = new THREE.Mesh(
    new THREE.RingGeometry(.72, 1, 32),
    new THREE.MeshBasicMaterial({ color: 0xF0C983, transparent: true, opacity: .75, depthTest: false, depthWrite: false })
  );
  landDisc.rotation.x = -Math.PI / 2;
  landDisc.visible = false;
  landDisc.renderOrder = 997;
  scene.add(landDisc);

  function updateLanding(it) {
    raycaster.setFromCamera(ndc, camera);
    const S = active.spec.surfaces;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -s.y);
      const p = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, p)) continue;
      if (p.x >= s.x[0] - .05 && p.x <= s.x[1] + .05 && p.z >= s.z[0] - .05 && p.z <= s.z[1] + .05) {
        landDisc.position.set(p.x, s.y + .005, p.z);
        landDisc.scale.setScalar(.30);
        landDisc.visible = true;
        return;
      }
    }
    landDisc.visible = false;
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const lastPointer = { x: 0, y: 0 };
  let drag = null;
  let snapPx = 48;

  function pointerNDC(e) {
    const r = canvas.getBoundingClientRect();
    lastPointer.x = e.clientX - r.left;
    lastPointer.y = e.clientY - r.top;
    ndc.x = (lastPointer.x / r.width) * 2 - 1;
    ndc.y = -(lastPointer.y / r.height) * 2 + 1;
    return ndc;
  }

  function planePoint(y) {
    raycaster.setFromCamera(ndc, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, p)) return null;
    return p;
  }

  function clampToRoom(p) {
    const w = active.spec.w / 2 - .08, d = active.spec.d / 2 - .08;
    p.x = Math.max(-w, Math.min(w, p.x));
    p.z = Math.max(-d, Math.min(d, p.z));
    return p;
  }

  function screenDistTo(v3) {
    const v = v3.clone().project(camera);
    const sx = (v.x * .5 + .5) * innerWidth;
    const sy = (-v.y * .5 + .5) * innerHeight;
    return Math.hypot(sx - lastPointer.x, sy - lastPointer.y);
  }

  function updateHotRing(it) {
    let best = -1, bestD = 1e9;
    it.anchors.forEach(function (a, i) {
      const d = screenDistTo(a.p);
      if (d < bestD) { bestD = d; best = i; }
    });
    it.rings.forEach(function (r, i) {
      r.userData.hot = (i === best && bestD < snapPx * 1.1);
    });
  }

  function beginDrag(it, e) {
    if (drag || !active) return;
    drag = { item: it, planeY: Math.max(0.2, it.group.position.y), fromTray: !it.placed };
    it.group.visible = true;
    it.dragging = true;
    if (it.placed) {
      const p = planePoint(it.group.position.y);
      drag.offset = p ? it.group.position.clone().sub(p) : new THREE.Vector3();
    } else {
      drag.offset = new THREE.Vector3();
      it.group.position.set(0, 1.02, 0.6);
      drag.planeY = 1.02;
    }
    it.group.scale.setScalar(1.14);
    it.rings.forEach(r => { r.visible = true; });
    canvas.style.cursor = 'grabbing';
    needsRender = true;
  }

  function moveDrag(e) {
    if (!drag) return;
    pointerNDC(e);
    const p = planePoint(drag.planeY);
    if (!p) return;
    p.add(drag.offset);
    clampToRoom(p);
    drag.item.group.position.set(p.x, drag.planeY, p.z);
    updateHotRing(drag.item);
    updateLanding(drag.item);
    needsRender = true;
  }

  function endDrag(e) {
    if (!drag) return;
    const it = drag.item, wasTray = drag.fromTray;
    pointerNDC(e);

    let best = null, bestD = 1e9;
    it.anchors.forEach(function (a) {
      const d = screenDistTo(a.p);
      if (d < bestD) { bestD = d; best = a; }
    });
    snapPx = (e.pointerType === 'touch') ? 64 : 48;

    if (best && bestD < snapPx) {
      tweenTo(it, best.p.clone(), best.rot, 170);
      soundSnap();
      if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
      landDisc.visible = false;
      finishPlace(it);
    } else {
      raycaster.setFromCamera(ndc, camera);
      let hit = null;
      const S = active.spec.surfaces;
      for (let i = 0; i < S.length; i++) {
        const s = S[i];
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -s.y);
        const p = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(plane, p)) continue;
        if (p.x >= s.x[0] - .05 && p.x <= s.x[1] + .05 && p.z >= s.z[0] - .05 && p.z <= s.z[1] + .05) {
          hit = { p: p, y: s.y }; break;
        }
      }
      if (hit) {
        const t = clampToRoom(hit.p.clone());
        t.y = hit.y;
        tweenTo(it, t, it.group.rotation.y, 200);
        soundPlace();
      } else {
        const t = clampToRoom(it.group.position.clone());
        t.y = 0;
        tweenTo(it, t, it.group.rotation.y, 200);
      }
      finishPlace(it);
    }

    drag = null;
    landDisc.visible = false;
    it.dragging = false;
    it.rings.forEach(r => { r.visible = false; r.material.opacity = 0; });
    canvas.style.cursor = '';
    if (wasTray) buildTray();
  }

  function finishPlace(it) {
    if (it.placed) return;
    it.placed = true;
    it.chip && it.chip.remove();
    it.chip = null;
    buildTray();
    updateCount();
  }

  function tweenTo(it, pos, rot, dur) {
    it.tween = {
      t0: performance.now(), dur: dur || 180,
      from: it.group.position.clone(), to: pos,
      fromR: it.group.rotation.y, toR: rot
    };
    needsRender = true;
  }

  function updateTween(it, now) {
    const tw = it.tween;
    if (!tw) return false;
    const k = Math.min(1, (now - tw.t0) / tw.dur);
    const e = 1 - Math.pow(1 - k, 3);
    it.group.position.lerpVectors(tw.from, tw.to, e);
    const pop = 1 + Math.sin(Math.PI * k) * .08;
    it.group.scale.setScalar(1.05 * (tw.dur > 100 ? pop : 1));
    it.group.rotation.y = tw.fromR + (tw.toR - tw.fromR) * e;
    if (k >= 1) { it.tween = null; it.group.scale.setScalar(1.05); }
    return true;
  }

  /* ---------- 事件 ---------- */
  canvas.addEventListener('pointerdown', function (e) {
    if (!active || e.button !== 0) return;
    if (document.querySelector('.veil')) return;
    pointerNDC(e);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(active.pickables, false);
    if (hits.length) {
      beginDrag(hits[0].object.userData.item, e);
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag && active && !document.querySelector('.veil')) {
      pointerNDC(e);
      raycaster.setFromCamera(ndc, camera);
      const hover = raycaster.intersectObjects(active.pickables, false);
      canvas.style.cursor = hover.length ? 'grab' : '';
    }
    moveDrag(e);
  });
  canvas.addEventListener('pointerup', e => { if (drag) endDrag(e); });
  canvas.addEventListener('pointercancel', e => { if (drag) endDrag(e); });

  chipsEl.addEventListener('pointerdown', function (e) {
    const chip = e.target.closest('.chip');
    if (!chip || !active) return;
    const it = active.items.find(i => i.id === chip.dataset.id);
    if (!it) return;
    pointerNDC(e);
    e.preventDefault();
    beginDrag(it, e);
    const p = planePoint(drag.planeY);
    if (p) { clampToRoom(p); it.group.position.set(p.x, drag.planeY, p.z); }
  });

  addEventListener('pointermove', function (e) {
    if (!drag || e.target === canvas) return;
    moveDrag(e);
  });
  addEventListener('pointerup', function (e) { if (drag) endDrag(e); });

  /* ================= 评级 ================= */
  const RATINGS = [
    { min: .90, stars: 5, title: '完美开夜床', text: '这间房可以直接挂出去卖了。位置、朝向、该在的东西，一样不差。' },
    { min: .75, stars: 4, title: '标准作业', text: '挑不出大毛病。个别小件可以再讲究一点。' },
    { min: .55, stars: 3, title: '大件都对', text: '大件都对了，小件有点随缘。' },
    { min: .30, stars: 2, title: '客人会愣一下', text: '进门那一瞬间，客人可能会怀疑自己走错了房间。' },
    { min: 0, stars: 1, title: '搬家现场', text: '这不是客房，这是搬家现场。' }
  ];

  function rate() {
    let hit = 0, miss = 0, placed = 0;
    active.items.forEach(function (it) {
      if (!it.placed) { miss++; return; }
      placed++;
      let d = 1e9;
      it.anchors.forEach(a => { d = Math.min(d, it.group.position.distanceTo(a.p)); });
      if (d <= 0.30) hit++;
    });
    const ratio = hit / active.items.length;
    let r = RATINGS[RATINGS.length - 1];
    for (let i = 0; i < RATINGS.length; i++) if (ratio >= RATINGS[i].min) { r = RATINGS[i]; break; }
    let egg = '';
    if (placed === 0) egg = '空房交付，客人会以为自己走错了。';
    return { hit: hit, miss: miss, placed: placed, ratio: ratio, rating: r, egg: egg };
  }

  function showResult() {
    const res = rate();
    soundDone();
    const veil = document.createElement('div');
    veil.className = 'veil';
    let stars = '';
    for (let i = 0; i < 5; i++)
      stars += '<i class="' + (i < res.rating.stars ? 'on' : '') + '" style="animation-delay:' + (i * 90 + 120) + 'ms"></i>';
    veil.innerHTML =
      '<div class="card">' +
        '<div class="kicker">本 局 评 级</div>' +
        '<div class="stars">' + stars + '</div>' +
        '<div class="rate">' + res.rating.title + '</div>' +
        '<div class="quote">' + res.rating.text + '</div>' +
        (res.egg ? '<div class="egg">' + res.egg + '</div>' : '') +
        '<div class="stat">命 中 ' + res.hit + ' / ' + active.items.length + ' · 未 摆 放 ' + res.miss + '</div>' +
        '<div class="actions">' +
          '<button class="btn" id="againBtn">再来一次</button>' +
          '<button class="btn" id="seeBtn">看看标准摆放</button>' +
          '<button class="btn primary" id="closeBtn">继续摆</button>' +
        '</div>' +
      '</div>';
    document.getElementById('ui').appendChild(veil);
    veil.querySelector('#closeBtn').onclick = () => veil.remove();
    veil.querySelector('#againBtn').onclick = () => { veil.remove(); resetAll(); };
    veil.querySelector('#seeBtn').onclick = () => { veil.remove(); flashAnchors(); };
  }

  function flashAnchors() {
    active.items.forEach(function (it) {
      if (it.placed) return;
      it.rings.forEach(r => { r.visible = true; r.material.opacity = .95; });
    });
    toast('金色圈是标准位置，3 秒后消失');
    setTimeout(function () {
      active.items.forEach(function (it) {
        if (it.dragging) return;
        it.rings.forEach(r => { r.visible = false; r.material.opacity = 0; });
      });
    }, 3200);
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function resetAll() {
    active.items.forEach(function (it) {
      it.placed = false; it.dragging = false; it.tween = null;
      it.group.visible = false;
      it.group.scale.setScalar(1.05);
      it.rings.forEach(r => { r.visible = false; r.material.opacity = 0; });
    });
    buildTray();
    updateCount();
    needsRender = true;
  }

  /* ================= 选房 ================= */
  function roomThumb(room) {
    let r;
    try {
      r = new THREE.WebGLRenderer({ antialias: true });
      r.setSize(560, 336); r.setPixelRatio(1);
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      r.setClearColor(0xF3EAD9, 1);
    } catch (e) { return ''; }
    const cam = new THREE.PerspectiveCamera(38, 560 / 336, .1, 100);
    const tgt = new THREE.Vector3(0.05, .75, -0.4);
    const dir = new THREE.Vector3(0.5, 0.42, 0.76).normalize();
    cam.position.copy(tgt.clone().add(dir.multiplyScalar(9.2)));
    cam.lookAt(tgt);
    Object.keys(rooms).forEach(k => { rooms[k].group.visible = (k === room.key); });
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/jpeg', .9);
    Object.keys(rooms).forEach(k => { rooms[k].group.visible = false; });
    r.dispose();
    return url;
  }

  function buildStart() {
    const wrap = document.getElementById('rooms');
    wrap.innerHTML = '';
    Object.keys(SPECS).forEach(function (k) {
      const spec = SPECS[k];
      const card = document.createElement('button');
      card.className = 'room-card';
      card.innerHTML =
        '<div class="thumb"><img alt="" src="' + roomThumb(rooms[k]) + '"><span class="rc-tag">' + (spec.type || '客房') + '</span></div>' +
        '<div class="body">' +
          '<div class="rc-brand">' + spec.brand + '</div>' +
          '<div class="rc-name">' + spec.name + '</div>' +
          '<div class="rc-desc">' + spec.desc + '</div>' +
          '<div class="rc-go">进入</div>' +
        '</div>';
      card.addEventListener('click', () => startGame(k));
      wrap.appendChild(card);
    });
  }

  function startGame(key) {
    document.getElementById('start').classList.add('hide');
    document.getElementById('ui').classList.add('on');
    enterRoom(key);
    const v = viewFor('iso');
    const far = camPosFor(v, 2.3);
    camera.up.set(v.up[0], v.up[1], v.up[2]);
    camera.fov = v.fov; camera.updateProjectionMatrix();
    camera.position.copy(far.pos);
    camTarget.copy(far.tgt);
    camera.lookAt(camTarget);
    setTimeout(function () { applyView('iso', false, 1, 1150); }, 60);
  }

  function enterRoom(key) {
    active = rooms[key];
    Object.keys(rooms).forEach(k => { rooms[k].group.visible = (k === key); });
    document.getElementById('brandLine').textContent = active.spec.brand.replace(/\s/g, '') + ' · ' + active.spec.name;
    document.getElementById('roomName').textContent = active.spec.name;
    const missing = active.items.filter(it => !thumbs[it.id]).map(it => DEF_MAP[it.id]);
    thumbs = Object.assign(thumbs, buildThumbs(missing));
    resetAll();
    buildTray();
    updateCount();
    tvAnimUntil = performance.now() + 8000;
    activeView = 'iso';
    document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('on', b.dataset.view === 'iso'));
  }

  function backToStart() {
    drag = null;
    document.querySelectorAll('.veil').forEach(v => v.remove());
    document.getElementById('ui').classList.remove('on');
    document.getElementById('start').classList.remove('hide');
    Object.keys(rooms).forEach(k => { rooms[k].group.visible = false; });
    needsRender = true;
  }

  document.getElementById('views').addEventListener('click', function (e) {
    const b = e.target.closest('button');
    if (!b || !active) return;
    this.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    applyView(b.dataset.view, false);
  });
  document.getElementById('btnDone').addEventListener('click', () => { if (active) showResult(); });
  document.getElementById('btnReset').addEventListener('click', () => { if (active) { resetAll(); toast('已重置'); } });
  document.getElementById('btnBack').addEventListener('click', backToStart);

  /* ================= 主循环 ================= */
  const t0 = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let anim = false;

    if (camTween) {
      const k = Math.min(1, (now - camTween.t0) / camTween.dur);
      const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
      camTarget.lerpVectors(camTween.fromT, camTween.toT, e);
      camera.up.lerpVectors(camTween.fromU, camTween.toU, e);
      camera.fov = camTween.fromF + (camTween.toF - camTween.fromF) * e;
      camera.updateProjectionMatrix();
      camera.lookAt(camTarget);
      if (k >= 1) camTween = null;
      anim = true;
    }

    if (active) active.items.forEach(it => { if (updateTween(it, now)) anim = true; });

    if (now < tvAnimUntil && tvScreens.length) {
      for (let i = 0; i < tvScreens.length; i++) {
        tvScreens[i].offset.y = (tvScreens[i].offset.y + 0.0009) % 1;
        tvScreens[i].offset.x = (tvScreens[i].offset.x + 0.0003) % 1;
      }
      anim = true;
    }

    if (drag) {
      const t = (now - t0) / 1000;
      drag.item.rings.forEach(function (r) {
        const hot = !!r.userData.hot;
        r.material.opacity = hot ? .95 : (.22 + .16 * (.5 + .5 * Math.sin(t * 3.2)));
        const s = hot ? 1.28 : (1 + .04 * Math.sin(t * 3.2));
        r.scale.set(s, s, s);
        r.material.color.setHex(hot ? 0xE2B463 : 0xC9A45B);
      });
      anim = true;
    }

    if (anim || needsRender) {
      renderer.render(scene, camera);
      needsRender = false;
    }
  }

  addEventListener('resize', function () {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    if (active) applyView(activeView, true);
    updateScrollBtns && setTimeout(updateScrollBtns, 50);
    needsRender = true;
  });

  buildStart();
  requestAnimationFrame(frame);

  window.__game = {
    rooms: rooms,
    get active() { return active; },
    start: startGame,
    back: backToStart,
    rate: rate,
    reset: resetAll,
    result: showResult,
    project: function (x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(camera);
      return { x: (v.x * .5 + .5) * innerWidth, y: (-v.y * .5 + .5) * innerHeight };
    },
    place: function (id, x, y, z) {
      const it = active.items.find(i => i.id === id);
      if (!it) return 'no item';
      it.group.visible = true;
      it.group.position.set(x, y, z);
      finishPlace(it);
      needsRender = true;
      return 'ok';
    }
  };
})();























