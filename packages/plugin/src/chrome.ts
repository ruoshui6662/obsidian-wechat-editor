import {setIcon,setTooltip} from 'obsidian';
/** Keep chrome icons and hover affordances consistent with the host. */
export function iconButton(button:HTMLButtonElement,icon:string,label:string){
 button.type='button';button.classList.add('wx-icon-button');button.setAttribute('aria-label',label);setIcon(button,icon);setTooltip(button,label);
}
