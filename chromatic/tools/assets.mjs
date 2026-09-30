import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../src/", import.meta.url));
mkdirSync(root, { recursive: true });
const letters = {
  A:[14,17,17,31,17,17,17],B:[30,17,17,30,17,17,30],C:[14,17,16,16,16,17,14],D:[30,17,17,17,17,17,30],
  E:[31,16,16,30,16,16,31],F:[31,16,16,30,16,16,16],G:[14,17,16,23,17,17,15],H:[17,17,17,31,17,17,17],
  I:[31,4,4,4,4,4,31],J:[7,2,2,2,18,18,12],K:[17,18,20,24,20,18,17],L:[16,16,16,16,16,16,31],
  M:[17,27,21,21,17,17,17],N:[17,25,25,21,19,19,17],O:[14,17,17,17,17,17,14],P:[30,17,17,30,16,16,16],
  Q:[14,17,17,17,21,18,13],R:[30,17,17,30,20,18,17],S:[15,16,16,14,1,1,30],T:[31,4,4,4,4,4,4],
  U:[17,17,17,17,17,17,14],V:[17,17,17,17,17,10,4],W:[17,17,17,21,21,21,10],X:[17,17,10,4,10,17,17],
  Y:[17,17,10,4,4,4,4],Z:[31,1,2,4,8,16,31],
  0:[14,17,19,21,25,17,14],1:[4,12,4,4,4,4,14],2:[14,17,1,2,4,8,31],3:[30,1,1,14,1,1,30],
  4:[2,6,10,18,31,2,2],5:[31,16,16,30,1,1,30],6:[14,16,16,30,17,17,14],7:[31,1,2,4,8,8,8],
  8:[14,17,17,14,17,17,14],9:[14,17,17,15,1,1,14],
  ".":[0,0,0,0,0,6,6],",":[0,0,0,0,6,6,4],":":[0,6,6,0,6,6,0],"!":[4,4,4,4,4,0,4],"?":[14,17,1,2,4,0,4],
  "'":[4,4,8,0,0,0,0],"-":[0,0,0,31,0,0,0],"+":[0,4,4,31,4,4,0],
  "/":[1,2,2,4,8,8,16],"(":[2,4,8,8,8,4,2],")":[8,4,2,2,2,4,8],"<":[1,2,4,8,4,2,1],
  ">":[16,8,4,2,4,8,16],"=":[0,0,31,0,31,0,0],"#":[10,31,10,10,31,10,0],"*":[0,21,14,31,14,21,0],
};
const canvas = (w=8,h=8) => Array.from({length:h},()=>Array(w).fill(0));
function box(p,x,y,w,h,c) { for(let j=y;j<y+h;j++) for(let i=x;i<x+w;i++) if(p[j]?.[i]!==undefined)p[j][i]=c; }
function encode(p,x=0,y=0) {
  const out=[];
  for(let j=0;j<8;j++){let a=0,b=0;for(let i=0;i<8;i++){const c=p[y+j][x+i];a|=(c&1)<<(7-i);b|=((c>>1)&1)<<(7-i);}out.push(a,b);}return out;
}
const tiles=[];
for(let ascii=32;ascii<96;ascii++){
  const p=canvas(),rows=letters[String.fromCharCode(ascii)]||[];
  rows.forEach((row,y)=>{for(let x=0;x<5;x++)if(row&(16>>x))p[y][x+1]=3;});tiles.push(...encode(p));
}
const names={};
function tile(name,draw){const p=canvas();draw(p);names[name]=tiles.length/16;tiles.push(...encode(p));}
tile("FLOOR",p=>{box(p,0,0,8,8,1);box(p,0,7,8,1,2);p[2][2]=2;p[4][6]=2;});
tile("WALL",p=>{box(p,0,0,8,8,1);box(p,0,3,8,1,2);box(p,3,0,1,3,2);box(p,6,4,1,4,2);});
tile("COUNTER",p=>{box(p,0,0,8,8,1);box(p,0,0,8,2,3);box(p,1,3,6,4,2);});
tile("STOOL",p=>{box(p,1,1,6,2,3);box(p,2,3,4,1,2);box(p,2,4,1,4,1);box(p,5,4,1,4,1);});
tile("LIGHT",p=>{box(p,0,1,8,1,1);box(p,3,2,2,4,3);box(p,2,3,4,2,2);});
tile("LEAF",p=>{box(p,3,0,2,7,1);box(p,1,2,6,3,3);box(p,2,1,4,5,2);});
tile("DOOR",p=>{box(p,0,0,8,8,1);box(p,1,0,6,8,2);p[4][5]=3;});
tile("WINDOW",p=>{box(p,0,0,8,8,1);box(p,1,1,6,6,3);box(p,3,1,1,6,2);box(p,1,3,6,1,2);});
tile("PAPER",p=>{box(p,1,0,6,8,3);box(p,2,1,4,1,1);box(p,2,3,3,1,1);box(p,2,5,4,1,1);});
tile("HEART",p=>{box(p,1,1,2,2,3);box(p,5,1,2,2,3);box(p,1,3,6,2,3);box(p,2,5,4,1,3);box(p,3,6,2,1,3);});
tile("COIN",p=>{box(p,2,1,4,6,3);box(p,1,2,6,4,3);box(p,3,2,1,4,1);});
tile("BOLT",p=>{box(p,4,0,2,3,3);box(p,2,3,4,2,3);box(p,2,5,2,3,3);});
tile("SNACK",p=>{box(p,1,3,6,4,2);box(p,1,2,6,1,3);box(p,2,0,1,2,3);box(p,5,0,1,2,3);});
tile("MUSIC",p=>{box(p,4,0,1,6,3);box(p,4,0,3,2,3);box(p,1,5,4,2,3);});
function person(kind,base=3,pattern=0,accessory=0){
  const p=canvas(16,16);
  box(p,4,0,8,2,1);box(p,3,2,10,4,1);box(p,5,2,6,5,2);p[3][6]=1;p[3][9]=1;
  box(p,4,7,8,6,3);box(p,2,8,2,4,2);box(p,12,8,2,4,2);box(p,4,13,3,3,1);box(p,9,13,3,3,1);
  for(let y=8;y<13;y++)for(let x=4;x<12;x++)if(x%3===0||y%3===0)p[y][x]=1;
  if(kind===1){box(p,3,0,10,2,3);box(p,2,2,2,4,3);box(p,12,2,2,4,3);p[4][7]=3;p[4][8]=3;}
  if(kind===2){box(p,1,9,3,5,1);box(p,1,9,3,4,2);}
  if(base<3){box(p,4,4,8,3,3);if(base===0){p[4][7]=2;p[4][8]=2;p[5][7]=1;p[5][8]=1;p[6][4]=2;p[6][11]=2;}if(base===1){box(p,5,5,6,1,1);}if(base===2){box(p,5,5,6,1,2);p[6][6]=1;p[6][9]=1;}
    for(let y=4;y<7;y++)for(let x=5;x<11;x++)if((pattern===1&&(x+y)%3===0)||(pattern===2&&x%3===0&&y%2===0)||(pattern===3&&y===6))p[y][x]=2;
    if(accessory===1)box(p,4,5,2,2,1);if(accessory===2){p[4][7]=2;p[4][8]=2;box(p,6,5,4,2,1);}
  }return p;
}
names.ACTOR=tiles.length/16;
for(let kind=0;kind<6;kind++){const p=person(kind===1?1:kind===2?2:0,kind===3?0:3);if(kind===4)box(p,3,0,10,2,3);if(kind===5){box(p,5,0,6,2,2);box(p,4,7,8,5,2);}for(const [x,y]of[[0,0],[8,0],[0,8],[8,8]])tiles.push(...encode(p,x,y));}
const owners=[];
for(let base=0;base<4;base++)for(let pattern=0;pattern<4;pattern++)for(let accessory=0;accessory<3;accessory++){const p=person(0,base,pattern,accessory);for(const [x,y]of[[0,0],[8,0],[0,8],[8,8]])owners.push(...encode(p,x,y));}
const format = data => data.map((v,i)=>(i%16===0?"\n  ":"")+`0x${v.toString(16).padStart(2,"0")}`).join(", ").replace(/ +\n/g, "\n");
writeFileSync(root+"assets.h",`#ifndef LAST_DITCH_ASSETS_H\n#define LAST_DITCH_ASSETS_H\n#include <stdint.h>\n#define TILE_COUNT ${tiles.length/16}\n${Object.entries(names).map(([k,v])=>`#define T_${k} ${v}`).join("\n")}\nextern const uint8_t tiles[${tiles.length}];\nextern const uint8_t owners[${owners.length}];\n#endif\n`);
writeFileSync(root+"assets.c",`#include "assets.h"\nconst uint8_t tiles[${tiles.length}] = {${format(tiles)}\n};\nconst uint8_t owners[${owners.length}] = {${format(owners)}\n};\n`);
console.log(`Generated ${tiles.length/16} background tiles and 48 owner looks.`);
