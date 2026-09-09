/**
 * ComfyUI Smooth Organizer
 * Version 1.0.1
 *
 * A graph-aware workflow layout extension with its own visual vocabulary.
 * No prototype patching; uses ComfyUI's extension hooks.
 */
import { app } from "../../scripts/app.js";

const EXTENSION_NAME = "comfyui.smooth-organizer";
const VERSION = "1.0.1";
const GUARD = "__smoothOrganizer101_v2_loaded";

if (!globalThis[GUARD]) {
  globalThis[GUARD] = true;

  const CFG = Object.freeze({
    margin: 90,
    xGap: 110,
    yGap: 55,
    laneGap: 95,
    groupPad: 70,
    gridGap: 45,
    rerouteGap: 35,
    maxCrossPasses: 10,
    animationMs: 500,
    animationEnabled: true,
  });

  const canvas = () => app.canvas ?? null;
  const graph = () => canvas()?.subgraph ?? canvas()?.graph ?? app.graph ?? null;

  const nodesOf = g => Array.isArray(g?.nodes) ? g.nodes : (g?._nodes ?? []);
  const groupsOf = g => Array.isArray(g?.groups) ? g.groups : (g?._groups ?? []);
  const linksOf = g => {
    const x = g?._links ?? g?.links;
    if (!x) return [];
    if (x instanceof Map) return [...x.values()].filter(Boolean);
    if (Array.isArray(x)) return x.filter(Boolean);
    return Object.values(x).filter(Boolean);
  };
  const reroutesOf = g => {
    const r = g?.reroutes;
    if (!r) return [];
    if (r instanceof Map) return [...r.values()].filter(Boolean);
    if (Array.isArray(r)) return r.filter(Boolean);
    return Object.values(r).filter(Boolean);
  };

  const sizeOf = n => ({
    w: Math.max(20, Number(n?.size?.[0] ?? n?.width ?? 180) || 180),
    h: Math.max(20, Number(n?.size?.[1] ?? n?.height ?? 90) || 90),
  });

  function setPos(item, x, y) {
    if (!item?.pos) return false;
    const nx = Math.round(x), ny = Math.round(y);
    if (Math.abs(item.pos[0] - nx) < 0.5 && Math.abs(item.pos[1] - ny) < 0.5) return false;
    item.pos = [nx, ny];
    return true;
  }

  function titleOf(n) {
    return String(n?.title ?? n?.type ?? n?.comfyClass ?? "").trim();
  }
  function typeOf(n) { return titleOf(n).toLowerCase(); }
  function isLoad(n) { const t = typeOf(n); return t === "loadimage" || t.includes("load image"); }
  function isSave(n) { const t = typeOf(n); return t === "saveimage" || t.includes("save image"); }
  function isReroute(n) { return String(n?.type ?? "").toLowerCase().includes("reroute"); }

  function endpoint(link) {
    return {
      from: link?.origin_id ?? link?.originId ?? link?.[1],
      to: link?.target_id ?? link?.targetId ?? link?.[3],
    };
  }

  function selectedNodes(g) {
    const c = canvas();
    if (c?.selectedItems instanceof Set) {
      const a = [...c.selectedItems].filter(x => nodesOf(g).includes(x));
      if (a.length) return a;
    }
    if (c?.selected_nodes && typeof c.selected_nodes === "object") {
      const ids = new Set(Object.keys(c.selected_nodes).map(String));
      return nodesOf(g).filter(n => ids.has(String(n.id)));
    }
    return [];
  }

  function stable(a, b) {
    const ay = Number(a?.pos?.[1] ?? 0), by = Number(b?.pos?.[1] ?? 0);
    const ax = Number(a?.pos?.[0] ?? 0), bx = Number(b?.pos?.[0] ?? 0);
    return ay - by || ax - bx || titleOf(a).localeCompare(titleOf(b)) || String(a?.id).localeCompare(String(b?.id));
  }

  function buildModel(g, only = null) {
    const all = nodesOf(g).filter(n => !isReroute(n));
    const picked = only?.length ? only.filter(n => all.includes(n)) : all;
    const ids = new Set(picked.map(n => n.id));
    const map = new Map(picked.map(n => [n.id, n]));
    const out = new Map(picked.map(n => [n.id, []]));
    const inc = new Map(picked.map(n => [n.id, []]));
    for (const l of linksOf(g)) {
      const { from, to } = endpoint(l);
      if (!ids.has(from) || !ids.has(to) || from === to) continue;
      if (!out.get(from).includes(to)) out.get(from).push(to);
      if (!inc.get(to).includes(from)) inc.get(to).push(from);
    }
    return { nodes: picked, map, out, inc };
  }

  function topo(m) {
    const deg = new Map([...m.map.keys()].map(id => [id, m.inc.get(id).length]));
    const q = [...m.map.keys()].filter(id => deg.get(id) === 0).sort((a,b)=>stable(m.map.get(a),m.map.get(b)));
    const result = [], seen = new Set();
    while (q.length) {
      const id = q.shift(); result.push(id); seen.add(id);
      for (const v of m.out.get(id)) {
        const d = deg.get(v) - 1; deg.set(v, d);
        if (d === 0) q.push(v);
      }
      q.sort((a,b)=>stable(m.map.get(a),m.map.get(b)));
    }
    for (const id of m.map.keys()) if (!seen.has(id)) result.push(id);
    return result;
  }

  function layersFor(m) {
    const order = topo(m), depth = new Map(order.map(id => [id, 0]));
    for (const id of order) {
      for (const v of m.out.get(id)) depth.set(v, Math.max(depth.get(v) ?? 0, (depth.get(id) ?? 0) + 1));
    }
    const max = Math.max(0, ...depth.values());
    const layers = Array.from({length:max+1},()=>[]);
    for (const [id,d] of depth) layers[d].push(id);
    layers.forEach(l=>l.sort((a,b)=>stable(m.map.get(a),m.map.get(b))));
    return layers;
  }

  function median(values) {
    if (!values.length) return null;
    values.sort((a,b)=>a-b);
    const i = Math.floor(values.length/2);
    return values.length % 2 ? values[i] : (values[i-1]+values[i])/2;
  }

  function reduceCrossings(layers, m) {
    const ls = layers.map(x=>[...x]);
    const reorder = (layer, ref, adjacency) => {
      const idx = new Map(ref.map((id,i)=>[id,i]));
      const scored = layer.map((id,i)=>{
        const vals = (adjacency.get(id) ?? []).map(v=>idx.get(v)).filter(Number.isFinite);
        return {id, i, score: median(vals)};
      });
      scored.sort((a,b)=> (a.score == null ? 1 : b.score == null ? -1 : a.score-b.score) || a.i-b.i);
      layer.splice(0,layer.length,...scored.map(x=>x.id));
    };
    for(let p=0;p<CFG.maxCrossPasses;p++) {
      for(let i=1;i<ls.length;i++) reorder(ls[i],ls[i-1],m.inc);
      for(let i=ls.length-2;i>=0;i--) reorder(ls[i],ls[i+1],m.out);
    }
    return ls;
  }

  function assignY(layers, m) {
    const y = new Map();
    let anchor = 0;
    for(let i=1;i<layers.length;i++) if(layers[i].length>layers[anchor].length) anchor=i;
    let cursor = 0;
    for(const id of layers[anchor]) { y.set(id,cursor); cursor += sizeOf(m.map.get(id)).h + CFG.yGap; }

    const walk = (start, end, step, adjacency) => {
      for(let i=start; i!==end; i+=step) {
        const layer=layers[i], ref=layers[i-step], refSet=new Set(ref);
        for(const id of layer) {
          const centers=(adjacency.get(id)??[]).filter(v=>refSet.has(v)).map(v=>y.get(v)+sizeOf(m.map.get(v)).h/2);
          if(centers.length) y.set(id, median(centers)-sizeOf(m.map.get(id)).h/2);
        }
        let bottom=-Infinity;
        for(const id of [...layer].sort((a,b)=>(y.get(a)??0)-(y.get(b)??0))) {
          let py=y.get(id); if(!Number.isFinite(py)) py=bottom+CFG.yGap;
          if(py<bottom+CFG.yGap) py=bottom+CFG.yGap;
          y.set(id,py); bottom=py+sizeOf(m.map.get(id)).h;
        }
      }
    };
    walk(anchor+1,layers.length,1,m.inc);
    walk(anchor-1,-1,-1,m.out);
    let min=Infinity; for(const v of y.values()) min=Math.min(min,v);
    for(const [id,v] of y) y.set(id,v-min);
    return y;
  }

  function flowStack(m, originX=CFG.margin, originY=CFG.margin) {
    if(!m.nodes.length) return false;
    const layers=reduceCrossings(layersFor(m),m), y=assignY(layers,m);
    let x=originX, changed=false;
    for(const layer of layers) {
      let width=0;
      for(const id of layer) width=Math.max(width,sizeOf(m.map.get(id)).w);
      for(const id of layer) changed=setPos(m.map.get(id),x,originY+(y.get(id)??0))||changed;
      x+=width+CFG.xGap;
    }
    return changed;
  }

  // A distinct, calmer layout: graph depth determines horizontal lanes, while
  // siblings are packed around their shared parent instead of a rigid stack.
  function smartFlow(m, originX=CFG.margin, originY=CFG.margin) {
    const changed=flowStack(m,originX,originY);
    const layers=layersFor(m);
    let any=changed;
    for(let i=1;i<layers.length;i++) {
      const layer=layers[i];
      for(const id of layer) {
        const parents=(m.inc.get(id)??[]).map(v=>m.map.get(v)).filter(Boolean);
        if(!parents.length) continue;
        const target=median(parents.map(p=>p.pos[1]+sizeOf(p).h/2));
        any=setPos(m.map.get(id),m.map.get(id).pos[0],target-sizeOf(m.map.get(id)).h/2)||any;
      }
      // collision pass
      const ordered=[...layer].sort((a,b)=>m.map.get(a).pos[1]-m.map.get(b).pos[1]);
      let bottom=-Infinity;
      for(const id of ordered){const n=m.map.get(id), s=sizeOf(n); let y=n.pos[1]; if(y<bottom+CFG.yGap)y=bottom+CFG.yGap; any=setPos(n,n.pos[0],y)||any; bottom=y+s.h;}
    }
    return any;
  }

  function matrix(m) {
    const list=[...m.nodes].sort(stable), cols=Math.max(1,Math.ceil(Math.sqrt(list.length)));
    const widths=Array(cols).fill(0); const heights=[];
    for(let i=0;i<list.length;i++){const s=sizeOf(list[i]); widths[i%cols]=Math.max(widths[i%cols],s.w); heights[Math.floor(i/cols)]=Math.max(heights[Math.floor(i/cols)]??0,s.h);}
    const xs=[]; let x=CFG.margin; for(let c=0;c<cols;c++){xs[c]=x;x+=widths[c]+CFG.gridGap;}
    const ys=[]; let y=CFG.margin; for(let r=0;r<heights.length;r++){ys[r]=y;y+=heights[r]+CFG.gridGap;}
    let changed=false; list.forEach((n,i)=>changed=setPos(n,xs[i%cols],ys[Math.floor(i/cols)])||changed); return changed;
  }

  function densePack(m) {
    const list=[...m.nodes].sort((a,b)=>sizeOf(b).h-sizeOf(a).h || stable(a,b));
    const bins=[]; const width=Math.max(900,Math.sqrt(list.reduce((s,n)=>s+sizeOf(n).w*sizeOf(n).h,0))*1.4);
    for(const n of list){const s=sizeOf(n); let best=null;
      for(const b of bins){const x=b.x+b.usedW+CFG.gridGap; if(x+s.w<=b.x+width) {best={b,x};break;}}
      if(!best){const y=bins.length?bins[bins.length-1].y+bins[bins.length-1].h+CFG.gridGap:CFG.margin; const b={x:CFG.margin,y,usedW:0,h:s.h};bins.push(b);best={b,x:b.x};}
      const {b,x}=best; setPos(n,x,b.y); b.usedW=Math.max(b.usedW,x-b.x+s.w); b.h=Math.max(b.h,s.h);
    }
    return true;
  }

  function typeLanes(m) {
    const groups=new Map();
    for(const n of m.nodes){const key=typeOf(n).replace(/\s+/g," ").split(".").pop(); if(!groups.has(key))groups.set(key,[]); groups.get(key).push(n);}
    const sorted=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])); let x=CFG.margin, changed=false;
    for(const [,list] of sorted){list.sort(stable); let y=CFG.margin; let w=0; for(const n of list){const s=sizeOf(n); changed=setPos(n,x,y)||changed;y+=s.h+CFG.yGap;w=Math.max(w,s.w);} x+=w+CFG.laneGap;}
    return changed;
  }

  function focusBranch(m) {
    const selected=selectedNodes(graph());
    if(!selected.length) return false;
    const ids=new Set(selected.map(n=>n.id)); const q=[...ids];
    while(q.length){const id=q.shift(); for(const v of m.out.get(id)??[]) if(!ids.has(v)){ids.add(v);q.push(v);} for(const v of m.inc.get(id)??[]) if(!ids.has(v)){ids.add(v);q.push(v);}}
    return smartFlow({...m,nodes:[...ids].map(id=>m.map.get(id)).filter(Boolean)},CFG.margin,CFG.margin);
  }

  function groupMembers(g, group) {
    if(group?.children instanceof Set) return [...group.children].filter(x=>nodesOf(g).includes(x));
    if(Array.isArray(group?._nodes)) return group._nodes.filter(x=>nodesOf(g).includes(x));
    const b=group?.boundingRect??group?._bounding??group?.bounding; if(!b)return[];
    return nodesOf(g).filter(n=>{const s=sizeOf(n);return n.pos[0]+s.w/2>=b[0]&&n.pos[0]+s.w/2<=b[0]+b[2]&&n.pos[1]+s.h/2>=b[1]&&n.pos[1]+s.h/2<=b[1]+b[3];});
  }

  function arrangeGroups(g) {
    let changed=false;
    for(const group of groupsOf(g)){
      const members=groupMembers(g,group); if(!members.length)continue;
      const m=buildModel(g,members); const before=[...members.map(n=>[...n.pos])];
      flowStack(m,CFG.margin,CFG.margin);
      const minX=Math.min(...members.map(n=>n.pos[0]))-CFG.groupPad, minY=Math.min(...members.map(n=>n.pos[1]))-CFG.groupPad;
      const dx=(group.pos?.[0]??0)-minX, dy=(group.pos?.[1]??0)-minY;
      for(let i=0;i<members.length;i++){const n=members[i]; changed=setPos(n,n.pos[0]+dx,n.pos[1]+dy)||changed;}
      try{group.recomputeInsideNodes?.();}catch{}
      changed ||= before.some((p,i)=>p[0]!==members[i].pos[0]||p[1]!==members[i].pos[1]);
    }
    return changed;
  }

  // Keep true graph sources on the left and true graph sinks on the right.
  // Unlike the old Load/Save-only rule, this works for any workflow node:
  // - source: no incoming connections, at least one outgoing connection
  // - sink: no outgoing connections, at least one incoming connection
  // Explicit image endpoints are still recognized and therefore receive the
  // same treatment even when their graph degree is unusual.
  function endpoints(g, targetModel = null) {
    const all = buildModel(g);
    const targetIds = new Set((targetModel?.nodes ?? all.nodes).map(n => n.id));
    const nodes = all.nodes;

    const sources = [];
    const sinks = [];

    for (const n of nodes) {
      const hasIn = (all.inc.get(n.id) ?? []).length > 0;
      const hasOut = (all.out.get(n.id) ?? []).length > 0;
      const explicitLoad = isLoad(n);
      const explicitSave = isSave(n);

      // Ignore truly isolated nodes. They should be handled by the main
      // layout instead of being pushed to an edge.
      if (!hasIn && !hasOut && !explicitLoad && !explicitSave) continue;

      if (explicitLoad || (!hasIn && hasOut)) sources.push(n);
      if (explicitSave || (hasIn && !hasOut)) sinks.push(n);
    }

    if (!sources.length && !sinks.length) return false;

    const GAP = 70;
    let changed = false;

    const centerY = n => {
      const s = sizeOf(n);
      return n.pos[1] + s.h / 2;
    };

    const uniqueNodes = ids => {
      const seen = new Set();
      const result = [];
      for (const id of ids) {
        if (seen.has(id)) continue;
        const n = all.map.get(id);
        if (!n || !targetIds.has(n.id)) continue;
        seen.add(id);
        result.push(n);
      }
      return result;
    };

    // A source is positioned immediately before its first meaningful
    // downstream layer. Its Y is derived from the median of its children,
    // which keeps parallel branches visually grouped.
    for (const n of sources) {
      if (!targetIds.has(n.id)) continue;

      const children = uniqueNodes(all.out.get(n.id) ?? []);
      if (!children.length) continue;

      const rightmostChild = Math.min(
        ...children.map(child => child.pos[0])
      );
      const x = rightmostChild - sizeOf(n).w - GAP;
      const y = median(children.map(centerY)) - sizeOf(n).h / 2;

      changed = setPos(n, x, y) || changed;
    }

    // A sink is positioned immediately after its last meaningful upstream
    // layer. This prevents the large empty area that occurred when Save Image
    // was placed relative to the farthest node in the entire graph.
    for (const n of sinks) {
      if (!targetIds.has(n.id)) continue;

      const parents = uniqueNodes(all.inc.get(n.id) ?? []);
      if (!parents.length) continue;

      const leftmostParentRight = Math.max(
        ...parents.map(parent => parent.pos[0] + sizeOf(parent).w)
      );
      const x = leftmostParentRight + GAP;
      const y = median(parents.map(centerY)) - sizeOf(n).h / 2;

      changed = setPos(n, x, y) || changed;
    }

    return changed;
  }

  function placeReroutes(g) {
    const rs=reroutesOf(g); if(!rs.length)return false;
    let changed=false;
    for(const r of rs){
      const p=r.pos??r._pos; if(!p)continue;
      // Keep reroutes close to their existing route; only snap tiny accidental
      // offsets and avoid moving them aggressively across the user's graph.
      changed=setPos(r,Math.round(p[0]/10)*10,Math.round(p[1]/10)*10)||changed;
    }
    return changed;
  }

  // Final collision pass used by Smart Arrange / Flow Stack.
  // Unlike a simple per-layer collision check, this works on the actual
  // rectangles of every node, so different layers cannot visually overlap.
  function resolveNodeOverlaps(nodes, gap = CFG.yGap) {
    if (nodes.length < 2) return false;

    const list = [...nodes].filter(n => n?.pos);
    let changed = false;

    // A few deterministic passes are enough for the small local cascades that
    // appear after median alignment. We only push downward; this preserves the
    // left-to-right graph structure and avoids introducing horizontal drift.
    for (let pass = 0; pass < 8; pass++) {
      let passChanged = false;
      list.sort((a, b) =>
        (a.pos[1] - b.pos[1]) ||
        (a.pos[0] - b.pos[0]) ||
        stable(a, b)
      );

      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        const as = sizeOf(a);
        const aRight = a.pos[0] + as.w;
        const aBottom = a.pos[1] + as.h;

        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          const bs = sizeOf(b);

          // Since the list is Y sorted, once b starts below a there can still
          // be overlap, but once it is safely below a we can stop for this a.
          if (b.pos[1] >= aBottom + gap) break;

          const bRight = b.pos[0] + bs.w;
          const overlapX = Math.min(aRight, bRight) - Math.max(a.pos[0], b.pos[0]);
          const overlapY = aBottom - b.pos[1];

          if (overlapX > 0 && overlapY > 0) {
            const nextY = aBottom + gap;
            if (b.pos[1] < nextY) {
              setPos(b, b.pos[0], nextY);
              passChanged = true;
              changed = true;
            }
          }
        }
      }

      if (!passChanged) break;
    }

    return changed;
  }

  function animateTo(g, from, to, duration = CFG.animationMs) {
    if (!CFG.animationEnabled || duration <= 0) {
      for (const n of nodesOf(g)) {
        const p = to.get(n.id);
        if (p) n.pos = [...p];
      }
      drawNow(g);
      return;
    }

    const entries = [];
    for (const n of nodesOf(g)) {
      const a = from.get(n.id);
      const b = to.get(n.id);
      if (!a || !b) continue;
      if (a[0] === b[0] && a[1] === b[1]) continue;
      entries.push({ n, x0: a[0], y0: a[1], x1: b[0], y1: b[1] });
    }

    if (!entries.length) {
      drawNow(g);
      return;
    }

    // Cancel an older animation cleanly if the user arranges again quickly.
    if (g.__smoothOrganizerAnimation?.raf) {
      cancelAnimationFrame(g.__smoothOrganizerAnimation.raf);
    }

    for (const e of entries) e.n.pos = [e.x0, e.y0];

    const start = performance.now();
    const state = { raf: 0 };
    g.__smoothOrganizerAnimation = state;

    const ease = t => 1 - Math.pow(1 - t, 3); // smooth ease-out

    const frame = now => {
      const raw = Math.min(1, (now - start) / duration);
      const t = ease(raw);

      for (const e of entries) {
        e.n.pos = [
          Math.round(e.x0 + (e.x1 - e.x0) * t),
          Math.round(e.y0 + (e.y1 - e.y0) * t),
        ];
      }

      drawNow(g);

      if (raw < 1) {
        state.raf = requestAnimationFrame(frame);
      } else {
        for (const e of entries) e.n.pos = [e.x1, e.y1];
        if (g.__smoothOrganizerAnimation === state) {
          g.__smoothOrganizerAnimation = null;
        }
        drawNow(g);
      }
    };

    state.raf = requestAnimationFrame(frame);
  }

  function snapshot(g){return new Map(nodesOf(g).map(n=>[n.id,[...(n.pos??[0,0])]]));}
  function restore(g,s){for(const n of nodesOf(g)){const p=s.get(n.id);if(p)n.pos=[...p];} redraw(g);}

  function captureHistory(){
    try{const t=app?.extensionManager?.workflowStore?.activeWorkflow?.changeTracker;if(t?.captureCanvasState){t.captureCanvasState();return true;}}catch(e){console.warn(`[${EXTENSION_NAME}]`,e)}
    try{app.graph?.change?.()}catch{}
    return false;
  }
  function drawNow(g){
    try{g?.setDirtyCanvas?.(true,true)}catch{}
    try{canvas()?.setDirty?.(true,true)}catch{}
    try{canvas()?.draw?.(true,true)}catch{}
  }

  function redraw(g){
    drawNow(g);
    requestAnimationFrame(()=>drawNow(g));
  }

  function run(label, action){
    const g=graph(); if(!g)return false;
    const before=snapshot(g);
    let changed=false;
    try{
      changed=!!action(g);
    }catch(e){
      console.error(`[${EXTENSION_NAME}] ${label}`,e);
      restore(g,before);
      return false;
    }

    if(!changed){
      redraw(g);
      return false;
    }

    const target=snapshot(g);
    captureHistory();

    // Keep the exact calculated target while visually interpolating from the
    // user's current layout. History remains a single Arrange transaction.
    animateTo(g,before,target);
    return true;
  }

  function execute(mode, selectionOnly=false){
    const g=graph(); if(!g)return false;
    const picked=selectionOnly?selectedNodes(g):null; const m=buildModel(g,picked); if(!m.nodes.length)return false;
    return run(mode,g=>{
      let changed=false;
      if(mode==="smart") changed=smartFlow(m);
      else if(mode==="matrix") changed=matrix(m);
      else if(mode==="dense") changed=densePack(m);
      else if(mode==="lanes") changed=typeLanes(m);
      else if(mode==="branch") changed=focusBranch(m);
      else if(mode==="groups") changed=arrangeGroups(g);
      else if(mode==="cleanup") changed=placeReroutes(g);
      else changed=flowStack(m);
      if(mode!=="matrix"&&mode!=="dense"&&mode!=="lanes") changed=endpoints(g,m)||changed;
      // Final global collision pass. This is intentionally after endpoint
      // placement because endpoint constraints can move nodes into a new
      // collision with an adjacent lane.
      if(mode!=="cleanup") changed=resolveNodeOverlaps(m.nodes, CFG.yGap)||changed;
      return changed;
    });
  }

  const item=(content,callback,extra={})=>({content,callback,...extra});

  app.registerExtension({
    name:EXTENSION_NAME,
    getCanvasMenuItems(){
      return [null,{content:"Smooth Organizer",has_submenu:true,submenu:{options:[
        item("Smart Arrange",()=>execute("smart")),
        item("Flow Stack",()=>execute("flow")),
        item("Branch Focus",()=>execute("branch")),
        null,
        item("Blueprint Grid",()=>execute("matrix")),
        item("Dense Pack",()=>execute("dense")),
        item("Type Lanes",()=>execute("lanes")),
        null,
        item("Tidy Groups",()=>execute("groups")),
        item("Clean Reroutes",()=>execute("cleanup")),
        item("Arrange Selection",()=>execute("smart",true)),
      ]}}];
    },
    getNodeMenuItems(){
      const g=graph(); if(!g||selectedNodes(g).length<2)return[];
      return [null,{content:"Smooth Organizer",has_submenu:true,submenu:{options:[
        item("Smart Arrange Selection",()=>execute("smart",true)),
        item("Flow Stack Selection",()=>execute("flow",true)),
        item("Blueprint Selection",()=>execute("matrix",true)),
        item("Dense Pack Selection",()=>execute("dense",true)),
      ]}}];
    },
    setup(){console.info(`[${EXTENSION_NAME}] v${VERSION} ready`);}
  });

  globalThis.ComfyUISmoothOrganizer=Object.freeze({version:VERSION,arrange:(m="smart")=>execute(m),arrangeSelection:(m="smart")=>execute(m,true),redraw:()=>redraw(graph())});
}
