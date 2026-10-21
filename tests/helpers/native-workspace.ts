// Only the Obsidian workspace boundary is simulated; views/panels run real code.
import type WechatLayoutPlugin from '../../packages/plugin/src/main';
export function nativeWorkspace(container:HTMLElement,file:any){
 const main={},left={},right={},groups:any[][]=[[]],leaves:any[]=[],factories=new Map<string,(leaf:any)=>any>();const splits:Array<{direction:string;before:boolean}>=[];let active:any;const readyCallbacks:Array<()=>void>=[];
 function leaf(group=groups[0],root=main){
  const item:any={type:'empty',root,group,view:{containerEl:container},getRoot:()=>root,getViewState:()=>({type:item.type,state:item.savedState??item.view.getState?.()??{}}),loadIfDeferred:async()=>{if(item.isDeferred)await item.setViewState(item.getViewState());},setViewState:async(state:any)=>{await item.view.onClose?.();item.view.contentEl?.remove();item.type=state.type;item.savedState=state.state;item.isDeferred=false;const factory=factories.get(state.type);if(!factory)throw Error('Unregistered view '+state.type);item.view=factory(item);item.view.containerEl=item.view.contentEl;document.body.append(item.view.contentEl);await item.view.onOpen();await item.view.setState?.(state.state??{},{});},detach:()=>{leaves.splice(leaves.indexOf(item),1);group.splice(group.indexOf(item),1);void item.view.onClose?.();item.view.contentEl?.remove();}};
  leaves.push(item);group.push(item);return item;
 }
 const editor=leaf();editor.type='markdown';
 const workspace={containerEl:container,leftSplit:left,rightSplit:right,getActiveFile:()=>file,getLeavesOfType:(type:string)=>leaves.filter(l=>l.type===type),getLeaf:(_kind:unknown)=>leaf(),getRightLeaf:()=>leaf([],right),createLeafBySplit:(source:any,direction:string,before=false)=>{splits.push({direction,before});const group:any[]=[];groups.splice(groups.indexOf(source.group)+(before?0:1),0,group);return leaf(group,source.root);},revealLeaf:async(item:any)=>{active=item;},iterateAllLeaves:(callback:(leaf:any)=>void)=>leaves.forEach(callback),on:()=>({}),onLayoutReady:(callback:()=>void)=>{readyCallbacks.push(callback);}};
 return{ready:()=>readyCallbacks.forEach(callback=>callback()),workspace,groups,leaves,splits,editor,active:()=>active,register:(plugin:WechatLayoutPlugin)=>{plugin.registerView=(type,create)=>{factories.set(type,create);};}};
}
