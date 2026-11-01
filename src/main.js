
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

// ---------- survey geometry (ft; x east, y north; origin = P.O.B.) ----------
const PARCEL=[[0,0],[-350.62,-57.78],[-425.17,-70.49],[-514.65,311.27],[-810.56,271.44],[-1352.12,231.59],[-1344.2,508.2],[-939.51,512.44],[-1.42,550.26],[2.11,223.82]];
const OX=-676,OY=240;
const W=(x,y,h=0)=>new THREE.Vector3(x-OX,h,-(y-OY));

// ---------- 2D helpers ----------
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], len=a=>Math.hypot(a[0],a[1]), nrm=a=>{const l=len(a);return[a[0]/l,a[1]/l];};
function segDist(p,a,b){const ab=sub(b,a),ap=sub(p,a);const t=Math.max(0,Math.min(1,(ap[0]*ab[0]+ap[1]*ab[1])/(ab[0]**2+ab[1]**2||1)));return Math.hypot(p[0]-a[0]-ab[0]*t,p[1]-a[1]-ab[1]*t);}
function polyDist(p,pts,closed=false){let d=1e9;const n=pts.length;for(let i=0;i<n-(closed?0:1);i++)d=Math.min(d,segDist(p,pts[i],pts[(i+1)%n]));return d;}
function pip(p,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c;}return c;}
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
const R=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
function fillet(pts,r,step=3){
  const out=[pts[0]];
  for(let i=1;i<pts.length-1;i++){
    const A=pts[i-1],P=pts[i],B=pts[i+1],d1=nrm(sub(P,A)),d2=nrm(sub(B,P));
    const T1=[P[0]-d1[0]*r,P[1]-d1[1]*r],T2=[P[0]+d2[0]*r,P[1]+d2[1]*r],C=[T1[0]+d2[0]*r,T1[1]+d2[1]*r];
    const a1=Math.atan2(T1[1]-C[1],T1[0]-C[0]);let da=Math.atan2(T2[1]-C[1],T2[0]-C[0])-a1;
    while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
    const n=Math.ceil(Math.abs(da)*r/step);
    for(let k=0;k<=n;k++)out.push([C[0]+r*Math.cos(a1+da*k/n),C[1]+r*Math.sin(a1+da*k/n)]);
  }
  out.push(pts[pts.length-1]);return out;
}
function curbReturn(cx,cy,qx,qy,r){ // concave fillet patch at inside corner
  const C=[cx+qx*r,cy+qy*r],pts=[[cx,cy]];const a1=Math.atan2(-qy,0),a2=Math.atan2(0,-qx);
  let da=a2-a1;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
  for(let k=0;k<=16;k++)pts.push([C[0]+r*Math.cos(a1+da*k/16),C[1]+r*Math.sin(a1+da*k/16)]);
  return pts;
}

// ---------- renderer ----------
const app=document.getElementById('app');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
const MOBILE=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
renderer.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.5:2));renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
app.appendChild(renderer.domElement);
const lr=new CSS2DRenderer();lr.setSize(innerWidth,innerHeight);
Object.assign(lr.domElement.style,{position:'fixed',top:'0',pointerEvents:'none'});app.appendChild(lr.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xbcd6e8);scene.fog=new THREE.Fog(0xbcd6e8,2200,5200);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,2,9000);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*0.49;controls.minDistance=50;controls.maxDistance=3200;
controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
scene.add(new THREE.HemisphereLight(0xdfefff,0x5d6b3a,1.15));
const sun=new THREE.DirectionalLight(0xfff1d6,2.1);sun.position.set(-500,900,600);sun.castShadow=true;
sun.shadow.mapSize.set(MOBILE?2048:4096,MOBILE?2048:4096);Object.assign(sun.shadow.camera,{left:-900,right:900,top:600,bottom:-600,near:100,far:2600});sun.shadow.bias=-0.0004;
scene.add(sun,sun.target);

// ---------- mesh helpers ----------
const matCache={};
const M=(c,o={})=>{const k=c+JSON.stringify(o);return matCache[k]||(matCache[k]=new THREE.MeshLambertMaterial({color:c,...o}));};
function flat(pts,color,h=0.1,o={}){
  const s=new THREE.Shape(pts.map(([x,y])=>new THREE.Vector2(x-OX,y-OY)));
  const m=new THREE.Mesh(new THREE.ShapeGeometry(s,24),M(color,o));m.rotation.x=-Math.PI/2;m.position.y=h;m.receiveShadow=true;scene.add(m);return m;
}
const boxGeo=new THREE.BoxGeometry(1,1,1);
function box(cx,cy,w,d,hgt,color,e=0,shadow=true){const m=new THREE.Mesh(boxGeo,typeof color==='object'?color:M(color));m.scale.set(w,hgt,d);m.position.copy(W(cx,cy,e+hgt/2));m.castShadow=shadow;m.receiveShadow=true;scene.add(m);return m;}
const labels=[];
function label(html,x,y,h,cls=''){const d=document.createElement('div');d.className='lbl '+cls;d.innerHTML=html;const o=new CSS2DObject(d);o.position.copy(W(x,y,h));scene.add(o);labels.push(o);return o;}
function strip(a,b,w,color,h){const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1,nx=-dy/L*w/2,ny=dx/L*w/2;return flat([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],color,h);}
function ribbon(pts,width,color,h){
  const pos=[],idx=[];
  pts.forEach((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];const d=nrm(sub(b,a)),n=[-d[1]*width/2,d[0]*width/2];
    const L=W(p[0]+n[0],p[1]+n[1],h),Rr=W(p[0]-n[0],p[1]-n[1],h);pos.push(L.x,L.y,L.z,Rr.x,Rr.y,Rr.z);
    if(i<pts.length-1){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2);}});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,M(color,{side:THREE.DoubleSide}));m.receiveShadow=true;scene.add(m);return m;
}
function pathLen(pts){let s=0;for(let i=1;i<pts.length;i++)s+=len(sub(pts[i],pts[i-1]));return s;}
function pointAt(pts,d){for(let i=1;i<pts.length;i++){const L=len(sub(pts[i],pts[i-1]));if(d<=L){const t=d/L;return[pts[i-1][0]+(pts[i][0]-pts[i-1][0])*t,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t];}d-=L;}return pts[pts.length-1];}
function dashes(pts,on=10,off=14,from=0,to=0){const L=pathLen(pts)-to;for(let d=from;d<L;d+=on+off)strip(pointAt(pts,d),pointAt(pts,Math.min(d+on,L)),0.7,0xf5d33b,0.38);}

// ---------- ground & surroundings ----------
const g=new THREE.Mesh(new THREE.PlaneGeometry(9000,9000),M(0x7d9a52));g.rotation.x=-Math.PI/2;g.receiveShadow=true;scene.add(g);
[[-2200,560,-1352,1400,0x86a35a],[-1352,550,600,1400,0x7a9550],[2,-60,900,550,0x8aa65c],[-2200,-600,-1352,232,0x83a057]].forEach(([a,b,c,d,col])=>flat(R(a,b,c,d),col,0.02));
flat(PARCEL,0x9dbb6a,0.05);

// US Hwy 82
const H0=[-425.17,-70.49],U=[425.17/430.97,70.49/430.97],N=[U[1],-U[0]];
const hp=(s,o)=>[H0[0]+U[0]*s+N[0]*o,H0[1]+U[1]*s+N[1]*o];
const hstrip=(o0,o1,c,h,s0=-1500,s1=1100)=>flat([hp(s0,o0),hp(s1,o0),hp(s1,o1),hp(s0,o1)],c,h);
hstrip(0,210,0x8fa864,0.04);hstrip(30,74,0x3b3f44,0.2);hstrip(118,162,0x3b3f44,0.2);hstrip(74,118,0x7f9b55,0.15);
for(let s=-1500;s<1100;s+=40){hstrip(51.6,52.4,0xffffff,0.25,s,s+12);hstrip(139.6,140.4,0xffffff,0.25,s,s+12);}
hstrip(32,32.8,0xf5d33b,0.25);hstrip(160,160.8,0xffffff,0.25);hstrip(72,72.8,0xffffff,0.25);hstrip(119.2,120,0xf5d33b,0.25);
label('U.S. HIGHWAY 82 — WEST',hp(150,52)[0]+70,hp(150,52)[1]-20,4,'road');
label('U.S. HIGHWAY 82 — EAST',hp(150,140)[0]+80,hp(150,140)[1],4,'road');
const hwyEdgeY=x=>{const s=(x-H0[0]-N[0]*30)/U[0];return H0[1]+U[1]*s+N[1]*30;}; // north edge of WB pavement
const hy=x=>x*(70.49/425.17); // property line along highway

// CR 167
const C0=[-1352.12,231.59],CV=[7.92/276.72,276.61/276.72],CE=[CV[1],-CV[0]];
const cp=(s,o)=>[C0[0]+CV[0]*s+CE[0]*o,C0[1]+CV[1]*s+CE[1]*o];
flat([cp(-900,-11),cp(1200,-11),cp(1200,11),cp(-900,11)],0x45484c,0.2);
for(let s=-900;s<1200;s+=30)flat([cp(s,-0.4),cp(s+12,-0.4),cp(s+12,0.4),cp(s,0.4)],0xf5d33b,0.25);
label('COUNTY ROAD 167',cp(-120,0)[0]-28,cp(-120,0)[1],4,'road');
const crEdgeX=y=>C0[0]+CV[0]*((y-C0[1])/CV[1])+11;

// boundary
for(let i=0;i<PARCEL.length;i++)strip(PARCEL[i],PARCEL[(i+1)%PARCEL.length],2.2,0xe0463a,0.6);
PARCEL.forEach(([x,y])=>{const p=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,6,8),M(0xe0463a));p.position.copy(W(x,y,3));scene.add(p);});

// ---------- FUTURE COMMERCIAL (Hwy frontage) ----------
const RES=[[-200,hy(-200)],[-350.62,-57.78],[-425.17,-70.49],[-472.2,130],[-200,130]];
flat(RES,0x4f7fc9,0.3,{transparent:true,opacity:.38});
for(let i=0;i<RES.length;i++){const a=RES[i],b=RES[(i+1)%RES.length],n=Math.floor(len(sub(b,a))/14);
  for(let k=0;k<n;k+=2)strip([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],[a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n],1.6,0xffffff,0.45);}
const ghost=new THREE.Mesh(boxGeo,new THREE.MeshLambertMaterial({color:0x7fb0ff,transparent:true,opacity:.22,depthWrite:false}));
ghost.scale.set(120,22,60);ghost.position.copy(W(-330,45,11));scene.add(ghost);
const ge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(140,22,70)),new THREE.LineBasicMaterial({color:0xcfe2ff}));ge.position.copy(ghost.position);scene.add(ge);
const resAc=area(RES)/43560;
label(`FUTURE COMMERCIAL<br><small>±${resAc.toFixed(2)} ac · Hwy 82 frontage kept open</small>`,-330,45,40,'com');

// ---------- ROADS (wider, curved) ----------
const ASP=0x3a3d42,ASP2=0x44474c;
const roads=[]; // {pts,hw} for site clearance
const keep=[];  // keep-out polygons
function road(pts,width,r){const c=r?fillet(pts,r):pts;ribbon(c,width,ASP,0.3);roads.push({pts:c,hw:width/2});return c;}
function rroad(poly,color=ASP,h=0.3){flat(poly,color,h);keep.push(poly);}
// Main road: CR 167 -> east, curves south into the entrance connector (36')
const mainPts=road([[crEdgeX(390)-6,390],[-30,390],[-30,214]],36,60);
// Loop road (32'): connector -> west -> curves north -> main road
const loopPts=road([[-48,216],[-466,216],[-466,392]],32,55);
// Hwy 82 boulevard: 70' (two 22' lanes + 26' green-belt median)
const BX0=-82,BX1=-12;
rroad([[BX0,hwyEdgeY(BX0)-4],[BX1,hwyEdgeY(BX1)-4],[BX1,232],[BX0,232]]);
// wide curved corners at the highway
[[BX0,-1],[BX1,1]].forEach(([x,q])=>{const p=curbReturn(x,hwyEdgeY(x)+1,q,1,45);flat(p,ASP,0.3);keep.push(p);});
// curb returns at T-junctions & CR 167
[[-48,232,-1,1,34],[BX0,200,-1,-1,32],[-482,372,-1,-1,32],[-450,372,1,-1,32]].forEach(([x,y,qx,qy,r])=>{const p=curbReturn(x,y,qx,qy,r);flat(p,ASP,0.3);keep.push(p);});
[[408,1],[372,-1]].forEach(([y,q])=>{const p=curbReturn(crEdgeX(y)-1,y,1,q,45);flat(p,ASP,0.3);keep.push(p);});
// green-belt median with rounded noses
const med=[];const mx0=-60,mx1=-34,my0=hwyEdgeY(-47)+22,my1=180,mr=13;
for(let k=0;k<=12;k++){const a=Math.PI+Math.PI*k/12;med.push([(mx0+mx1)/2+mr*Math.cos(a),my0+mr+mr*Math.sin(a)]);}
for(let k=0;k<=12;k++){const a=Math.PI*k/12;med.push([(mx0+mx1)/2+mr*Math.cos(a),my1-mr+mr*Math.sin(a)]);}
flat(med,0x6f9a4a,0.55);
const curb=new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(med.map(([x,y])=>new THREE.Vector2(x-OX,y-OY))),{depth:0.5,bevelEnabled:false}),M(0x6f9a4a));
curb.rotation.x=-Math.PI/2;curb.position.y=0.3;curb.receiveShadow=true;scene.add(curb);
// RV check-in lane by office + car parking
// One-way check-in loop: Road A -> south -> east past office front -> north to entrance junction
const ckPts=road([[-184,212],[-184,72],[-92,72],[-92,210]],18,22);
dashes(ckPts,6,30,30,30);
for(const[x,y,s]of[[-184,175,-1],[-184,150,-1],[-92,110,1],[-92,170,1]])arrow(x,y,s);
flat([[-160,68],[-148,72],[-160,76]],0xffffff,0.4);

// Front (highway-side) parking: reached from the check-in loop's west leg, one-way east, exits right onto the boulevard exit lane
const pkDrive=road([[-184,92],[-184,-6],[-162,-6]],18,14);
const aisle=[];for(let x=-168;x<=-82;x+=8)aisle.push([x,Math.max(hy(x)+5,-24)]);aisle.push([-82,1],[-168,1]);
flat(aisle,ASP2,0.31);keep.push(aisle);
rroad(R(-164,1,-104,19),ASP2,0.31);
for(let i=0;i<=6;i++){const x=-164+i*60/6;strip([x,2],[x,18],0.6,0xffffff,0.36);}
// 6 more stalls behind the office, off Check-In Lane, next to the laundry
rroad(R(-170,81,-108,97),ASP2,0.31);
for(let i=0;i<=6;i++){const x=-170+i*62/6;strip([x,82],[x,96],0.6,0xffffff,0.36);}
flat(R(-113,3,-104,17),0x2f6fd1,0.34);
for(const x of[-140,-118])flat([[x-6,hy(x)+9],[x+4,hy(x)+12],[x-6,hy(x)+15]],0xffffff,0.4); // one-way arrows
label('6 stalls · front',-134,-8,6);label('6 stalls',-139,89,5);
label('exit only →',-92,-6,6);
// sidewalk / porch zone between stalls and buildings
flat(R(-166,19,-102,27),0xe2ddd2,0.33);
box(-170,23,0.5,0.5,24,0xdddddd); // flagpole

// lane markings
dashes(mainPts,10,14,20,40);dashes(loopPts,10,14,40,20);
function arrow(x,y,s){flat([[x-3,y-6*s],[x+3,y-6*s],[x+3,y+2*s],[x+6,y+2*s],[x,y+9*s],[x-6,y+2*s],[x-3,y+2*s]],0xffffff,0.4);}
arrow(-23,40,1);arrow(-23,110,1);arrow(-71,40,-1);arrow(-71,110,-1);
// stop bars
strip([BX0+1,hwyEdgeY(BX0)+8],[-61,hwyEdgeY(-61)+8],1.5,0xffffff,0.4);

// ---------- entrance features ----------
function arch(x,y,span,rotY){
  const grp=new THREE.Group(),wood=M(0x6b4a2f),stone=M(0xb8ad98);
  [-span/2,span/2].forEach(o=>{const p=new THREE.Mesh(new THREE.BoxGeometry(2.6,24,2.6),wood);p.position.set(o,12,0);p.castShadow=true;grp.add(p);
    const b=new THREE.Mesh(new THREE.BoxGeometry(6,4,6),stone);b.position.set(o,2,0);grp.add(b);});
  const beam=new THREE.Mesh(new THREE.BoxGeometry(span+6,3.5,1.6),wood);beam.position.set(0,23,0);beam.castShadow=true;grp.add(beam);
  const sign=new THREE.Mesh(new THREE.BoxGeometry(span*0.5,5,0.6),M(0x2f5d3a));sign.position.set(0,18.5,0);grp.add(sign);
  grp.position.copy(W(x,y,0));grp.rotation.y=rotY;scene.add(grp);
}
arch(-47,188,74,0);arch(-1318,390,40,Math.PI/2);
label('TEXOMA RV PARK',-47,188,24,'brand');label('TEXOMA RV PARK',-1318,390,24,'brand');label('TEXOMA RV PARK',-47,hwyEdgeY(-47)+48,13,'brand');
box(-47,hwyEdgeY(-47)+48,16,4,7,0x8b7d68);box(-47,hwyEdgeY(-47)+48,13,1.4,5,0x2f5d3a,7); // monument sign
label('HWY 82 ENTRANCE / EXIT<br><small>70\' boulevard · 26\' green-belt median</small>',-47,hwyEdgeY(-47)+20,32,'big');
label('CR 167 ENTRANCE / EXIT',-1318,390,36,'big');

// ---------- office + laundry (highway side) ----------
function building(cx,cy,w,d,h,wall,roof,pitch=7){box(cx,cy,w,d,h,wall);
  const r=new THREE.Mesh(new THREE.CylinderGeometry(0.01,1,1,4,1),M(roof));r.rotation.y=Math.PI/4;r.scale.set(w*0.78,pitch,d*0.78);r.position.copy(W(cx,cy,h+pitch/2));r.castShadow=true;scene.add(r);keep.push(R(cx-w/2-6,cy-d/2-6,cx+w/2+6,cy+d/2+6));}
building(-133,44,50,34,13,0xe8dcc4,0x6d4c3d);                       // OFFICE (east, nearest entrance)
box(-133,26,44,6,1,0x6d4c3d,11);box(-153,24,1,1,11,0x6b4a2f);box(-113,24,1,1,11,0x6b4a2f); // porch facing parking
building(-138,114,46,28,12,0xd4e0e8,0x46607a);                      // LAUNDRY (behind office, across Check-In Lane)
flat(R(-142,62,-134,100),0xe2ddd2,0.33); // crosswalk path office -> laundry
for(let y=64;y<80;y+=4)strip([-142,y],[-134,y],1.6,0xffffff,0.36);
label('OFFICE / CHECK-IN',-133,44,28,'big');label('LAUNDRY · RESTROOMS',-138,114,26);

// ---------- CENTRAL HUB: dog park + pavilion + playground ----------
const fenceM=M(0x6c6c6c);
function fence(a,b){const L=len(sub(b,a));const m=new THREE.Mesh(boxGeo,fenceM);m.scale.set(a[0]!==b[0]?L:0.4,4,a[1]!==b[1]?L:0.4);m.position.copy(W((a[0]+b[0])/2,(a[1]+b[1])/2,2));scene.add(m);}



// ---------- AEROBIC WASTEWATER: ATU plant + spray fields ----------
const yb=x=>231.59+0.07358*(x+1352.12);              // south line (west strip)
const yN=x=>512.44+(x+939.51)*0.040338;               // north line
const fields=[];
function field(poly){fields.push(poly);keep.push(poly);flat(poly,0xb9a77a,0.22,{transparent:true,opacity:.75});
  const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
  for(let y=Math.min(...ys)+4;y<Math.max(...ys);y+=6){let a=null;for(let x=Math.min(...xs);x<=Math.max(...xs);x+=2){const ins=pip([x,y],poly)&&polyDist([x,y],poly,true)>3;if(ins&&a===null)a=x;if((!ins||x+2>Math.max(...xs))&&a!==null){if(x-a>6)strip([a,y],[x-2,y],0.5,0x6b5a33,0.3);a=null;}}}
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],n=Math.floor(len(sub(b,a))/10);for(let k=0;k<n;k+=2)strip([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n],[a[0]+(b[0]-a[0])*(k+1)/n,a[1]+(b[1]-a[1])*(k+1)/n],1.2,0x7a52a8,0.42);}}
// ---------- STORM-WATER DETENTION POND (SW corner, south of main road, drains to CR 167) ----------
const PX0=-1305,PX1=-1180;
{const yt=350,yB=yb(-1242)+14,cx=(PX0+PX1)/2,rx=(PX1-PX0)/2,cy=(yt+yB)/2,ry=(yt-yB)/2;const pondOuter=[];
  for(let k=0;k<48;k++){const a=2*Math.PI*k/48,c=Math.cos(a),s2=Math.sin(a);
    pondOuter.push([cx+rx*Math.sign(c)*Math.pow(Math.abs(c),0.5),cy+ry*Math.sign(s2)*Math.pow(Math.abs(s2),0.5)]);}
  keep.push(R(PX0-6,200,PX1+6,366));
  flat(pondOuter,0x7fa35a,0.18);
  flat(pondOuter.map(([x,y])=>[cx+(x-cx)*0.8,cy+(y-cy)*0.72]),0x3f86b0,0.26,{transparent:true,opacity:.95});
  label('DETENTION POND<br><small>rain-water → outfall to CR 167</small>',cx,cy,10,'com');
  strip([PX0+8,cy],[crEdgeX(cy)+2,cy],2,0x8a8a8a,0.5);box(crEdgeX(cy)+4,cy,3,8,3,0xb8ad98);
  label('OUTFALL → existing pond / CR 167 ditch',crEdgeX(cy)-40,cy-30,6);
}
// drainage: swale along north line flows west, down the CR 167 side, culvert under main road, into the pond
for(let x=-1328;x<-30;x+=8)strip([x,yN(x)-7],[x+8,yN(x+8)-7],5,0x6f9c8c,0.21);
strip([-1328,yN(-1328)-7],[-1328,352],5,0x6f9c8c,0.21);
strip([-1328,412],[-1328,368],2.4,0x8a8a8a,0.5);label('culvert',-1328,392,4);
function flowArrow(x,y,ang){const c=Math.cos(ang),s2=Math.sin(ang),P=(u,v)=>[x+u*c-v*s2,y+u*s2+v*c];
  flat([P(-7,-2.5),P(3,-2.5),P(3,-6),P(10,0),P(3,6),P(3,2.5),P(-7,2.5)],0x1e88e5,0.6);}
[[-300,60],[-200,20],[-60,40],[-420,10]].forEach(([x,y])=>flowArrow(x,y,Math.PI/2));
[[-250,300],[-150,300],[-20,300],[-360,300],[-450,250]].forEach(([x,y])=>flowArrow(x,y,Math.atan2(1,-0.2)));
for(let x=-120;x>-1300;x-=110)flowArrow(x,yN(x)-7,Math.PI+0.04);
[[-1328,470],[-1328,440]].forEach(([x,y])=>flowArrow(x,y,-Math.PI/2));
[[-1000,290],[-800,295],[-600,320]].forEach(([x,y])=>flowArrow(x,y,Math.atan2(0.1,-1)));
label('DRAINAGE: Hwy 82 → north → west → pond',-200,yN(-200)+8,8);
// Wastewater: aerobic treatment + SUBSURFACE DRIP field (south side, east of pond); east limit Xe sized from flow
const WX0=PX1+20;
function wwPolys(Xe){const so=[];for(let x=WX0;x<Xe;x+=20)so.push([x,yb(x)+20]);so.push([Xe,yb(Xe)+20],[Xe,352],[WX0,352]);return [so];}
function drawATU(Xe){
  const [x0,y0,x1,y1]=[Xe+6,312,Xe+48,358];flat(R(x0,y0,x1,y1),0xbdb6a6,0.3);
  [[x0+11,y0+12],[x0+30,y0+12],[x0+11,y0+32]].forEach(([x,y],i)=>{
    const t=new THREE.Mesh(new THREE.CylinderGeometry(6.5,6.5,1.6,24),M(i<2?0x3f7d4a:0x2d5f8a));t.position.copy(W(x,y,1.1));t.castShadow=true;scene.add(t);
    const lid=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,1.2,12),M(0x2c2c2c));lid.position.copy(W(x,y,2.3));scene.add(lid);});
  box(x0+32,y0+34,6,3,5,0xd6d6d6);box(x0+32,y0+34,1,1,2,0xff4040,5);
  [[[x0,y0],[x1,y0]],[[x1,y0],[x1,y1]],[[x1,y1],[x0,y1]],[[x0,y1],[x0,y0]]].forEach(([a,b])=>fence(a,b));
  strip([Xe,335],[x0,335],1.4,0x7a3fb0,0.45);
  label('AEROBIC TREATMENT UNITS<br><small>3 ATUs · pump tank · chlorinator</small>',(x0+x1)/2,335,40,'ww');
}


// ---------- RV sites (auto-placed, cleared from roads & keep-outs) ----------
const RVCOL=[0xf4f1ea,0xece6d8,0xf7f7f7,0xe9e2d2,0xdfe4e8],STRIPE=[0x1f4e79,0x8a2b2b,0x3d3d3d,0x7a5a2a,0x2d6a4f,0x5b3f7a],VEH=[0x9b1c1c,0x1d3557,0x222222,0xbcbcbc,0x2a6f4e,0xe9e9e9,0x5c4033];
const wheelGeo=new THREE.CylinderGeometry(1.6,1.6,1,12);wheelGeo.rotateZ(Math.PI/2);const glass=M(0x22303a);
const rnd=(()=>{let s=7;return()=>{s=(s*16807)%2147483647;return(s-1)/2147483646;}})();const pick=a=>a[Math.floor(rnd()*a.length)];
function lbox(g,w,h,d,x,y,z,mat){const m=new THREE.Mesh(boxGeo,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function wheels(g,xs,zs){zs.forEach(z=>xs.forEach(x=>{const w=new THREE.Mesh(wheelGeo,M(0x161616));w.position.set(x,1.6,z);g.add(w);}));}
function vehicle(col,L=19){const g=new THREE.Group(),m=M(col);lbox(g,7,3.2,L,0,2.8,0,m);lbox(g,6.6,2.8,L*0.42,0,5.7,-L*0.08,m);lbox(g,6.7,2,0.3,0,5.8,-L*0.29,glass);wheels(g,[-3.4,3.4],[-L*0.32,L*0.32]);return g;}
function makeRV(){const t=rnd(),g=new THREE.Group(),body=M(pick(RVCOL)),st=M(pick(STRIPE));
  if(t<0.38){const L=40;lbox(g,8.5,10,L,0,6.5,0,body);lbox(g,8.6,1.6,L*0.9,0,4.6,0.5,st);lbox(g,8.2,4.5,0.4,0,8.6,-L/2-0.1,glass);lbox(g,0.4,2.2,L*0.55,4.4,8.5,0,glass);lbox(g,0.4,2.2,L*0.55,-4.4,8.5,0,glass);lbox(g,3,7,14,-5.5,6.2,2,body);wheels(g,[-3.9,3.9],[-L*0.32,L*0.3]);
    if(rnd()<0.6){const v=vehicle(pick(VEH),15);v.position.set(0,0,-L/2-11);g.add(v);}return g;}
  if(t<0.72){const L=34;lbox(g,8.5,10.5,L,0,7.2,4,body);lbox(g,8.5,4,9,0,10.7,-L/2-0.5,body);lbox(g,8.6,1.4,L*0.8,0,5.2,5,st);lbox(g,0.4,2,L*0.4,4.35,9,4,glass);lbox(g,3,8,12,5.5,6.6,6,body);wheels(g,[-3.9,3.9],[10,13.5]);
    const v=vehicle(pick(VEH),20);v.position.set(0,0,-L/2-6);g.add(v);return g;}
  const L=27;lbox(g,8,9.5,L,0,6.5,0,body);lbox(g,8.1,1.4,L*0.9,0,4.4,0,st);lbox(g,8.1,2.4,4,0,7.5,-L/2+2,glass);lbox(g,1,1,5,0,1.6,-L/2-2.5,M(0x333333));wheels(g,[-3.6,3.6],[1.5,4.5]);
  const v=vehicle(pick(VEH),17);v.position.set(0,0,-L/2-14);g.add(v);return g;}
function clear(p,margin=3){
  if(!pip(p,PARCEL)||polyDist(p,PARCEL,true)<5)return false;
  for(const r of roads)if(polyDist(p,r.pts)<r.hw+margin)return false;
  for(const k of keep)if(pip(p,k))return false;
  return true;
}
function siteOK(x0,x1,y0,y1){for(let i=0;i<=4;i++)for(let j=0;j<=4;j++){if(!clear([x0+(x1-x0)*i/4,y0+(y1-y0)*j/4]))return false;}return true;}
const tableGeo=new THREE.BoxGeometry(5,0.4,3);let siteCount=0;const siteRects=[];
function siteCol(yFrom,yTo,edgeX,dir,depth,dry=false){let c=0; // sites facing an east/west road
  for(let y=yFrom;y+30<=yTo;y+=30){
    const x0=edgeX+dir*2,x1=edgeX+dir*depth,xs=edgeX+dir*5;
    if(!siteOK(Math.min(xs,x1),Math.max(xs,x1),y+1,y+29))continue;
    c++;if(dry)continue;
    siteCount++;const cy=y+15,xm=(x0+x1)/2;siteList.push({x:x0+dir*6,y:cy,row:curRow});siteRects.push(R(Math.min(x0,x1),y,Math.max(x0,x1),y+30));
    flat(R(Math.min(x0,x1-dir*3),cy-11,Math.max(x0,x1-dir*3),cy+3),0xcdbf9f,0.22);
    flat(R(xm-6,cy+3,xm+6,cy+13),0xd8d3c8,0.24);
    const t=new THREE.Mesh(tableGeo,M(0x7b5a3a));t.rotation.y=Math.PI/2;t.position.copy(W(xm,cy+8,2.6));t.castShadow=true;scene.add(t);
    box(x1-dir*14,cy-12.5,1,1.4,3.5,0x8d99a3);
    if(rnd()<0.78){const g=makeRV();const back=x1-dir*5;g.position.copy(W(back-dir*22,cy-4,0));g.rotation.y=dir>0?Math.PI/2:-Math.PI/2;scene.add(g);}
  }
  return c;
}
const place=(r,dry=false)=>r[5]==='col'?siteCol(r[0],r[1],r[2],r[3],r[4],dry):siteRow(r[0],r[1],r[2],r[3],r[4],dry);
function siteRow(xFrom,xTo,edgeY,dir,depth,dry=false){let c=0;
  for(let x=xFrom;x+30<=xTo;x+=30){
    const y0=edgeY+dir*2,y1=edgeY+dir*depth;
    const ys=edgeY+dir*5;if(!siteOK(x+1,x+29,Math.min(ys,y1),Math.max(ys,y1)))continue;
    c++;if(dry)continue;
    siteCount++;const cx=x+15,ym=(y0+y1)/2;siteList.push({x:cx,y:y0+dir*6,row:curRow});siteRects.push(R(x,Math.min(y0,y1),x+30,Math.max(y0,y1)));
    flat(R(cx-3,y0,cx+11,y1-dir*3),0xcdbf9f,0.22);
    flat(R(cx-13,ym-6,cx-3,ym+6),0xd8d3c8,0.24);
    const t=new THREE.Mesh(tableGeo,M(0x7b5a3a));t.position.copy(W(cx-8,ym,2.6));t.castShadow=true;scene.add(t);
    box(cx+12.5,y1-dir*14,1.4,1,3.5,0x8d99a3);box(cx-13,y0+dir*2,0.6,0.6,3,0xffffff);
    if(rnd()<0.78){const g=makeRV();const back=y1-dir*5;
      g.position.copy(W(cx+4,back-dir*22,0));if(dir>0)g.rotation.y=Math.PI;scene.add(g);}
  }
  return c;
}
// ---------- NE: sites pushed back to the north line, one-way access lane, amenity strip in front ----------
const NEX0=-418,NEX1=-92,NDEP=65;
const front=x=>yN(x)-8-NDEP;            // front edge of the pushed-back sites
const ylane=x=>front(x)-10;              // lane centerline (20' lane)
const laneC=road([[NEX0,392],[NEX0,ylane(NEX0)],[NEX1,ylane(NEX1)],[NEX1,392]],20,18);
const spur=road([[NEX1,ylane(NEX1)-4],[NEX1,yN(NEX1)-14]],20);flat(curbReturn(NEX1+10,ylane(NEX1)+10,1,1,0.01),ASP,0.3);
dashes(laneC,6,30,24,24);
arrow(NEX0,425,1);arrow(NEX1,425,-1);
// amenity strip between Ritchey Trail (edge 408) and the lane
const AY0=413,ay1=x=>ylane(x)-13;
const STRIP=[[NEX0+13,AY0],[NEX1-13,AY0],[NEX1-13,ay1(NEX1-13)],[NEX0+13,ay1(NEX0+13)]];
keep.push(STRIP);flat(STRIP,0x95c06d,0.2);
// play area
{const x0=-398,x1=-330;flat(R(x0,AY0+4,x1,ay1(x1)-3),0xc9a46a,0.26);
 box(x0+14,AY0+14,10,4,7,0xd94b3b);box(x0+38,AY0+20,3,14,5,0x2f7bd1);box(x0+56,AY0+12,8,8,9,0xf2b84b);
 const sw=new THREE.Mesh(new THREE.TorusGeometry(5,0.4,6,16,Math.PI),M(0x555555));sw.position.copy(W(x0+24,ay1(x0)-10,0));scene.add(sw);
 label('PLAY AREA',(x0+x1)/2,(AY0+ay1(x1))/2,14,'big');}
// sitting area: shade pergola + picnic tables + benches
{const x0=-318,x1=-252,yc=(AY0+ay1(-285))/2;flat(R(x0,AY0+4,x1,ay1(x1)-3),0xd8d3c8,0.27);
 for(const[px,py]of[[x0+8,AY0+8],[x1-8,AY0+8],[x0+8,ay1(x0)-7],[x1-8,ay1(x1)-7]])box(px,py,1,1,9,0x6b4a2f);
 for(let x=x0+6;x<=x1-6;x+=4)box(x,yc,0.6,ay1(x)-AY0-12,0.5,0x6b4a2f,9);
 for(const x of[x0+18,x0+38])for(const y of[yc-6,yc+6])box(x,y,7,4,2.6,0x7b5a3a);
 label('SITTING AREA',(x0+x1)/2,yc,16,'big');}
// dog park
{const x0=-240,x1=-120,y1=x=>ay1(x)-3;const poly=[[x0,AY0+4],[x1,AY0+4],[x1,y1(x1)],[x0,y1(x0)]];
 flat(poly,0x8fb86a,0.24);
 const fz=(a,b)=>{const L=len(sub(b,a));const m=new THREE.Mesh(boxGeo,fenceM);m.scale.set(L,4,0.4);m.position.copy(W((a[0]+b[0])/2,(a[1]+b[1])/2,2));m.rotation.y=Math.atan2(b[1]-a[1],b[0]-a[0]);scene.add(m);};
 fz([x0,AY0+4],[x0+50,AY0+4]);fz([x0+60,AY0+4],[x1,AY0+4]);fz([x1,AY0+4],[x1,y1(x1)]);fz([x1,y1(x1)],[x0,y1(x0)]);fz([x0,y1(x0)],[x0,AY0+4]);
 box(x0+10,AY0+14,2,2,3,0x3d6fb3);box(x0+95,AY0+16,6,2,1.6,0x7b5a3a);
 label('DOG PARK<br><small>±120\' × 35\'</small>',(x0+x1)/2,(AY0+y1(-180))/2,14,'big');}
// walkway along the strip
strip([NEX0+14,AY0+2],[NEX1-14,AY0+2],3,0xd8d3c8,0.3);
const neRows=[];for(let x=NEX0+12;x+30<=NEX1-10;x+=30)neRows.push([x,x+30,front(x+15),+1,NDEP]);
const ROWS=[[-480,-40,232,+1,60],[-484,-96,200,-1,62],[-480,-40,372,-1,60],[-1320,NEX0-14,408,+1,70],[-1320,-470,372,-1,62],...neRows,[410,545,NEX1+10,+1,64,'col']];
const GPD=40,HOMES=3,HGPD=180,AMEN=400+HOMES*HGPD,RA=0.20;
// ---------- CONTAINER HOMES (replace old site 82, inside Check-In Lane island) ----------
keep.push(R(-178,136,-100,201));
function containerHome(cx,y0,c1,c2){ // 2-story, 1-bedroom; two stacked 8'x40' containers, front (glass + deck) faces Pecan Loop (north)
  const L=40,y1=y0+L,cy=(y0+y1)/2;
  flat(R(cx-6,y0-2,cx+6,y1+2),0xd8d3c8,0.25);
  box(cx,cy,8,L,9.5,c1,0.3);box(cx,cy+3,8,L,9.5,c2,9.8);          // ground + upper (cantilevered 3' over the deck)
  for(let y=y0+1;y<y1;y+=2.2){box(cx-4.05,y,0.15,0.6,9,c1,0.5,false);box(cx+4.05,y,0.15,0.6,9,c1,0.5,false);box(cx-4.05,y+3,0.15,0.6,9,c2,10,false);box(cx+4.05,y+3,0.15,0.6,9,c2,10,false);}
  box(cx,y1+0.1,6.5,0.3,6.5,0x22303a,2);box(cx,y1+3.1,6.5,0.3,5,0x22303a,12.5);   // glass front, both floors
  box(cx+4.2,cy-6,0.3,6,4,0x22303a,3.5);box(cx+4.2,cy+6,0.3,6,4,0x22303a,13);     // side windows
  box(cx,y1+3.5,8.4,3,0.4,0x444444,9.6);                                          // balcony slab
  for(let k=0;k<9;k++)box(cx-5.5,y0+4+k*2.2,2.6,2.2,0.5,0x555555,k*1.1);          // exterior stair at the back
  flat(R(cx-6,y1+2,cx+6,y1+9),0xb59a73,0.27);                                     // front deck
}
const HC=[[0x1d5c8c,0xd9d4c7],[0x8a3b2b,0xd9d4c7],[0x2e6b46,0xd9d4c7]];
[-164,-139,-114].forEach((x,i)=>containerHome(x,146,HC[i][0],HC[i][1]));
for(const x of[-151,-126])flat(R(x-4.5,178,x+4.5,199),0xbfb6a6,0.26);           // car pads between homes
label('CONTAINER HOMES<br><small>3 × 2-story · 1-bedroom</small>',-139,172,30,'big');
let Xe=-1100;
for(let x=-1150;x<=-600;x+=10){
  const tmp=[...wwPolys(x),R(x,306,x+54,372)];keep.push(...tmp);
  const n=ROWS.reduce((s,r)=>s+place(r,true),0);
  keep.splice(keep.length-tmp.length,tmp.length);
  const have=wwPolys(x).reduce((s,p)=>s+area(p),0),need=(GPD*n+AMEN)/RA;
  if(have>=need*1.05){Xe=x;break;}
}
wwPolys(Xe).forEach(field);keep.push(R(Xe,306,Xe+54,372));drawATU(Xe);
const siteList=[];let curRow=0;
ROWS.forEach((r,i)=>{curRow=i;place(r);});
// ---- site numbers: Ritchey Trail north side W->E, south side W->E, then Pecan Loop rows ----
const numLabels=[];
[[3,...neRows.map((_,i)=>5+i),5+neRows.length],[4],[2],[0],[1]].reduce((n,rows)=>{siteList.filter(s=>rows.includes(s.row)).sort((a,b)=>(a.x-b.x)||(b.y-a.y)).forEach(s=>{
  const d=document.createElement('div');d.className='lbl num';d.textContent=n++;const o=new CSS2DObject(d);o.position.copy(W(s.x,s.y,3));scene.add(o);numLabels.push(o);});return n;},1);
label('DRIP FIELD<br><small>subsurface · treated water</small>',(WX0+Xe)/2,300,10,'ww');
const sprayFt=fields.reduce((s,p)=>s+area(p),0);
label(`TEXOMA RV PARK · ${siteCount} RV SITES<br><small>30' back-ins · full hookups</small>`,-560,445,30,'big');
// ---- road names ----
const street=(t,x,y,h=5)=>label(t,x,y,h,'street');
street('RITCHEY TRAIL',-1000,390);street('RITCHEY TRAIL',-620,390);street('RITCHEY TRAIL',-30,300);
street('PECAN LOOP',-300,216);street('PECAN LOOP',-466,300);
street('PARK ENTRANCE BLVD',-47,95);
street('CHECK-IN LANE',-150,72);
street('OFFICE DRIVE',-150,-14,4);
street('PARK ROW',-250,ylane(-250),4);
// street-sign posts at intersections
function signPost(x,y){box(x,y,0.4,0.4,10,0x8a8a8a);box(x,y,7,0.3,1.4,0x1f6b3a,8.6);box(x,y,0.3,7,1.4,0x1f6b3a,10);}
[[-1300,365],[-440,366],[-58,365],[-68,238],[-204,236],[-58,206]].forEach(([x,y])=>signPost(x,y));
label('N ↑',-20,600,10);

flat(R(-470,292,-40,312),0x8cb565,0.21);
label('20\' green buffer (back-to-back rows)',-260,302,4);
// ---------- trees ----------
const treeSpots=[];
const tryTree=(x,y)=>{if(!pip([x,y],PARCEL)&&!(x>-98&&x<0&&y<20))return;for(const r of roads)if(polyDist([x,y],r.pts)<r.hw+4)return;
  for(const k of keep)if(pip([x,y],k))return;for(const s of siteRects)if(pip([x,y],s))return;treeSpots.push([x,y]);};
for(let y=hwyEdgeY(-47)+40;y<170;y+=22)treeSpots.push([-47+(rnd()-.5)*6,y]);           // green-belt median
for(let y=8;y<180;y+=24){tryTree(-90,y);tryTree(-6,y);}                                  // boulevard edge belts
for(let x=-1300;x<-40;x+=24)tryTree(x+rnd()*6,yN(x)-8-rnd()*6);                           // north buffer
for(let x=-1290;x<-1100;x+=40)tryTree(x,yb(x)+8);                                         // south line
for(let x=-470;x<-40;x+=30)tryTree(x+15,302);                                              // 20' buffer between back-to-back rows
                                                  // green behind island row
for(let y=-50;y<190;y+=26){tryTree(-425.17-(y+70.49)*0.2344+9,y);}                        // west line of east block
for(let y=240;y<400;y+=26)tryTree(-8,y);
for(const[x,y]of[[-800,505],[-700,508],[-640,500],[-580,500],[-812,420],[-570,420],[-1338,470],[-1300,450],[-1338,320]])tryTree(x,y);
const trunkI=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.8,1.1,8,6),M(0x5b4129),treeSpots.length);
const crownI=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),M(0x3f6b2f,{flatShading:true}),treeSpots.length);
crownI.castShadow=trunkI.castShadow=true;const dm=new THREE.Object3D(),tc=new THREE.Color();
treeSpots.forEach(([x,y],i)=>{const s=0.8+rnd()*0.6;dm.rotation.set(0,0,0);dm.position.copy(W(x,y,4*s));dm.scale.set(s,s,s);dm.updateMatrix();trunkI.setMatrixAt(i,dm.matrix);
  dm.position.copy(W(x,y,14*s));dm.scale.set(9*s,8*s,9*s);dm.rotation.y=rnd()*3;dm.updateMatrix();crownI.setMatrixAt(i,dm.matrix);tc.setHSL(0.25+rnd()*0.05,0.4,0.25+rnd()*0.08);crownI.setColorAt(i,tc);});
scene.add(trunkI,crownI);
const shrubPts=[];for(let x=-468;x<-206;x+=9)shrubPts.push([x,132]);
const shI=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),M(0x4d7a37,{flatShading:true}),shrubPts.length);
shrubPts.forEach(([x,y],i)=>{dm.position.copy(W(x,y,2.5));dm.scale.set(4,3,4);dm.rotation.y=i;dm.updateMatrix();shI.setMatrixAt(i,dm.matrix);});shI.castShadow=true;scene.add(shI);
// street lights along main road
for(let x=-1260;x<-120;x+=120){box(x,410,0.6,0.6,16,0x555555);box(x,406,0.8,6,0.6,0x555555,16);}

// ---------- highway traffic ----------
const cars=[];
for(let i=0;i<10;i++){const wb=i%2===0;const v=vehicle(pick(VEH),i%3===0?40:17);if(i%3===0)v.children.forEach(c=>{if(c.scale.y>3)c.material=M(0xf2f2f2);});
  scene.add(v);cars.push({v,s:rnd()*2600-1500,off:wb?(i%4===0?41:62):(i%4===1?129:151),sp:(wb?-1:1)*(80+rnd()*30)});}
function placeCar(c){const p=hp(c.s,c.off);c.v.position.copy(W(p[0],p[1],0));c.v.rotation.y=Math.atan2(U[1],U[0])+(c.sp>0?-Math.PI/2:Math.PI/2);}

// ---------- info panel numbers ----------
const Qs=siteCount*GPD,Q=Qs+AMEN,need=Q/RA;
const $=id=>document.getElementById(id);
$('vRes').textContent=`±${resAc.toFixed(2)} ac`;$('vSites').textContent=siteCount;
$('vQs').textContent=`${Qs.toLocaleString()} gpd`;$('vQ').textContent=`${Q.toLocaleString()} gpd`;
$('vLim').textContent=Q<5000?'Yes':'No — TCEQ permit';if(Q>=5000)$('vLim').classList.remove('ok');
$('vNeed').textContent=`${Math.round(need/100)*100} sf (${(need/43560).toFixed(2)} ac)`;
$('vHave').textContent=`${Math.round(sprayFt/100)*100} sf (${(sprayFt/43560).toFixed(2)} ac)`;
if(sprayFt>=need)$('vHave').classList.add('ok');

// ---------- views ----------
const VIEWS={overview:{p:[-180,820,-560],t:[-640,0,250]},top:{p:[-660,1750,200],t:[-660,0,230]},
  hwy:{p:[60,150,-200],t:[-160,0,130]},center:{p:[-60,110,260],t:[-150,0,165]},cr:{p:[-1620,180,330],t:[-1050,0,400]}};
let anim=null;
function go(name,instant){const v=VIEWS[name],tp=W(v.p[0],v.p[2],v.p[1]),tt=W(v.t[0],v.t[2],v.t[1]);
  const asp=innerWidth/innerHeight;if(asp<1){tp.sub(tt).multiplyScalar(Math.min(2.2,1/asp*0.95)).add(tt);}
  if(instant){camera.position.copy(tp);controls.target.copy(tt);controls.update();return;}
  anim={p0:camera.position.clone(),t0:controls.target.clone(),p1:tp,t1:tt,st:performance.now()};}
document.querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-v]').forEach(x=>x.classList.remove('on'));b.classList.add('on');go(b.dataset.v);}));
const numBtn=$('numBtn');numBtn.onclick=()=>{const on=!numBtn.classList.contains('on');numBtn.classList.toggle('on',on);numLabels.forEach(l=>l.visible=on);};
const lblBtn=$('lblBtn');lblBtn.onclick=()=>{const on=!lblBtn.classList.contains('on');lblBtn.classList.toggle('on',on);labels.forEach(l=>l.visible=on);};
const infoBtn=$('infoBtn'),info=$('info');infoBtn.onclick=()=>{info.classList.toggle('show');infoBtn.classList.toggle('on');};
go('overview',true);
window.__view=(p,t,nums)=>{camera.position.copy(W(p[0],p[2],p[1]));controls.target.copy(W(t[0],t[2],t[1]));controls.update();anim=null;numLabels.forEach(l=>l.visible=nums);};
if(MOBILE&&innerWidth<700){numLabels.forEach(l=>l.visible=false);numBtn.classList.remove('on');}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);lr.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener('pointerdown',()=>{anim=null;$('hint').style.display='none';});
const clock=new THREE.Clock();
function loop(){const dt=Math.min(clock.getDelta(),0.05);
  if(anim){const k=Math.min(1,(performance.now()-anim.st)/1200),e=1-Math.pow(1-k,3);camera.position.lerpVectors(anim.p0,anim.p1,e);controls.target.lerpVectors(anim.t0,anim.t1,e);if(k>=1)anim=null;}
  cars.forEach(c=>{c.s+=c.sp*dt;if(c.s>1100)c.s=-1500;if(c.s<-1500)c.s=1100;placeCar(c);});
  controls.update();renderer.render(scene,camera);lr.render(scene,camera);requestAnimationFrame(loop);}
$('load').remove();loop();
window.__stats={siteCount,sprayFt,need,resAc};
