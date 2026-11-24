import { describe, expect, it } from 'vitest'
import { compareVersion, isVersionSupported, resolvePiPath } from './resolvePi'

describe('resolvePiPath', () => {
  it('prefers PIPER_PI_PATH', () => {
    expect(
      resolvePiPath({
        env: { PIPER_PI_PATH: '/custom/pi' },
        pathEnv: '/usr/bin',
        exists: (path) => path === '/custom/pi',
        platform: 'darwin'
      })
    ).toBe('/custom/pi')
  })

  it('falls back to PATH', () => {
    expect(
      resolvePiPath({
        env: {},
        pathEnv: '/opt/homebrew/bin:/usr/bin',
        exists: (path) => path === '/opt/homebrew/bin/pi',
        platform: 'darwin'
      })
    ).toBe('/opt/homebrew/bin/pi')
  })

  it('returns null when nothing is found', () => {
    expect(
      resolvePiPath({ env: {}, pathEnv: '/usr/bin', exists: () => false, platform: 'linux' })
    ).toBeNull()
  })

  it('uses pi.cmd on win32', () => {
    expect(
      resolvePiPath({
        env: {},
        pathEnv: 'C:\\tools',
        exists: (path) => path.toLowerCase().endsWith('pi.cmd'),
        platform: 'win32'
      })
    ).not.toBeNull()
  })
})

describe('versions', () => {
  it('compares dotted versions', () => {
    expect(compareVersion('1.6.0', '1.5.9')).toBeGreaterThan(0)
    expect(compareVersion('1.6.0', '1.6.0')).toBe(0)
    expect(compareVersion('1.6', '1.6.0')).toBe(0)
  })

  it('checks the minimum', () => {
    expect(isVersionSupported('1.6.0')).toBe(true)
    expect(isVersionSupported('2.0.1')).toBe(true)
    expect(isVersionSupported('1.5.9')).toBe(false)
    expect(isVersionSupported('invalid')).toBe(false)
  })
})
