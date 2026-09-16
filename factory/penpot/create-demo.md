# Crear el diseño de demo

Pasar el siguiente cuerpo de función al tool `execute_code` del MCP oficial de Penpot. No es un script autónomo de Node. Verificar antes que el archivo activo sea el de la demo y esté vacío.

```javascript
// Execute with the official Penpot MCP only in a new, empty demo file.
// Confirm the active file with a read-only call before running.
if (!penpot.currentFile || !penpot.currentPage) throw new Error('Open a demo file');
if(penpot.root.children.length) throw new Error('Design already has content');
penpot.currentPage.name='Sin resultados · especificación v1';
const colors={surface:'#FFFFFF',background:'#F6F8F8',text:'#172F35',muted:'#52666B',primary:'#176A79',tint:'#E8F3F5',border:'#C7DADD'};
const set=penpot.library.local.tokens.addSet({name:'hoteles-demo'});
for(const [name,value] of Object.entries(colors)) set.addToken({type:'color',name:'color.'+name,value});
set.addToken({type:'spacing',name:'space.card',value:'32'});
set.addToken({type:'borderRadius',name:'radius.card',value:'12'});
if(!set.active) set.toggleActive();
const font=penpot.fonts.findByName('Inter');
function board(name,x,y,w,h){const b=penpot.createBoard();b.name=name;b.x=x;b.y=y;b.resize(w,h);b.fills=[{fillColor:colors.surface,fillOpacity:1}];b.borderRadius=12;return b;}
function rect(parent,name,x,y,w,h,color,r=0){const s=penpot.createRectangle();s.name=name;s.x=x+parent.x;s.y=y+parent.y;s.resize(w,h);s.fills=[{fillColor:color,fillOpacity:1}];s.borderRadius=r;parent.appendChild(s);return s;}
function text(parent,name,copy,x,y,w,h,size,color,weight='400'){const s=penpot.createText(copy);s.name=name;font.applyToText(s,font.variants.find(v=>v.fontWeight===weight&&v.fontStyle==='normal'));s.fontSize=String(size);s.fills=[{fillColor:color,fillOpacity:1}];s.resize(w,h);s.align='center';s.x=parent.x+x;s.y=parent.y+y;parent.appendChild(s);return s;}
function panel(name,x,width){const b=board(name,x,0,width,340);b.strokes=[{strokeColor:colors.border,strokeOpacity:1,strokeWidth:1,strokeAlignment:'inner',strokeStyle:'solid'}];
rect(b,'Icono / fondo',(width-56)/2,32,56,56,colors.tint,28);
text(b,'Icono / búsqueda','⌕',(width-48)/2,36,48,48,36,colors.primary);
text(b,'Título','Todavía no hemos encontrado tu hotel',24,108,width-48,56,width<500?20:24,colors.text,'600');
text(b,'Ayuda','Prueba otro destino o amplía los filtros para descubrir más opciones.',32,178,width-64,52,14,colors.muted);
rect(b,'Acción / fondo',(width-208)/2,260,208,44,colors.primary,8);
text(b,'Acción / etiqueta','Ver todos los hoteles',(width-208)/2,272,208,24,14,colors.surface,'600');
return b;}
const desktop=panel('Estado vacío / escritorio',0,800);
const mobile=panel('Estado vacío / móvil',880,360);
penpot.selection=[desktop,mobile];
return {fileId:penpot.currentFile.id,pageId:penpot.currentPage.id,desktop:desktop.id,mobile:mobile.id,tokens:penpotUtils.tokenOverview()};
```
