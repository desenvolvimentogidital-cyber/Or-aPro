// Deterministic PNG PWA icons. No dependencies or third-party image services.
// Matches OrçaPro's dark/orange diamond brand symbol.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';

const folder=join(process.cwd(),'public','icons');
mkdirSync(folder,{recursive:true});
const clamp=v=>Math.max(0,Math.min(1,v));
const blend=(base,over,a)=>base*(1-a)+over*a;
function crc32(buffer){
  let crc=0xffffffff;
  for(const byte of buffer){
    crc^=byte;
    for(let n=0;n<8;n++)crc=(crc&1)?(crc>>>1)^0xedb88320:crc>>>1;
  }
  return (crc^0xffffffff)>>>0;
}
function chunk(type,bytes){
  const name=Buffer.from(type,'ascii');
  const length=Buffer.alloc(4);length.writeUInt32BE(bytes.length,0);
  const checksum=Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name,bytes])),0);
  return Buffer.concat([length,name,bytes,checksum]);
}
function icon(size,maskable=false){
  const pixel=Buffer.alloc(size*(1+size*4));
  const safe=maskable?0.8:1;
  for(let y=0;y<size;y++){
    const row=y*(1+size*4);pixel[row]=0;
    for(let x=0;x<size;x++){
      const X=(x+0.5)/size*2-1,Y=(y+0.5)/size*2-1;
      const radius=maskable?1:0.87;
      const corner=Math.max(Math.abs(X)-radius+0.26,0);
      const other=Math.max(Math.abs(Y)-radius+0.26,0);
      const rounded=(Math.min(Math.max(Math.abs(X)-radius+0.26,Math.abs(Y)-radius+0.26),0)+Math.hypot(corner,other)-0.26);
      const alpha=maskable?1:clamp(-rounded*size*0.55+0.5);
      const gradient=clamp((Y+1)/2);
      let rgb=[Math.round(8+8*gradient),Math.round(19+12*gradient),Math.round(31+17*gradient)];
      // Soft brand halo.
      const halo=clamp(1-Math.hypot(X*0.8,Y+0.08)*1.2)*0.16;
      rgb=rgb.map((v,i)=>Math.round(blend(v,[42,99,139][i],halo)));
      const dx=(X+0.005)/safe,dy=Y/safe;
      const diamond=Math.abs(dx)+Math.abs(dy);
      const edge=clamp((0.55-diamond)*size/5);
      const hollow=clamp((diamond-0.29)*size/5);
      const border=edge*hollow;
      const orange=[255,Math.round(112+55*clamp((-dy+0.7)/1.4)),32];
      rgb=rgb.map((v,i)=>Math.round(blend(v,orange[i],border)));
      // Tiny white glint toward the upper-right.
      const slash=Math.abs(dy+dx-0.02)<0.042 && dx>0.05 && dx<0.32 && dy<0.05 && dy>-0.3;
      if(slash)rgb=rgb.map((v,i)=>Math.round(blend(v,[251,252,253][i],0.9)));
      const off=row+1+x*4;
      pixel[off]=rgb[0];pixel[off+1]=rgb[1];pixel[off+2]=rgb[2];pixel[off+3]=Math.round(alpha*255);
    }
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);
  header[8]=8;header[9]=6;// RGBA
  const png=Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),
    chunk('IDAT',deflateSync(pixel,{level:9})),
    chunk('IEND',Buffer.alloc(0))
  ]);
  return png;
}
for(const [size,maskable,name] of [
  [192,false,'icon-192.png'],[512,false,'icon-512.png'],[512,true,'icon-maskable-512.png']
]){
  writeFileSync(join(folder,name),icon(size,maskable));
  process.stdout.write(`Icone PWA: ${name} gerado\n`);
}
