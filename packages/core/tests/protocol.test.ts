import {it,expect} from 'vitest';
import {parseMessage,isWechatImageURL} from '../src/protocol';
it('rejectsMalformedProtocolAndUnexpectedFields',()=>{
 expect(()=>parseMessage('{')).toThrow();expect(()=>parseMessage(JSON.stringify({version:2,type:'hello',requestId:'1',payload:{token:'a'}}))).toThrow();
 expect(()=>parseMessage(JSON.stringify({version:1,type:'upload-result',requestId:'1',payload:{key:'a',url:'javascript:bad'}}))).toThrow();
 expect(isWechatImageURL('https://mmbiz.qpic.cn/a')).toBe(true);expect(isWechatImageURL('https://mmbiz.qpic.cn.evil.test/a')).toBe(false);
});
