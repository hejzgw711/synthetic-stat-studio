import { useState, type FormEvent, type ReactNode } from 'react'

const AUTH_USERNAME = 'bigNBny'
const PASSWORD_SHA256 = 'a721200c375289479a02127718f6bc25b64c5a5e87a71ec9735f3e1842d34886'
const SESSION_KEY = 'synthetic-stat-studio-authenticated'
const PERSISTENT_SESSION_KEY = 'synthetic-stat-studio-authenticated-persistent'
const REMEMBER_KEY = 'synthetic-stat-studio-remember'

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function verifyCredentials(username: string, password: string) {
  if (username.trim() !== AUTH_USERNAME) return false
  return (await sha256(password)) === PASSWORD_SHA256
}

function hasSession() {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === '1' || window.localStorage.getItem(PERSISTENT_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function rememberedByDefault() {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === '1'
  } catch {
    return false
  }
}

function storeSession(remember: boolean) {
  try {
    if (remember) {
      window.localStorage.setItem(PERSISTENT_SESSION_KEY, '1')
      window.sessionStorage.removeItem(SESSION_KEY)
    } else {
      window.sessionStorage.setItem(SESSION_KEY, '1')
      window.localStorage.removeItem(PERSISTENT_SESSION_KEY)
    }
  } catch {
    try { window.sessionStorage.setItem(SESSION_KEY, '1') } catch { /* Storage is optional for this static gate. */ }
  }
}

export function clearAuthSession() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
    window.localStorage.removeItem(PERSISTENT_SESSION_KEY)
  } catch {
    // Continue even when browser storage is unavailable.
  }
}

export function AuthGate({ children }: { children: (onLogout: () => void) => ReactNode }) {
  const [authenticated, setAuthenticated] = useState(hasSession)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(rememberedByDefault)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setChecking(true)
    try {
      if (await verifyCredentials(username, password)) {
        storeSession(remember)
        setAuthenticated(true)
        setPassword('')
      } else {
        setError('账号或密码不正确')
      }
    } catch {
      setError('登录校验失败，请刷新页面后重试')
    } finally {
      setChecking(false)
    }
  }

  const logout = () => {
    clearAuthSession()
    setAuthenticated(false)
    setUsername('')
    setPassword('')
  }

  const changeRemember = (checked: boolean) => {
    setRemember(checked)
    try { window.localStorage.setItem(REMEMBER_KEY, checked ? '1' : '0') } catch { /* Preference is optional. */ }
  }

  if (authenticated) return <>{children(logout)}</>

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-mark">SYNTHETIC DATA STUDIO</div>
      <h1 id="auth-title">统计反推模拟数据生成器</h1>
      <p className="auth-subtitle">请输入账号密码进入本地模拟工作台</p>
      <form className="auth-form" onSubmit={submit}>
        <label className="auth-field"><span>账号</span><input autoFocus autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label className="auth-field"><span>密码</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label className="auth-remember"><input type="checkbox" checked={remember} onChange={(event) => changeRemember(event.target.checked)} /><span>在此浏览器保持登录</span></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={checking}>{checking ? '正在验证…' : '登录'}</button>
      </form>
      <p className="auth-footnote">仅限受邀使用者。数据在当前浏览器本地生成。</p>
    </section>
  </main>
}
