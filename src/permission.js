import router from './router'
import { ElMessage } from 'element-plus'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { getToken } from '@/utils/auth'
import { isHttp, isPathMatch } from '@/utils/validate'
import { isRelogin } from '@/utils/request'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'
import usePermissionStore from '@/store/modules/permission'

NProgress.configure({ showSpinner: false })

const whiteList = ['/login', '/register']

const isWhiteList = (path) => {
  return whiteList.some(pattern => isPathMatch(pattern, path))
}

function firstVisibleMenuPath(routes, parentPath = '') {
  for (const route of routes || []) {
    if (route.hidden || !route.path || isHttp(route.path)) continue
    const path = route.path.startsWith('/') ? route.path : `${parentPath}/${route.path}`
    const fullPath = path.replace(/\/+/g, '/')
    if (route.children?.length) {
      const childPath = firstVisibleMenuPath(route.children, fullPath)
      if (childPath) return childPath
    } else if (route.component && fullPath !== '/' && fullPath !== '/index') {
      return fullPath
    }
  }
  return ''
}

const isHome = path => path === '/' || path === '/index'

router.beforeEach((to, from, next) => {
  NProgress.start()
  if (getToken()) {
    to.meta.title && useSettingsStore().setTitle(to.meta.title)
    /* has token*/
    if (to.path === '/login') {
      next({ path: '/' })
      NProgress.done()
    } else if (isWhiteList(to.path)) {
      next()
    } else {
      if (useUserStore().roles.length === 0) {
        isRelogin.show = true
        // 判断当前用户是否已拉取完user_info信息
        return useUserStore().getInfo().then(() => {
          isRelogin.show = false
          return usePermissionStore().generateRoutes().then(accessRoutes => {
            // 根据roles权限生成可访问的路由表
            accessRoutes.forEach(route => {
              if (!isHttp(route.path)) {
                router.addRoute(route) // 动态添加可访问路由表
              }
            })
            const homePath = isHome(to.path) ? firstVisibleMenuPath(accessRoutes) : ''
            next(homePath ? { path: homePath, replace: true } : { ...to, replace: true }) // 确保动态路由已添加
          })
        }).catch(err => {
          isRelogin.show = false
          return useUserStore().logOut().then(() => {
            ElMessage.error(err.message || err)
            next({ path: '/login', query: { redirect: to.fullPath } })
            NProgress.done()
          })
        })
      } else {
        const homePath = isHome(to.path) ? firstVisibleMenuPath(usePermissionStore().addRoutes) : ''
        if (homePath) next({ path: homePath, replace: true })
        else next()
      }
    }
  } else {
    // 没有token
    if (isWhiteList(to.path)) {
      // 在免登录白名单，直接进入
      next()
    } else {
      next(`/login?redirect=${to.fullPath}`) // 否则全部重定向到登录页
      NProgress.done()
    }
  }
})

router.afterEach(() => {
  NProgress.done()
})
