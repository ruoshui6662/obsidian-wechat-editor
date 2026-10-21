declare const __WECHAT_LAYOUT_VERSION__:string;
/** The running bundle version stays accurate even when only a manifest was updated. */
export function displayVersion(manifestVersion?:string){const build=typeof __WECHAT_LAYOUT_VERSION__==='string'?__WECHAT_LAYOUT_VERSION__:manifestVersion;return build?`v${build} · 本地验证`:'本地验证版';}
