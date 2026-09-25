import {defineConfig,mergeConfig} from 'vite'
import original from './vite.config'
export default defineConfig(env=>mergeConfig(typeof original==='function'?original(env):original,{server:{port:5180,host:'127.0.0.1',open:false,proxy:{'/dev-api':{target:'http://127.0.0.1:8088',changeOrigin:true,rewrite:p=>p.replace(/^\/dev-api/,'')}}}}))
