import {mountPopup} from './popup-view';
import type {AssistantState} from './assistant';
const ui=mountPopup(document,{send:message=>chrome.runtime.sendMessage(message),diagnostics:text=>navigator.clipboard.writeText(text),version:chrome.runtime.getManifest().version});
const changed=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&changes.assistantState?.newValue)ui.update(changes.assistantState.newValue as AssistantState);};
chrome.storage.onChanged.addListener(changed);
window.addEventListener('unload',()=>{chrome.storage.onChanged.removeListener(changed);ui.destroy()},{once:true});
