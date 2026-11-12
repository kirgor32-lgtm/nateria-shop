
const fs=require('fs'),PNG=require('pngjs').PNG,IT=require('imagetracerjs');
const [,,inp,out,palJson]=process.argv;
const png=PNG.sync.read(fs.readFileSync(inp));
const pal=JSON.parse(palJson).map(h=>({r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16),a:255}));
pal.push({r:0,g:0,b:0,a:0});
const imgd={width:png.width,height:png.height,data:png.data};
const svg=IT.imagedataToSVG(imgd,{pal,colorquantcycles:1,ltres:2.5,qtres:2.5,pathomit:60,rightangleenhance:false,blurradius:0,roundcoords:1,linefilter:true,strokewidth:0,viewbox:true,desc:false,layering:0});
fs.writeFileSync(out,svg);console.log(out,svg.length);
