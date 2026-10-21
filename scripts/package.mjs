import {readFile,writeFile,mkdir,cp,rm,readdir,stat} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=resolve('.'),pkg=JSON.parse(await readFile('package.json','utf8')),version=pkg.version,tag='v'+version;
// macOS zip writes UTF-8 path bytes without the UTF-8 flag. Mark both headers so
// Windows and other standard ZIP readers preserve Chinese fixture filenames.
function markUTF8(bytes){
 let end=bytes.length-22;while(end>=0&&bytes.readUInt32LE(end)!==0x06054b50)end--;if(end<0)throw Error('Invalid ZIP directory');
 let pos=bytes.readUInt32LE(end+16);const count=bytes.readUInt16LE(end+10);
 for(let i=0;i<count;i++){if(bytes.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid ZIP entry');const local=bytes.readUInt32LE(pos+42);if(bytes.readUInt32LE(local)!==0x04034b50)throw Error('Invalid local ZIP entry');bytes.writeUInt16LE(bytes.readUInt16LE(pos+8)|0x800,pos+8);bytes.writeUInt16LE(bytes.readUInt16LE(local+6)|0x800,local+6);pos+=46+bytes.readUInt16LE(pos+28)+bytes.readUInt16LE(pos+30)+bytes.readUInt16LE(pos+32);}
 return bytes;
}
const plugin=resolve('dist/obsidian/wechat-layout'),extension=resolve('dist/extension'),vault=resolve('dist/test-vault');
for(const file of ['main.js','manifest.json','styles.css'])await stat(join(plugin,file));
for(const file of ['background.js','popup.js','manifest.json','popup.html','popup.css'])await stat(join(extension,file));
const seen=new Set();let notices='Third-party licenses for bundled runtime dependencies\n';
async function collect(name,from){
 const require=createRequire(join(from,'package.json'));let dir=dirname(require.resolve(name));
 while(true){try{const candidate=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));if(candidate.name===name)break;}catch{}const parent=dirname(dir);if(parent===dir)throw Error('Cannot locate license: '+name);dir=parent;}
 const meta=JSON.parse(await readFile(join(dir,'package.json'),'utf8')),key=name+'@'+meta.version;if(seen.has(key))return;seen.add(key);
 const files=(await readdir(dir)).filter(f=>/^(license|copying)([._-]|$)/i.test(f));if(!files.length)throw Error('License missing: '+key);
 notices+='\n\n=== '+key+' ('+meta.license+') ===\n';for(const f of files)notices+=await readFile(join(dir,f),'utf8');
 for(const dep of Object.keys(meta.dependencies??{}))await collect(dep,dir);
}
for(const dep of Object.keys(pkg.dependencies))await collect(dep,root);
await writeFile(join(plugin,'THIRD_PARTY_LICENSES.txt'),notices);
await rm(vault,{recursive:true,force:true});await mkdir(join(vault,'.obsidian/plugins'),{recursive:true});await cp('fixtures/vault',vault,{recursive:true});await cp(plugin,join(vault,'.obsidian/plugins/wechat-layout'),{recursive:true});
await writeFile(join(vault,'.obsidian/community-plugins.json'),JSON.stringify(['wechat-layout']));await writeFile(join(vault,'.obsidian/app.json'),'{}');await cp('docs/INSTALL.md',join(vault,'安装与试用.md'));
await mkdir('release',{recursive:true});const bundles=[['wechat-layout-'+tag+'.zip',dirname(plugin),'wechat-layout'],['wechat-layout-extension-'+tag+'.zip',dirname(extension),'extension'],['test-vault-'+tag+'.zip',dirname(vault),'test-vault']];let sums='';
for(const [name,cwd,folder]of bundles){const target=resolve('release',name);await rm(target,{force:true});execFileSync('/usr/bin/zip',['-q','-r',target,folder],{cwd});await writeFile(target,markUTF8(await readFile(target)));const entries=execFileSync('/usr/bin/unzip',['-Z1',target],{encoding:'utf8'}).trim().split('\n');if(entries.some(p=>/(?:^|\/)(?:data\.json|node_modules|\.DS_Store)(?:\/|$)|\.pdf$|\.map$/i.test(p)))throw Error('Unexpected private/development content in '+name);sums+=createHash('sha256').update(await readFile(target)).digest('hex')+'  '+name+'\n';console.log(name+' ('+(await stat(target)).size+' bytes)');}
await writeFile('release/SHA256SUMS.txt',sums);console.log('Packaged clean test Vault and install archives.');
