import authRouter from '../src/routes/auth'
import geographyRouter from '../src/routes/geography'

const list = (router: any, name: string) => {
  console.log('Router:', name)
  if (!router.stack) return console.log('  (no stack)')
  for (const layer of router.stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase()
      console.log(`  ${methods} ${layer.route.path}`)
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      console.log(`  subrouter ${layer.regexp}`)
    }
  }
}

list(authRouter, 'auth')
list(geographyRouter, 'geography')
