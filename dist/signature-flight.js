(() => {
  'use strict';
  // A textured sheet, split along its actual creases. Each fold rotates rigid
  // paper panels about a shared 3D hinge; the uploaded artwork stays on them.
  const clamp = x => Math.max(0, Math.min(1, x));
  const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
  const mix = (a, b, t) => a + (b - a) * t;
  const point = (x, y, z = 0) => [x, y, z];
  const N = point(0, -270), C = point(0, 270);
  const axisLeft = point(-105, 270), axisRight = point(105, 270);
  const panels = [
    { side: -1, corner: true, vertices: [N, point(-210,-270), point(-210,-60)] },
    { side: 1, corner: true, vertices: [N, point(210,-60), point(210,-270)] },
    { side: -1, outer: true, vertices: [N, point(-210,-60), point(-210,270), axisLeft] },
    { side: 1, outer: true, vertices: [N, axisRight, point(210,270), point(210,-60)] },
    { side: -1, vertices: [N, axisLeft, C] },
    { side: 1, vertices: [N, C, axisRight] }
  ];
  function rotate(p, a, b, angle) {
    const v = p.map((x, i) => x - a[i]), u = b.map((x, i) => x - a[i]);
    const length = Math.hypot(...u); for (let i = 0; i < 3; i++) u[i] /= length;
    const [x,y,z] = v, [i,j,k] = u, dot = x*i+y*j+z*k;
    const cross = [j*z-k*y, k*x-i*z, i*y-j*x], c = Math.cos(angle), s = Math.sin(angle);
    return v.map((value, at) => a[at] + value*c + cross[at]*s + u[at]*dot*(1-c));
  }
  function geometry(panel, t) {
    const corner = ease((t - .55) / .95), dart = ease((t - 1.65) / 1.05);
    const keel = ease((t - 2.85) / .85), wings = ease((t - 3.75) / .85);
    return panel.vertices.map(original => {
      let p = [...original];
      const hinge = panel.side < 0 ? axisLeft : axisRight;
      if (panel.corner) p = rotate(p, N, point(panel.side*210,-60), -panel.side*Math.PI*corner);
      if (panel.outer || panel.corner) p = rotate(p, N, hinge, -panel.side*Math.PI*dart);
      p = rotate(p, N, C, -panel.side*(Math.PI*.46*keel));
      // Open the folded halves into wings, leaving a narrow central keel.
      const wingAxis = point(panel.side*18, 270, -46);
      p = rotate(p, N, wingAxis, panel.side*Math.PI*.38*wings);
      // Settle the layered folds into the two wing surfaces and central keel.
      const [x,y] = original;
      let resting;
      if (x === 0) resting = point(0,y === 270 ? 165 : y,y === 270 ? -70 : 0);
      else if (Math.abs(x) === 105) resting = point(panel.side*150,y,0);
      else if (y === -270) resting = point(panel.side*41,-60,-5);
      else if (y === -60) resting = point(0,-60,-16);
      else resting = point(0,165,-70);
      const settle = ease((t-3.55)/1.05);
      return p.map((value,i)=>mix(value,resting[i],settle));
    });
  }
  function pose(t, width, height) {
    const launch = clamp((t-4.8)/2.3), bank = ease((t-4.2)/.65);
    const base = Math.min(width/650, height/780, .85);
    return {
      x: width/2 + width*1.4*launch*launch - width*.06*Math.sin(launch*Math.PI),
      y: height/2 + 12*Math.sin(t*.8) - height*.55*launch*launch,
      scale: base * (1 - .48*ease(launch)),
      yaw: -.12 + .62*bank + Math.sin(launch*Math.PI)*.4,
      pitch: -.12 + .78*bank,
      roll: -.045 + 1.12*bank - .38*Math.sin(launch*Math.PI)
    };
  }
  function project(p, camera) {
    p = rotate(p, point(0,0), point(0,1), camera.yaw);
    p = rotate(p, point(0,0), point(1,0), camera.pitch);
    p = rotate(p, point(0,0), point(0,0,1), camera.roll);
    const perspective = 1100/(1100-p[2]);
    return [camera.x+p[0]*camera.scale*perspective, camera.y+p[1]*camera.scale*perspective, p[2]];
  }
  function texture(image) {
    const paper = document.createElement('canvas'); paper.width=420; paper.height=540;
    const ctx = paper.getContext('2d');
    ctx.fillStyle='#fffdf3'; ctx.fillRect(0,0,420,540);
    ctx.strokeStyle='#a8bfd255'; ctx.lineWidth=1;
    for(let y=48;y<540;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(420,y);ctx.stroke();}
    ctx.strokeStyle='#d59d9b70';ctx.beginPath();ctx.moveTo(42,0);ctx.lineTo(42,540);ctx.stroke();
    const scale=Math.min(305/image.naturalWidth,235/image.naturalHeight);
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    ctx.drawImage(image,(420-w)/2,(540-h)/2,w,h);
    return paper;
  }
  function triangle(ctx, paper, source, dest) {
    const [[x0,y0],[x1,y1],[x2,y2]] = source.map(p => [p[0]+210,p[1]+270]);
    const [[u0,v0],[u1,v1],[u2,v2]] = dest;
    const det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(det)<.01)return;
    const a=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/det;
    const c=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/det;
    const b=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/det;
    const d=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/det;
    ctx.save();ctx.beginPath();ctx.moveTo(u0,v0);ctx.lineTo(u1,v1);ctx.lineTo(u2,v2);ctx.closePath();ctx.clip();
    ctx.transform(a,b,c,d,u0-a*x0-c*y0,v0-b*x0-d*y0);ctx.drawImage(paper,0,0);ctx.restore();
  }
  function render(ctx, paper, seconds, width, height) {
    ctx.clearRect(0,0,width,height);
    const camera=pose(seconds,width,height);
    const faces=panels.map(panel => {
      const world=geometry(panel,seconds), pts=world.map(p=>project(p,camera));
      const a=world[1].map((v,i)=>v-world[0][i]),b=world[2].map((v,i)=>v-world[0][i]);
      const normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const length=Math.hypot(...normal)||1;
      const shade=clamp(.14+(normal[0]/length)*.26+(normal[1]/length)*.1);
      return {panel,pts,shade,z:pts.reduce((sum,p)=>sum+p[2],0)/pts.length};
    }).sort((a,b)=>a.z-b.z);
    // A soft ground shadow lifts away as the finished plane launches.
    const depart=clamp((seconds-4.8)/2.3);
    ctx.save();ctx.globalAlpha=.12*(1-depart);ctx.fillStyle='#172a23';ctx.filter='blur(16px)';
    ctx.beginPath();ctx.ellipse(width/2,height/2+170*camera.scale,130*camera.scale,18*camera.scale,0,0,Math.PI*2);ctx.fill();ctx.restore();
    for(const {panel,pts,shade} of faces){
      for(let i=1;i<pts.length-1;i++)triangle(ctx,paper,[panel.vertices[0],panel.vertices[i],panel.vertices[i+1]],[pts[0],pts[i],pts[i+1]]);
      ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
      const fold=clamp((seconds-.5)/4);
      ctx.fillStyle=`rgba(40,48,55,${shade*fold})`;ctx.fill();
      ctx.strokeStyle=`rgba(70,65,49,${.10+.16*fold})`;ctx.lineWidth=.7;ctx.stroke();
    }
  }
  let active, generation = 0;
  function cancel() { generation++; active?.stop(); }
  async function play(dialog, imageURL) {
    cancel();
    const version = generation;
    const image=new Image();image.src=imageURL;await image.decode();
    if(!dialog.open || version !== generation)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const overlay=document.createElement('div');overlay.className='signature-flight';
    overlay.innerHTML='<canvas aria-hidden="true"></canvas><p role="status">Sent.</p><button type="button" aria-label="Finish sending animation">Skip animation</button>';
    // Fixed inside the modal keeps the effect in the browser's top layer.
    dialog.appendChild(overlay);dialog.classList.add('is-sending');
    const canvas=overlay.querySelector('canvas'),ctx=canvas.getContext('2d'),paper=texture(image);
    let width,height,frame=0,start=performance.now();
    const resize=()=>{width=window.innerWidth;height=window.innerHeight;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
    resize();window.addEventListener('resize',resize);
    return new Promise(resolve=>{
      const stop=()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);overlay.remove();dialog.classList.remove('is-sending');if(active?.stop===stop)active=null;resolve();};
      active={stop};overlay.querySelector('button').addEventListener('click',stop);overlay.querySelector('button').focus({preventScroll:true});
      const tick=now=>{const t=(now-start)/1000;
        try { render(ctx,paper,reduced?0:t,width,height); } catch { stop(); return; }
        overlay.dataset.stage=reduced?'sent':t<.55?'paper':t<1.65?'corners':t<2.85?'dart':t<3.75?'keel':t<4.8?'wings':'flight';
        if(t>(reduced?1.2:7.15))stop();else frame=requestAnimationFrame(tick);
      };frame=requestAnimationFrame(tick);
    });
  }
  window.addEventListener('pagehide',cancel);
  window.MAKERSPACE_FLIGHT={play,cancel,geometry,pose,render};
})();
